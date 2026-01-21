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

    // DEBUG: Log first 50 lines of extracted text
    const debugLines = text.split('\n').slice(0, 50);
    console.log('[OCR DEBUG] First 50 lines of extracted text:');
    debugLines.forEach((line, idx) => console.log(`${idx}: ${line}`));
    console.log('[OCR DEBUG] ---End of debug output---');

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

    // Pattern for discount line - two formats:
    // 1. Negative price: "8.00-A" or "1103106 5.00-"
    // 2. Barcode/item format: "0000349046 /1103106" followed by price on same or next line
    // Captures: group 1 = optional item number (from barcode line or prefix), group 2 = amount (may or may not have decimal), group 3 = optional tax code
    const discountLineRegex = /(?:([$]?\d{4,7}[A-Z]?)\s+)?(\d+(?:\.\d{2})?)-\s*([A-Z])?\s*$/;

    // Pattern for Costco-style discount with barcode: "0000349046 /1103106" or "0000349046 /1103106 5.00"
    // Captures: group 1 = item number after slash, group 2 = optional price
    const barcodeDiscountLineRegex = /^0{4,}\d+\s*\/\s*([$]?\d{4,7}[A-Z]?)(?:\s+(\d+\.\d{2}))?/;

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

    // Track discounts by item number (for Costco-style receipts where discount line includes item number)
    const discountsByItemNumber = new Map<string, number>();

    // Track pending discount item numbers from barcode lines (e.g., "0000349046 /1103106")
    // This is used when discount line appears later without item number
    let pendingDiscountItemNumber: string | null = null;
    let lastBarcodeItemNumber: string | null = null;

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

      // DEBUG: Log matching info
      console.log(`[OCR DEBUG] Matching ${pendingItems.length} items with ${pendingPrices.length} prices`);
      console.log('[OCR DEBUG] Items:', pendingItems.map(i => `${i.itemNumber} ${i.name} (line ${i.order})`));
      console.log('[OCR DEBUG] Prices:', pendingPrices.map(p => `$${p.price} (line ${p.order})`));

      // When we have equal counts, find optimal matching by trying different orderings
      // This handles cases where OCR reads items and prices in different orders
      if (pendingItems.length === pendingPrices.length) {
        // Use greedy matching for all counts
        // Process items in order of their minimum distance to any unused price
        const usedItems = new Set<number>();
        const usedPrices = new Set<number>();
        const bestMatching: Array<{ itemIdx: number; priceIdx: number }> = [];

        while (usedItems.size < pendingItems.length) {
          let bestItemIdx = -1;
          let bestPriceIdx = -1;
          let bestDistance = Infinity;

          // Find the item-price pair with smallest distance
          for (let i = 0; i < pendingItems.length; i++) {
            if (usedItems.has(i)) continue;

            for (let j = 0; j < pendingPrices.length; j++) {
              if (usedPrices.has(j)) continue;
              const distance = Math.abs(pendingItems[i].order - pendingPrices[j].order);
              if (distance < bestDistance) {
                bestDistance = distance;
                bestItemIdx = i;
                bestPriceIdx = j;
              }
            }
          }

          if (bestItemIdx !== -1 && bestPriceIdx !== -1) {
            usedItems.add(bestItemIdx);
            usedPrices.add(bestPriceIdx);
            bestMatching.push({ itemIdx: bestItemIdx, priceIdx: bestPriceIdx });
          } else {
            break;
          }
        }

        // Apply the best matching
        for (const { itemIdx, priceIdx } of bestMatching) {
          const item = pendingItems[itemIdx];
          const priceInfo = pendingPrices[priceIdx];

          // Check for discount by item number first, fallback to price order
          const discountByItemNumber = discountsByItemNumber.get(item.itemNumber) || 0;
          const discountByOrder = discountsByPriceOrder.get(priceInfo.order) || 0;
          const discount = discountByItemNumber || discountByOrder;
          const totalPrice = Math.round((priceInfo.price - discount) * 100) / 100;

          const distance = Math.abs(item.order - priceInfo.order);
          console.log(`[OCR DEBUG] Matched (optimal): ${item.itemNumber} ${item.name} (line ${item.order}) -> $${priceInfo.price} (line ${priceInfo.order}, distance: ${distance}, discount: $${discount})`);

          // If we used discount by item number, remove it from map to prevent double application
          if (discountByItemNumber > 0) {
            discountsByItemNumber.delete(item.itemNumber);
            console.log(`[OCR DEBUG] Removed discount from map for ${item.itemNumber} (already applied)`);
          }

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
          // Check for discount by item number first, fallback to price order
          const discountByItemNumber = discountsByItemNumber.get(item.itemNumber) || 0;
          const discountByOrder = discountsByPriceOrder.get(priceInfo.order) || 0;
          const discount = discountByItemNumber || discountByOrder;
          const totalPrice = Math.round((priceInfo.price - discount) * 100) / 100;

          console.log(`[OCR DEBUG] Matched (unequal): ${item.itemNumber} ${item.name} -> $${priceInfo.price} (discount: $${discount})`);

          // If we used discount by item number, remove it from map to prevent double application
          if (discountByItemNumber > 0) {
            discountsByItemNumber.delete(item.itemNumber);
            console.log(`[OCR DEBUG] Removed discount from map for ${item.itemNumber} (already applied)`);
          }

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
        /[^\x00-\x7F]/, // Lines with non-ASCII characters (OCR garbage like "యయயயய")
        /^SUBTOTAL$/i, // Subtotal marker (price may come after in OCR)
        /^TAX$/i, // Tax marker
        /^\*+\s*TOTAL/i, // Total marker
        /^XXXX+\d+/, // Masked card numbers
        /^AID:/i, // Card AID
        /^H$/, // Single H (often appears after card info)
        /Date\s*of\s*Birth/i, // Date of birth verification lines (Costco alcohol purchases)
        /KEYED/i, // Manual entry indicators
      ];

      // Check if this is a line to skip but keep pending item
      if (skipButKeepPendingPatterns.some(pattern => pattern.test(line))) {
        // Check for Costco-style barcode discount line: "0000349046 /1103106" or "0000349046 /1103106 5.00"
        const barcodeDiscountMatch = line.match(barcodeDiscountLineRegex);
        if (barcodeDiscountMatch) {
          const itemNumber = barcodeDiscountMatch[1];
          const price = barcodeDiscountMatch[2];

          console.log(`[OCR DEBUG] Found barcode discount line for item ${itemNumber}${price ? ` with price $${price}` : ' (no price on same line)'}`);

          if (price) {
            // Price is on same line - apply discount immediately
            const discount = parseFloat(price);
            const existing = discountsByItemNumber.get(itemNumber) || 0;
            discountsByItemNumber.set(itemNumber, existing + discount);
            console.log(`[OCR DEBUG] Applied barcode discount $${discount} to item ${itemNumber}`);
          } else {
            // Barcode line without price - track it for later discount line
            // The discount will appear in a later line ending with '-'
            lastBarcodeItemNumber = itemNumber;
            console.log(`[OCR DEBUG] Tracking barcode item ${itemNumber} for upcoming discount line`);
          }
          continue;
        }

        // Before skipping, check if there's a discount at the end of the line (e.g., "0000349287 / 1316229 4.00-")
        // This may also include item number: "1103106 5.00-"
        const endOfLineDiscountMatch = line.match(/(?:([$]?\d{4,7}[A-Z]?)\s+)?(\d+\.\d{2})-\s*([A-Z])?\s*$/);
        if (endOfLineDiscountMatch) {
          const itemNumber = endOfLineDiscountMatch[1];
          const discount = parseFloat(endOfLineDiscountMatch[2]);

          // If discount includes item number, store by item number
          if (itemNumber) {
            const existing = discountsByItemNumber.get(itemNumber) || 0;
            discountsByItemNumber.set(itemNumber, existing + discount);
          }
          // Otherwise apply discount to last raw item or buffer it
          else if (rawItems.length > 0) {
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
        // Also clear barcode item number when we hit skip patterns (moved to different section)
        if (lastBarcodeItemNumber) {
          console.log(`[OCR DEBUG] Clearing barcode item number ${lastBarcodeItemNumber} due to skip pattern`);
          lastBarcodeItemNumber = null;
        }
        continue;
      }

      // Check if this is a price line
      const priceMatch = line.match(priceLineRegex);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1]);
        if (price >= 0.01 && price < 10000) {
          // Don't treat regular prices as discount amounts even if we saw a barcode line
          // The barcode lines are just metadata - actual discounts come from lines ending with '-'
          // Clear pendingDiscountItemNumber if we hit a regular price (it means the barcode was just metadata)
          if (pendingDiscountItemNumber) {
            console.log(`[OCR DEBUG] Clearing pending discount item number ${pendingDiscountItemNumber} - barcode was metadata only`);
            pendingDiscountItemNumber = null;
          }

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
        let itemNumber = discountMatch[1]; // May be undefined if no item number
        let discount = parseFloat(discountMatch[2]);
        // If no decimal in original (e.g., "800" instead of "8.00"), divide by 100
        if (!discountMatch[2].includes('.')) {
          discount = discount / 100;
        }

        // If no item number in discount line, check if we have a tracked barcode item number
        if (!itemNumber && lastBarcodeItemNumber) {
          itemNumber = lastBarcodeItemNumber;
          console.log(`[OCR DEBUG] Discount line $${discount} without item number - using tracked barcode item ${itemNumber}`);
          lastBarcodeItemNumber = null; // Clear after using
        }

        // If discount line includes item number (or we got it from barcode), store it by item number
        if (itemNumber) {
          const existing = discountsByItemNumber.get(itemNumber) || 0;
          discountsByItemNumber.set(itemNumber, existing + discount);
          console.log(`[OCR DEBUG] Applied discount $${discount} to item ${itemNumber} by item number`);
        }
        // Otherwise use the old sequential logic
        else if (pendingPrices.length > 0) {
          // If we have pending prices, store discount for that price order
          const firstPrice = pendingPrices[0];
          const existing = discountsByPriceOrder.get(firstPrice.order) || 0;
          discountsByPriceOrder.set(firstPrice.order, existing + discount);
          console.log(`[OCR DEBUG] Applied discount $${discount} to pending price order ${firstPrice.order}`);
        }
        // If items are pending but no prices yet, buffer the discount
        else if (pendingItems.length > 0) {
          pendingDiscounts.push({ discount, order: i });
          console.log(`[OCR DEBUG] Buffered discount $${discount} for pending items`);
        }
        // If we have raw items, apply to last item
        else if (rawItems.length > 0) {
          const lastItem = rawItems[rawItems.length - 1];
          lastItem.discount = (lastItem.discount || 0) + discount;
          lastItem.totalPrice = Math.round((lastItem.unitPrice * lastItem.quantity - lastItem.discount) * 100) / 100;
          console.log(`[OCR DEBUG] Applied discount $${discount} to last raw item ${lastItem.itemNumber}`);
        }
        continue;
      }

      // Check for item with price on same line
      const itemWithPriceMatch = line.match(itemWithPriceRegex);
      if (itemWithPriceMatch) {
        // First, resolve any pending items using orphanPrice if available
        if (pendingItems.length > 0 && orphanPrice) {
          const item = pendingItems.shift()!;
          // Check for discount by item number first, fallback to price order
          const discountByItemNumber = discountsByItemNumber.get(item.itemNumber) || 0;
          const discountByOrder = discountsByPriceOrder.get(orphanPrice.order) || 0;
          const discount = discountByItemNumber || discountByOrder;

          // If we used discount by item number, remove it from map to prevent double application
          if (discountByItemNumber > 0) {
            discountsByItemNumber.delete(item.itemNumber);
          }

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
          // Check for discount by item number
          const discount = discountsByItemNumber.get(itemNumber) || 0;

          // If we used discount by item number, remove it from map to prevent double application
          if (discount > 0) {
            discountsByItemNumber.delete(itemNumber);
          }

          rawItems.push({
            itemNumber,
            name,
            unitPrice: price,
            quantity: 1,
            discount: discount,
            totalPrice: Math.round((price - discount) * 100) / 100,
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
      // Check for discount by item number first, fallback to price order
      const discountByItemNumber = discountsByItemNumber.get(item.itemNumber) || 0;
      const discountByOrder = discountsByPriceOrder.get(orphanPrice.order) || 0;
      const discount = discountByItemNumber || discountByOrder;

      // If we used discount by item number, remove it from map to prevent double application
      if (discountByItemNumber > 0) {
        discountsByItemNumber.delete(item.itemNumber);
      }

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

    // Apply any remaining discounts by item number to raw items
    // This handles cases where discount appears after the item (e.g., Costco barcode discounts)
    for (const item of rawItems) {
      if (item.itemNumber && discountsByItemNumber.has(item.itemNumber)) {
        const additionalDiscount = discountsByItemNumber.get(item.itemNumber)!;
        item.discount = (item.discount || 0) + additionalDiscount;
        item.totalPrice = Math.round((item.unitPrice * item.quantity - item.discount) * 100) / 100;
        // Remove from map so it's not applied again during merge
        discountsByItemNumber.delete(item.itemNumber);
      }
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
