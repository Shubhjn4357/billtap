
import app from './app';

import { logger } from 'hono/logger';
app.use(logger())
export const GET = app;
export const POST = app;
export const PUT = app;
export const DELETE = app;
export const PATCH = app;
export default app;