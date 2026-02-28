import { Hono } from 'hono';
import type { AppEnv } from '../middleware/auth';

const siteRoute = new Hono<AppEnv>();

const html = (title: string, body: string) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #f7f8fa; color: #1f2937; }
    main { max-width: 960px; margin: 40px auto; padding: 24px; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    a { color: #0b57d0; text-decoration: none; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;

siteRoute.get('/', (c) => {
    return c.html(html('Vahi API', `
      <h1>Vahi API 2026</h1>
      <p>Cloudflare Worker backend is running.</p>
      <p>Health: <a href="/api/health"><code>/api/health</code></a></p>
      <p>Docs: <a href="/docs"><code>/docs</code></a></p>
    `));
});

siteRoute.get('/docs', (c) => {
    return c.html(html('Vahi API Docs', `
      <h1>Vahi API Surface</h1>
      <ul>
        <li><code>/api/auth/*</code></li>
        <li><code>/api/users/*</code></li>
        <li><code>/api/organizations/*</code></li>
        <li><code>/api/items/*</code></li>
        <li><code>/api/parties/*</code></li>
        <li><code>/api/transactions/*</code></li>
        <li><code>/api/subscription/*</code></li>
        <li><code>/api/accounting/*</code></li>
        <li><code>/api/reporting/*</code></li>
        <li><code>/api/analytics/*</code></li>
        <li><code>/api/staff/*</code></li>
        <li><code>/api/operations/*</code></li>
        <li><code>/api/admin/*</code></li>
      </ul>
    `));
});

export default siteRoute;
