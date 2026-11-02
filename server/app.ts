import { Hono } from 'hono';
import { authEnabled, authRoutes } from './auth.js';
import { HttpError } from './errors.js';

export const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ ok: true, authEnabled: authEnabled() }));

app.route('/auth', authRoutes);

app.notFound((c) => c.json({ error: '없는 API 경로예요.' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: '서버에서 문제가 발생했어요. 잠시 후 다시 시도해 주세요.' }, 500);
});
