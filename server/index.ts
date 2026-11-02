import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { app as api } from './app.js';
import { authEnabled, missingAuthEnv } from './auth.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const server = new Hono();
server.route('/', api);
server.all('/api/*', (c) => c.json({ error: '없는 API 경로예요.' }, 404));
if (existsSync('dist/index.html')) {
  server.use('/*', serveStatic({ root: './dist' }));
  server.get('*', serveStatic({ path: './dist/index.html' }));
}

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8788);
serve({ fetch: server.fetch, port }, () => {
  console.log(`[api] http://localhost:${port}/api`);
  if (!authEnabled()) console.warn('[api] GOOGLE_CLIENT_ID 가 없어 로그인·백업 상태 조회가 꺼져 있어요.');
  else if (missingAuthEnv().length) console.warn(`[api] 로그인 설정이 덜 됐어요: ${missingAuthEnv().join(', ')}`);
});
