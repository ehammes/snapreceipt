# SnapReceipt

Receipt tracking application with OCR-powered receipt scanning.

## Project Structure

```
client/          # React frontend (TypeScript)
  ├── api/       # API clients and services
  ├── src/
      ├── components/  # React components
      ├── constants/   # App constants (categories, etc.)
      └── config/      # Configuration files
server/          # Express backend (TypeScript)
  ├── src/
      ├── routes/      # API route handlers
      ├── services/    # Business logic (OCR, etc.)
      ├── models/      # Database models
      └── middleware/  # Auth, validation, etc.
```

## Common Commands

### Server (from /server)
```bash
npm run dev      # Start dev server with hot reload
npm run build    # Compile TypeScript
npm start        # Run compiled server
npm test         # Run Jest tests
```

### Client (from /client)
```bash
npm start        # Start React dev server
npm run build    # Production build
```

## Architecture

- **Frontend**: React + TypeScript, hosted on Vercel
- **Backend**: Express + TypeScript + PostgreSQL, deployed as Vercel serverless functions
- **OCR**: Google Cloud Vision API for receipt text extraction
- **Auth**: JWT-based authentication

### Architecture Decisions

#### Vercel Serverless for Both Frontend and Backend
The backend runs on Vercel serverless functions rather than a separate server platform (like Render). This provides:
- **Cost savings**: Free tier sufficient for most usage
- **Simplified deployment**: Single platform for both frontend and backend
- **Auto-scaling**: Serverless functions scale automatically

#### Duplicated OCR Logic
OCR parsing logic exists in both:
- `client/api/lib/ocrService.ts` - Client-side processing
- `server/src/services/ocrService.ts` - Server-side processing

**Why?** This appears redundant but is intentional:
- Client can process receipts directly without server round-trip
- Server provides backup/validation of OCR results
- Both implementations must stay in sync when making changes

**Important**: When updating OCR logic, update BOTH files identically.

## Key Features

### OCR Receipt Extraction
- Upload receipt image → Google Vision API extracts text
- Intelligent parsing matches items to prices
- Handles discounts, tax extraction, store information
- ~67% accuracy on item ordering (known limitation)

### Manual Drag-and-Drop Reordering
Users can reorder items to match physical receipt:
- **ReceiptReviewModal**: Reorder during initial upload
- **ReceiptDetail**: Reorder on saved receipts
- Changes persist to database via `PATCH /api/items/reorder`

### Receipt Review & Editing
- Review OCR results before saving
- Edit items, prices, quantities, discounts, categories
- Add/delete items manually
- Edit store information and purchase date
- Tax amount is editable (extracted from OCR or calculated)

### Item Categorization
Automatic and manual categorization using predefined categories in `client/src/constants/categories.ts`

## Database Schema

### Users Table
```sql
id (UUID), email, password_hash, created_at
```

### Receipts Table
```sql
id (UUID), user_id (FK), store_name, store_location, store_city,
store_state, store_zip, purchase_date, total_amount, tax_amount,
image_url, created_at, updated_at
```

### Items Table
```sql
id (UUID), receipt_id (FK), item_number, name, unit_price, quantity,
discount, total_price, category, item_order, created_at, updated_at
```

**Key Fields**:
- `item_order`: Integer for custom sort order (set by drag-and-drop)
- `discount`: Per-item discount (capped at subtotal to prevent negative totals)
- `total_price`: Calculated as `(unit_price * quantity) - discount`

## Component Overview

### ReceiptReviewModal (`client/src/components/ReceiptReviewModal.tsx`)
Modal shown after receipt upload for reviewing OCR results:
- Displays extracted store info, items, totals
- Side-by-side with receipt image
- All fields editable inline
- Drag-and-drop item reordering
- Add/delete items
- Tax override with auto-calculation of total
- Local state only (saves to server on "Save Receipt" click)

### ReceiptDetail (`client/src/components/ReceiptDetail.tsx`)
Full page view for saved receipts:
- Display all receipt information
- Inline editing of items
- Drag-and-drop reordering (persists immediately to server)
- Item sorting options (by receipt order, category, name)
- Delete receipt functionality

