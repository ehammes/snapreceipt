export const CATEGORIES = [
  'Groceries',
  'Alcohol',
  'Electronics',
  'Household',
  'Clothing',
  'Health',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

// For filter dropdowns that need an "all" option
export const CATEGORIES_WITH_ALL = ['All Categories', ...CATEGORIES] as const;
