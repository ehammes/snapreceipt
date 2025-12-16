import pool from '../config/database';

export interface Item {
  id: string;
  receipt_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  category: string | null;
}

export interface CreateItemData {
  receipt_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  category?: string | null;
}

export const ItemModel = {
  async create(data: CreateItemData): Promise<Item> {
    const result = await pool.query(
      `INSERT INTO items (receipt_id, name, unit_price, quantity, total_price, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.receipt_id,
        data.name,
        data.unit_price,
        data.quantity,
        data.total_price,
        data.category || null,
      ]
    );
    return result.rows[0];
  },

  async findByReceiptId(receiptId: string): Promise<Item[]> {
    const result = await pool.query(
      'SELECT * FROM items WHERE receipt_id = $1 ORDER BY name',
      [receiptId]
    );
    return result.rows;
  },

  async createBatch(items: CreateItemData[]): Promise<Item[]> {
    if (items.length === 0) {
      return [];
    }

    const values: (string | number | null)[] = [];
    const placeholders: string[] = [];
    let paramCount = 1;

    for (const item of items) {
      placeholders.push(
        `($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`
      );
      values.push(
        item.receipt_id,
        item.name,
        item.unit_price,
        item.quantity,
        item.total_price,
        item.category || null
      );
    }

    const result = await pool.query(
      `INSERT INTO items (receipt_id, name, unit_price, quantity, total_price, category)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values
    );
    return result.rows;
  },

  async deleteByReceiptId(receiptId: string): Promise<number> {
    const result = await pool.query(
      'DELETE FROM items WHERE receipt_id = $1',
      [receiptId]
    );
    return result.rowCount ?? 0;
  },
};

export default ItemModel;
