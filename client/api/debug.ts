import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from './lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const checks: any = {
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      GOOGLE_CREDENTIALS_JSON: !!process.env.GOOGLE_CREDENTIALS_JSON,
    },
    database: 'not tested',
  };

  try {
    const result = await pool.query('SELECT NOW() as time');
    checks.database = { connected: true, time: result.rows[0].time };
  } catch (err: any) {
    checks.database = { connected: false, error: err.message };
  }

  return res.json(checks);
}
