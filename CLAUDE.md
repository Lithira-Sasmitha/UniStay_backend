# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UniStay is a student boarding/accommodation platform backend built with Express 5 + Mongoose 9 + MongoDB. Three user roles: **superadmin**, **student**, **boardingowner**. The frontend (Vite/React) runs on port 5173.

## Commands

- `npm run dev` — start dev server with nodemon (port 5000)
- `npm start` — start production server
- `node seedAdmin.js` — seed/reset the superadmin account
- No test suite is configured yet

## Required Environment Variables (.env)

```
MONGODB_URI, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, NODE_ENV
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET  # optional, falls back to memory storage
STRIPE_SECRET_KEY          # optional, payment endpoints return 503 without it
EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS  # Brevo SMTP for booking notifications
```

## Architecture

**Auth**: JWT access/refresh token pair. Access token (15m) in Bearer header, refresh token (7d) in HTTP-only cookie (`jwt`). Middleware in `middleware/authMiddleware.js` — `protect` verifies access token, `authorize(roles[])` checks RBAC.

**API route mounting** (server.js):
- `/api/users` — auth, profile, admin user CRUD
- `/api/properties` — property + room CRUD, photo management, admin verification
- `/api/bookings` — booking lifecycle (request → approve/reject → payment → confirm)

**Route ordering matters** in `routes/propertyRoutes.js`: admin and named routes (`/public`, `/my-listings`, `/admin/*`) must be defined before the `/:propertyId` catch-all param route.

**Models and relationships**:
- `User` — has role-based conditional validation (university required only for students). Password auto-hashed via pre-save hook.
- `Property` → owned by User (boardingowner). Has verification workflow (pending → verified) and trust badge system (gold/silver/bronze based on uploaded docs).
- `Room` → belongs to Property. Tracks `currentOccupants[]` with student refs. Has virtual `availableSlots`.
- `Booking` → links Student ↔ Room ↔ Property. Status flow: pending → approved → confirmed (after Stripe payment) or rejected/cancelled.

**File uploads**: Cloudinary via multer-storage-cloudinary (`config/cloudinary.js`). Two multer instances: `upload` (images only, 5MB) and `uploadDocs` (images+PDF, 10MB). Falls back to memory storage if Cloudinary credentials are missing.

**Payments**: Stripe PaymentIntents in LKR currency. Created after owner approves a booking, confirmed by student.

**Email**: Nodemailer with Brevo SMTP (`config/emailService.js`). Email failures are logged but don't block the booking flow.

**Error handling**: Global `notFound` + `errorHandler` middleware. Controllers return `{ success, message, ... }` shape consistently.

## Placeholder Directories

`controllers/{boardingownerctr,guidectr,reviewctr,safetyctr}`, `models/{guidemodel,ownermodel,reviewmodel,safetymodel}`, and `routes/{guideroutes,ownerroutes,reviewroutes,safetyroutes}` contain only empty `a.js` placeholder files — these are reserved for future feature modules.

## API Collections

`UniStay_v3_API_Collection.json` and `UniStay_v4_API_Collection.json` in the project root are Postman/API client collections for testing endpoints.
