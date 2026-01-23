// Mock dependencies BEFORE imports
jest.mock('../../models/Receipt');
jest.mock('../../models/Item');
jest.mock('../../services/ocrService', () => ({
  ocrService: {
    processReceipt: jest.fn(),
    parseReceiptText: jest.fn(),
  },
}));
jest.mock('jsonwebtoken');
jest.mock('fs');
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.userId = 'user-123'; // Mock authenticated user
    next();
  },
}));

import request from 'supertest';
import express from 'express';
import receiptsRouter from '../../routes/receipts';
import ReceiptModel from '../../models/Receipt';
import ItemModel from '../../models/Item';
import { ocrService } from '../../services/ocrService';
import jwt from 'jsonwebtoken';

const mockReceiptModel = ReceiptModel as jest.Mocked<typeof ReceiptModel>;
const mockItemModel = ItemModel as jest.Mocked<typeof ItemModel>;
const mockOcrService = ocrService as jest.Mocked<typeof ocrService>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/receipts', receiptsRouter);

describe('Receipt Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/receipts', () => {
    it('should return receipts for authenticated user', async () => {
      const mockReceipts = [
        { id: 1, userId: 'user-123', store_name: 'Costco', total_amount: 100.00 },
        { id: 2, userId: 'user-123', store_name: 'Target', total_amount: 50.00 },
      ];

      // Mock pool.query used in the route
      const mockPool = require('../../config/database').default;
      mockPool.query = jest.fn().mockResolvedValue({ rows: mockReceipts });

      const response = await request(app)
        .get('/api/receipts')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.receipts).toEqual(mockReceipts);
      expect(response.body.count).toBe(2);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get('/api/receipts');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should filter receipts by search term', async () => {
      const mockReceipts = [
        { id: 1, userId: 'user-123', store_name: 'Costco', total_amount: 100.00 },
      ];

      const mockPool = require('../../config/database').default;
      mockPool.query = jest.fn().mockResolvedValue({ rows: mockReceipts });

      const response = await request(app)
        .get('/api/receipts?search=Costco')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.receipts).toEqual(mockReceipts);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['user-123', '%Costco%'])
      );
    });

    it('should filter receipts by date range', async () => {
      const mockReceipts = [
        { id: 1, userId: 'user-123', store_name: 'Costco', total_amount: 100.00 },
      ];

      const mockPool = require('../../config/database').default;
      mockPool.query = jest.fn().mockResolvedValue({ rows: mockReceipts });

      const response = await request(app)
        .get('/api/receipts?startDate=2025-01-01&endDate=2025-12-31')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('purchase_date >='),
        expect.arrayContaining(['user-123', '2025-01-01', '2025-12-31'])
      );
    });

    it('should filter receipts by amount range', async () => {
      const mockReceipts = [
        { id: 1, userId: 'user-123', store_name: 'Costco', total_amount: 100.00 },
      ];

      const mockPool = require('../../config/database').default;
      mockPool.query = jest.fn().mockResolvedValue({ rows: mockReceipts });

      const response = await request(app)
        .get('/api/receipts?minAmount=50&maxAmount=150')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('total_amount >='),
        expect.arrayContaining(['user-123', 50, 150])
      );
    });

    it('should filter receipts by category', async () => {
      const mockReceipts = [
        { id: 1, userId: 'user-123', store_name: 'Costco', total_amount: 100.00 },
      ];

      const mockPool = require('../../config/database').default;
      mockPool.query = jest.fn().mockResolvedValue({ rows: mockReceipts });

      const response = await request(app)
        .get('/api/receipts?category=Groceries')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('category ='),
        expect.arrayContaining(['user-123', 'Groceries'])
      );
    });
  });

  describe('GET /api/receipts/:id', () => {
    it('should return receipt with items', async () => {
      const mockReceipt = { id: 1, userId: 'user-123', store_name: 'Costco' };
      const mockItems = [
        { id: 1, name: 'Item 1', unit_price: 10.00, quantity: 2 },
        { id: 2, name: 'Item 2', unit_price: 5.00, quantity: 1 },
      ];

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockItemModel.findByReceiptId.mockResolvedValue(mockItems as any);

      const response = await request(app)
        .get('/api/receipts/1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.receipt).toHaveProperty('id', 1);
      expect(response.body.receipt.items).toEqual(mockItems);
      expect(mockReceiptModel.findById).toHaveBeenCalledWith('1', 'user-123');
      expect(mockItemModel.findByReceiptId).toHaveBeenCalledWith('1');
    });

    it('should return 404 for non-existent receipt', async () => {
      mockReceiptModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/receipts/999')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Receipt not found');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get('/api/receipts/1');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/receipts/:id/items', () => {
    it('should add item to receipt', async () => {
      const mockReceipt = { id: 1, userId: 'user-123', store_name: 'Costco' };
      const mockNewItem = {
        id: 5,
        receipt_id: 1,
        name: 'New Item',
        unit_price: 15.99,
        quantity: 1,
        discount: 0,
        total_price: 15.99,
        category: 'Groceries',
      };
      const mockAllItems = [mockNewItem];

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockItemModel.create.mockResolvedValue(mockNewItem as any);
      mockItemModel.findByReceiptId.mockResolvedValue(mockAllItems as any);

      const response = await request(app)
        .post('/api/receipts/1/items')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'New Item',
          unitPrice: 15.99,
          quantity: 1,
          discount: 0,
          category: 'Groceries',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.item).toEqual(mockNewItem);
      expect(mockItemModel.create).toHaveBeenCalledWith({
        receipt_id: '1',
        name: 'New Item',
        unit_price: 15.99,
        quantity: 1,
        discount: 0,
        total_price: 15.99,
        category: 'Groceries',
      });
    });

    it('should return 400 when required fields are missing', async () => {
      mockReceiptModel.findById.mockResolvedValue({ id: 1 } as any);

      const response = await request(app)
        .post('/api/receipts/1/items')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Item' }); // Missing unitPrice and quantity

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name, unitPrice, and quantity are required');
    });

    it('should return 404 for non-existent receipt', async () => {
      mockReceiptModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/receipts/999/items')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Item',
          unitPrice: 10.00,
          quantity: 1,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Receipt not found');
    });

    it('should calculate total price with discount', async () => {
      const mockReceipt = { id: 1, userId: 'user-123' };
      const mockNewItem = {
        id: 5,
        receipt_id: 1,
        name: 'Discounted Item',
        unit_price: 39.99,
        quantity: 1,
        discount: 8.00,
        total_price: 31.99,
        category: null,
      };

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockItemModel.create.mockResolvedValue(mockNewItem as any);
      mockItemModel.findByReceiptId.mockResolvedValue([mockNewItem] as any);

      const response = await request(app)
        .post('/api/receipts/1/items')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Discounted Item',
          unitPrice: 39.99,
          quantity: 1,
          discount: 8.00,
        });

      expect(response.status).toBe(201);
      expect(mockItemModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          total_price: 31.99, // 39.99 - 8.00
        })
      );
    });
  });

  describe('PUT /api/receipts/:id/items/:itemId', () => {
    it('should update item fields', async () => {
      const mockReceipt = { id: 1, userId: 'user-123' };
      const mockExistingItem = {
        id: 5,
        receipt_id: 1,
        name: 'Old Name',
        unit_price: 10.00,
        quantity: 1,
        discount: 0,
        total_price: 10.00,
      };
      const mockUpdatedItem = {
        ...mockExistingItem,
        name: 'New Name',
        unit_price: 15.00,
        total_price: 15.00,
      };

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockItemModel.findById.mockResolvedValue(mockExistingItem as any);
      mockItemModel.update.mockResolvedValue(mockUpdatedItem as any);

      const response = await request(app)
        .put('/api/receipts/1/items/5')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'New Name',
          unitPrice: 15.00,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.item.name).toBe('New Name');
      expect(mockItemModel.update).toHaveBeenCalledWith(
        '5',
        '1',
        expect.objectContaining({
          name: 'New Name',
          unit_price: 15.00,
          total_price: 15.00,
        })
      );
    });

    it('should recalculate total price when price or quantity changes', async () => {
      const mockReceipt = { id: 1, userId: 'user-123' };
      const mockExistingItem = {
        id: 5,
        receipt_id: 1,
        name: 'Item',
        unit_price: 10.00,
        quantity: 1,
        discount: 0,
        total_price: 10.00,
      };
      const mockUpdatedItem = {
        ...mockExistingItem,
        quantity: 3,
        total_price: 30.00,
      };

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockItemModel.findById.mockResolvedValue(mockExistingItem as any);
      mockItemModel.update.mockResolvedValue(mockUpdatedItem as any);

      const response = await request(app)
        .put('/api/receipts/1/items/5')
        .set('Authorization', 'Bearer valid-token')
        .send({ quantity: 3 });

      expect(response.status).toBe(200);
      expect(mockItemModel.update).toHaveBeenCalledWith(
        '5',
        '1',
        expect.objectContaining({
          quantity: 3,
          total_price: 30.00, // 10.00 * 3
        })
      );
    });

    it('should return 404 for non-existent item', async () => {
      mockReceiptModel.findById.mockResolvedValue({ id: 1 } as any);
      mockItemModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/receipts/1/items/999')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Item not found');
    });
  });

  describe('PATCH /api/receipts/:id', () => {
    it('should update receipt fields', async () => {
      const mockReceipt = { id: 1, userId: 'user-123', store_name: 'Costco' };
      const mockUpdatedReceipt = { ...mockReceipt, store_name: 'Target' };
      const mockItems: any[] = [];

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockReceiptModel.update.mockResolvedValue(mockUpdatedReceipt as any);
      mockItemModel.findByReceiptId.mockResolvedValue(mockItems);

      const response = await request(app)
        .patch('/api/receipts/1')
        .set('Authorization', 'Bearer valid-token')
        .send({ storeName: 'Target' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.receipt.store_name).toBe('Target');
      expect(mockReceiptModel.update).toHaveBeenCalledWith(
        '1',
        'user-123',
        expect.objectContaining({ store_name: 'Target' })
      );
    });

    it('should return 404 for non-existent receipt', async () => {
      mockReceiptModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/receipts/999')
        .set('Authorization', 'Bearer valid-token')
        .send({ storeName: 'Target' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Receipt not found');
    });

    it('should update multiple fields', async () => {
      const mockReceipt = { id: 1, userId: 'user-123' };
      const mockUpdatedReceipt = {
        ...mockReceipt,
        store_name: 'Target',
        total_amount: 75.50,
      };

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockReceiptModel.update.mockResolvedValue(mockUpdatedReceipt as any);
      mockItemModel.findByReceiptId.mockResolvedValue([]);

      const response = await request(app)
        .patch('/api/receipts/1')
        .set('Authorization', 'Bearer valid-token')
        .send({
          storeName: 'Target',
          totalAmount: 75.50,
        });

      expect(response.status).toBe(200);
      expect(mockReceiptModel.update).toHaveBeenCalledWith(
        '1',
        'user-123',
        expect.objectContaining({
          store_name: 'Target',
          total_amount: 75.50,
        })
      );
    });
  });

  describe('DELETE /api/receipts/:id', () => {
    it('should delete receipt and return success', async () => {
      const mockReceipt = { id: 1, userId: 'user-123' };

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockReceiptModel.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/receipts/1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Receipt deleted');
      expect(mockReceiptModel.delete).toHaveBeenCalledWith('1', 'user-123');
    });

    it('should return 404 if receipt not found', async () => {
      mockReceiptModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/receipts/999')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Receipt not found');
    });

    it('should return 500 if delete fails', async () => {
      const mockReceipt = { id: 1, userId: 'user-123' };

      mockReceiptModel.findById.mockResolvedValue(mockReceipt as any);
      mockReceiptModel.delete.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/receipts/1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete receipt');
    });
  });

  describe('POST /api/receipts/save-guest', () => {
    it('should save guest receipt to user account', async () => {
      const mockReceipt = { id: 1, userId: 'user-123' };
      const mockItems = [
        { id: 1, name: 'Item 1', unit_price: 10.00, quantity: 1, total_price: 10.00 },
      ];

      mockReceiptModel.create.mockResolvedValue(mockReceipt as any);
      mockItemModel.createBatch.mockResolvedValue(mockItems as any);
      mockReceiptModel.update.mockResolvedValue(mockReceipt as any);

      const guestData = {
        imageUrl: '/uploads/test.jpg',
        storeName: 'Costco',
        storeLocation: '123 Main St',
        totalAmount: 10.00,
        items: [
          { name: 'Item 1', unitPrice: 10.00, quantity: 1, totalPrice: 10.00 },
        ],
      };

      const response = await request(app)
        .post('/api/receipts/save-guest')
        .set('Authorization', 'Bearer valid-token')
        .send({ guestReceiptData: guestData });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.receiptId).toBe(1);
      expect(mockReceiptModel.create).toHaveBeenCalled();
      expect(mockItemModel.createBatch).toHaveBeenCalled();
    });

    it('should return 400 when guest data is missing', async () => {
      const response = await request(app)
        .post('/api/receipts/save-guest')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No guest receipt data provided');
    });
  });
});
