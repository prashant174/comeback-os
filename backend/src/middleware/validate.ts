import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError.js';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

/** Validates and replaces req.body/query/params with the parsed (coerced, stripped) values. */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(ApiError.badRequest('Validation failed', result.error.flatten()));
      }
      // query is a getter in some express versions; assign defensively
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true });
    }
    next();
  };
