import { ImageAnnotatorClient } from '@google-cloud/vision';

function mergeDuplicateItems(items: Array<{
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  itemNumber?: string;
  order: number;
}>): Array<{
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  itemNumber?: string;
  item_order: number;
}> {
  if (!items || items.length === 0) return [];

  const itemMap = new Map<string, {
    name: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    itemNumber?: string;
    order: number;
  }>();

  for (const item of items) {
    if (typeof item.unitPrice !== 'number' || isNaN(item.unitPrice) || item.unitPrice <= 0) continue;

    let key: string;
    if (item.itemNumber) {
      key = item.itemNumber;
    } else {
      const normalizedName = item.name.toLowerCase().trim().replace(/\s+/g, ' ');
      key = `${normalizedName}|${item.unitPrice.toFixed(2)}`;
    }

    if (itemMap.has(key)) {
      const existing = itemMap.get(key)!;
      existing.quantity += 1;
      existing.totalPrice = Math.round((existing.totalPrice + item.totalPrice) * 100) / 100;
      existing.unitPrice = Math.round((existing.totalPrice / existing.quantity) * 100) / 100;
      existing.order = Math.min(existing.order, item.order);
    } else {
      itemMap.set(key, {
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity || 1,
        totalPrice: item.totalPrice,
        itemNumber: item.itemNumber,
        order: item.order,
      });
    }
  }

  const mergedItems = Array.from(itemMap.values());
  mergedItems.sort((a, b) => a.order - b.order);

  return mergedItems.map(({ order, ...item }) => ({
    ...item,
    item_order: order,
  }));
}

export interface ParsedItem {
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  totalPrice: number;
  itemNumber?: string;
  item_order?: number;
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
  rawText?: string;
}

let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (visionClient) return visionClient;

  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    visionClient = new ImageAnnotatorClient({ credentials });
  } else {
    throw new Error('No Google credentials configured');
  }

  return visionClient;
}

export async function extractText(imageBuffer: Buffer): Promise<string> {
  const client = getVisionClient();
  const [result] = await client.textDetection({
    image: { content: imageBuffer },
  });

  const textAnnotations = result.textAnnotations;
  if (!textAnnotations || textAnnotations.length === 0) return '';

  return textAnnotations[0].description || '';
}

function cleanItemName(name: string): string {
  return name
    .replace(/^\d{5,7}\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/^[A-Z]\s+/, '')
    .trim();
}

