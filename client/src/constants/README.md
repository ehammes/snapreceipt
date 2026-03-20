# Constants

Centralized constants for the SnapReceipt application.

## Usage

Import constants from the barrel export:

```typescript
import {
  CURRENCY_DECIMAL_PLACES,
  DEFAULT_QUANTITY,
  DEFAULT_CATEGORY,
  formatCurrency,
  CATEGORIES,
} from '../constants';
```

## Organization

### `index.ts`
Main constants file containing:
- Form validation rules (min values, step values, decimal places)
- Default form values
- Currency formatting helpers
- Date formatting helpers
- File validation
- Error/success messages
- UI constants

### `categories.ts`
Receipt item categories:
- `CATEGORIES` - Array of all available categories
- `DEFAULT_CATEGORY` - Default category for new items
- `CATEGORIES_WITH_ALL` - Categories with "All" option for filters

## Best Practices

### ✅ DO
```typescript
// Use constants
<input step={PRICE_STEP} min={MIN_PRICE} />
const formatted = formatCurrency(total);
setItemForm({ ...itemForm, quantity: DEFAULT_QUANTITY });
```

### ❌ DON'T
```typescript
// Hardcode values
<input step="0.01" min="0" />
const formatted = `$${total.toFixed(2)}`;
setItemForm({ ...itemForm, quantity: 1 });
```

## When to Add New Constants

Add a constant when you find yourself:
1. **Repeating the same value** in multiple places
2. **Using magic numbers** that aren't self-explanatory
3. **Hardcoding validation rules** (min, max, step, etc.)
4. **Duplicating error/success messages**
5. **Using the same calculation** in multiple components

## Examples

### Before
```typescript
// Scattered hardcoded values
<input step="0.01" min="0" />
const total = `$${amount.toFixed(2)}`;
setItemForm({ quantity: '1', discount: '0', category: 'Uncategorized' });
```

### After
```typescript
// Centralized constants
import { PRICE_STEP, MIN_PRICE, formatCurrency, DEFAULT_QUANTITY, DEFAULT_DISCOUNT, DEFAULT_CATEGORY } from '../constants';

<input step={PRICE_STEP} min={MIN_PRICE} />
const total = formatCurrency(amount);
setItemForm({
  quantity: String(DEFAULT_QUANTITY),
  discount: String(DEFAULT_DISCOUNT),
  category: DEFAULT_CATEGORY
});
```

## Updating Constants

When changing a constant:
1. Update the value in `constants/index.ts` or `constants/categories.ts`
2. No need to search/replace across the codebase
3. All usages automatically updated

## Type Safety

All constants are properly typed:
```typescript
// Literal types
export const CATEGORIES = [...] as const;
export type Category = (typeof CATEGORIES)[number];

// Validation messages
export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  // ...
} as const;
```
