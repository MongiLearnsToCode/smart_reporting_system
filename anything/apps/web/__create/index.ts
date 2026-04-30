import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { serializeError } from 'serialize-error';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { API_BASENAME, api } from './route-builder';

const als = new AsyncLocalStorage<{ requestId: string }>();

for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);
  console[method] = (...args: unknown[]) => {
    const id = als.getStore()?.requestId;
    if (id) original(`[traceId:${id}]`, ...args);
    else original(...args);
  };
}

const app = new Hono();

app.use('*', requestId());
app.use('*', (c, next) => {
  const id = c.get('requestId');
  return als.run({ requestId: id }, () => next());
});
app.use(contextStorage());

app.onError((err, c) => {
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

export default await createHonoServer({ app, defaultLogger: false });