export function parseReceiptText(text: string): ParsedReceiptData {
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

  if (!text || text.trim().length === 0) return result;

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Store name detection
  if (/COSTCO\s*WHOLESALE/i.test(text)) result.storeName = 'Costco Wholesale';
  else if (/WALMART/i.test(text)) result.storeName = 'Walmart';
  else if (/TARGET/i.test(text)) result.storeName = 'Target';
  else if (/SAFEWAY/i.test(text)) result.storeName = 'Safeway';
  else if (/KROGER/i.test(text)) result.storeName = 'Kroger';
  else if (/TRADER\s*JOE/i.test(text)) result.storeName = "Trader Joe's";
  else if (/WHOLE\s*FOODS/i.test(text)) result.storeName = 'Whole Foods';
  else if (/ALDI/i.test(text)) result.storeName = 'Aldi';

  // Extract address - look for street address pattern in first 15 lines
  const addressLines = lines.slice(0, 15);

  // Look for street address (number + street name)
  const streetPattern = /^(\d+\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z]+\s*)+(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|WAY|CT|COURT|PL|PLACE|PKWY|PARKWAY|HWY|HIGHWAY)\.?)$/i;
  for (const line of addressLines) {
    const streetMatch = line.match(streetPattern);
    if (streetMatch) {
      result.storeLocation = streetMatch[1].trim();
      break;
    }
  }

  // Look for City, State ZIP pattern
  const cityStateZipPattern = /^([A-Za-z\s]+),?\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/;
  for (const line of addressLines) {
    const match = line.match(cityStateZipPattern);
    if (match) {
      result.storeCity = match[1].trim();
      result.storeState = match[2];
      result.storeZip = match[3];
      break;
    }
  }

  // Alternative: Look for just City, State (no ZIP on same line)
  if (!result.storeCity) {
    const cityStatePattern = /^([A-Za-z\s]+),\s*([A-Z]{2})$/;
    for (const line of addressLines) {
      const match = line.match(cityStatePattern);
      if (match) {
        result.storeCity = match[1].trim();
        result.storeState = match[2];
        break;
      }
    }
  }

  // Look for standalone ZIP code if not found
  if (!result.storeZip) {
    const zipPattern = /^(\d{5}(?:-\d{4})?)$/;
    for (const line of addressLines) {
      const match = line.match(zipPattern);
      if (match) {
        result.storeZip = match[1];
        break;
      }
    }
  }

  // Extract date
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let year = parseInt(match[3], 10);
      if (year < 100) year += 2000;
      const month = parseInt(match[1], 10) - 1;
      const day = parseInt(match[2], 10);
      const parsedDate = new Date(year, month, day);
      if (!isNaN(parsedDate.getTime())) {
        result.purchaseDate = parsedDate;
        break;
      }
    }
  }

  // Extract items
  const skipPatterns = [
    /^COSTCO/i, /^WHOLESALE/i, /^SUBTOTAL$/i, /^TAX$/i, /^\*+\s*TOTAL/i,
    /^TOTAL\s/i, /BALANCE/i, /^CHANGE$/i, /APPROVED/i, /VISA/i,
    /^MEMBER/i, /^\d{12,}/, /TERMINAL/i, /THANK\s*YOU/i,
  ];

  const itemLineRegex = /^(?:[A-Z]\s+)?([$]?\d{4,7}[A-Z]?)\s+(.+)$/i;
  const priceLineRegex = /^(\d+\.\d{2})\s*([A-Z])?\s*$/;
  const itemWithPriceRegex = /^(?:[A-Z]\s+)?([$]?\d{4,7}[A-Z]?)\s+(.+?)\s+(\d+\.\d{2})\s*([A-Z])?\s*$/i;
  // Match discounts at start of line (8.00-) or end of line (... 8.00-)
  const discountLineRegex = /(\d+\.\d{2})-\s*$/;

  const unmatchedItems: Array<{ itemNumber: string; name: string; order: number; matched: boolean }> = [];
  const rawItems: Array<ParsedItem & { order: number }> = [];

  // Proximity-based matching: find closest unmatched item above the price
  const matchPriceToItem = (price: number, priceLineOrder: number) => {
    // Look backward from the price line to find the nearest unmatched item
    let bestMatch: typeof unmatchedItems[0] | null = null;
    let minDistance = Infinity;

    for (const item of unmatchedItems) {
      if (item.matched) continue;

      // Price should be after or on the same line as the item
      const distance = priceLineOrder - item.order;
      if (distance >= 0 && distance < minDistance) {
        minDistance = distance;
        bestMatch = item;
      }
    }

    if (bestMatch) {
      bestMatch.matched = true;
      rawItems.push({
        itemNumber: bestMatch.itemNumber,
        name: bestMatch.name,
        unitPrice: price,
        quantity: 1,
        discount: 0,
        totalPrice: price,
        order: bestMatch.order,
      });
      return true;
    }
    return false;
  };

  // Proximity-based discount matching: apply discount to nearest item above
  const applyDiscountToItem = (discountAmount: number, discountLineOrder: number) => {
    if (rawItems.length === 0) return false;

    // Find the item with the closest order number that's before the discount line
    let bestMatch: (typeof rawItems)[0] | null = null;
    let minDistance = Infinity;

    for (const item of rawItems) {
      const distance = discountLineOrder - item.order;
      // Discount should be after the item (within a reasonable range, e.g., 3 lines)
      if (distance > 0 && distance <= 3 && distance < minDistance) {
        minDistance = distance;
        bestMatch = item;
      }
    }

    if (bestMatch) {
      // Store the discount value and recalculate total
      bestMatch.discount = (bestMatch.discount || 0) + discountAmount;
      bestMatch.totalPrice = Math.round((bestMatch.unitPrice * bestMatch.quantity - bestMatch.discount) * 100) / 100;
      return true;
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 2) continue;
    if (skipPatterns.some(pattern => pattern.test(line))) {
      // Clear unmatched items when we hit skip patterns (section boundaries)
      unmatchedItems.length = 0;
      continue;
    }

    // First, try to match item+price on same line (most reliable)
    const itemWithPriceMatch = line.match(itemWithPriceRegex);
    if (itemWithPriceMatch) {
      const name = cleanItemName(itemWithPriceMatch[2]);
      const price = parseFloat(itemWithPriceMatch[3]);
      if (name.length >= 2 && price >= 0.01 && price < 10000) {
        rawItems.push({
          itemNumber: itemWithPriceMatch[1],
          name,
          unitPrice: price,
          quantity: 1,
          discount: 0,
          totalPrice: price,
          order: i,
        });
      }
      continue;
    }

    // Check for standalone price - use proximity matching
    const priceMatch = line.match(priceLineRegex);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      if (price >= 0.01 && price < 10000) {
        matchPriceToItem(price, i);
      }
      continue;
    }

    // Check for discount line - use proximity-based matching
    const discountMatch = line.match(discountLineRegex);
    if (discountMatch && rawItems.length > 0) {
      let discount = parseFloat(discountMatch[1]);
      if (!discountMatch[1].includes('.')) discount = discount / 100;
      applyDiscountToItem(discount, i);
      continue;
    }

    // Item line without price - add to unmatched items
    const itemMatch = line.match(itemLineRegex);
    if (itemMatch) {
      const name = cleanItemName(itemMatch[2]);
      if (name.length >= 2) {
        unmatchedItems.push({
          itemNumber: itemMatch[1],
          name,
          order: i,
          matched: false
        });
      }
    }
  }

  result.items = mergeDuplicateItems(rawItems);

  // Extract total
  for (let i = 0; i < lines.length; i++) {
    if (/^\*+\s*TOTAL/i.test(lines[i])) {
      const priceValues: number[] = [];
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const priceMatch = lines[j].match(/^(\d+\.\d{2})$/);
        if (priceMatch) priceValues.push(parseFloat(priceMatch[1]));
      }
      if (priceValues.length > 0) {
        result.totalAmount = Math.max(...priceValues);
        return result;
      }
    }
  }

  const totalMatch = text.match(/TOTAL\s+\$?\s*(\d+\.\d{2})/i);
  if (totalMatch) result.totalAmount = parseFloat(totalMatch[1]);
  else if (result.items.length > 0) {
    result.totalAmount = Math.round(result.items.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
  }

  return result;
}

export async function processReceipt(imageBuffer: Buffer): Promise<ParsedReceiptData> {
  const text = await extractText(imageBuffer);
  if (!text) {
    return {
      storeName: '', storeLocation: '', storeCity: '', storeState: '', storeZip: '',
      purchaseDate: new Date(), totalAmount: 0, items: [],
    };
  }
  return parseReceiptText(text);
}
