import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { ocrService } from '../services/ocrService';
import ReceiptModel from '../models/Receipt';
import ItemModel from '../models/Item';
import pool from '../config/database';

const router = Router();

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Helper function - placeholder for cloud upload
// TODO: Integrate AWS S3 or Cloudinary for production
const uploadToCloud = (file: Express.Multer.File): string => {
  return `/uploads/${file.filename}`;
};

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
router.post('/upload', upload.single('receipt'), optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({ error: 'No receipt file uploaded' });
      return;
    }

    const filePath = req.file.path;

    try {
      // Read file as buffer
      const imageBuffer = fs.readFileSync(filePath);

      // Process with OCR
      let ocrData;
      try {
        ocrData = await ocrService.processReceipt(imageBuffer);
      } catch (ocrError) {
        console.error('OCR processing failed:', ocrError);
        // Use default empty structure on OCR failure
        ocrData = {
          storeName: 'Costco',
          storeLocation: '',
          storeCity: '',
          storeState: '',
          storeZip: '',
          purchaseDate: new Date(),
          totalAmount: 0,
          items: [],
        };
      }

      // Get image URL (placeholder for now)
      const imageUrl = uploadToCloud(req.file);

      // Check if user is authenticated
      if (!req.userId) {
        // Guest mode - return data without saving, clean up file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
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

      // Authenticated mode - keep the file and save to database
      const receipt = await ReceiptModel.create({
        user_id: req.userId,
        image_url: imageUrl,
        purchase_date: ocrData.purchaseDate,
        total_amount: ocrData.totalAmount,
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
          total_price: item.totalPrice,
          category: null,
          item_order: item.item_order ?? index,  // Use OCR order or fallback to array index
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
    } catch (innerError) {
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw innerError;
    }
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
            'total_price', i.total_price,
            'category', i.category,
            'item_order', i.item_order
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
    const { name, unitPrice, quantity, category } = req.body;

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

    // Calculate total price
    const totalPrice = parseFloat(unitPrice) * parseInt(quantity);

    // Create item
    const newItem = await ItemModel.create({
      receipt_id: id,
      name,
      unit_price: parseFloat(unitPrice),
      quantity: parseInt(quantity),
      total_price: totalPrice,
      category: category || null,
    });

    // Recalculate receipt total
    const allItems = await ItemModel.findByReceiptId(id);
    const newTotal = allItems.reduce((sum, item) => sum + parseFloat(String(item.total_price)), 0);
    await ReceiptModel.update(id, userId, { total_amount: newTotal });

    // Get updated receipt
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
      store_name: storeName || 'Costco',
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

// PUT /api/receipts/:id/items/:itemId - Update an item
router.put('/:id/items/:itemId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id, itemId } = req.params;
    const { name, unitPrice, quantity, category } = req.body;

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(id, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Verify item exists
    const existingItem = await ItemModel.findById(itemId, id);
    if (!existingItem) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (unitPrice !== undefined) updateData.unit_price = parseFloat(unitPrice);
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (category !== undefined) updateData.category = category || null;

    // Calculate total_price if unitPrice or quantity changed
    const newUnitPrice = updateData.unit_price ?? existingItem.unit_price;
    const newQuantity = updateData.quantity ?? existingItem.quantity;
    updateData.total_price = newUnitPrice * newQuantity;

    // Update item
    const updatedItem = await ItemModel.update(itemId, id, updateData);

    // Recalculate receipt total
    const allItems = await ItemModel.findByReceiptId(id);
    const newTotal = allItems.reduce((sum, item) => sum + parseFloat(String(item.total_price)), 0);
    await ReceiptModel.update(id, userId, { total_amount: newTotal });

    res.json({
      success: true,
      item: updatedItem,
      newReceiptTotal: newTotal,
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/receipts/:id/items/:itemId - Delete an item
router.delete('/:id/items/:itemId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id, itemId } = req.params;

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(id, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Verify item exists
    const existingItem = await ItemModel.findById(itemId, id);
    if (!existingItem) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Delete item
    await ItemModel.delete(itemId, id);

    // Recalculate receipt total
    const allItems = await ItemModel.findByReceiptId(id);
    const newTotal = allItems.reduce((sum, item) => sum + parseFloat(String(item.total_price)), 0);
    await ReceiptModel.update(id, userId, { total_amount: newTotal });

    res.json({
      success: true,
      message: 'Item deleted',
      newReceiptTotal: newTotal,
    });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
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
