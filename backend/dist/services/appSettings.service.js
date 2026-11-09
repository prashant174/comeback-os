import { AppSettingModel } from '../models/admin.js';
import { env } from '../config/env.js';
export async function getAppSettings() {
    const s = await AppSettingModel.findOneAndUpdate({ key: 'app' }, { $setOnInsert: { key: 'app' } }, { upsert: true, new: true }).lean();
    return s;
}
/** Runtime override (admin panel) wins over the ALLOW_REGISTRATION env var. */
export async function isRegistrationOpen() {
    const s = await getAppSettings();
    return s.registrationOpen ?? env.ALLOW_REGISTRATION;
}
//# sourceMappingURL=appSettings.service.js.map