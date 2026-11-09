import { Router } from 'express';
import * as c from '../controllers/water.controller.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import * as v from '../validators/water.validators.js';

const r = Router();
r.get('/', validate({ query: v.waterDayQuery }), c.day);
r.get('/history', validate({ query: v.waterHistoryQuery }), c.history);
r.post('/', validate({ body: v.addWaterSchema }), c.add);
r.delete('/:id', validate({ params: idParam }), c.remove);
export default r;
