import { ImageAnnotatorClient } from '@google-cloud/vision';

export interface ParsedItem {
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
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
}

class OCRService {
  private visionClient: ImageAnnotatorClient;

  constructor() {
    try {
      // Initialize with credentials from environment variable
      this.visionClient = new ImageAnnotatorClient({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      });
      console.log('Google Vision API client initialized');
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
      console.log('Extracting text from image...');

      const [result] = await this.visionClient.textDetection({
        image: { content: imageBuffer },
      });

      const textAnnotations = result.textAnnotations;

      if (!textAnnotations || textAnnotations.length === 0) {
        console.log('No text found in image');
        return '';
      }

      // First annotation contains the full text
      const fullText = textAnnotations[0].description || '';
      console.log(`Extracted ${fullText.length} characters from image`);

      return fullText;
    } catch (error) {
      console.error('Vision API error:', error);
      throw new Error('Failed to extract text from receipt');
    }
  }

  /**
   * Parse Costco-specific receipt text format
   */
  parseReceiptText(text: string): ParsedReceiptData {
    console.log('Parsing receipt text...');

    const result: ParsedReceiptData = {
      storeName: 'Costco',
      storeLocation: '',
      storeCity: '',
      storeState: '',
      storeZip: '',
      purchaseDate: new Date(),
      totalAmount: 0,
      items: [],
    };

    if (!text || text.trim().length === 0) {
      console.log('Empty text provided for parsing');
      return result;
    }

    const lines = text.split('\n').map(line => line.trim());

    // Extract store name
    const storeNameMatch = text.match(/COSTCO\s*WHOLESALE/i);
    if (storeNameMatch) {
      result.storeName = 'Costco Wholesale';
      console.log('Found store name: Costco Wholesale');
    }

    // Extract store address
    // Pattern: street number, street name, city, state (2 letters), ZIP (5 digits)
    const addressRegex = /(\d+)\s+([A-Za-z\s]+?)[\s,]+([A-Za-z\s]+?)[\s,]+([A-Z]{2})[\s,]+(\d{5})/i;
    const addressMatch = text.match(addressRegex);
    if (addressMatch) {
      result.storeLocation = `${addressMatch[1]} ${addressMatch[2].trim()}`;
      result.storeCity = addressMatch[3].trim();
      result.storeState = addressMatch[4].toUpperCase();
      result.storeZip = addressMatch[5];
      console.log(`Found address: ${result.storeLocation}, ${result.storeCity}, ${result.storeState} ${result.storeZip}`);
    }

    // Extract purchase date
    const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      const parsedDate = new Date(dateMatch[1]);
      if (!isNaN(parsedDate.getTime())) {
        result.purchaseDate = parsedDate;
        console.log(`Found purchase date: ${parsedDate.toISOString()}`);
      }
    }

    // Extract line items
    // Costco format variations: "ITEM NAME    QTY    PRICE" or "ITEM NAME    PRICE"
    const itemRegex = /^(.+?)\s+(\d+)\s+\$?([\d,]+\.?\d{0,2})$/;
    const singleItemRegex = /^(.+?)\s+\$?([\d,]+\.\d{2})$/;

    for (const line of lines) {
      // Try quantity format first
      let match = line.match(itemRegex);
      if (match) {
        const name = match[1].trim();
        const quantity = parseInt(match[2], 10);
        const totalPrice = parseFloat(match[3].replace(',', ''));
        const unitPrice = totalPrice / quantity;

        // Skip if name too short or price too low (likely discounts/fees)
        if (name.length >= 3 && unitPrice >= 0.50) {
          result.items.push({
            name,
            unitPrice: Math.round(unitPrice * 100) / 100,
            quantity,
            totalPrice,
          });
          console.log(`Found item: ${name} x${quantity} = $${totalPrice}`);
        }
        continue;
      }

      // Try single item format (quantity = 1)
      match = line.match(singleItemRegex);
      if (match) {
        const name = match[1].trim();
        const totalPrice = parseFloat(match[2].replace(',', ''));

        // Skip common non-item lines
        const skipPatterns = ['SUBTOTAL', 'TAX', 'TOTAL', 'CHANGE', 'CASH', 'CREDIT', 'DEBIT', 'VISA', 'MASTERCARD', 'MEMBER'];
        const shouldSkip = skipPatterns.some(pattern =>
          name.toUpperCase().includes(pattern)
        );

        if (!shouldSkip && name.length >= 3 && totalPrice >= 0.50) {
          result.items.push({
            name,
            unitPrice: totalPrice,
            quantity: 1,
            totalPrice,
          });
          console.log(`Found item: ${name} x1 = $${totalPrice}`);
        }
      }
    }

    // Extract total amount
    const totalRegex = /TOTAL[:\s]+\$?([\d,]+\.?\d{0,2})/i;
    const totalMatch = text.match(totalRegex);
    if (totalMatch) {
      result.totalAmount = parseFloat(totalMatch[1].replace(',', ''));
      console.log(`Found total: $${result.totalAmount}`);
    } else if (result.items.length > 0) {
      // Calculate total from items if not found
      result.totalAmount = result.items.reduce((sum, item) => sum + item.totalPrice, 0);
      result.totalAmount = Math.round(result.totalAmount * 100) / 100;
      console.log(`Calculated total from items: $${result.totalAmount}`);
    }

    console.log(`Parsing complete: ${result.items.length} items found, total: $${result.totalAmount}`);
    return result;
  }

  /**
   * Process receipt image: extract text and parse data
   */
  async processReceipt(imageBuffer: Buffer): Promise<ParsedReceiptData> {
    try {
      console.log('Processing receipt image...');

      // Extract text from image
      const text = await this.extractText(imageBuffer);

      if (!text) {
        console.log('No text extracted, returning default structure');
        return this.getDefaultReceiptData();
      }

      // Parse the extracted text
      const parsedData = this.parseReceiptText(text);

      console.log('Receipt processing complete');
      return parsedData;
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
      storeName: 'Costco',
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

// Export singleton instance
export const ocrService = new OCRService();

export default ocrService;
