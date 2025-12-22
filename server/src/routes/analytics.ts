import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import pool from '../config/database';

const router = Router();

// GET /api/analytics/spending-timeline - Monthly spending data
router.get('/spending-timeline', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT
        TO_CHAR(purchase_date, 'YYYY-MM') as month,
        SUM(total_amount) as amount
      FROM receipts
      WHERE user_id = $1
      GROUP BY TO_CHAR(purchase_date, 'YYYY-MM')
      ORDER BY month ASC
    `;

    const result = await pool.query(query, [userId]);

    // Format the data
    const timeline = result.rows.map(row => ({
      month: formatMonth(row.month),
      amount: parseFloat(row.amount) || 0,
    }));

    res.json({ success: true, timeline });
  } catch (error) {
    console.error('Spending timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch spending timeline' });
  }
});

// GET /api/analytics/top-items - Most purchased items
router.get('/top-items', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 10;

    const query = `
      SELECT
        i.name,
        SUM(i.quantity) as quantity,
        SUM(i.total_price) as total_spent,
        COUNT(DISTINCT r.id) as purchase_count
      FROM items i
      JOIN receipts r ON i.receipt_id = r.id
      WHERE r.user_id = $1
      GROUP BY i.name
      ORDER BY quantity DESC, total_spent DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [userId, limit]);

    const topItems = result.rows.map(row => ({
      name: truncateName(row.name, 20),
      quantity: parseInt(row.quantity) || 0,
      totalSpent: parseFloat(row.total_spent) || 0,
      purchaseCount: parseInt(row.purchase_count) || 0,
    }));

    res.json({ success: true, topItems });
  } catch (error) {
    console.error('Top items error:', error);
    res.status(500).json({ error: 'Failed to fetch top items' });
  }
});

// GET /api/analytics/category-breakdown - Spending by category
router.get('/category-breakdown', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT
        COALESCE(i.category, 'Uncategorized') as category,
        SUM(i.total_price) as total_spent,
        COUNT(*) as item_count
      FROM items i
      JOIN receipts r ON i.receipt_id = r.id
      WHERE r.user_id = $1
      GROUP BY COALESCE(i.category, 'Uncategorized')
      ORDER BY total_spent DESC
    `;

    const result = await pool.query(query, [userId]);

    const categories = result.rows.map(row => ({
      category: row.category,
      totalSpent: parseFloat(row.total_spent) || 0,
      itemCount: parseInt(row.item_count) || 0,
    }));

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Category breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch category breakdown' });
  }
});

// GET /api/analytics/summary - Overall summary stats
router.get('/summary', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT
        COUNT(DISTINCT r.id) as total_receipts,
        COALESCE(SUM(r.total_amount), 0) as total_spent,
        COUNT(DISTINCT i.name) as unique_items,
        COALESCE(AVG(r.total_amount), 0) as avg_receipt,
        MIN(r.purchase_date) as first_purchase,
        MAX(r.purchase_date) as last_purchase
      FROM receipts r
      LEFT JOIN items i ON r.id = i.receipt_id
      WHERE r.user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    const row = result.rows[0];

    res.json({
      success: true,
      summary: {
        totalReceipts: parseInt(row.total_receipts) || 0,
        totalSpent: parseFloat(row.total_spent) || 0,
        uniqueItems: parseInt(row.unique_items) || 0,
        avgReceipt: parseFloat(row.avg_receipt) || 0,
        firstPurchase: row.first_purchase,
        lastPurchase: row.last_purchase,
      },
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Helper: Format month from YYYY-MM to readable format
function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

// Helper: Truncate long item names
function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

export default router;
