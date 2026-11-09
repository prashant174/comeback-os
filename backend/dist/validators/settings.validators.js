import { z } from 'zod';
import { hhmm } from './common.js';
export const profileUpdateSchema = z
    .object({
    personal: z
        .object({
        ageRange: z.string().max(20).nullable(),
        gender: z.string().max(30).nullable(),
        heightCm: z.number().min(50).max(260).nullable(),
        currentWeightKg: z.number().min(20).max(400).nullable(),
        fitnessGoal: z.string().max(60).nullable(),
        dietType: z.string().max(60).nullable(),
        cooking: z.string().max(60).nullable(),
        workoutLocation: z.string().max(60).nullable(),
        equipment: z.array(z.string().max(60)).max(50),
        currency: z.string().length(3),
        timezone: z.string().max(60).refine((tz) => {
            try {
                new Intl.DateTimeFormat('en', { timeZone: tz });
                return true;
            }
            catch {
                return false;
            }
        }, 'Unknown timezone'),
        monthlyBudget: z.number().min(0).max(10_000_000),
    })
        .partial(),
    targets: z
        .object({
        proteinMinG: z.number().min(0).max(500),
        proteinMaxG: z.number().min(0).max(500),
        waterMl: z.number().min(0).max(10000),
        sleepHours: z.number().min(0).max(14),
        studyMinutesPerDay: z.number().min(0).max(1440),
        workoutMinutesPerDay: z.number().min(0).max(600),
    })
        .partial(),
    schedule: z
        .object({
        wakeUp: hhmm,
        sleep: hhmm,
        blocks: z
            .array(z.object({ key: z.string().min(1).max(40), label: z.string().min(1).max(60), start: hhmm, end: hhmm }))
            .max(30),
    })
        .partial(),
    careerGoals: z.array(z.string().trim().min(1).max(80)).max(50),
})
    .partial()
    .refine((v) => !v.targets?.proteinMinG || !v.targets?.proteinMaxG || v.targets.proteinMinG <= v.targets.proteinMaxG, { message: 'Protein min cannot exceed max', path: ['targets', 'proteinMinG'] });
export const preferencesUpdateSchema = z
    .object({
    theme: z.enum(['light', 'dark', 'system']),
    dashboardWidgets: z
        .array(z.object({ key: z.string().max(40), visible: z.boolean(), size: z.enum(['sm', 'md', 'lg']) }))
        .max(30),
    waterQuickAdd: z.array(z.number().int().min(10).max(2000)).min(1).max(6),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
})
    .partial();
export const resetSchema = z.object({ section: z.enum(['profile', 'preferences', 'habits', 'all']) });
//# sourceMappingURL=settings.validators.js.map