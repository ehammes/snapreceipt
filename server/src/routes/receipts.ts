import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { ocrService } from '../services/ocrService';
import ReceiptModel from '../models/Receipt';
import ItemModel from '../models/Item';
import pool from '../config/database';

const router = Router();

// Optional auth middleware - extracts userId if token present, continues if not
const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token - continue as guest
    next();
    return;
  }

  // Try to authenticate
  authenticate(req, res, next);
};

// POST /api/receipts/upload - Upload and process receipt (guest or authenticated)
router.post('/upload', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // Accept base64 image from JSON body
    const { image } = req.body;

    if (!image) {
      res.status(400).json({ error: 'No receipt image provided' });
      return;
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Process with OCR
    let ocrData;
    try {
      ocrData = await ocrService.processReceipt(imageBuffer);
    } catch (ocrError) {
      console.error('OCR processing failed:', ocrError);
      // Use default empty structure on OCR failure
      ocrData = {
        storeName: '',
        storeLocation: '',
        storeCity: '',
        storeState: '',
        storeZip: '',
        purchaseDate: new Date(),
        totalAmount: 0,
        items: [],
      };
    }

    // Save image to file and get URL
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, imageBuffer);
    const imageUrl = `/uploads/${filename}`;

    // Check if user is authenticated
    if (!req.userId) {
      // Guest mode - return data without saving (keep file for preview)
      res.json({
        success: true,
        guestMode: true,
        data: {
          ...ocrData,
          imageUrl,
        },
        message: 'Receipt processed! Create an account to save.',
      });
      return;
    }

    // Authenticated mode - save to database
    const receipt = await ReceiptModel.create({
      user_id: req.userId,
      image_url: imageUrl,
      purchase_date: ocrData.purchaseDate,
      total_amount: ocrData.totalAmount,
      tax_amount: ocrData.taxAmount,
      store_name: ocrData.storeName,
      store_location: ocrData.storeLocation,
      store_city: ocrData.storeCity,
      store_state: ocrData.storeState,
      store_zip: ocrData.storeZip,
    });

    // Save items as batch
    let savedItems: any[] = [];
    if (ocrData.items.length > 0) {
      const itemsToCreate = ocrData.items.map((item, index) => ({
        receipt_id: receipt.id,
        name: item.name,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        discount: item.discount || 0,
        total_price: item.totalPrice,
        category: null,
        item_order: item.item_order ?? index,  // Use OCR order or fallback to array index
        item_number: item.itemNumber || null,  // Product ID from receipt
      }));
      savedItems = await ItemModel.createBatch(itemsToCreate);

      // Only recalculate total from items if OCR didn't find a total (includes tax)
      // Keep the OCR total if it was found - it's more accurate and includes tax
      if (!ocrData.totalAmount || ocrData.totalAmount === 0) {
        const calculatedTotal = savedItems.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
        await ReceiptModel.update(receipt.id, req.userId, { total_amount: calculatedTotal });
      }
    }

    res.status(201).json({
      success: true,
      receiptId: receipt.id,
      imageUrl,
      data: {
        ...receipt,
        items: savedItems,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process receipt' });
  }
});

// GET /api/receipts - Get all receipts for user with filtering
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { search, startDate, endDate, minAmount, maxAmount, category } = req.query;

    // Build query with filters
    let query = `
      SELECT r.*,
        COALESCE(json_agg(
          json_build_object(
            'id', i.id,
            'name', i.name,
            'unit_price', i.unit_price,
            'quantity', i.quantity,
            'discount', i.discount,
            'total_price', i.total_price,
            'category', i.category,
            'item_order', i.item_order,
            'item_number', i.item_number
          )
          ORDER BY i.item_order, i.id
        ) FILTER (WHERE i.id IS NOT NULL), '[]') as items
      FROM receipts r
      LEFT JOIN items i ON r.id = i.receipt_id
      WHERE r.user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    // Add search filter
    if (search) {
      query += ` AND (r.store_name ILIKE $${paramIndex} OR EXISTS (
        SELECT 1 FROM items WHERE receipt_id = r.id AND name ILIKE $${paramIndex}
      ))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add date range filters
    if (startDate) {
      query += ` AND r.purchase_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND r.purchase_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Add amount range filters
    if (minAmount) {
      query += ` AND r.total_amount >= $${paramIndex}`;
      params.push(parseFloat(minAmount as string));
      paramIndex++;
    }
    if (maxAmount) {
      query += ` AND r.total_amount <= $${paramIndex}`;
      params.push(parseFloat(maxAmount as string));
      paramIndex++;
    }

    // Add category filter
    if (category) {
      query += ` AND EXISTS (
        SELECT 1 FROM items WHERE receipt_id = r.id AND category = $${paramIndex}
      )`;
      params.push(category);
      paramIndex++;
    }

    query += ` GROUP BY r.id ORDER BY r.purchase_date DESC, r.upload_date DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      receipts: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// GET /api/receipts/:id - Get single receipt with items
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Get receipt
    const receipt = await ReceiptModel.findById(id, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Get items for receipt
    const items = await ItemModel.findByReceiptId(id);

    res.json({
      success: true,
      receipt: {
        ...receipt,
        items,
      },
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// POST /api/receipts/:id/items - Add item to receipt
router.post('/:id/items', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, unitPrice, quantity, discount, category } = req.body;

    // Validate required fields
    if (!name || unitPrice === undefined || quantity === undefined) {
      res.status(400).json({ error: 'Name, unitPrice, and quantity are required' });
      return;
    }

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(id, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Calculate total price (unit price * quantity - discount)
    const discountAmount = parseFloat(discount) || 0;
    const totalPrice = Math.round((parseFloat(unitPrice) * parseInt(quantity) - discountAmount) * 100) / 100;

    // Create item
    const newItem = await ItemModel.create({
      receipt_id: id,
      name,
      unit_price: parseFloat(unitPrice),
      quantity: parseInt(quantity),
      discount: discountAmount,
      total_price: totalPrice,
      category: category || null,
    });

    // Note: We don't recalculate receipt total here because:
    // 1. The OCR-extracted total includes tax, which item sum doesn't
    // 2. User may have manually set the total
    // User can edit total manually if needed

    // Get all items for response
    const allItems = await ItemModel.findByReceiptId(id);
    const updatedReceipt = await ReceiptModel.findById(id, userId);

    res.status(201).json({
      success: true,
      item: newItem,
      receipt: {
        ...updatedReceipt,
        items: allItems,
      },
    });
  } catch (error) {
    console.error('Add item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// PUT /api/receipts/:id/items/:itemId - Update item
router.put('/:id/items/:itemId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id, itemId } = req.params;
    const { name, unitPrice, quantity, discount, category } = req.body;

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(id, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Verify item exists and belongs to this receipt
    const existingItem = await ItemModel.findById(itemId, id);
    if (!existingItem) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Build update object with provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (unitPrice !== undefined) updateData.unit_price = parseFloat(unitPrice);
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (discount !== undefined) updateData.discount = parseFloat(discount);
    if (category !== undefined) updateData.category = category;

    // Recalculate total price if unit price, quantity, or discount changed
    if (unitPrice !== undefined || quantity !== undefined || discount !== undefined) {
      const finalUnitPrice = unitPrice !== undefined ? parseFloat(unitPrice) : existingItem.unit_price;
      const finalQuantity = quantity !== undefined ? parseInt(quantity) : existingItem.quantity;
      const finalDiscount = discount !== undefined ? parseFloat(discount) : existingItem.discount;
      updateData.total_price = Math.round((finalUnitPrice * finalQuantity - finalDiscount) * 100) / 100;
    }

    // Update item
    const updatedItem = await ItemModel.update(itemId, id, updateData);

    if (!updatedItem) {
      res.status(500).json({ error: 'Failed to update item' });
      return;
    }

    res.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// PATCH /api/receipts/:id - Update receipt details
router.patch('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { storeName, storeLocation, storeCity, storeState, storeZip, purchaseDate, totalAmount } = req.body;

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(id, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (storeName !== undefined) updateData.store_name = storeName;
    if (storeLocation !== undefined) updateData.store_location = storeLocation;
    if (storeCity !== undefined) updateData.store_city = storeCity;
    if (storeState !== undefined) updateData.store_state = storeState;
    if (storeZip !== undefined) updateData.store_zip = storeZip;
    if (purchaseDate !== undefined) updateData.purchase_date = purchaseDate;
    if (totalAmount !== undefined) updateData.total_amount = parseFloat(totalAmount);

    // Update receipt
    const updatedReceipt = await ReceiptModel.update(id, userId, updateData);

    // Get items
    const items = await ItemModel.findByReceiptId(id);

    res.json({
      success: true,
      receipt: {
        ...updatedReceipt,
        items,
      },
    });
  } catch (error) {
    console.error('Update receipt error:', error);
    res.status(500).json({ error: 'Failed to update receipt' });
  }
});

// POST /api/receipts/save-guest - Save guest receipt to user account
router.post('/save-guest', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { guestReceiptData } = req.body;

    if (!guestReceiptData) {
      res.status(400).json({ error: 'No guest receipt data provided' });
      return;
    }

    const {
      imageUrl,
      storeName,
      storeLocation,
      storeCity,
      storeState,
      storeZip,
      purchaseDate,
      totalAmount,
      items,
    } = guestReceiptData;

    // Create the receipt
    const receipt = await ReceiptModel.create({
      user_id: userId,
      image_url: imageUrl || '',
      purchase_date: purchaseDate ? new Date(purchaseDate) : new Date(),
      total_amount: totalAmount || 0,
      store_name: storeName || '',
      store_location: storeLocation || '',
      store_city: storeCity || '',
      store_state: storeState || '',
      store_zip: storeZip || '',
    });

    // Save items if present
    let savedItems: any[] = [];
    if (items && items.length > 0) {
      const itemsToCreate = items.map((item: any, index: number) => ({
        receipt_id: receipt.id,
        name: item.name,
        unit_price: item.unitPrice || 0,
        quantity: item.quantity || 1,
        total_price: item.totalPrice || 0,
        category: item.category || null,
        item_order: item.item_order ?? index,  // Use provided order or array index
        item_number: item.itemNumber || null,
      }));
      savedItems = await ItemModel.createBatch(itemsToCreate);

      // Recalculate total from items
      const calculatedTotal = savedItems.reduce(
        (sum, item) => sum + parseFloat(item.total_price),
        0
      );
      await ReceiptModel.update(receipt.id, userId, { total_amount: calculatedTotal });
    }

    res.status(201).json({
      success: true,
      receiptId: receipt.id,
      message: 'Guest receipt saved to your account',
    });
  } catch (error) {
    console.error('Save guest receipt error:', error);
    res.status(500).json({ error: 'Failed to save guest receipt' });
  }
});

// DELETE /api/receipts/:id - Delete receipt and all items
router.delete('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(id, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Delete receipt (items cascade delete)
    const deleted = await ReceiptModel.delete(id, userId);

    if (deleted) {
      res.json({ success: true, message: 'Receipt deleted' });
    } else {
      res.status(500).json({ error: 'Failed to delete receipt' });
    }
  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

export default router;
