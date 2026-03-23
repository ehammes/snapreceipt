import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import pool from '../config/database';
import { sendSpendingSummary } from '../services/emailService';

const router = Router();

// POST /api/email/send-summary — send spending summary to the authenticated user
router.post('/send-summary', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    // Get user email
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const email = userResult.rows[0].email;

    // Total spent + receipt count
    const metricsResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_spent, COUNT(*) as receipt_count
       FROM receipts WHERE user_id = $1 AND total_amount > 0`,
      [userId]
    );
    const totalSpent = parseFloat(metricsResult.rows[0].total_spent) || 0;
    const receiptCount = parseInt(metricsResult.rows[0].receipt_count) || 0;

    // Category breakdown
    const categoryResult = await pool.query(
      `SELECT COALESCE(i.category, 'Uncategorized') as category, SUM(i.total_price) as total_spent
       FROM items i JOIN receipts r ON i.receipt_id = r.id
       WHERE r.user_id = $1
       GROUP BY COALESCE(i.category, 'Uncategorized')
       ORDER BY total_spent DESC
       LIMIT 5`,
      [userId]
    );
    const categoryBreakdown = categoryResult.rows.map(row => ({
      category: row.category,
      totalSpent: parseFloat(row.total_spent) || 0,
    }));

    // Top items
    const itemsResult = await pool.query(
      `SELECT i.name, SUM(i.total_price) as total_spent, COUNT(DISTINCT r.id) as purchase_count
       FROM items i JOIN receipts r ON i.receipt_id = r.id
       WHERE r.user_id = $1
       GROUP BY i.name
       ORDER BY total_spent DESC
       LIMIT 3`,
      [userId]
    );
    const topItems = itemsResult.rows.map(row => ({
      name: row.name,
      totalSpent: parseFloat(row.total_spent) || 0,
      purchaseCount: parseInt(row.purchase_count) || 0,
    }));

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    await sendSpendingSummary(email, { totalSpent, receiptCount, categoryBreakdown, topItems, frontendUrl });

    res.json({ success: true });
  } catch (error) {
    console.error('Email summary error:', error);
    res.status(500).json({ error: 'Failed to send summary email' });
  }
});

export default router;
