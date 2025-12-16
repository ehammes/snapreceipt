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
        // Guest mode - return data without saving
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
        store_name: ocrData.storeName,
        store_location: ocrData.storeLocation,
        store_city: ocrData.storeCity,
        store_state: ocrData.storeState,
        store_zip: ocrData.storeZip,
      });

      // Save items as batch
      let savedItems: any[] = [];
      if (ocrData.items.length > 0) {
        const itemsToCreate = ocrData.items.map(item => ({
          receipt_id: receipt.id,
          name: item.name,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          total_price: item.totalPrice,
          category: null,
        }));
        savedItems = await ItemModel.createBatch(itemsToCreate);

        // Recalculate total from items
        const calculatedTotal = savedItems.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
        await ReceiptModel.update(receipt.id, req.userId, { total_amount: calculatedTotal });
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
    } finally {
      // Clean up temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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
            'category', i.category
          )
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

    query += ` GROUP BY r.id ORDER BY r.upload_date DESC`;

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
    const { storeName, storeLocation, storeCity, storeState, storeZip, purchaseDate } = req.body;

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
