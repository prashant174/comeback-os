import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { isProd } from '../config/env.js';

export const notFound: RequestHandler = (req, _res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let message = 'Something went wrong on the server';
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    message = 'Duplicate value';
    details = err.keyValue;
  } else if (err?.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
  } else if (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500 && err.expose) {
    // http-errors from express internals (e.g. serve-static 404)
    status = err.statusCode;
    message = status === 404 ? 'Not found' : err.message;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) logger.error(err?.message ?? 'Unknown error', { stack: err?.stack, path: req.originalUrl });

  res.status(status).json({
    success: false,
    error: { message, ...(details ? { details } : {}), ...(!isProd && status >= 500 ? { stack: err?.stack } : {}) },
  });
};
