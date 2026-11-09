import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectTestDB, closeDB } from './helpers.js';

let dist: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  await connectTestDB();
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'cbos-dist-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dist, 'sw.js'), 'self.addEventListener("fetch",()=>{})');
  fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), '{"name":"Comeback OS"}');
  app = createApp({ frontendDist: dist });
});
afterAll(closeDB);

describe('single-origin deploy', () => {
  it('serves the SPA for client routes with a strict CSP', async () => {
    const r = await request(app).get('/fitness');
    expect(r.status).toBe(200);
    expect(r.text).toContain('id="root"');
    expect(r.headers['cache-control']).toBe('no-cache');
    const csp = r.headers['content-security-policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain('https://fonts.gstatic.com');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('upgrade-insecure-requests'); // COOKIE_SECURE=false in tests (http)
  });
  it('caches hashed assets forever, revalidates sw + manifest', async () => {
    const a = await request(app).get('/assets/app-abc123.js');
    expect(a.status).toBe(200);
    expect(a.headers['cache-control']).toContain('immutable');
    expect((await request(app).get('/sw.js')).headers['cache-control']).toBe('no-cache');
    expect((await request(app).get('/manifest.webmanifest')).headers['cache-control']).toBe('no-cache');
  });
  it('never swallows API 404s or missing assets into index.html', async () => {
    const api = await request(app).get('/api/nope');
    expect(api.status).toBe(404);
    expect(api.body.success).toBe(false);
    expect((await request(app).get('/assets/missing.js')).status).toBe(404);
    expect((await request(app).get('/missing.png')).status).toBe(404);
  });
  it('keeps the health check public', async () => {
    expect((await request(app).get('/api/health')).body.data.status).toBe('ok');
  });
});
