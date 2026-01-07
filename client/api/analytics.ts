import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './lib/db';
import { verifyToken } from './lib/auth';

function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { type } = req.query;

  try {
    if (type === 'spending-timeline') {
      const result = await pool.query(`
        SELECT TO_CHAR(purchase_date, 'YYYY-MM') as month, SUM(total_amount) as amount
        FROM receipts WHERE user_id = $1
        GROUP BY TO_CHAR(purchase_date, 'YYYY-MM') ORDER BY month ASC
      `, [userId]);
      const timeline = result.rows.map(row => ({ month: formatMonth(row.month), amount: parseFloat(row.amount) || 0 }));
      return res.json({ success: true, timeline });

    } else if (type === 'top-items') {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await pool.query(`
        SELECT i.name, SUM(i.quantity) as quantity, SUM(i.total_price) as total_spent,
          COUNT(DISTINCT r.id) as purchase_count,
          MODE() WITHIN GROUP (ORDER BY i.category) as category,
          MODE() WITHIN GROUP (ORDER BY i.item_number) as item_number,
          MAX(r.purchase_date) as last_purchased,
          (SELECT i2.unit_price FROM items i2 JOIN receipts r2 ON i2.receipt_id = r2.id
           WHERE r2.user_id = $1 AND i2.name = i.name ORDER BY r2.purchase_date DESC LIMIT 1) as latest_price,
          (SELECT i3.unit_price FROM items i3 JOIN receipts r3 ON i3.receipt_id = r3.id
           WHERE r3.user_id = $1 AND i3.name = i.name ORDER BY r3.purchase_date ASC LIMIT 1) as first_price
        FROM items i JOIN receipts r ON i.receipt_id = r.id WHERE r.user_id = $1
        GROUP BY i.name ORDER BY quantity DESC, total_spent DESC LIMIT $2
      `, [userId, limit]);
      const topItems = result.rows.map(row => {
        const latestPrice = parseFloat(row.latest_price) || 0;
        const firstPrice = parseFloat(row.first_price) || 0;
        let priceChange = 0;
        if (firstPrice > 0 && latestPrice > 0) priceChange = ((latestPrice - firstPrice) / firstPrice) * 100;
        return {
          name: row.name, quantity: parseInt(row.quantity) || 0, totalSpent: parseFloat(row.total_spent) || 0,
          purchaseCount: parseInt(row.purchase_count) || 0, category: row.category || 'Uncategorized',
          itemNumber: row.item_number || '', lastPurchased: row.last_purchased, priceChange: Math.round(priceChange * 10) / 10,
        };
      });
      return res.json({ success: true, topItems });

    } else if (type === 'category-breakdown') {
      const result = await pool.query(`
        SELECT COALESCE(i.category, 'Uncategorized') as category, SUM(i.total_price) as total_spent, COUNT(*) as item_count
        FROM items i JOIN receipts r ON i.receipt_id = r.id WHERE r.user_id = $1
        GROUP BY COALESCE(i.category, 'Uncategorized') ORDER BY total_spent DESC
      `, [userId]);
      const categories = result.rows.map(row => ({
        category: row.category, totalSpent: parseFloat(row.total_spent) || 0, itemCount: parseInt(row.item_count) || 0,
      }));
      return res.json({ success: true, categories });

    } else if (type === 'summary-metrics') {
      const receiptResult = await pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) as total_spent, COUNT(*) as total_receipts
        FROM receipts WHERE user_id = $1 AND total_amount > 0
      `, [userId]);
      const receiptRow = receiptResult.rows[0];
      const totalSpent = parseFloat(receiptRow.total_spent) || 0;
      const totalReceipts = parseInt(receiptRow.total_receipts) || 0;
      const averagePerReceipt = totalReceipts > 0 ? totalSpent / totalReceipts : 0;

      const itemResult = await pool.query(`
        SELECT COALESCE(SUM(i.quantity), 0) as total_items, COUNT(DISTINCT LOWER(i.name)) as unique_items
        FROM items i JOIN receipts r ON i.receipt_id = r.id WHERE r.user_id = $1 AND r.total_amount > 0
      `, [userId]);
      const itemRow = itemResult.rows[0];
      return res.json({
        totalSpent, totalItems: parseInt(itemRow.total_items) || 0, uniqueItems: parseInt(itemRow.unique_items) || 0,
        totalReceipts, averagePerReceipt: Math.round(averagePerReceipt * 100) / 100,
      });

    } else if (type === 'summary') {
      const result = await pool.query(`
        SELECT COUNT(DISTINCT r.id) as total_receipts, COALESCE(SUM(r.total_amount), 0) as total_spent,
          COUNT(DISTINCT i.name) as unique_items, COALESCE(AVG(r.total_amount), 0) as avg_receipt,
          MIN(r.purchase_date) as first_purchase, MAX(r.purchase_date) as last_purchase
        FROM receipts r LEFT JOIN items i ON r.id = i.receipt_id WHERE r.user_id = $1
      `, [userId]);
      const row = result.rows[0];
      return res.json({
        success: true,
        summary: {
          totalReceipts: parseInt(row.total_receipts) || 0, totalSpent: parseFloat(row.total_spent) || 0,
          uniqueItems: parseInt(row.unique_items) || 0, avgReceipt: parseFloat(row.avg_receipt) || 0,
          firstPurchase: row.first_purchase, lastPurchase: row.last_purchase,
        },
      });

    } else {
      return res.status(400).json({ error: 'Invalid type. Use ?type=spending-timeline|top-items|category-breakdown|summary-metrics|summary' });
    }
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
