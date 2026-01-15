import { ImageAnnotatorClient } from '@google-cloud/vision';

/**
 * Merge duplicate items that appear on separate lines in receipts.
 * Some stores list each quantity as a separate line, so 2 of the same item
 * appears as 2 separate lines with qty 1 each.
 * This function merges them into 1 item with qty 2.
 * Preserves the original order based on first occurrence on receipt.
 */
function mergeDuplicateItems(items: Array<{
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  totalPrice: number;
  itemNumber?: string;
  order: number;  // Track position on receipt
}>): Array<{
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  totalPrice: number;
  itemNumber?: string;
  item_order: number;  // Order for database storage
}> {
  // Handle empty array
  if (!items || items.length === 0) {
    return [];
  }

  // Use Map to track unique items by name + price
  const itemMap = new Map<string, {
    name: string;
    unitPrice: number;
    quantity: number;
    discount: number;
    totalPrice: number;
    itemNumber?: string;
    order: number;  // Keep earliest order
  }>();

  for (const item of items) {
    // Skip items with invalid prices
    if (typeof item.unitPrice !== 'number' || isNaN(item.unitPrice) || item.unitPrice <= 0) {
      continue;
    }

    // Create unique key using item number ONLY (preferred) or name + price
    // Item number alone handles: same product with different prices (discounts, OCR errors)
    // Example: "681467" for item number match
    // Example: "kirkland butter|12.99" for name-based match (fallback)
    let key: string;
    if (item.itemNumber) {
      // Use item number ONLY as key (merges same product even with different prices)
      key = item.itemNumber;
    } else {
      // Fallback to name + price for items without item numbers
      const normalizedName = item.name.toLowerCase().trim().replace(/\s+/g, ' ');
      key = `${normalizedName}|${item.unitPrice.toFixed(2)}`;
    }

    if (itemMap.has(key)) {
      // Duplicate found - increment quantity and accumulate totals
      const existing = itemMap.get(key)!;
      existing.quantity += 1;
      existing.discount = Math.round((existing.discount + item.discount) * 100) / 100;
      existing.totalPrice = Math.round((existing.totalPrice + item.totalPrice) * 100) / 100;
      // Recalculate unit price as average (before discount)
      existing.unitPrice = Math.round(((existing.totalPrice + existing.discount) / existing.quantity) * 100) / 100;
      // Keep the earliest order (first occurrence on receipt)
      existing.order = Math.min(existing.order, item.order);
    } else {
      // New unique item - add to map
      // Keep original name casing from first occurrence
      itemMap.set(key, {
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity || 1,
        discount: item.discount || 0,
        totalPrice: item.totalPrice,
        itemNumber: item.itemNumber,
        order: item.order,
      });
    }
  }

  // Convert Map values back to array and sort by original receipt order
  const mergedItems = Array.from(itemMap.values());
  mergedItems.sort((a, b) => a.order - b.order);

  // Return items with item_order field for database storage
  return mergedItems.map(({ order, ...item }) => ({
    ...item,
    item_order: order,  // Rename to match database column
  }));
}

export interface ParsedItem {
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  totalPrice: number;
  itemNumber?: string;
  item_order?: number;  // Order on receipt (for sorting)
}

export interface ParsedReceiptData {
  storeName: string;
  storeLocation: string;
  storeCity: string;
  storeState: string;
  storeZip: string;
  purchaseDate: Date;
  totalAmount: number;
  items: ParsedItem[];
  rawText?: string; // For debugging
}

class OCRService {
  private visionClient: ImageAnnotatorClient;

  constructor() {
    try {
      // Support both file path (local dev) and JSON string (production/Railway)
      if (process.env.GOOGLE_CREDENTIALS_JSON) {
        // Production: credentials passed as JSON string
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        this.visionClient = new ImageAnnotatorClient({ credentials });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Local development: credentials from file
        this.visionClient = new ImageAnnotatorClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
      } else {
        throw new Error('No Google credentials configured');
      }
    } catch (error) {
      console.error('Failed to initialize Google Vision API client:', error);
      throw new Error('Failed to initialize OCR service');
    }
  }

  /**
   * Extract text from image buffer using Google Vision API
   */
  async extractText(imageBuffer: Buffer): Promise<string> {
    try {
      const [result] = await this.visionClient.textDetection({
        image: { content: imageBuffer },
      });

      const textAnnotations = result.textAnnotations;

      if (!textAnnotations || textAnnotations.length === 0) {
        return '';
      }

      return textAnnotations[0].description || '';
    } catch (error) {
      console.error('Vision API error:', error);
      throw new Error('Failed to extract text from receipt');
    }
  }

