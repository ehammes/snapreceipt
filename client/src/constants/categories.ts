export const CATEGORIES = [
  'Alcohol',
  'Clothing',
  'Electronics',
  'Groceries',
  'Health & Beauty',
  'Household Supplies',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

// For filter dropdowns that need an "all" option
export const CATEGORIES_WITH_ALL = ['All Categories', ...CATEGORIES] as const;
