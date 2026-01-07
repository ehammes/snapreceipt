import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import { verifyToken } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is missing' });
    }
    const { guestReceiptData } = req.body;

    if (!guestReceiptData) {
      return res.status(400).json({ error: 'No guest receipt data provided' });
    }

    const {
      imageUrl, storeName, storeLocation, storeCity, storeState, storeZip,
      purchaseDate, totalAmount, items,
    } = guestReceiptData;

    // Create receipt
    const receiptResult = await pool.query(
      `INSERT INTO receipts (user_id, image_url, purchase_date, total_amount, store_name, store_location, store_city, store_state, store_zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, imageUrl || '', purchaseDate ? new Date(purchaseDate) : new Date(),
       totalAmount || 0, storeName || '', storeLocation || '', storeCity || '', storeState || '', storeZip || '']
    );
    const receipt = receiptResult.rows[0];

    // Save items
    if (items && items.length > 0) {
      const itemValues = items.map((item: any, index: number) =>
        `('${receipt.id}', '${(item.name || '').replace(/'/g, "''")}', ${item.unitPrice || 0}, ${item.quantity || 1}, ${item.totalPrice || 0}, ${item.category ? `'${item.category}'` : 'NULL'}, ${item.item_order ?? index}, ${item.itemNumber ? `'${item.itemNumber}'` : 'NULL'})`
      ).join(', ');

      await pool.query(
        `INSERT INTO items (receipt_id, name, unit_price, quantity, total_price, category, item_order, item_number)
         VALUES ${itemValues}`
      );
    }

    return res.status(201).json({
      success: true,
      receiptId: receipt.id,
      message: 'Guest receipt saved to your account',
    });
  } catch (error) {
    console.error('Save guest receipt error:', error);
    return res.status(500).json({ error: 'Failed to save guest receipt' });
  }
}