### Key API Endpoints

#### Receipts
- `POST /api/receipts/upload` - Upload receipt image, run OCR
- `GET /api/receipts` - List user's receipts
- `GET /api/receipts/:id` - Get single receipt with items
- `PUT /api/receipts/:id` - Update receipt details
- `DELETE /api/receipts/:id` - Delete receipt

#### Items
- `PUT /api/items/:itemId?receiptId=xxx` - Update item details
- `PATCH /api/items/reorder?receiptId=xxx` - Reorder items (bulk update item_order)
- `DELETE /api/items/:itemId?receiptId=xxx` - Delete item

## OCR Processing Details

### Google Cloud Vision API
- Extracts text blocks with bounding box coordinates
- Returns text in reading order (not always top-to-bottom)
- **Known Limitation**: ~33% of receipts have items extracted out of order

### Item-to-Price Matching Algorithm
Located in `ocrService.ts` (both client and server):

1. **Price Extraction**: Identify price patterns (`$X.XX`, `X.XX A/E/F/N`)
2. **Tax Code Removal**: Strip tax codes (A/E/F/N) from prices
3. **Distance-Based Matching**: Match each price to nearest item name by line distance
4. **Barcode Discount Queue**: FIFO queue handles multiple consecutive discount lines
5. **Discount Capping**: Discount cannot exceed item subtotal (prevents negative totals)

### Key Helpers
```typescript
calculateTotalPrice(unitPrice, quantity, discount)
// Caps discount at subtotal to prevent negative totals
// Returns { total, cappedDiscount }
```

### OCR Processing Flow
1. Upload image → Google Vision API
2. Extract text annotations (lines of text)
3. Parse store name, address, date
4. Extract tax amount
5. Extract prices with tax codes
6. Match prices to item names by distance
7. Handle barcode discounts (FIFO)
8. Calculate totals with capped discounts
9. Return structured data to frontend

## Development Patterns

### Code Conventions
- TypeScript strict mode enabled
- Functional components with hooks (React)
- No prop drilling - pass data explicitly
- Error handling with try-catch in async functions
- Console logging for debugging (tagged with `[OCR DEBUG]`, `[SUBTOTAL DEBUG]`, etc.)

### Testing Approach
- Jest tests in `server/src/__tests__/`
- Focus on critical business logic (OCR parsing, calculations)
- API endpoint tests with mock database
- Run with `npm test` from server directory

### Common Pitfalls

#### 1. Forgetting to Update Both OCR Services
When changing OCR logic, update BOTH:
- `client/api/lib/ocrService.ts`
- `server/src/services/ocrService.ts`

#### 2. Not Capping Discounts
Always use `calculateTotalPrice()` helper to prevent negative item totals

#### 3. OCR Item Ordering
Don't rely on OCR extraction order matching physical receipt order. Users must manually reorder if needed.

#### 4. Tax Calculation
Tax is locked at initial OCR extraction value unless manually overridden. Item changes don't recalculate tax automatically.

#### 5. Floating Point Precision
Always round currency to 2 decimal places:
```typescript
Math.round(value * 100) / 100
```

### File Modification Checklist

When updating features:
- [ ] Update both OCR services if changing parsing logic
- [ ] Update TypeScript interfaces if changing data structures
- [ ] Update database models if changing schema
- [ ] Add/update tests for new business logic
- [ ] Test on multiple receipt formats
- [ ] Verify drag-and-drop still works after item list changes

## Environment Variables

See `server/.env.example` for required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Auth token signing key
- `GOOGLE_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` - Vision API credentials

## Deployment

- **Frontend**: Vercel (automatic deployment from git)
- **Backend**: Vercel serverless functions (see `vercel.json` config)
- **Database**: PostgreSQL (hosted separately, referenced via DATABASE_URL)

### Deployment Notes
- Vercel automatically detects Next.js/React and Express apps
- Environment variables configured in Vercel dashboard
- Backend API routes deployed as serverless functions
- Static assets (images) served from Vercel CDN
