/** OpenAPI 3 spec — served at /api/docs (Swagger UI) and /api/openapi.json. */
const bearer = [{ bearerAuth: [] }];
const ok = { description: 'OK' };
const json = (schema) => ({ required: true, content: { 'application/json': { schema } } });
const idParam = [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }];
const dateQuery = { name: 'date', in: 'query', schema: { type: 'string', example: '2026-11-09' } };
export const openapiSpec = {
    openapi: '3.0.3',
    info: { title: 'Comeback OS API', version: '0.1.0', description: 'Phase 1: auth, settings, dashboard, habits, water.' },
    servers: [{ url: '/' }],
    components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        schemas: {
            Credentials: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
            Register: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string', minLength: 8 } } },
            Habit: {
                type: 'object', required: ['name'],
                properties: {
                    name: { type: 'string' }, description: { type: 'string' },
                    category: { type: 'string', enum: ['routine', 'fitness', 'nutrition', 'learning', 'finance', 'grooming', 'sleep', 'mind', 'other'] },
                    icon: { type: 'string' }, frequency: { type: 'string', enum: ['daily', 'weekly'] },
                    daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
                },
            },
        },
    },
    tags: [{ name: 'Auth' }, { name: 'Settings' }, { name: 'Dashboard' }, { name: 'Habits' }, { name: 'Water' }],
    paths: {
        '/api/health': { get: { tags: ['Auth'], summary: 'Health check', responses: { 200: ok } } },
        '/api/auth/config': { get: { tags: ['Auth'], summary: 'Is registration open / first run', responses: { 200: ok } } },
        '/api/auth/register': { post: { tags: ['Auth'], summary: 'Register (first user becomes admin)', requestBody: json({ $ref: '#/components/schemas/Register' }), responses: { 201: ok, 403: { description: 'Registration disabled' }, 409: { description: 'Email exists' } } } },
        '/api/auth/login': { post: { tags: ['Auth'], summary: 'Login — returns access token, sets httpOnly refresh cookie', requestBody: json({ $ref: '#/components/schemas/Credentials' }), responses: { 200: ok, 401: { description: 'Bad credentials' } } } },
        '/api/auth/refresh': { post: { tags: ['Auth'], summary: 'Rotate refresh token (cookie) and get new access token', responses: { 200: ok, 401: { description: 'Invalid/reused token' } } } },
        '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Revoke refresh token', responses: { 200: ok } } },
        '/api/auth/forgot-password': { post: { tags: ['Auth'], summary: 'Generate reset link', requestBody: json({ type: 'object', properties: { email: { type: 'string' } } }), responses: { 200: ok } } },
        '/api/auth/reset-password': { post: { tags: ['Auth'], summary: 'Reset password with token', requestBody: json({ type: 'object', properties: { token: { type: 'string' }, password: { type: 'string' } } }), responses: { 200: ok, 400: { description: 'Invalid/expired' } } } },
        '/api/auth/me': {
            get: { tags: ['Auth'], security: bearer, summary: 'Current user', responses: { 200: ok } },
            patch: { tags: ['Auth'], security: bearer, summary: 'Update name', requestBody: json({ type: 'object', properties: { name: { type: 'string' } } }), responses: { 200: ok } },
        },
        '/api/auth/change-password': { post: { tags: ['Auth'], security: bearer, summary: 'Change password (revokes all sessions)', requestBody: json({ type: 'object', properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } } }), responses: { 200: ok } } },
        '/api/settings': { get: { tags: ['Settings'], security: bearer, summary: 'Profile + preferences', responses: { 200: ok } } },
        '/api/settings/profile': { patch: { tags: ['Settings'], security: bearer, summary: 'Partial update of personal/targets/schedule/careerGoals', requestBody: json({ type: 'object' }), responses: { 200: ok } } },
        '/api/settings/preferences': { patch: { tags: ['Settings'], security: bearer, summary: 'Theme, widgets, water quick-add', requestBody: json({ type: 'object' }), responses: { 200: ok } } },
        '/api/settings/reset': { post: { tags: ['Settings'], security: bearer, summary: 'Reset a section to defaults', requestBody: json({ type: 'object', properties: { section: { type: 'string', enum: ['profile', 'preferences', 'habits', 'all'] } } }), responses: { 200: ok } } },
        '/api/dashboard': { get: { tags: ['Dashboard'], security: bearer, summary: "Today's summary, score, weekly series", responses: { 200: ok } } },
        '/api/habits': {
            get: { tags: ['Habits'], security: bearer, summary: 'List habits with today status, streaks, last 7 days', parameters: [dateQuery, { name: 'includeArchived', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } }], responses: { 200: ok } },
            post: { tags: ['Habits'], security: bearer, summary: 'Create habit', requestBody: json({ $ref: '#/components/schemas/Habit' }), responses: { 201: ok } },
        },
        '/api/habits/heatmap': { get: { tags: ['Habits'], security: bearer, summary: 'Daily completion ratio', parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 90 } }], responses: { 200: ok } } },
        '/api/habits/reorder': { put: { tags: ['Habits'], security: bearer, summary: 'Reorder habits', requestBody: json({ type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } }), responses: { 200: ok } } },
        '/api/habits/{id}': {
            patch: { tags: ['Habits'], security: bearer, summary: 'Update / archive habit', parameters: idParam, requestBody: json({ $ref: '#/components/schemas/Habit' }), responses: { 200: ok, 404: { description: 'Not found' } } },
            delete: { tags: ['Habits'], security: bearer, summary: 'Soft delete habit', parameters: idParam, responses: { 200: ok } },
        },
        '/api/habits/{id}/log': { post: { tags: ['Habits'], security: bearer, summary: 'Mark done / undone for a date', parameters: idParam, requestBody: json({ type: 'object', properties: { completed: { type: 'boolean' }, date: { type: 'string' } } }), responses: { 200: ok } } },
        '/api/water': {
            get: { tags: ['Water'], security: bearer, summary: 'Water entries + total for a day', parameters: [dateQuery], responses: { 200: ok } },
            post: { tags: ['Water'], security: bearer, summary: 'Add water', requestBody: json({ type: 'object', properties: { amountMl: { type: 'integer' }, date: { type: 'string' } } }), responses: { 201: ok } },
        },
        '/api/water/history': { get: { tags: ['Water'], security: bearer, summary: 'Daily totals', parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }], responses: { 200: ok } } },
        '/api/water/{id}': { delete: { tags: ['Water'], security: bearer, summary: 'Delete entry', parameters: idParam, responses: { 200: ok } } },
    },
};
//# sourceMappingURL=openapi.js.map