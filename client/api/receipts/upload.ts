import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db';
import { verifyToken } from '../_lib/auth';
import ocrService from '../_lib/ocrService';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = verifyToken(req);

    // Handle base64 image upload
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is missing' });
    }
    const { image, imageUrl } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No receipt image provided' });
    }

    // Decode base64 image
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Process with OCR
    let ocrData;
    try {
      ocrData = await ocrService.processReceipt(imageBuffer);
    } catch (ocrError) {
      console.error('OCR processing failed:', ocrError);
      ocrData = {
        storeName: '', storeLocation: '', storeCity: '', storeState: '', storeZip: '',
        purchaseDate: new Date(), totalAmount: 0, items: [],
      };
    }

    // Use image as imageUrl if imageUrl is not provided (to avoid duplicate payload)
    const storedImageUrl = imageUrl || image;

    // If not authenticated, return guest mode response
    if (!userId) {
      return res.json({
        success: true,
        guestMode: true,
        data: { ...ocrData, imageUrl: storedImageUrl },
        message: 'Receipt processed! Create an account to save.',
      });
    }

    // Check for duplicate receipt (same store + date + total) — non-fatal
    let duplicate = null;
    try {
      if (ocrData.storeName && ocrData.purchaseDate && ocrData.totalAmount) {
        const dupCheck = await pool.query(
          `SELECT id, store_name, purchase_date, total_amount
           FROM receipts
           WHERE user_id = $1
             AND LOWER(store_name) = LOWER($2)
             AND purchase_date::date = $3::date
             AND ABS(total_amount - $4) < 0.01
           LIMIT 1`,
          [userId, ocrData.storeName, ocrData.purchaseDate, ocrData.totalAmount]
        );
        if (dupCheck.rows.length > 0) duplicate = dupCheck.rows[0];
      }
    } catch (dupError) {
      console.error('Duplicate check failed (non-fatal):', dupError);
    }

    // Create receipt in database
    const receiptResult = await pool.query(
      `INSERT INTO receipts (user_id, image_url, purchase_date, total_amount, store_name, store_location, store_city, store_state, store_zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, storedImageUrl, ocrData.purchaseDate, ocrData.totalAmount, ocrData.storeName,
       ocrData.storeLocation, ocrData.storeCity, ocrData.storeState, ocrData.storeZip]
    );
    const receipt = receiptResult.rows[0];

    // Save items using parameterized queries
    let savedItems: any[] = [];
    if (ocrData.items.length > 0) {
      for (let i = 0; i < ocrData.items.length; i++) {
        const item = ocrData.items[i];
        const result = await pool.query(
          `INSERT INTO items (receipt_id, name, unit_price, quantity, discount, total_price, category, item_order, item_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [receipt.id, item.name, item.unitPrice, item.quantity, item.discount || 0, item.totalPrice, null, item.item_order ?? i, item.itemNumber || null]
        );
        savedItems.push(result.rows[0]);
      }
    }

    return res.status(201).json({
      success: true,
      receiptId: receipt.id,
      imageUrl: imageUrl || '',
      duplicate,
      data: { ...receipt, items: savedItems },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to process receipt' });
  }
}
