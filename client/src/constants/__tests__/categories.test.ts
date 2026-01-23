import { CATEGORIES, DEFAULT_CATEGORY, CATEGORIES_WITH_ALL } from '../categories';

describe('Category Constants', () => {
  describe('CATEGORIES', () => {
    it('includes all expected categories', () => {
      expect(CATEGORIES).toContain('Alcohol');
      expect(CATEGORIES).toContain('Clothing');
      expect(CATEGORIES).toContain('Electronics');
      expect(CATEGORIES).toContain('Groceries');
      expect(CATEGORIES).toContain('Health & Beauty');
      expect(CATEGORIES).toContain('Household Supplies');
      expect(CATEGORIES).toContain('Other');
      expect(CATEGORIES).toContain('Uncategorized');
    });

    it('has correct length', () => {
      expect(CATEGORIES.length).toBe(8);
    });

    it('is an array', () => {
      expect(Array.isArray(CATEGORIES)).toBe(true);
    });

    it('contains only strings', () => {
      CATEGORIES.forEach(category => {
        expect(typeof category).toBe('string');
      });
    });

    it('has no duplicate categories', () => {
      const uniqueCategories = new Set(CATEGORIES);
      expect(uniqueCategories.size).toBe(CATEGORIES.length);
    });

    it('has no empty strings', () => {
      CATEGORIES.forEach(category => {
        expect(category.length).toBeGreaterThan(0);
      });
    });
  });

  describe('DEFAULT_CATEGORY', () => {
    it('is Uncategorized', () => {
      expect(DEFAULT_CATEGORY).toBe('Uncategorized');
    });

    it('is a string', () => {
      expect(typeof DEFAULT_CATEGORY).toBe('string');
    });

    it('is included in CATEGORIES', () => {
      expect(CATEGORIES).toContain(DEFAULT_CATEGORY);
    });

    it('is not empty', () => {
      expect(DEFAULT_CATEGORY.length).toBeGreaterThan(0);
    });
  });

  describe('CATEGORIES_WITH_ALL', () => {
    it('includes All Categories as first option', () => {
      expect(CATEGORIES_WITH_ALL[0]).toBe('All Categories');
    });

    it('includes all regular categories', () => {
      CATEGORIES.forEach(category => {
        expect(CATEGORIES_WITH_ALL).toContain(category);
      });
    });

    it('has length of CATEGORIES + 1', () => {
      expect(CATEGORIES_WITH_ALL.length).toBe(CATEGORIES.length + 1);
    });

    it('is an array', () => {
      expect(Array.isArray(CATEGORIES_WITH_ALL)).toBe(true);
    });

    it('contains only strings', () => {
      CATEGORIES_WITH_ALL.forEach(category => {
        expect(typeof category).toBe('string');
      });
    });

    it('has no duplicate values', () => {
      const unique = new Set(CATEGORIES_WITH_ALL);
      expect(unique.size).toBe(CATEGORIES_WITH_ALL.length);
    });

    it('All Categories option appears only once', () => {
      const allCount = CATEGORIES_WITH_ALL.filter(c => c === 'All Categories').length;
      expect(allCount).toBe(1);
    });
  });

  describe('Category List Consistency', () => {
    it('CATEGORIES_WITH_ALL contains All Categories plus all CATEGORIES', () => {
      const categoriesAfterAll = CATEGORIES_WITH_ALL.slice(1);
      CATEGORIES.forEach(category => {
        expect(categoriesAfterAll).toContain(category);
      });
    });

    it('maintains order after All Categories', () => {
      const categoriesAfterAll = CATEGORIES_WITH_ALL.slice(1);
      // Verify these are the same as CATEGORIES (which should be in order)
      expect(categoriesAfterAll.length).toBe(CATEGORIES.length);
      CATEGORIES.forEach((category, index) => {
        expect(categoriesAfterAll[index]).toBe(category);
      });
    });
  });
});