  /**
   * Parse receipt text format
   */
  parseReceiptText(text: string): ParsedReceiptData {
    const result: ParsedReceiptData = {
      storeName: '',
      storeLocation: '',
      storeCity: '',
      storeState: '',
      storeZip: '',
      purchaseDate: new Date(),
      totalAmount: 0,
      items: [],
      rawText: text,
    };

    if (!text || text.trim().length === 0) {
      return result;
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Extract store name - detect common stores
    if (/COSTCO\s*WHOLESALE/i.test(text)) {
      result.storeName = 'Costco Wholesale';
    } else if (/WALMART/i.test(text)) {
      result.storeName = 'Walmart';
    } else if (/TARGET/i.test(text)) {
      result.storeName = 'Target';
    } else if (/SAFEWAY/i.test(text)) {
      result.storeName = 'Safeway';
    } else if (/KROGER/i.test(text)) {
      result.storeName = 'Kroger';
    }

    // Extract store address - look for pattern with street number and ZIP
    this.extractAddress(lines, result);

    // Extract purchase date - look for MM/DD/YYYY or MM/DD/YY format
    this.extractDate(text, result);

    // Extract items - items typically have item number and price
    this.extractItems(lines, result);

    // Extract total amount
    this.extractTotal(text, result);

    return result;
  }

  /**
   * Extract store address from receipt lines
   */
  private extractAddress(lines: string[], result: ParsedReceiptData): void {
    // Look for address patterns in the first 10 lines (usually near the top)
    const headerLines = lines.slice(0, 15);

    // Street type pattern - matches both abbreviated and full words
    const streetTypes = '(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|DR|DRIVE|RD|ROAD|WAY|LN|LANE|CT|COURT|PL|PLACE|PKWY|PARKWAY|HWY|HIGHWAY)';

    // Pattern 1: Full address on one line - "123 MAIN ST CITY, ST 12345"
    const fullAddressRegex = new RegExp(`^(\\d+\\s+[A-Z0-9\\s]+${streetTypes}\\.?)\\s*,?\\s*([A-Z\\s]+),?\\s*([A-Z]{2})\\s*(\\d{5}(?:-\\d{4})?)`, 'i');

    // Pattern 2: Street address with city/state/zip on separate lines
    const streetRegex = new RegExp(`^(\\d+\\s+[A-Z0-9\\s]+${streetTypes}\\.?)$`, 'i');
    const cityStateZipRegex = /^([A-Z][A-Za-z\s]+),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/;

    for (let i = 0; i < headerLines.length; i++) {
      const line = headerLines[i];

      // Try full address on one line
      const fullMatch = line.match(fullAddressRegex);
      if (fullMatch) {
        result.storeLocation = fullMatch[1].trim();
        result.storeCity = fullMatch[2].trim();
        result.storeState = fullMatch[3].toUpperCase();
        result.storeZip = fullMatch[4];
        return;
      }

      // Try street address followed by city/state/zip
      const streetMatch = line.match(streetRegex);
      if (streetMatch && i + 1 < headerLines.length) {
        const nextLine = headerLines[i + 1];
        const cityMatch = nextLine.match(cityStateZipRegex);
        if (cityMatch) {
          result.storeLocation = streetMatch[1].trim();
          result.storeCity = cityMatch[1].trim();
          result.storeState = cityMatch[2].toUpperCase();
          result.storeZip = cityMatch[3];
          return;
        }
      }
    }

    // Fallback: Look for any ZIP code pattern
    const zipMatch = lines.slice(0, 15).join(' ').match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*([A-Z]{2})\s+(\d{5})/);
    if (zipMatch) {
      result.storeCity = zipMatch[1].trim();
      result.storeState = zipMatch[2].toUpperCase();
      result.storeZip = zipMatch[3];
    }
  }

  /**
   * Extract purchase date from receipt text
   */
  private extractDate(text: string, result: ParsedReceiptData): void {
    // Try various date formats
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)/, // MM/DD/YY
      /(\d{1,2})-(\d{1,2})-(\d{4})/, // MM-DD-YYYY
      /(\d{1,2})-(\d{1,2})-(\d{2})(?!\d)/, // MM-DD-YY
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        let year = parseInt(match[3], 10);
        if (year < 100) {
          year += 2000; // Convert 2-digit year to 4-digit
        }
        const month = parseInt(match[1], 10) - 1; // JS months are 0-indexed
        const day = parseInt(match[2], 10);

