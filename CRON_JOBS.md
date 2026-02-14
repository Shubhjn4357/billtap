# BillTap - Vercel Cron Jobs Configuration

> **⚠️ IMPORTANT: Cron Job Tier Limitations**
> 
> - **Hobby (Free) Plan**: 1 cron job per deployment
> - **Pro Plan**: Up to 5 cron jobs ($20/month)
> - **Enterprise**: Unlimited
>
> This project has **2 cron jobs** configured, so you'll need **Pro tier or higher**.
>
> **Alternative for Free Tier**: Manually call `/api/jobs/*` endpoints via external cron services (e.g., cron-job.org, GitHub Actions).

## Configured Cron Jobs

### 1. Expire Subscriptions
- **Endpoint**: `/api/jobs/expire-subscriptions`
- **Schedule**: Daily at 2:00 AM UTC (`0 2 * * *`)
- **Function**: Marks active subscriptions as expired when `subscriptionEndsAt` is past

### 2. Sync Offers
- **Endpoint**: `/api/jobs/sync-offers`
- **Schedule**: Every hour (`0 * * * *`)
- **Function**: Activates/deactivates offers based on `startsAt` and `endsAt` dates

## Manual Trigger (Free Tier Workaround)

If using Hobby tier, you can trigger these endpoints manually or via external services:

```bash
# Set your CRON_SECRET in headers
curl -X POST https://your-project.vercel.app/api/jobs/expire-subscriptions \
  -H "X-Cron-Secret: YOUR_CRON_SECRET"

curl -X POST https://your-project.vercel.app/api/jobs/sync-offers \
  -H "X-Cron-Secret: YOUR_CRON_SECRET"
```

## GitHub Actions Alternative

Create `.github/workflows/cron-jobs.yml` in your repo:

```yaml
name: Trigger Vercel Cron Jobs

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
    - cron: '0 * * * *'  # Every hour

jobs:
  trigger-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Expire Subscriptions
        if: github.event.schedule == '0 2 * * *'
        run: |
          curl -X POST https://your-project.vercel.app/api/jobs/expire-subscriptions \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
      
      - name: Sync Offers
        run: |
          curl -X POST https://your-project.vercel.app/api/jobs/sync-offers \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
```
