import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import api from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/error.js';
import { openapiSpec } from './docs/openapi.js';
/** Locates the built SPA: explicit option/env, else ../frontend/dist in production. */
function resolveDist(opt) {
    const candidates = [opt, env.FRONTEND_DIST, env.NODE_ENV === 'production' ? path.resolve('../frontend/dist') : ''].filter(Boolean);
    return candidates.map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, 'index.html'))) ?? null;
}
export function createApp(opts = {}) {
    const app = express();
    app.set('trust proxy', env.TRUST_PROXY);
    app.disable('x-powered-by');
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                // Radix/Recharts set inline style attributes; Google Fonts CSS
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'"],
                manifestSrc: ["'self'"],
                workerSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                // only force https sub-resources when actually served over https (LAN/http installs would break)
                upgradeInsecureRequests: env.COOKIE_SECURE ? [] : null,
            },
        },
    }));
    app.use(cors({ origin: env.CLIENT_URL.split(',').map((s) => s.trim()), credentials: true }));
    app.use(express.json({ limit: '1mb' }));
    app.use(cookieParser());
    app.use(mongoSanitize()); // strips $ and . keys from body/query/params
    if (env.NODE_ENV === 'development')
        app.use(morgan('dev'));
    // Swagger UI needs inline scripts, so it gets a relaxed CSP on its own path only
    app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapiSpec));
    app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
    app.use('/api', apiLimiter, api);
    // Single-origin deploy: serve the built frontend (cookies stay first-party, no CORS)
    const dist = resolveDist(opts.frontendDist);
    if (dist) {
        app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
        app.use(express.static(dist, {
            index: false,
            setHeaders: (res, file) => {
                // the service worker and manifest must always be revalidated so updates roll out
                if (/(sw\.js|\.webmanifest|index\.html)$/.test(file))
                    res.setHeader('Cache-Control', 'no-cache');
            },
        }));
        // SPA fallback for client-side routes (never for /api)
        app.get(/^\/(?!api\/).*/, (req, res, next) => {
            if (path.extname(req.path))
                return next(); // missing file → 404, not index.html
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(path.join(dist, 'index.html'));
        });
    }
    app.use(notFound);
    app.use(errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map