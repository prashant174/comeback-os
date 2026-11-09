import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { getDashboard } from '../services/dashboard.service.js';
export const summary = asyncHandler(async (req, res) => ok(res, await getDashboard(req.user.id)));
//# sourceMappingURL=dashboard.controller.js.map