/**
 * Default configuration applied when a new user registers.
 * These are ONLY seed values — every field is editable from Settings
 * and stored per-user in MongoDB. Nothing below is read at runtime
 * except during user creation or "reset to default".
 */
export const DEFAULT_PROFILE = {
    ageRange: '25-30',
    gender: 'male',
    heightCm: 163,
    currentWeightKg: 57,
    fitnessGoal: 'lean_muscle_gain',
    dietType: 'vegetarian_eggs',
    cooking: 'self',
    workoutLocation: 'home',
    equipment: [],
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    monthlyBudget: 2500,
};
export const DEFAULT_TARGETS = {
    proteinMinG: 85,
    proteinMaxG: 95,
    waterMl: 3000,
    sleepHours: 7.5,
    studyMinutesPerDay: 40,
    workoutMinutesPerDay: 30,
};
export const DEFAULT_SCHEDULE = {
    wakeUp: '06:15',
    sleep: '23:00',
    blocks: [
        { key: 'workout', label: 'Workout', start: '06:25', end: '06:55' },
        { key: 'learning', label: 'Learning', start: '07:15', end: '07:55' },
        { key: 'breakfast', label: 'Breakfast', start: '08:00', end: '08:30' },
        { key: 'office', label: 'Office + commute', start: '09:00', end: '21:00' },
        { key: 'dinner', label: 'Dinner', start: '21:15', end: '21:45' },
        { key: 'personal', label: 'Personal time', start: '21:45', end: '22:15' },
    ],
};
export const DEFAULT_CAREER_GOALS = [
    'Python programming',
    'AI Automation',
    'n8n workflows',
    'REST APIs',
    'MongoDB',
    'LLM APIs',
    'AI Agents',
    'Document Processing Automation',
];
export const DEFAULT_HABITS = [
    { name: 'Wake up on time', category: 'routine', icon: 'sunrise' },
    { name: 'Workout', category: 'fitness', icon: 'dumbbell' },
    { name: 'Healthy breakfast', category: 'nutrition', icon: 'egg' },
    { name: 'Complete protein target', category: 'nutrition', icon: 'beef' },
    { name: 'Water target', category: 'nutrition', icon: 'droplet' },
    { name: 'Study Python', category: 'learning', icon: 'code' },
    { name: 'Avoid unnecessary spending', category: 'finance', icon: 'wallet' },
    { name: 'Grooming', category: 'grooming', icon: 'sparkles' },
    { name: 'Prepare next-day clothes', category: 'grooming', icon: 'shirt' },
    { name: 'Sleep on time', category: 'sleep', icon: 'moon' },
];
export const DEFAULT_DASHBOARD_WIDGETS = [
    { key: 'score', visible: true, size: 'md' },
    { key: 'habits', visible: true, size: 'md' },
    { key: 'workout', visible: true, size: 'sm' },
    { key: 'nutrition', visible: true, size: 'sm' },
    { key: 'water', visible: true, size: 'sm' },
    { key: 'schedule', visible: true, size: 'sm' },
    { key: 'study', visible: true, size: 'sm' },
    { key: 'sleep', visible: true, size: 'sm' },
    { key: 'finance', visible: true, size: 'sm' },
    { key: 'goals', visible: true, size: 'sm' },
    { key: 'profile', visible: true, size: 'sm' },
    { key: 'weekly', visible: true, size: 'lg' },
];
//# sourceMappingURL=defaults.js.map