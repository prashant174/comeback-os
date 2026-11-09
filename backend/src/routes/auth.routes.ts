import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import * as v from '../validators/auth.validators.js';

const r = Router();
r.get('/config', c.config);
r.post('/register', authLimiter, validate({ body: v.registerSchema }), c.register);
r.post('/login', authLimiter, validate({ body: v.loginSchema }), c.login);
r.post('/refresh', c.refresh);
r.post('/logout', c.logout);
r.post('/forgot-password', authLimiter, validate({ body: v.forgotSchema }), c.forgotPassword);
r.post('/reset-password', authLimiter, validate({ body: v.resetSchema }), c.resetPassword);
r.get('/me', requireAuth, c.me);
r.patch('/me', requireAuth, validate({ body: v.updateMeSchema }), c.updateMe);
r.post('/change-password', requireAuth, validate({ body: v.changePasswordSchema }), c.changePassword);
export default r;
