import { ReceiptModel, Receipt, CreateReceiptData } from '../../models/Receipt';
import pool from '../../config/database';

// Mock the database pool
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

// Use explicit any for mock to avoid complex pg types
const mockQuery = pool.query as jest.Mock;

describe('ReceiptModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a receipt with all fields', async () => {
      const mockReceipt: Receipt = {
        id: '123',
        user_id: 'user-1',
        image_url: '/uploads/test.jpg',
        upload_date: new Date(),
        purchase_date: new Date('2024-01-15'),
        total_amount: 150.99,
        store_name: 'Test Store',
        store_location: '123 Main St',
        store_city: 'San Francisco',
        store_state: 'CA',
        store_zip: '94102',
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockReceipt], rowCount: 1 } as any);

      const data: CreateReceiptData = {
        user_id: 'user-1',
        image_url: '/uploads/test.jpg',
        purchase_date: new Date('2024-01-15'),
        total_amount: 150.99,
        store_name: 'Test Store',
        store_location: '123 Main St',
        store_city: 'San Francisco',
        store_state: 'CA',
        store_zip: '94102',
      };

      const result = await ReceiptModel.create(data);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockReceipt);
      expect(result.store_name).toBe('Test Store');
      expect(result.total_amount).toBe(150.99);
    });

    it('should create a receipt with minimal fields', async () => {
      const mockReceipt: Receipt = {
        id: '124',
        user_id: 'user-1',
        image_url: '/uploads/test.jpg',
        upload_date: new Date(),
        purchase_date: null,
        total_amount: 0,
        store_name: null,
        store_location: null,
        store_city: null,
        store_state: null,
        store_zip: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockReceipt], rowCount: 1 } as any);

      const data: CreateReceiptData = {
        user_id: 'user-1',
        image_url: '/uploads/test.jpg',
      };

      const result = await ReceiptModel.create(data);

      expect(result.id).toBe('124');
      expect(result.total_amount).toBe(0);
    });
  });

  describe('findByUserId', () => {
    it('should return receipts for a user ordered by upload date', async () => {
      const mockReceipts: Receipt[] = [
        {
          id: '1',
          user_id: 'user-1',
          image_url: '/uploads/1.jpg',
          upload_date: new Date('2024-01-20'),
          purchase_date: new Date('2024-01-20'),
          total_amount: 100,
          store_name: 'Test Store',
          store_location: null,
          store_city: null,
          store_state: null,
          store_zip: null,
        },
        {
          id: '2',
          user_id: 'user-1',
          image_url: '/uploads/2.jpg',
          upload_date: new Date('2024-01-15'),
          purchase_date: new Date('2024-01-15'),
          total_amount: 200,
          store_name: 'Test Store',
          store_location: null,
          store_city: null,
          store_state: null,
          store_zip: null,
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockReceipts, rowCount: 2 } as any);

      const result = await ReceiptModel.findByUserId('user-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        ['user-1']
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array when user has no receipts', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await ReceiptModel.findByUserId('user-no-receipts');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a receipt when found', async () => {
      const mockReceipt: Receipt = {
        id: '123',
        user_id: 'user-1',
        image_url: '/uploads/test.jpg',
        upload_date: new Date(),
        purchase_date: new Date(),
        total_amount: 99.99,
        store_name: 'Test Store',
        store_location: null,
        store_city: null,
        store_state: null,
        store_zip: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockReceipt], rowCount: 1 } as any);

      const result = await ReceiptModel.findById('123', 'user-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        ['123', 'user-1']
      );
      expect(result).toEqual(mockReceipt);
    });

    it('should return null when receipt not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await ReceiptModel.findById('non-existent', 'user-1');

      expect(result).toBeNull();
    });

    it('should return null when receipt belongs to different user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await ReceiptModel.findById('123', 'wrong-user');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update receipt with provided fields', async () => {
      const updatedReceipt: Receipt = {
        id: '123',
        user_id: 'user-1',
        image_url: '/uploads/test.jpg',
        upload_date: new Date(),
        purchase_date: new Date('2024-02-01'),
        total_amount: 200.00,
        store_name: 'Test Store Updated',
        store_location: null,
        store_city: null,
        store_state: null,
        store_zip: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [updatedReceipt], rowCount: 1 } as any);

      const result = await ReceiptModel.update('123', 'user-1', {
        total_amount: 200.00,
        store_name: 'Test Store Updated',
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result?.total_amount).toBe(200.00);
      expect(result?.store_name).toBe('Test Store Updated');
    });

    it('should return existing receipt when no fields to update', async () => {
      const existingReceipt: Receipt = {
        id: '123',
        user_id: 'user-1',
        image_url: '/uploads/test.jpg',
        upload_date: new Date(),
        purchase_date: new Date(),
        total_amount: 100,
        store_name: 'Test Store',
        store_location: null,
        store_city: null,
        store_state: null,
        store_zip: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingReceipt], rowCount: 1 } as any);

      const result = await ReceiptModel.update('123', 'user-1', {});

      // Should call findById instead
      expect(result).toEqual(existingReceipt);
    });
  });

  describe('delete', () => {
    it('should return true when receipt is deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const result = await ReceiptModel.delete('123', 'user-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM receipts'),
        ['123', 'user-1']
      );
      expect(result).toBe(true);
    });

    it('should return false when receipt not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await ReceiptModel.delete('non-existent', 'user-1');

      expect(result).toBe(false);
    });
  });
});
