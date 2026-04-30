import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createRequestHandler } from 'react-router';
import { serializeError } from 'serialize-error';
import { getHTMLForErrorPage } from './__create/get-html-for-error-page';
import { API_BASENAME, api } from './__create/route-builder';

// @ts-expect-error - virtual module provided by React Router at build time
import * as build from 'virtual:react-router/server-build';

const app = new Hono();

app.use('*', requestId());
app.use(contextStorage());

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  if (c.req.method !== 'GET') {
    return c.json({ error: 'An error occurred', details: serializeError(err) }, 500);
  }
  return c.html(getHTMLForErrorPage(err), 200);
});

if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    })
  );
}

for (const method of ['post', 'put', 'patch'] as const) {
  app[method](
    '*',
    bodyLimit({
      maxSize: 4.5 * 1024 * 1024,
      onError: (c) => c.json({ error: 'Body size limit exceeded' }, 413),
    })
  );
}

app.route(API_BASENAME, api);

const handler = createRequestHandler(build);
app.all('*', (c) => handler(c.req.raw));

export default app.fetch;
