import { ItemModel, Item, CreateItemData } from '../../models/Item';
import pool from '../../config/database';

// Mock the database pool
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

// Use explicit any for mock to avoid complex pg types
const mockQuery = pool.query as jest.Mock;

describe('ItemModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an item with all fields', async () => {
      const mockItem: Item = {
        id: 'item-1',
        receipt_id: 'receipt-1',
        name: 'Kirkland Water',
        unit_price: 4.99,
        quantity: 2,
        total_price: 9.98,
        category: 'Beverages',
        item_order: 1,
        item_number: '123456',
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockItem], rowCount: 1 } as any);

      const data: CreateItemData = {
        receipt_id: 'receipt-1',
        name: 'Kirkland Water',
        unit_price: 4.99,
        quantity: 2,
        total_price: 9.98,
        category: 'Beverages',
        item_order: 1,
        item_number: '123456',
      };

      const result = await ItemModel.create(data);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockItem);
      expect(result.name).toBe('Kirkland Water');
    });

    it('should create an item with minimal fields', async () => {
      const mockItem: Item = {
        id: 'item-2',
        receipt_id: 'receipt-1',
        name: 'Generic Item',
        unit_price: 10.00,
        quantity: 1,
        total_price: 10.00,
        category: null,
        item_order: 0,
        item_number: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockItem], rowCount: 1 } as any);

      const data: CreateItemData = {
        receipt_id: 'receipt-1',
        name: 'Generic Item',
        unit_price: 10.00,
        quantity: 1,
        total_price: 10.00,
      };

      const result = await ItemModel.create(data);

      expect(result.category).toBeNull();
      expect(result.item_number).toBeNull();
    });
  });

  describe('findByReceiptId', () => {
    it('should return items for a receipt ordered by item_order', async () => {
      const mockItems: Item[] = [
        {
          id: 'item-1',
          receipt_id: 'receipt-1',
          name: 'First Item',
          unit_price: 5.00,
          quantity: 1,
          total_price: 5.00,
          category: null,
          item_order: 0,
          item_number: null,
        },
        {
          id: 'item-2',
          receipt_id: 'receipt-1',
          name: 'Second Item',
          unit_price: 10.00,
          quantity: 2,
          total_price: 20.00,
          category: 'Food',
          item_order: 1,
          item_number: null,
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockItems, rowCount: 2 } as any);

      const result = await ItemModel.findByReceiptId('receipt-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY item_order'),
        ['receipt-1']
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('First Item');
    });

    it('should return empty array when receipt has no items', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await ItemModel.findByReceiptId('empty-receipt');

      expect(result).toEqual([]);
    });
  });

  describe('createBatch', () => {
    it('should create multiple items at once', async () => {
      const mockItems: Item[] = [
        {
          id: 'item-1',
          receipt_id: 'receipt-1',
          name: 'Item 1',
          unit_price: 5.00,
          quantity: 1,
          total_price: 5.00,
          category: null,
          item_order: 0,
          item_number: null,
        },
        {
          id: 'item-2',
          receipt_id: 'receipt-1',
          name: 'Item 2',
          unit_price: 10.00,
          quantity: 1,
          total_price: 10.00,
          category: null,
          item_order: 1,
          item_number: null,
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockItems, rowCount: 2 } as any);

      const itemsData: CreateItemData[] = [
        {
          receipt_id: 'receipt-1',
          name: 'Item 1',
          unit_price: 5.00,
          quantity: 1,
          total_price: 5.00,
        },
        {
          receipt_id: 'receipt-1',
          name: 'Item 2',
          unit_price: 10.00,
          quantity: 1,
          total_price: 10.00,
        },
      ];

      const result = await ItemModel.createBatch(itemsData);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when given empty array', async () => {
      const result = await ItemModel.createBatch([]);

      expect(mockQuery).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return an item when found', async () => {
      const mockItem: Item = {
        id: 'item-1',
        receipt_id: 'receipt-1',
        name: 'Test Item',
        unit_price: 15.00,
        quantity: 1,
        total_price: 15.00,
        category: 'Food',
        item_order: 0,
        item_number: '789',
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockItem], rowCount: 1 } as any);

      const result = await ItemModel.findById('item-1', 'receipt-1');

      expect(result).toEqual(mockItem);
    });

    it('should return null when item not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await ItemModel.findById('non-existent', 'receipt-1');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update item fields', async () => {
      const updatedItem: Item = {
        id: 'item-1',
        receipt_id: 'receipt-1',
        name: 'Updated Name',
        unit_price: 20.00,
        quantity: 3,
        total_price: 60.00,
        category: 'Updated Category',
        item_order: 0,
        item_number: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [updatedItem], rowCount: 1 } as any);

      const result = await ItemModel.update('item-1', 'receipt-1', {
        name: 'Updated Name',
        unit_price: 20.00,
        quantity: 3,
        total_price: 60.00,
        category: 'Updated Category',
      });

      expect(result?.name).toBe('Updated Name');
      expect(result?.total_price).toBe(60.00);
    });

    it('should return existing item when no fields to update', async () => {
      const existingItem: Item = {
        id: 'item-1',
        receipt_id: 'receipt-1',
        name: 'Existing',
        unit_price: 10.00,
        quantity: 1,
        total_price: 10.00,
        category: null,
        item_order: 0,
        item_number: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingItem], rowCount: 1 } as any);

      const result = await ItemModel.update('item-1', 'receipt-1', {});

      expect(result).toEqual(existingItem);
    });
  });

  describe('delete', () => {
    it('should return true when item is deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const result = await ItemModel.delete('item-1', 'receipt-1');

      expect(result).toBe(true);
    });

    it('should return false when item not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await ItemModel.delete('non-existent', 'receipt-1');

      expect(result).toBe(false);
    });
  });

  describe('deleteByReceiptId', () => {
    it('should delete all items for a receipt and return count', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 5 } as any);

      const result = await ItemModel.deleteByReceiptId('receipt-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM items WHERE receipt_id = $1'),
        ['receipt-1']
      );
      expect(result).toBe(5);
    });

    it('should return 0 when no items to delete', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await ItemModel.deleteByReceiptId('empty-receipt');

      expect(result).toBe(0);
    });
  });
});
