-- Migration: Add discount column to items table
-- Date: 2026-01-22
-- Description: Add discount field to support receipt discounts/instant savings

-- Add discount column with default value of 0
ALTER TABLE items ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;

-- Verify column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'items' AND column_name = 'discount';
