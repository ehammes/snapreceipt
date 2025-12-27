import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import authRouter from '../../routes/auth';
import UserModel from '../../models/User';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: new Date(),
      };

      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue(mockUser);
      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (mockJwt.sign as jest.Mock).mockReturnValue('mock-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token', 'mock-token');
      expect(response.body).toHaveProperty('userId', 'user-123');
      expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserModel.create).toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid-email', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should return 400 when password is too short', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password must be at least 8 characters');
    });

    it('should return 409 when user already exists', async () => {
      mockUserModel.findByEmail.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
        password_hash: 'hash',
        created_at: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User with this email already exists');
    });

    it('should lowercase email before saving', async () => {
      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        created_at: new Date(),
      });
      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      (mockJwt.sign as jest.Mock).mockReturnValue('token');

      await request(app)
        .post('/api/auth/register')
        .send({ email: 'TEST@EXAMPLE.COM', password: 'password123' });

      expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        created_at: new Date(),
      };

      mockUserModel.findByEmail.mockResolvedValue(mockUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockJwt.sign as jest.Mock).mockReturnValue('mock-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'mock-token');
      expect(response.body).toHaveProperty('userId', 'user-123');
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should return 401 when user not found', async () => {
      mockUserModel.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 when password is incorrect', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        created_at: new Date(),
      };

      mockUserModel.findByEmail.mockResolvedValue(mockUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should lowercase email for lookup', async () => {
      mockUserModel.findByEmail.mockResolvedValue(null);

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'TEST@EXAMPLE.COM', password: 'password123' });

      expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });
});
