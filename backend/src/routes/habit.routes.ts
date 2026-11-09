import { Router } from 'express';
import * as c from '../controllers/habit.controller.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import * as v from '../validators/habit.validators.js';

const r = Router();
r.get('/', validate({ query: v.listHabitsQuery }), c.list);
r.post('/', validate({ body: v.createHabitSchema }), c.create);
r.get('/heatmap', validate({ query: v.heatmapQuery }), c.heatmap);
r.put('/reorder', validate({ body: v.reorderSchema }), c.reorder);
r.patch('/:id', validate({ params: idParam, body: v.updateHabitSchema }), c.update);
r.delete('/:id', validate({ params: idParam }), c.remove);
r.post('/:id/log', validate({ params: idParam, body: v.toggleHabitSchema }), c.toggle);
export default r;
