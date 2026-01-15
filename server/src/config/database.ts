import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to test connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

// Initialize database tables
export const initializeDatabase = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        purchase_date DATE,
        total_amount DECIMAL(10,2) DEFAULT 0,
        store_name VARCHAR(255),
        store_location TEXT,
        store_city VARCHAR(100),
        store_state VARCHAR(50),
        store_zip VARCHAR(20)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        quantity INTEGER NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0,
        total_price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        item_order INTEGER DEFAULT 0,
        item_number VARCHAR(50)
      )
    `);

    // Add columns if table already exists without them
    await client.query(`
      ALTER TABLE items ADD COLUMN IF NOT EXISTS item_number VARCHAR(50)
    `);
    await client.query(`
      ALTER TABLE items ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_receipts_purchase_date ON receipts(purchase_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_items_receipt_id ON items(receipt_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
