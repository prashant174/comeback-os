import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from './asyncHandler.js';
import { ok, created } from './response.js';
import { ApiError } from './ApiError.js';
import { validate } from '../middleware/validate.js';
import { idParam, dayKeySchema } from '../validators/common.js';
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Generic user-scoped REST resource:
 *   GET /        list (page, limit, q, from, to, filters)
 *   GET /:id     read
 *   POST /       create
 *   PATCH /:id   partial update
 *   DELETE /:id  delete (soft if configured)
 * Every query is filtered by req.user.id, so cross-user ids return 404.
 */
export function crudRouter(o) {
    const r = Router();
    const update = o.update ?? o.create.partial();
    const listQuery = z
        .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(o.maxLimit ?? 200).default(50),
        q: z.string().trim().max(100).optional(),
        from: dayKeySchema.optional(),
        to: dayKeySchema.optional(),
    })
        .catchall(z.string().max(100));
    const base = (req) => ({ user: req.user.id, ...(o.softDelete ? { deletedAt: null } : {}) });
    const findOwned = async (req) => {
        const doc = await o.model.findOne({ _id: req.params.id, ...base(req) });
        if (!doc)
            throw ApiError.notFound(`${o.model.modelName} not found`);
        return doc;
    };
    r.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
        const q = req.query;
        const filter = base(req);
        for (const f of o.filters ?? [])
            if (q[f] !== undefined && q[f] !== '')
                filter[f] = q[f] === 'true' ? true : q[f] === 'false' ? false : q[f];
        if (o.dateField && (q.from || q.to)) {
            filter[o.dateField] = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
        }
        if (q.q && o.searchFields?.length) {
            const rx = new RegExp(escapeRx(q.q), 'i');
            filter.$or = o.searchFields.map((f) => ({ [f]: rx }));
        }
        const [items, total] = await Promise.all([
            o.model.find(filter).sort(o.sort ?? { createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
            o.model.countDocuments(filter),
        ]);
        ok(res, items, { page: q.page, limit: q.limit, total });
    }));
    r.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await findOwned(req))));
    r.post('/', validate({ body: o.create }), asyncHandler(async (req, res) => {
        const body = o.transform ? await o.transform(req.body, req) : req.body;
        const doc = await o.model.create({ ...body, user: req.user.id });
        await o.afterWrite?.(doc, req, 'create');
        created(res, doc);
    }));
    r.patch('/:id', validate({ params: idParam, body: update }), asyncHandler(async (req, res) => {
        const doc = await findOwned(req);
        const body = o.transform ? await o.transform(req.body, req, doc) : req.body;
        doc.set(body);
        await doc.save();
        await o.afterWrite?.(doc, req, 'update');
        ok(res, doc);
    }));
    r.delete('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
        const doc = await findOwned(req);
        if (o.softDelete) {
            doc.set({ deletedAt: new Date() });
            await doc.save();
        }
        else
            await doc.deleteOne();
        await o.afterWrite?.(doc, req, 'delete');
        ok(res, { deleted: true });
    }));
    return r;
}
//# sourceMappingURL=crud.js.map