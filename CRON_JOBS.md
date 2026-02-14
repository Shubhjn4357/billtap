# BillTap - Vercel Cron Jobs Configuration

> **⚠️ IMPORTANT: Cron Job Tier Limitations**
> 
> - **Hobby (Free) Plan**: 1 cron job, **DAILY ONLY** (cannot run more than once per day)
> - **Pro Plan**: Up to 5 cron jobs, any schedule ($20/month)
> - **Enterprise**: Unlimited
>
> This project uses **1 combined cron job** that runs **daily at 2 AM UTC** for free tier compatibility.
>
> **For more frequent runs**: Use external cron services (e.g., cron-job.org, GitHub Actions) or upgrade to Pro.

## Configured Cron Job

### Combined Job: `/api/jobs/run-all`
- **Schedule**: Daily at 2:00 AM UTC (`0 2 * * *`)
- **Functions**: 
  1. Expires active subscriptions when `subscriptionEndsAt` is past
  2. Activates/deactivates offers based on `startsAt` and `endsAt` dates
- **Free Tier Compatible**: ✅ Yes (Hobby tier allows daily jobs)

### Individual Endpoints (Still Available)

1. **`/api/jobs/expire-subscriptions`** - Expire outdated subscriptions only
2. **`/api/jobs/sync-offers`** - Sync offer activation/deactivation only

These can be called manually or via external cron services for more frequent runs.

## Manual Trigger (Free Tier Workaround)

If using Hobby tier, you can trigger these endpoints manually or via external services:

```bash
# Set your CRON_SECRET in headers
curl -X POST https://your-project.vercel.app/api/jobs/expire-subscriptions \
  -H "X-Cron-Secret: YOUR_CRON_SECRET"

curl -X POST https://your-project.vercel.app/api/jobs/sync-offers \
  -H "X-Cron-Secret: YOUR_CRON_SECRET"
```

## GitHub Actions Alternative (For Hourly Runs)

If you need more frequent runs than daily, use GitHub Actions (free):

Create `.github/workflows/cron-jobs.yml`:

```yaml
name: Hourly Cron Jobs

on:
  schedule:
    - cron: '0 * * * *'  # Every hour (for offer syncing)
    - cron: '0 2 * * *'  # Daily at 2 AM (for subscriptions)

jobs:
  run-jobs:
    runs-on: ubuntu-latest
    steps:
      - name: Run All Jobs
        run: |
          curl -X POST https://your-backend.vercel.app/api/jobs/run-all \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
```

Add `CRON_SECRET` to your GitHub repository secrets:
1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `CRON_SECRET`, Value: your cron secret
