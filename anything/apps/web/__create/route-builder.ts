import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

export const API_BASENAME = '/api';
export const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Static route registry — add new route files here
const routes: { path: string; methods: string[]; file: string }[] = [
  { path: '/widgets',            methods: ['GET', 'POST'],   file: '../src/app/api/widgets/route.js' },
  { path: '/widgets/seed',       methods: ['POST'],          file: '../src/app/api/widgets/seed/route.js' },
  { path: '/auth/token',         methods: ['GET'],           file: '../src/app/api/auth/token/route.js' },
  { path: '/auth/expo-web-success', methods: ['GET'],        file: '../src/app/api/auth/expo-web-success/route.js' },
  { path: '/process',            methods: ['POST'],          file: '../src/app/api/process/route.js' },
  { path: '/categories',         methods: ['GET'],           file: '../src/app/api/categories/route.js' },
  { path: '/export',             methods: ['POST'],          file: '../src/app/api/export/route.js' },
  { path: '/logs',               methods: ['GET'],           file: '../src/app/api/logs/route.js' },
  { path: '/logs/:id',           methods: ['DELETE'],        file: '../src/app/api/logs/[id]/route.js' },
  { path: '/__create/ssr-test',  methods: ['GET'],           file: '../src/app/api/__create/ssr-test/route.js' },
  { path: '/__create/check-social-secrets', methods: ['GET'], file: '../src/app/api/__create/check-social-secrets/route.js' },
];

// Eagerly import all route modules
const routeModules = import.meta.glob('../src/app/api/**/route.js', { eager: true }) as Record<string, Record<string, unknown>>;

function getModule(file: string) {
  return routeModules[file] ?? {};
}

for (const { path, methods, file } of routes) {
  for (const method of methods) {
    const mod = getModule(file);
    const handler = mod[method] as ((req: Request, ctx: { params: Record<string, string> }) => Response | Promise<Response>) | undefined;
    if (!handler) continue;

    const honoHandler: Handler = async (c) => {
      return handler(c.req.raw, { params: c.req.param() });
    };

    switch (method) {
      case 'GET':    api.get(path, honoHandler); break;
      case 'POST':   api.post(path, honoHandler); break;
      case 'PUT':    api.put(path, honoHandler); break;
      case 'DELETE': api.delete(path, honoHandler); break;
      case 'PATCH':  api.patch(path, honoHandler); break;
    }
  }
}

// Hot reload in development
if (import.meta.env.DEV && import.meta.hot) {
  import.meta.hot.accept(() => {});
}
