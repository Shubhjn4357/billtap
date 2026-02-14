# BillTap Backend

Production-ready API server for BillTap, built with Hono and deployed on Vercel serverless functions.

## 🚀 Tech Stack

- **Runtime**: Hono (Fast web framework for Edge/Serverless)
- **Database**: Neon PostgreSQL (Serverless Postgres)
- **ORM**: Drizzle ORM
- **Authentication**: JWT + Google OAuth + Phone OTP
- **Deployment**: Vercel Serverless Functions

## 📋 Prerequisites

- Node.js 18+ and pnpm
- [Neon Database](https://neon.tech) account (free tier available)
- [Google Cloud Console](https://console.cloud.google.com) project for OAuth
- [Vercel](https://vercel.com) account for deployment

## 🛠️ Local Setup

### 1. Install Dependencies

```bash
cd backend
pnpm install --ignore-workspace
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | ✅ Yes | `postgres://user:pass@host/db?sslmode=require` |
| `API_JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) | ✅ Yes | Generate: `openssl rand -base64 32` |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth 2.0 Client ID | ✅ Yes | `123456789-abc.apps.googleusercontent.com` |
| `PAYMENT_PROVIDER` | Payment provider (`mock`, `stripe`, `razorpay`) | No | `mock` (default) |
| `CHECKOUT_BASE_URL` | Base URL for payment checkout page | No | `https://yourapp.com/checkout` |
| `PAYMENT_WEBHOOK_SECRET` | Secret for verifying payment webhooks | No | Generate: `openssl rand -hex 32` |
| `CRON_SECRET` | Secret to authenticate cron job requests | ⚠️ Recommended | Generate: `openssl rand -hex 24` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID (for production SMS) | No | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | No | `your_auth_token` |
| `TWILIO_FROM_NUMBER` | Twilio phone number | No | `+1234567890` |

### 3. Setup Database

```bash
# Generate migration files
pnpm db:generate

# Push schema to database
pnpm db:push

# (Optional) Open Drizzle Studio to view/edit data
pnpm db:studio
```

### 4. Run Development Server

```bash
pnpm dev
```

Server runs at `http://localhost:3000`

Test health endpoint:
```bash
curl http://localhost:3000/api/health
```

## 🌐 Deployment to Vercel

### Method 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from backend directory
cd backend
vercel

# Follow prompts to create new project
# Set environment variables when prompted
```

### Method 2: GitHub Integration

1. Push code to GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click **"Add New Project"**
4. Import your repository
5. **Root Directory**: Set to `backend`
6. Click **"Deploy"**

### Set Environment Variables in Vercel

After deployment, configure environment variables:

1. Go to **Project Settings → Environment Variables**
2. Add all variables from `.env.example`
3. Click **"Save"**
4. Redeploy to apply changes

### Verify Deployment

```bash
curl https://your-project.vercel.app/api/health
```

Expected response:
```json
{
  "ok": true,
  "service": "billtap-api",
  "now": "2026-02-14T03:44:01.000Z"
}
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/google` - Google Sign-In
- `POST /api/auth/phone/send` - Send phone OTP
- `POST /api/auth/phone/verify` - Verify OTP
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/logout` - Logout

### User Management
- `PATCH /api/users/me` - Update user profile

### Items (Inventory)
- `GET /api/items` - List items (supports `?q=search`)
- `GET /api/items/:id` - Get item by ID
- `POST /api/items` - Create item
- `PATCH /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Bills (Orders)
- `GET /api/bills` - List bills (supports `?limit=`, `?start=`, `?end=`)
- `POST /api/bills` - Create bill (auto-decrements stock)

### Marketing
- `GET /api/plans` - List subscription plans
- `GET /api/offers/active` - Get active offers

### Analytics
- `POST /api/analytics/events` - Track analytics event

### Payments
- `POST /api/payments/subscription-checkout` - Create checkout session
- `GET /api/payments/intents/:intentId/status` - Check payment status
- `POST /api/payments/webhook` - Payment provider webhook

### Admin (requires `role: 'admin'`)
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:uid` - Update user
- `PATCH /api/admin/users/:uid/role` - Change user role
- `GET /api/admin/plans` - List all plans (including inactive)
- `PUT /api/admin/plans/:id` - Upsert plan
- `GET /api/admin/offers` - List all offers
- `PUT /api/admin/offers/:id` - Upsert offer
- `PATCH /api/admin/offers/:id/active` - Toggle offer active status
- `POST /api/admin/seed/default-plans` - Seed default plans
- `GET /api/analytics/events` - Get analytics events

### Cron Jobs (Vercel Serverless)

**Important**: Vercel Hobby tier allows **1 daily cron job only**.

Configured endpoint `/api/jobs/run-all` runs daily at 2 AM UTC:
- Expires subscriptions when `subscriptionEndsAt` has passed
- Activates/deactivates offers based on their schedules

For hourly runs, see `CRON_JOBS.md` for GitHub Actions alternative or upgrade to Pro.

## 🔒 Security Notes

1. **JWT Secret**: Use a strong, randomly-generated secret (min 32 characters)
   ```bash
   openssl rand -base64 32
   ```

2. **CRON_SECRET**: Protect cron endpoints from unauthorized access
   ```bash
   openssl rand -hex 24
   ```

3. **CORS**: Currently set to `origin: '*'` for development. For production, restrict to your client domains:
   ```typescript
   // In api/[[...route]].ts
   app.use('*', cors({
       origin: ['https://yourapp.com', 'https://yourdomain.vercel.app'],
       // ...
   }));
   ```

## 🧪 Testing

```bash
# Type check
pnpm typecheck

# Test health endpoint
curl http://localhost:3000/api/health

# Test authentication (Google)
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"YOUR_GOOGLE_ID_TOKEN"}'
```

## 📝 Development Commands

- `pnpm dev` - Start development server (Vercel Dev)
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio

## 🔧 Troubleshooting

### Vercel Deployment Fails

**Error**: `No entrypoint found`
- **Fix**: Ensure `vercel.json` exists in backend directory
- The API entrypoint is `api/[[...route]].ts` which is configured in `vercel.json`

**Error**: `esbuild scripts blocked`
- **Fix**: `.pnpmfile.cjs` is provided to auto-approve esbuild scripts

### Database Connection Issues

- Verify `DATABASE_URL` is correct and includes `?sslmode=require`
- Check Neon dashboard for connection status
- Ensure IP allowlist includes Vercel IPs (or use Neon's serverless driver)

### Google OAuth Not Working

- Verify `GOOGLE_OAUTH_CLIENT_ID` matches your Google Cloud Console
- Add authorized domains in Google Cloud Console
- For local dev, add `http://localhost:3000` to authorized origins

## 📚 Additional Documentation

See root-level documentation for more details:
- [SETUP.md](../SETUP.md) - Complete project setup guide
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment guide for all platforms
- [API_REFERENCE.md](../API_REFERENCE.md) - Complete API documentation
- [ENV_VARIABLES.md](../ENV_VARIABLES.md) - Environment variables reference

## 🎯 Next Steps After Deployment

1. Note your deployed backend URL (e.g., `https://your-project.vercel.app`)
2. Configure client app to use this URL in `.env`:
   ```bash
   EXPO_PUBLIC_API_BASE_URL=https://your-project.vercel.app/api
   ```
3. Set up cron job secrets in Vercel environment variables
4. (Optional) Configure real payment provider (Stripe/Razorpay)
5. (Optional) Configure Twilio for production SMS OTP

## 💡 Notes

- **First User = Admin**: The first user to sign up automatically gets `role: 'admin'`
- **Phone OTP**: Returns `testCode` in response unless Twilio is configured
- **Payments**: In demo mode unless `PAYMENT_PROVIDER` is set to `stripe` or `razorpay`
- **Cron Jobs**: Configured in `vercel.json` and run automatically on Vercel
