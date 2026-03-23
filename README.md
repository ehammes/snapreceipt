# SnapReceipt

Receipt tracking application with OCR-powered receipt scanning. Upload a photo of any receipt and SnapReceipt automatically extracts items, prices, discounts, and store details.

## Features

- **OCR Scanning** — Google Cloud Vision API extracts items and prices from receipt photos
- **Receipt Management** — View, edit, and organize all your receipts in one place
- **Item Editing** — Edit item names, prices, quantities, discounts, and categories
- **Drag-and-Drop Reordering** — Reorder items to match the physical receipt
- **Duplicate Detection** — Warns when uploading a receipt that matches an existing one
- **Analytics** — Spending insights across categories and time
- **Magic Link Auth** — Passwordless login via email link (in addition to password login)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| Backend | Express + TypeScript (dev), Vercel Serverless Functions (prod) |
| Database | PostgreSQL (Neon) |
| OCR | Google Cloud Vision API |
| Auth | JWT + Magic Link (Resend) |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or [Neon](https://neon.tech))
- Google Cloud Vision API credentials
- (Optional) [Resend](https://resend.com) API key for magic link emails

### 1. Clone and install

```bash
git clone <repo-url>
cd snapreceipt

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment variables

```bash
# server/.env
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=your-secret-key
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx   # For magic link emails
FRONTEND_URL=http://localhost:3000
```

### 3. Initialize the database

```bash
cd server
npm run db:init   # or run server/src/config/init-db.sql manually
```

### 4. Start development servers

```bash
# Terminal 1 — API server (port 3001)
cd server && npm run dev

# Terminal 2 — React client (port 3000)
cd client && npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
snapreceipt/
├── client/                  # React frontend
│   ├── api/                 # Vercel serverless functions (production API)
│   │   ├── auth/            # Login, register, magic link
│   │   ├── receipts/        # Receipt upload, CRUD
│   │   └── items/           # Item CRUD
│   └── src/
│       ├── components/      # React components
│       ├── config/          # API endpoint config (dev vs prod routing)
│       └── constants/       # Shared constants (categories, formatting)
└── server/                  # Express backend (development)
    └── src/
        ├── routes/          # API routes
        ├── services/        # OCR processing
        ├── models/          # Database models
        └── __tests__/       # Jest tests
```

## Running Tests

```bash
# Server tests (74 tests)
cd server && npm test

# Client tests
cd client && npm test -- --watchAll=false
```

## Deployment

The app deploys to Vercel. Both the React frontend and backend API routes are served from the same Vercel project.

1. Push to `main` — Vercel auto-deploys
2. Set environment variables in the Vercel dashboard (same as `.env` above)
3. The `client/api/` directory contains the serverless function handlers

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `GOOGLE_CREDENTIALS_JSON` | Yes | Google Cloud Vision service account JSON |
| `RESEND_API_KEY` | No | Resend API key for magic link emails |
| `FRONTEND_URL` | Yes | Frontend URL (used in magic link emails) |
