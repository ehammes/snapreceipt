import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ReceiptModel } from '../models/Receipt';
import { ItemModel } from '../models/Item';

const router = Router();

// PUT /api/items/:itemId?receiptId=xxx - Update an item
router.put('/:itemId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { itemId } = req.params;
    const { receiptId } = req.query;
    const { name, unitPrice, quantity, discount, category } = req.body;

    if (!receiptId || typeof receiptId !== 'string') {
      res.status(400).json({ error: 'receiptId query parameter is required' });
      return;
    }

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(receiptId, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Verify item exists
    const existingItem = await ItemModel.findById(itemId, receiptId);
    if (!existingItem) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (unitPrice !== undefined) updateData.unit_price = parseFloat(unitPrice);
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (discount !== undefined) updateData.discount = parseFloat(discount);
    if (category !== undefined) updateData.category = category || null;

    // Calculate total_price if unitPrice, quantity, or discount changed
    const newUnitPrice = updateData.unit_price ?? existingItem.unit_price;
    const newQuantity = updateData.quantity ?? existingItem.quantity;
    const newDiscount = updateData.discount ?? existingItem.discount;
    updateData.total_price = Math.round((newUnitPrice * newQuantity - newDiscount) * 100) / 100;

    // Update item
    const updatedItem = await ItemModel.update(itemId, receiptId, updateData);

    res.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// PATCH /api/items/reorder?receiptId=xxx - Reorder items
router.patch('/reorder', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { receiptId } = req.query;
    const { items } = req.body; // Array of { id, item_order }

    if (!receiptId || typeof receiptId !== 'string') {
      res.status(400).json({ error: 'receiptId query parameter is required' });
      return;
    }

    if (!items || !Array.isArray(items)) {
      res.status(400).json({ error: 'items array is required' });
      return;
    }

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(receiptId, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Update item_order for each item
    for (const item of items) {
      await ItemModel.update(item.id, receiptId, { item_order: item.item_order });
    }

    res.json({ success: true, message: 'Items reordered' });
  } catch (error) {
    console.error('Reorder items error:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// DELETE /api/items/:itemId?receiptId=xxx - Delete an item
router.delete('/:itemId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { itemId } = req.params;
    const { receiptId } = req.query;

    if (!receiptId || typeof receiptId !== 'string') {
      res.status(400).json({ error: 'receiptId query parameter is required' });
      return;
    }

    // Verify receipt belongs to user
    const receipt = await ReceiptModel.findById(receiptId, userId);
    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    // Verify item exists
    const existingItem = await ItemModel.findById(itemId, receiptId);
    if (!existingItem) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Delete item
    await ItemModel.delete(itemId, receiptId);

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
