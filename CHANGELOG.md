# Changelog

## 2.1.0 - 2026-02-16
- Expanded CORS allow-list headers to include both `X-Organization-Id` and lowercase `x-organization-id` tokens for stricter browser preflight compatibility.
- Added explicit health endpoints at both `/health` and `/api/health` for environment validation and smoke tooling.
- Fixed Cloudflare Worker OTP verify crashes caused by reusing Neon pooled clients across requests; DB client creation is now request-safe.
- Stabilized phone OTP flows by simplifying verification-attempt writes and removing pre-send OTP invalidation contention.
