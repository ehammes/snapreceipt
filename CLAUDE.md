# SnapReceipt

Receipt tracking application with OCR-powered receipt scanning.

## Project Structure

```
client/          # React frontend (TypeScript)
server/          # Express backend (TypeScript)
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
- **Backend**: Express + TypeScript + PostgreSQL
- **OCR**: Google Cloud Vision API for receipt text extraction
- **Auth**: JWT-based authentication

## Key Files

- `server/src/services/ocrService.ts` - Receipt OCR parsing logic
- `server/src/routes/receipts.ts` - Receipt CRUD endpoints
- `client/src/components/` - React components

## Database

PostgreSQL with tables: users, receipts, items

## Environment Variables

See `server/.env.example` for required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Auth token signing key
- `GOOGLE_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` - Vision API credentials

## Deployment

- Frontend: Vercel
- Backend: Render (see `server/render.yaml`)