        const parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) {
          result.purchaseDate = parsedDate;
          return;
        }
      }
    }
  }

  /**
   * Extract items from receipt lines
   * Format: Item number + name on one line, price on the NEXT line
   * Example:
   *   1954841 IRIS BIN
   *   11.99 A
   */
  private extractItems(lines: string[], result: ParsedReceiptData): void {
    // Lines to skip - these are not product items
    const skipPatterns = [
      /^COSTCO/i,
      /^WHOLESALE/i,
      /^SUBTOTAL$/i,
      /^TAX$/i,
      /^\*+\s*TOTAL/i,
      /^TOTAL\s/i,
      /BALANCE/i,
      /^CHANGE$/i,
      /APPROVED/i,
      /VISA/i,
      /MASTER\s*CARD/i,
      /^MEMBER/i,
      /^\d{12,}/, // Long numbers (member IDs, barcodes)
      /^0{4,}\d+\s*\//, // Barcode lines like "0000366341 / 1935001"
      /TERMINAL/i,
      /TRANS\s*ID/i,
      /APPROVAL/i,
      /RECEIPT/i,
      /THANK\s*YOU/i,
      /PLEASE\s*COME/i,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}/, // Date lines
      /^#\d+/, // Store numbers like #388
      /WAREHOUSE/i,
      /SELF.?CHECKOUT/i,
      /^AID:/i,
      /^Seq#/i,
      /^App#/i,
      /^Resp:/i,
      /^Tran\s*ID/i,
      /AMOUNT:/i,
      /^OP#:/i,
      /^Whse:/i,
      /Items\s*Sold/i,
      /INSTANT\s*SAVINGS/i,
      /SEASONS\s*GREETINGS/i,
      /HAPPY\s*HOLIDAYS/i,
      /^\d{10,}$/, // Long number-only lines
      /^[A-Z]\s+\d+\.?\d*%/i, // Tax rate lines like "A 7.5% Tax"
      /TOTAL\s*TAX/i,
      /TOTAL\s*NUMBER/i,
      /Date\s*of\s*Birth/i,
      /^Name:/i,
      /^XX+/i, // Masked card numbers
      /\b(Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Way|Lane|Ln|Court|Ct|Place|Pl|Parkway|Pkwy|Highway|Hwy)\b/i, // Address lines
    ];

    // Pattern for item line: optionally starts with tax code (E, A, etc.), then item number (4-7 digits), followed by name
    // Examples: "1954841 IRIS BIN" or "E 1603075 ORG PFCT BAR" or "$843323 STRING CHEES" ($ is OCR error for 8)
    // Note: $ can be OCR error for 8 or S, so we allow it at the start of item numbers
    const itemLineRegex = /^(?:[A-Z]\s+)?([$]?\d{4,7}[A-Z]?)\s+(.+)$/i;

    // Pattern for price line: price followed by optional tax code (A, E, F, etc.)
    const priceLineRegex = /^(\d+\.\d{2})\s*([A-Z])?\s*$/;

    // Pattern for discount line: negative price like "8.00-A" or "800-A" (OCR may miss decimal)
    // Matches at start of line OR at end of line (right-aligned on receipts)
    // Captures: group 1 = amount (may or may not have decimal)
    const discountLineRegex = /(\d+(?:\.\d{2})?)-\s*([A-Z])?\s*$/;

    // Pattern for item with price on same line (with optional tax code prefix)
    // Note: $ can be OCR error for 8 or S
    const itemWithPriceRegex = /^(?:[A-Z]\s+)?([$]?\d{4,7}[A-Z]?)\s+(.+?)\s+(\d+\.\d{2})\s*([A-Z])?\s*$/i;

    // Track pending items waiting for prices (queue to handle multiple consecutive items)
    const pendingItems: Array<{ itemNumber: string; name: string; order: number }> = [];
    // Buffer for collecting consecutive prices when multiple items are pending
    const pendingPrices: Array<{ price: number; order: number }> = [];
    // Buffer for pending discounts (apply to first pending price when matching)
    const pendingDiscounts: Array<{ discount: number; order: number }> = [];
    let orphanPrice: { price: number; order: number } | null = null;

    // Collect raw items first (before merging duplicates)
    // Include order to track position on receipt
    const rawItems: Array<ParsedItem & { order: number; discount: number }> = [];

    // Track discounts to apply to items (keyed by price order)
    const discountsByPriceOrder = new Map<number, number>();

    // Helper function to apply pending discounts - stores them for later application to items
    const applyPendingDiscounts = (prices: Array<{ price: number; order: number }>) => {
      if (pendingDiscounts.length === 0 || prices.length === 0) return;

      // Sum all pending discounts and apply to first price's order
      const totalDiscount = pendingDiscounts.reduce((sum, d) => sum + d.discount, 0);
      discountsByPriceOrder.set(prices[0].order, totalDiscount);
      pendingDiscounts.length = 0;
    };

    // Helper function to match pending items with pending prices
    const matchPendingItemsAndPrices = () => {
      if (pendingItems.length === 0 || pendingPrices.length === 0) return;

      // Apply any pending discounts before matching
      applyPendingDiscounts(pendingPrices);

      // When we have equal counts, match in same order (FIFO)
      // Items and prices typically appear in the same order
      // (left column = items, right column = prices, both top to bottom)
      if (pendingItems.length === pendingPrices.length) {
        for (let k = 0; k < pendingItems.length; k++) {
          const item = pendingItems[k];
          const priceInfo = pendingPrices[k];
          const discount = discountsByPriceOrder.get(priceInfo.order) || 0;
          const totalPrice = Math.round((priceInfo.price - discount) * 100) / 100;
          rawItems.push({
            itemNumber: item.itemNumber,
            name: item.name,
            unitPrice: priceInfo.price,
            quantity: 1,
            discount: discount,
            totalPrice: totalPrice,
            order: item.order,
          });
        }
        pendingItems.length = 0;
        pendingPrices.length = 0;
      } else {
        // Different counts - use FIFO matching for what we can
        while (pendingItems.length > 0 && pendingPrices.length > 0) {
          const item = pendingItems.shift()!;
          const priceInfo = pendingPrices.shift()!;
          const discount = discountsByPriceOrder.get(priceInfo.order) || 0;
          const totalPrice = Math.round((priceInfo.price - discount) * 100) / 100;
          rawItems.push({
            itemNumber: item.itemNumber,
            name: item.name,
            unitPrice: priceInfo.price,
            quantity: 1,
            discount: discount,
            totalPrice: totalPrice,
            order: item.order,
          });
        }
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line || line.length < 2) {
        continue;
      }

      // These patterns should be skipped but NOT clear pending item
      // (barcodes and section markers can appear between item name and price due to OCR ordering)
      const skipButKeepPendingPatterns = [
        /^0{4,}\d+\s*\//, // Barcode lines like "0000366341 / 1935001"
        /^\d{10,}$/, // Long number-only lines (barcodes)
        /^[A-Z]$/, // Single letter lines (tax codes like "E" that got separated)
        /^[A-Z]{2,6}$/, // Multiple letter lines (tax codes like "EEE" or "EEEEEE")
        /[^\x00-\x7F]/, // Lines with non-ASCII characters (OCR garbage like "ययययय")
        /^SUBTOTAL$/i, // Subtotal marker (price may come after in OCR)
        /^TAX$/i, // Tax marker
        /^\*+\s*TOTAL/i, // Total marker
        /^XXXX+\d+/, // Masked card numbers
        /^AID:/i, // Card AID
        /^H$/, // Single H (often appears after card info)
      ];

      // Check if this is a line to skip but keep pending item
      if (skipButKeepPendingPatterns.some(pattern => pattern.test(line))) {
        // Before skipping, check if there's a discount at the end of the line (e.g., "0000349287 / 1316229 4.00-")
        const endOfLineDiscountMatch = line.match(/(\d+\.\d{2})-\s*([A-Z])?\s*$/);
        if (endOfLineDiscountMatch) {
          const discount = parseFloat(endOfLineDiscountMatch[1]);
          // Apply discount to last raw item or buffer it
          if (rawItems.length > 0) {
            const lastItem = rawItems[rawItems.length - 1];
            lastItem.discount = (lastItem.discount || 0) + discount;
            lastItem.totalPrice = Math.round((lastItem.unitPrice * lastItem.quantity - lastItem.discount) * 100) / 100;
          } else if (pendingPrices.length > 0) {
            const firstPrice = pendingPrices[0];
            const existing = discountsByPriceOrder.get(firstPrice.order) || 0;
            discountsByPriceOrder.set(firstPrice.order, existing + discount);
          } else if (pendingItems.length > 0) {
            pendingDiscounts.push({ discount, order: i });
          }
        }
        continue;
      }

      // Skip non-item lines - these clear pending items queue
      if (skipPatterns.some(pattern => pattern.test(line))) {
        matchPendingItemsAndPrices(); // Try to match before clearing
        pendingItems.length = 0;
        pendingPrices.length = 0;
        continue;
      }

      // Check if this is a price line
      const priceMatch = line.match(priceLineRegex);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1]);
        if (price >= 0.01 && price < 10000) {
          if (pendingItems.length > 0) {
            // Add to pending prices buffer
            pendingPrices.push({ price, order: i });

            // If we have only 1 pending item, match immediately (no multi-column ambiguity)
            if (pendingItems.length === 1 && pendingPrices.length === 1) {
              matchPendingItemsAndPrices();
            }
          } else {
            // No pending item - save as orphan price for potential later use
            orphanPrice = { price, order: i };
          }
        }
        continue;
      }

      // Check for discount line
      const discountMatch = line.match(discountLineRegex);
      if (discountMatch) {
        let discount = parseFloat(discountMatch[1]);
        // If no decimal in original (e.g., "800" instead of "8.00"), divide by 100
        if (!discountMatch[1].includes('.')) {
          discount = discount / 100;
        }

        // If we have pending prices, store discount for that price order
        if (pendingPrices.length > 0) {
          const firstPrice = pendingPrices[0];
          const existing = discountsByPriceOrder.get(firstPrice.order) || 0;
          discountsByPriceOrder.set(firstPrice.order, existing + discount);
        }
        // If items are pending but no prices yet, buffer the discount
        else if (pendingItems.length > 0) {
          pendingDiscounts.push({ discount, order: i });
        }
        // If we have raw items, apply to last item
        else if (rawItems.length > 0) {
          const lastItem = rawItems[rawItems.length - 1];
          lastItem.discount = (lastItem.discount || 0) + discount;
          lastItem.totalPrice = Math.round((lastItem.unitPrice * lastItem.quantity - lastItem.discount) * 100) / 100;
        }
        continue;
      }

      // Check for item with price on same line
      const itemWithPriceMatch = line.match(itemWithPriceRegex);
      if (itemWithPriceMatch) {
        // First, resolve any pending items using orphanPrice if available
        if (pendingItems.length > 0 && orphanPrice) {
          const item = pendingItems.shift()!;
          const discount = discountsByPriceOrder.get(orphanPrice.order) || 0;
          rawItems.push({
            itemNumber: item.itemNumber,
            name: item.name,
            unitPrice: orphanPrice.price,
            quantity: 1,
            discount: discount,
            totalPrice: Math.round((orphanPrice.price - discount) * 100) / 100,
            order: item.order,
          });
          orphanPrice = null;
        }

        const itemNumber = itemWithPriceMatch[1];
        const name = this.cleanItemName(itemWithPriceMatch[2]);
        const price = parseFloat(itemWithPriceMatch[3]);

        if (name.length >= 2 && price >= 0.01 && price < 10000) {
          rawItems.push({
            itemNumber,
            name,
            unitPrice: price,
            quantity: 1,
            discount: 0,
            totalPrice: price,
            order: i,  // Use current line number as order
          });
        }
        continue;
      }

      // Check if this is an item line (number + name, price on next line)
      const itemMatch = line.match(itemLineRegex);
      if (itemMatch) {
        // Before adding new item, try to match any pending items with buffered prices
        // This handles the case where prices were collected and now we're seeing the next item
        if (pendingPrices.length > 0 && pendingItems.length > 0) {
          matchPendingItemsAndPrices();
        }

        const itemNumber = itemMatch[1];
        const name = this.cleanItemName(itemMatch[2]);

        if (name.length >= 2) {
          // Add to pending items queue
          pendingItems.push({ itemNumber, name, order: i });
        }
        continue;
      }

      // Unrecognized line - don't clear pending items (could be noise between item and price)
    }

    // At end of lines, try to match any remaining pending items with buffered prices
    matchPendingItemsAndPrices();

    // Handle any remaining pending items using orphan price
    while (pendingItems.length > 0 && orphanPrice) {
      const item = pendingItems.shift()!;
      const discount = discountsByPriceOrder.get(orphanPrice.order) || 0;
      rawItems.push({
        itemNumber: item.itemNumber,
        name: item.name,
        unitPrice: orphanPrice.price,
        quantity: 1,
        discount: discount,
        totalPrice: Math.round((orphanPrice.price - discount) * 100) / 100,
        order: item.order,
      });
      orphanPrice = null;
    }

    // Merge duplicate items (same name + same price)
    const mergedItems = mergeDuplicateItems(rawItems);

    // Assign merged items to result
    result.items = mergedItems;
  }

  /**
   * Clean up item name by removing item numbers and extra whitespace
   */
  private cleanItemName(name: string): string {
    return name
      .replace(/^\d{5,7}\s*/, '') // Remove leading item numbers
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .replace(/^[A-Z]\s+/, '')   // Remove single letter prefixes
      .trim();
  }

  /**
   * Check if a line looks like metadata rather than a product
   */
  private isMetadataLine(text: string): boolean {
    const metadataPatterns = [
      /^\d+\/\d+\/\d+/, // Dates
      /^\d+:\d+/, // Times
      /^[#*]+/, // Special characters
      /^\d+\s+\d+\s+\d+/, // Multiple numbers (could be transaction info)
      /REG(ISTER)?/i,
      /CASHIER/i,
      /OP(ERATOR)?(\s|$)/i,
      /TRN/i,
    ];

    return metadataPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Extract total amount from receipt text
   */
  private extractTotal(text: string, result: ParsedReceiptData): void {
    const lines = text.split('\n').map(l => l.trim());

    // PRIORITY 1: Look for FIRST **** TOTAL followed by amount
    // After **** TOTAL we may see:
    //   - Masked card number (XXXX5089)
    //   - Random item prices from multi-column OCR (59.99 A)
    //   - Subtotal, Tax, Total values as standalone numbers (427.03, 25.39, 452.42)
    // The actual TOTAL is typically the LARGEST standalone number in this section
    for (let i = 0; i < lines.length; i++) {
      if (/^\*+\s*TOTAL/i.test(lines[i])) {
        // Collect all standalone price values in the next several lines
        const priceValues: number[] = [];
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          const line = lines[j];
          // Stop if we hit another section marker
          if (/^(CHANGE|APPROVED|Costco Visa|A \d+\.\d+% Tax|E \d+\.\d+% Tax|TOTAL NUMBER|INSTANT SAVINGS)/i.test(line)) {
            break;
          }
          // Match standalone prices (not prices with tax codes like "59.99 A")
          const priceMatch = line.match(/^(\d+\.\d{2})$/);
          if (priceMatch) {
            priceValues.push(parseFloat(priceMatch[1]));
          }
        }

        // The actual total is the largest value (total > subtotal > tax)
        if (priceValues.length > 0) {
          result.totalAmount = Math.max(...priceValues);
          return;
        }
      }
    }

    // PRIORITY 2: Look for various total patterns
    const totalPatterns = [
      /TOTAL\s+\$?\s*(\d+\.\d{2})/i,                     // TOTAL $XX.XX
      /BALANCE\s+DUE\s+\$?\s*(\d+\.\d{2})/i,            // BALANCE DUE $XX.XX
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.totalAmount = parseFloat(match[1]);
        return;
      }
    }

    // Fallback: Calculate from items
    if (result.items.length > 0) {
      result.totalAmount = result.items.reduce((sum, item) => sum + item.totalPrice, 0);
      result.totalAmount = Math.round(result.totalAmount * 100) / 100;
    }
  }

  /**
   * Process receipt image: extract text and parse data
   */
  async processReceipt(imageBuffer: Buffer): Promise<ParsedReceiptData> {
    try {
      const text = await this.extractText(imageBuffer);

      if (!text) {
        return this.getDefaultReceiptData();
      }

      return this.parseReceiptText(text);
    } catch (error) {
      console.error('Error processing receipt:', error);
      return this.getDefaultReceiptData();
    }
  }

  /**
   * Get default empty receipt data structure
   */
  private getDefaultReceiptData(): ParsedReceiptData {
    return {
      storeName: '',
      storeLocation: '',
      storeCity: '',
      storeState: '',
      storeZip: '',
      purchaseDate: new Date(),
      totalAmount: 0,
      items: [],
    };
  }
}

export const ocrService = new OCRService();
export default ocrService;
