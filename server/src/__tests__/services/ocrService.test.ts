// Set mock credentials before importing ocrService
process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify({ type: 'service_account', project_id: 'test' });

// Mock Google Vision API
jest.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
    textDetection: jest.fn(),
  })),
}));

import { ocrService } from '../../services/ocrService';

describe('OCRService', () => {
  describe('parseReceiptText', () => {
    it('should parse receipt with instant savings discount correctly', () => {
      const rawText = `COSTCO
WHOLESALE
Oak Brook
#388
1901 West 22nd Street
Oak Brook, IL 60523
4K Member 111855127510
1935001 HUG PU 3T-4T
0000366341 / 1935001
1954841 IRIS BIN
39.99 A
8.00-A
11.99 A
1954841 IRIS BIN
11.99 A
SUBTOTAL
63.97
TAX
0.00
**** TOTAL
63.97`;

      const result = ocrService.parseReceiptText(rawText);

      // Check store info
      expect(result.storeName).toBe('Costco Wholesale');
      expect(result.storeCity).toBe('Oak Brook');
      expect(result.storeState).toBe('IL');
      expect(result.storeZip).toBe('60523');

      // Check items
      expect(result.items.length).toBe(2);

      // HUG PU 3T-4T: 39.99 with 8.00 discount = 31.99 total
      const hugPu = result.items.find(item => item.name.includes('HUG PU'));
      expect(hugPu).toBeDefined();
      expect(hugPu!.unitPrice).toBe(39.99);
      expect(hugPu!.discount).toBe(8.00);
      expect(hugPu!.quantity).toBe(1);
      expect(hugPu!.totalPrice).toBe(31.99);

      // IRIS BIN: 11.99 x 2 = 23.98 (merged duplicates)
      const irisBin = result.items.find(item => item.name.includes('IRIS BIN'));
      expect(irisBin).toBeDefined();
      expect(irisBin!.unitPrice).toBe(11.99);
      expect(irisBin!.quantity).toBe(2);
      expect(irisBin!.totalPrice).toBe(23.98);

      // Total
      expect(result.totalAmount).toBe(63.97);
    });

    it('should parse full receipt with multiple items and discounts', () => {
      const rawText = `COSTCO
WHOLESALE
Oak Brook
#388
1901 West 22nd Street
Oak Brook, IL 60523
4K Member 111855127510
1935001 HUG PU 3T-4T
0000366341 / 1935001
1954841 IRIS BIN
39.99 A
8.00-A
11.99 A
1954841 IRIS BIN
11.99 A
4043 RUFFINO GOLD
29.99 A
Date of Birth - xx/xx/XX KEYED
1974202 JDSBHERITAGE
59.99 A
E
679131 KS ORG SYRUP
12.59 E
10251B WOODFORD RSV
58.99 A
725674 OBAN EDITION
79.99 A
681467 HESS ALLOMI
25.99 A
681467 HESS ALLOMI
25.99 A
4043 RUFFINO GOLD
29.99 A
SUBTOTAL
379.49
TAX
27.74
**** TOTAL
XXXXXXXXXXXX5089
407.23
H
AID:
A0000000031010
Seq#
11964
App#: 24313C
Costco Visa
Resp: APPROVED
Tran ID#: 534300011964....
APPROVED - Purchase
AMOUNT: $407.23
12/09/2025 13:35 388 11 109 630
Costco Visa
CHANGE
A 7.5% Tax
E 1.75% TAX
TOTAL TAX
407.23
0.00
27.52
0.22
27.74
TOTAL NUMBER OF ITEMS SOLD - 11
INSTANT SAVINGS
$ 8.00
12/09/2025 13:35 388 11 109 630
*SEASONS GREETINGS & HAPPY HOLIDAYS*
21038801101092512091335
OP#: 630 Name: Ken S.
Thank You!
Please Come Again
Whse: 388 Tr:11 Trn:109 OP:630
Items Sold: 11`;

      const result = ocrService.parseReceiptText(rawText);

      // Check date
      expect(result.purchaseDate.getMonth()).toBe(11); // December (0-indexed)
      expect(result.purchaseDate.getDate()).toBe(9);
      expect(result.purchaseDate.getFullYear()).toBe(2025);

      // Check total
      expect(result.totalAmount).toBe(407.23);

      // Find specific items
      const hugPu = result.items.find(item => item.name.includes('HUG PU'));
      expect(hugPu).toBeDefined();
      expect(hugPu!.unitPrice).toBe(39.99);
      expect(hugPu!.discount).toBe(8.00);
      expect(hugPu!.totalPrice).toBe(31.99); // 39.99 - 8.00 discount

      const irisBin = result.items.find(item => item.name.includes('IRIS BIN'));
      expect(irisBin).toBeDefined();
      expect(irisBin!.quantity).toBe(2); // Merged duplicates
      expect(irisBin!.unitPrice).toBe(11.99);
      expect(irisBin!.totalPrice).toBe(23.98);

      const ruffinoGold = result.items.find(item => item.name.includes('RUFFINO GOLD'));
      expect(ruffinoGold).toBeDefined();
      expect(ruffinoGold!.quantity).toBe(2); // Merged duplicates
      expect(ruffinoGold!.unitPrice).toBe(29.99);
      expect(ruffinoGold!.totalPrice).toBe(59.98);

      const hessAllomi = result.items.find(item => item.name.includes('HESS ALLO'));
      expect(hessAllomi).toBeDefined();
      expect(hessAllomi!.quantity).toBe(2); // Merged duplicates
      expect(hessAllomi!.unitPrice).toBe(25.99);
      expect(hessAllomi!.totalPrice).toBe(51.98);

      const woodford = result.items.find(item => item.name.includes('WOODFORD'));
      expect(woodford).toBeDefined();
      expect(woodford!.unitPrice).toBe(58.99);

      const oban = result.items.find(item => item.name.includes('OBAN'));
      expect(oban).toBeDefined();
      expect(oban!.unitPrice).toBe(79.99);
    });

    it('should parse items with inline prices', () => {
      const rawText = `COSTCO
WHOLESALE
1234567 KIRKLAND WATER 4.99 A
7654321 ORGANIC EGGS 8.99 E
SUBTOTAL
13.98
**** TOTAL
13.98`;

      const result = ocrService.parseReceiptText(rawText);

      expect(result.items.length).toBe(2);

      const water = result.items.find(item => item.name.includes('KIRKLAND WATER'));
      expect(water).toBeDefined();
      expect(water!.unitPrice).toBe(4.99);

      const eggs = result.items.find(item => item.name.includes('ORGANIC EGGS'));
      expect(eggs).toBeDefined();
      expect(eggs!.unitPrice).toBe(8.99);
    });

    it('should merge duplicate items by item number', () => {
      const rawText = `COSTCO
WHOLESALE
1234567 TEST ITEM
10.00 A
1234567 TEST ITEM
10.00 A
1234567 TEST ITEM
10.00 A
SUBTOTAL
30.00
**** TOTAL
30.00`;

      const result = ocrService.parseReceiptText(rawText);

      // Should merge into 1 item with qty 3
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toContain('TEST ITEM');
      expect(result.items[0].quantity).toBe(3);
      expect(result.items[0].unitPrice).toBe(10.00);
      expect(result.items[0].totalPrice).toBe(30.00);
    });

    it('should extract address correctly', () => {
      const rawText = `COSTCO
WHOLESALE
1901 West 22nd Street
Oak Brook, IL 60523
Member 12345`;

      const result = ocrService.parseReceiptText(rawText);

      expect(result.storeLocation).toBe('1901 West 22nd Street');
      expect(result.storeCity).toBe('Oak Brook');
      expect(result.storeState).toBe('IL');
      expect(result.storeZip).toBe('60523');
    });

    it('should extract date in various formats', () => {
      // MM/DD/YYYY format
      let result = ocrService.parseReceiptText('12/09/2025 13:35');
      expect(result.purchaseDate.getMonth()).toBe(11);
      expect(result.purchaseDate.getDate()).toBe(9);
      expect(result.purchaseDate.getFullYear()).toBe(2025);

      // MM/DD/YY format
      result = ocrService.parseReceiptText('12/09/25 13:35');
      expect(result.purchaseDate.getMonth()).toBe(11);
      expect(result.purchaseDate.getDate()).toBe(9);
      expect(result.purchaseDate.getFullYear()).toBe(2025);
    });

    it('should handle empty or invalid text gracefully', () => {
      let result = ocrService.parseReceiptText('');
      expect(result.items).toEqual([]);
      expect(result.storeName).toBe('');

      result = ocrService.parseReceiptText('   ');
      expect(result.items).toEqual([]);

      result = ocrService.parseReceiptText('random text without any receipt data');
      expect(result.items).toEqual([]);
    });

    it('should extract correct total when subtotal/tax/total appear after TOTAL marker', () => {
      const rawText = `COSTCO
WHOLESALE
1974202 JDSBHERITAGE
SUBTOTAL
TAX
**** TOTAL
XXXXXXXXXXXX5089
AID: A0000000031010
59.99 A
427.03
25.39
452.42
H
CHANGE
452.42`;

      const result = ocrService.parseReceiptText(rawText);

      // Should pick the largest value (452.42) not the first (427.03)
      expect(result.totalAmount).toBe(452.42);
    });

    it('should handle discount without decimal point (OCR error)', () => {
      const rawText = `COSTCO
WHOLESALE
Bloomingdale #371
505 West Army Trail Road
Bloomingdale, IL 60108
1935001 HUG PU 3T-4T
39.99 A
0000366341 / 1935001
800-A
1795787 WGNLRWRKJCKT
34.99 A
0000368139 /1795787
5.00-A
SUBTOTAL
61.98
**** TOTAL
61.98`;

      const result = ocrService.parseReceiptText(rawText);

      // HUG PU 3T-4T: 39.99 with 8.00 discount (800 without decimal) = 31.99 total
      const hugPu = result.items.find(item => item.name.includes('HUG PU'));
      expect(hugPu).toBeDefined();
      expect(hugPu!.unitPrice).toBe(39.99);
      expect(hugPu!.discount).toBe(8.00);
      expect(hugPu!.totalPrice).toBe(31.99);

      // WGNLRWRKJCKT: 34.99 with 5.00 discount = 29.99 total
      const jacket = result.items.find(item => item.name.includes('WGNLRWRKJCKT'));
      expect(jacket).toBeDefined();
      expect(jacket!.unitPrice).toBe(34.99);
      expect(jacket!.discount).toBe(5.00);
      expect(jacket!.totalPrice).toBe(29.99);
    });

    it('should skip non-item lines', () => {
      const rawText = `COSTCO
WHOLESALE
MEMBER 12345
APPROVED
VISA XXXX1234
Thank You!
1234567 REAL ITEM
15.99 A
SUBTOTAL
15.99
**** TOTAL
15.99`;

      const result = ocrService.parseReceiptText(rawText);

      // Should only have 1 real item
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toContain('REAL ITEM');
    });

    it('should match items to prices sequentially when in consecutive blocks', () => {
      // Tests the fix for PEDIASURE OG price issue (GitHub issue #XX)
      // When items and prices form consecutive blocks (Costco-style),
      // use sequential matching instead of greedy distance matching
      const rawText = `COSTCO
WHOLESALE
E 1268174 PEDIASURE OG
E 923855 POST-TS
39.99 E
16.99 E
SUBTOTAL
56.98
**** TOTAL
56.98`;

      const result = ocrService.parseReceiptText(rawText);

      expect(result.items.length).toBe(2);

      // PEDIASURE OG should get first price (39.99), NOT second price
      const pediasure = result.items.find(item => item.name.includes('PEDIASURE'));
      expect(pediasure).toBeDefined();
      expect(pediasure!.unitPrice).toBe(39.99);
      expect(pediasure!.itemNumber).toBe('1268174');
      expect(pediasure!.totalPrice).toBe(39.99);

      // POST-TS should get second price (16.99), NOT first price
      const postTs = result.items.find(item => item.name.includes('POST'));
      expect(postTs).toBeDefined();
      expect(postTs!.unitPrice).toBe(16.99);
      expect(postTs!.itemNumber).toBe('923855');
      expect(postTs!.totalPrice).toBe(16.99);
    });

    it('should handle mixed item-price layouts with greedy matching', () => {
      // When items and prices are interleaved (not consecutive blocks),
      // use greedy distance matching instead of sequential
      const rawText = `COSTCO
WHOLESALE
1234567 ITEM A
19.99 A
E 7654321 ITEM B
E 9876543 ITEM C
29.99 E
39.99 E
SUBTOTAL
89.97
**** TOTAL
89.97`;

      const result = ocrService.parseReceiptText(rawText);

      expect(result.items.length).toBe(3);

      const itemA = result.items.find(item => item.name.includes('ITEM A'));
      expect(itemA).toBeDefined();
      expect(itemA!.unitPrice).toBe(19.99);

      const itemB = result.items.find(item => item.name.includes('ITEM B'));
      expect(itemB).toBeDefined();
      expect(itemB!.unitPrice).toBe(29.99);

      const itemC = result.items.find(item => item.name.includes('ITEM C'));
      expect(itemC).toBeDefined();
      expect(itemC!.unitPrice).toBe(39.99);
    });
  });
});
