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
  const discountLineRegex = /^(\d+(?:\.\d{2})?)-([A-Z])?\s*$/;

  const pendingItems: Array<{ itemNumber: string; name: string; order: number }> = [];
  const pendingPrices: Array<{ price: number; order: number }> = [];
  const rawItems: Array<ParsedItem & { order: number }> = [];

  const matchPendingItemsAndPrices = () => {
    if (pendingItems.length === 0 || pendingPrices.length === 0) return;
    while (pendingItems.length > 0 && pendingPrices.length > 0) {
      const item = pendingItems.shift()!;
      const priceInfo = pendingPrices.shift()!;
      rawItems.push({
        itemNumber: item.itemNumber,
        name: item.name,
        unitPrice: priceInfo.price,
        quantity: 1,
        totalPrice: priceInfo.price,
        order: item.order,
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 2) continue;
    if (skipPatterns.some(pattern => pattern.test(line))) {
      matchPendingItemsAndPrices();
      pendingItems.length = 0;
      pendingPrices.length = 0;
      continue;
    }

    const priceMatch = line.match(priceLineRegex);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      if (price >= 0.01 && price < 10000 && pendingItems.length > 0) {
        pendingPrices.push({ price, order: i });
        if (pendingItems.length === 1 && pendingPrices.length === 1) {
          matchPendingItemsAndPrices();
        }
      }
      continue;
    }

    const discountMatch = line.match(discountLineRegex);
    if (discountMatch && rawItems.length > 0) {
      let discount = parseFloat(discountMatch[1]);
      if (!discountMatch[1].includes('.')) discount = discount / 100;
      const lastItem = rawItems[rawItems.length - 1];
      lastItem.totalPrice = Math.round((lastItem.totalPrice - discount) * 100) / 100;
      lastItem.unitPrice = lastItem.totalPrice / lastItem.quantity;
      continue;
    }

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
          totalPrice: price,
          order: i,
        });
      }
      continue;
    }

    const itemMatch = line.match(itemLineRegex);
    if (itemMatch) {
      if (pendingPrices.length > 0 && pendingItems.length > 0) {
        matchPendingItemsAndPrices();
      }
      const name = cleanItemName(itemMatch[2]);
      if (name.length >= 2) {
        pendingItems.push({ itemNumber: itemMatch[1], name, order: i });
      }
    }
  }

  matchPendingItemsAndPrices();
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
