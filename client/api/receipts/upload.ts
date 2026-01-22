import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import { verifyToken } from '../lib/auth';
import { processReceipt } from '../lib/ocrService';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
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
      ocrData = await processReceipt(imageBuffer);
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
          `INSERT INTO items (receipt_id, name, unit_price, quantity, total_price, category, item_order, item_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [receipt.id, item.name, item.unitPrice, item.quantity, item.totalPrice, null, item.item_order ?? i, item.itemNumber || null]
        );
        savedItems.push(result.rows[0]);
      }
    }

    return res.status(201).json({
      success: true,
      receiptId: receipt.id,
      imageUrl: imageUrl || '',
      data: { ...receipt, items: savedItems },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to process receipt' });
  }
}
