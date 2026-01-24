import pool from '../config/database';

export interface Receipt {
  id: string;
  user_id: string;
  image_url: string;
  upload_date: Date;
  purchase_date: Date | null;
  total_amount: number;
  tax_amount?: number | null;
  store_name: string | null;
  store_location: string | null;
  store_city: string | null;
  store_state: string | null;
  store_zip: string | null;
}

export interface CreateReceiptData {
  user_id: string;
  image_url: string;
  purchase_date?: Date | null;
  total_amount?: number;
  tax_amount?: number | null;
  store_name?: string | null;
  store_location?: string | null;
  store_city?: string | null;
  store_state?: string | null;
  store_zip?: string | null;
}

export interface UpdateReceiptData {
  purchase_date?: Date | null;
  total_amount?: number;
  tax_amount?: number | null;
  store_name?: string | null;
  store_location?: string | null;
  store_city?: string | null;
  store_state?: string | null;
  store_zip?: string | null;
}

export const ReceiptModel = {
  async create(data: CreateReceiptData): Promise<Receipt> {
    const result = await pool.query(
      `INSERT INTO receipts (user_id, image_url, purchase_date, total_amount, tax_amount, store_name, store_location, store_city, store_state, store_zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.user_id,
        data.image_url,
        data.purchase_date || null,
        data.total_amount || 0,
        data.tax_amount || null,
        data.store_name || null,
        data.store_location || null,
        data.store_city || null,
        data.store_state || null,
        data.store_zip || null,
      ]
    );
    return result.rows[0];
  },

  async findByUserId(userId: string): Promise<Receipt[]> {
    const result = await pool.query(
      `SELECT * FROM receipts
       WHERE user_id = $1
       ORDER BY upload_date DESC`,
      [userId]
    );
    return result.rows;
  },

  async findById(id: string, userId: string): Promise<Receipt | null> {
    const result = await pool.query(
      'SELECT * FROM receipts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  },

  async update(id: string, userId: string, data: UpdateReceiptData): Promise<Receipt | null> {
    const fields: string[] = [];
    const values: (string | number | Date | null)[] = [];
    let paramCount = 1;

    if (data.purchase_date !== undefined) {
      fields.push(`purchase_date = $${paramCount++}`);
      values.push(data.purchase_date);
    }
    if (data.total_amount !== undefined) {
      fields.push(`total_amount = $${paramCount++}`);
      values.push(data.total_amount);
    }
    if (data.tax_amount !== undefined) {
      fields.push(`tax_amount = $${paramCount++}`);
      values.push(data.tax_amount);
    }
    if (data.store_name !== undefined) {
      fields.push(`store_name = $${paramCount++}`);
      values.push(data.store_name);
    }
    if (data.store_location !== undefined) {
      fields.push(`store_location = $${paramCount++}`);
      values.push(data.store_location);
    }
    if (data.store_city !== undefined) {
      fields.push(`store_city = $${paramCount++}`);
      values.push(data.store_city);
    }
    if (data.store_state !== undefined) {
      fields.push(`store_state = $${paramCount++}`);
      values.push(data.store_state);
    }
    if (data.store_zip !== undefined) {
      fields.push(`store_zip = $${paramCount++}`);
      values.push(data.store_zip);
    }

    if (fields.length === 0) {
      return this.findById(id, userId);
    }

    values.push(id, userId);

    const result = await pool.query(
      `UPDATE receipts
       SET ${fields.join(', ')}
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM receipts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },
};

export default ReceiptModel;
