import pool from '../config/database';

export interface Item {
  id: string;
  receipt_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  category: string | null;
  item_order: number;
}

export interface CreateItemData {
  receipt_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  category?: string | null;
  item_order?: number;
}

export const ItemModel = {
  async create(data: CreateItemData): Promise<Item> {
    const result = await pool.query(
      `INSERT INTO items (receipt_id, name, unit_price, quantity, total_price, category, item_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.receipt_id,
        data.name,
        data.unit_price,
        data.quantity,
        data.total_price,
        data.category || null,
        data.item_order ?? 0,
      ]
    );
    return result.rows[0];
  },

  async findByReceiptId(receiptId: string): Promise<Item[]> {
    const result = await pool.query(
      'SELECT * FROM items WHERE receipt_id = $1 ORDER BY item_order, id',
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

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      placeholders.push(
        `($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`
      );
      values.push(
        item.receipt_id,
        item.name,
        item.unit_price,
        item.quantity,
        item.total_price,
        item.category || null,
        item.item_order ?? idx  // Use provided order or array index as fallback
      );
    }

    const result = await pool.query(
      `INSERT INTO items (receipt_id, name, unit_price, quantity, total_price, category, item_order)
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

  async findById(id: string, receiptId: string): Promise<Item | null> {
    const result = await pool.query(
      'SELECT * FROM items WHERE id = $1 AND receipt_id = $2',
      [id, receiptId]
    );
    return result.rows[0] || null;
  },

  async update(
    id: string,
    receiptId: string,
    data: Partial<Omit<CreateItemData, 'receipt_id'>>
  ): Promise<Item | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.unit_price !== undefined) {
      fields.push(`unit_price = $${paramIndex++}`);
      values.push(data.unit_price);
    }
    if (data.quantity !== undefined) {
      fields.push(`quantity = $${paramIndex++}`);
      values.push(data.quantity);
    }
    if (data.total_price !== undefined) {
      fields.push(`total_price = $${paramIndex++}`);
      values.push(data.total_price);
    }
    if (data.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }

    if (fields.length === 0) {
      return this.findById(id, receiptId);
    }

    values.push(id, receiptId);
    const result = await pool.query(
      `UPDATE items SET ${fields.join(', ')}
       WHERE id = $${paramIndex++} AND receipt_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async delete(id: string, receiptId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM items WHERE id = $1 AND receipt_id = $2',
      [id, receiptId]
    );
    return (result.rowCount ?? 0) > 0;
  },
};

export default ItemModel;
