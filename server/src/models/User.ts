import pool from '../config/database';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  created_at: Date;
}

export const UserModel = {
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  },

  async findById(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async create(email: string, passwordHash: string): Promise<UserPublic> {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );
    return result.rows[0];
  },
};

export default UserModel;
