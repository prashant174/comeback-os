import { ApiError } from '../utils/ApiError.js';
/** Validates and replaces req.body/query/params with the parsed (coerced, stripped) values. */
export const validate = (schemas) => (req, _res, next) => {
    for (const key of ['body', 'query', 'params']) {
        const schema = schemas[key];
        if (!schema)
            continue;
        const result = schema.safeParse(req[key]);
        if (!result.success) {
            return next(ApiError.badRequest('Validation failed', result.error.flatten()));
        }
        // query is a getter in some express versions; assign defensively
        Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true });
    }
    next();
};
//# sourceMappingURL=validate.js.map