# BillTap Backend

Server API for BillTap, deployed separately from the Expo app.

## Stack

- Hono on Vercel serverless functions
- Drizzle ORM
- Neon Postgres
- JWT session auth

## Setup

1. Install deps

```bash
cd backend
pnpm install --ignore-workspace
```

2. Configure env

```bash
cp .env.example .env
```

3. Push database schema

```bash
pnpm db:push
```

4. Run locally

```bash
pnpm dev
```

## Deploy (Vercel)

- Deploy `backend/` as a separate Vercel project.
- Set all env vars from `.env.example` in Vercel Project Settings.
- Cron endpoints are configured in `backend/vercel.json`.

## Key Endpoints

- `POST /api/auth/google`
- `POST /api/auth/phone/send`
- `POST /api/auth/phone/verify`
- `GET /api/auth/me`
- `PATCH /api/users/me`
- `GET/POST/PATCH/DELETE /api/items...`
- `GET/POST /api/bills`
- `POST /api/analytics/events`
- `GET /api/plans`
- `GET /api/offers/active`
- `GET /api/admin/*` / `PATCH /api/admin/*` / `PUT /api/admin/*`
- `POST /api/payments/subscription-checkout`
- `POST /api/payments/webhook`
- `POST /api/jobs/expire-subscriptions`
- `POST /api/jobs/sync-offers`

## Notes

- Payment remains scaffold/demo mode unless you integrate real provider SDK and webhook verification.
- Phone OTP returns `testCode` unless Twilio env vars are configured.
