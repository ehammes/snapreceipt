import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import { verifyToken } from '../lib/auth';

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

  try {
    const result = await pool.query(`
      SELECT TO_CHAR(purchase_date, 'YYYY-MM') as month, SUM(total_amount) as amount
      FROM receipts WHERE user_id = $1
      GROUP BY TO_CHAR(purchase_date, 'YYYY-MM')
      ORDER BY month ASC
    `, [userId]);

    const timeline = result.rows.map(row => ({
      month: formatMonth(row.month),
      amount: parseFloat(row.amount) || 0,
    }));

    return res.json({ success: true, timeline });
  } catch (error) {
    console.error('Spending timeline error:', error);
    return res.status(500).json({ error: 'Failed to fetch spending timeline' });
  }
}
