import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** Images only (jpeg/png/webp), max 5 MB, kept in memory then written to GridFS. */
export const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED.has(file.mimetype))
            cb(null, true);
        else
            cb(ApiError.badRequest('Only JPEG, PNG or WebP images are allowed'));
    },
});
//# sourceMappingURL=upload.js.map