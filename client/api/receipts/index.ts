import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import { verifyToken } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { search, startDate, endDate, minAmount, maxAmount, category } = req.query;

    let query = `
      SELECT r.*,
        COALESCE(json_agg(
          json_build_object(
            'id', i.id, 'name', i.name, 'unit_price', i.unit_price,
            'quantity', i.quantity, 'total_price', i.total_price,
            'category', i.category, 'item_order', i.item_order, 'item_number', i.item_number
          ) ORDER BY i.item_order, i.id
        ) FILTER (WHERE i.id IS NOT NULL), '[]') as items
      FROM receipts r
      LEFT JOIN items i ON r.id = i.receipt_id
      WHERE r.user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (search) {
      query += ` AND (r.store_name ILIKE $${paramIndex} OR EXISTS (
        SELECT 1 FROM items WHERE receipt_id = r.id AND name ILIKE $${paramIndex}
      ))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (startDate) { query += ` AND r.purchase_date >= $${paramIndex}`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND r.purchase_date <= $${paramIndex}`; params.push(endDate); paramIndex++; }
    if (minAmount) { query += ` AND r.total_amount >= $${paramIndex}`; params.push(parseFloat(minAmount as string)); paramIndex++; }
    if (maxAmount) { query += ` AND r.total_amount <= $${paramIndex}`; params.push(parseFloat(maxAmount as string)); paramIndex++; }

    if (category) {
      query += ` AND EXISTS (SELECT 1 FROM items WHERE receipt_id = r.id AND category = $${paramIndex})`;
      params.push(category);
      paramIndex++;
    }

    query += ` GROUP BY r.id ORDER BY r.purchase_date DESC, r.upload_date DESC`;

    const result = await pool.query(query, params);

    return res.json({ success: true, receipts: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Get receipts error:', error);
    return res.status(500).json({ error: 'Failed to fetch receipts' });
  }
}
