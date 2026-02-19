# Vahi Backend

Cloudflare Worker backend for Vahi business suite.

## Stack

- Hono API
- Cloudflare Workers runtime
- Neon Postgres
- Drizzle ORM
- JWT auth + Google OAuth + phone OTP

## Local Development

```bash
cd backend
cp .env.example .env
pnpm install --ignore-workspace
pnpm db:push
pnpm dev
```

Local URL: `http://localhost:8787/api`

## Production Deploy (Cloudflare)

```bash
cd backend
wrangler login
pnpm deploy
```

For Cloudflare Git-integrated builds that execute deploy from repository root,
use the root `wrangler.jsonc` (already included) or set Worker project root directory to `backend`.

## CI/CD Deploy (GitHub Actions)

Workflow file:

- `.github/workflows/cloudflare_ci_cd.yml`

Behavior:

- PR to `dev`/`main`: validate only (typecheck + build)
- Push to `dev`: validate + deploy to Cloudflare Worker `vahi-api-dev` (`--env dev`)
- Push to `main`: validate + deploy to Cloudflare (production environment)
- Manual run: choose `dev` or `production`, optionally run `db:push`

Required repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `DATABASE_URL` (only required if you use manual `run_db_push=true`)

For development Worker env (`--env dev`), configure Worker secrets with:

```bash
wrangler secret put DATABASE_URL --env dev
wrangler secret put API_JWT_SECRET --env dev
wrangler secret put GOOGLE_OAUTH_CLIENT_ID --env dev
wrangler secret put GOOGLE_OAUTH_CLIENT_IDS --env dev
wrangler secret put CRON_SECRET --env dev
wrangler secret put DEVELOPER_ADMIN_UIDS --env dev
wrangler secret put DEVELOPER_ADMIN_EMAILS --env dev
wrangler secret put APK_OWNER_UID --env dev
```

## Required Secrets

```bash
wrangler secret put DATABASE_URL
wrangler secret put API_JWT_SECRET
wrangler secret put GOOGLE_OAUTH_CLIENT_ID
wrangler secret put GOOGLE_OAUTH_CLIENT_IDS
wrangler secret put CRON_SECRET
wrangler secret put DEVELOPER_ADMIN_UIDS
wrangler secret put DEVELOPER_ADMIN_EMAILS
wrangler secret put APK_OWNER_UID
```

## Important Endpoints

- `POST /api/auth/google`
- `POST /api/auth/phone/send`
- `POST /api/auth/phone/verify`
- `GET /api/items`
- `POST /api/transactions`
- `PATCH /api/transactions/:id/payment`
- `GET /api/transactions/pending-reminders`
- `GET /api/reporting/export/transactions`
- `GET /api/accounting/*`
- `GET /api/admin/access`
- `POST /api/jobs/run-all`

## Server-Side Docs and Playground

These routes are served directly by the Worker (no client build required):

- `/` - API console homepage with quick links
- `/docs` - endpoint catalog with search
- `/docs/swagger` - Swagger UI for OpenAPI testing
- `/docs/openapi.json` - generated OpenAPI spec
- `/playground` - interactive request runner (method/path/body/token)
- `/docs/catalog.json` - machine-readable endpoint list for tooling

## Cron

Configured in `wrangler.json` to run daily at `02:00 UTC` and invoke `/api/jobs/run-all`.

## Commands

- `pnpm dev` - local Worker dev
- `pnpm deploy` - deploy Worker
- `pnpm typecheck` - TypeScript checks
- `pnpm smoke:e2e` - login/store-switch/estimate/reminder smoke flow
- `pnpm db:push` - push schema
- `pnpm db:generate` - generate migrations
- `pnpm db:studio` - open studio

## Media Uploads (R2)

Media APIs use signed upload tokens with Cloudflare R2 bucket binding `MEDIA_BUCKET`.
Optional envs: `MEDIA_UPLOAD_SECRET`, `MEDIA_PUBLIC_BASE_URL`, `MEDIA_MAX_UPLOAD_MB`.

## Security

- Restrict admin by `DEVELOPER_ADMIN_UIDS`/`DEVELOPER_ADMIN_EMAILS`
- Keep JWT/cron secrets rotated
- Keep release keystore out of repository
