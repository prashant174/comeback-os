/**
 * Starter data seeded once per user per module. Everything is editable or
 * deletable afterwards; deleting it all does NOT re-seed (tracked in
 * userpreferences.seededModules).
 */

export const SEED_EXERCISES = [
  { name: 'Incline push-ups', muscleGroup: 'chest', type: 'reps', difficulty: 'beginner', instructions: 'Hands on a bed/table edge, body straight from head to heels. Lower chest to the edge, push back up. Lower the surface over weeks to progress.' },
  { name: 'Knee push-ups', muscleGroup: 'chest', type: 'reps', difficulty: 'beginner', instructions: 'Knees on the floor, hands slightly wider than shoulders. Keep hips in line, lower chest close to the floor, press up.' },
  { name: 'Push-ups', muscleGroup: 'chest', type: 'reps', difficulty: 'intermediate', instructions: 'Plank position, elbows ~45° from body, lower until chest nearly touches the floor, press up keeping core tight.' },
  { name: 'Pike push-ups', muscleGroup: 'shoulders', type: 'reps', difficulty: 'intermediate', instructions: 'Hips high in an inverted V, bend elbows to bring head toward the floor between hands, press back up.' },
  { name: 'Plank', muscleGroup: 'core', type: 'time', difficulty: 'beginner', instructions: 'Forearms under shoulders, body in a straight line, squeeze glutes and brace abs. Breathe steadily.' },
  { name: 'Squats', muscleGroup: 'legs', type: 'reps', difficulty: 'beginner', instructions: 'Feet shoulder-width, sit back and down keeping chest up and knees tracking over toes, stand up through heels.' },
  { name: 'Reverse lunges', muscleGroup: 'legs', type: 'reps', difficulty: 'beginner', instructions: 'Step one foot back, lower until both knees ~90°, push through the front heel to return. Reps per leg.' },
  { name: 'Glute bridges', muscleGroup: 'glutes', type: 'reps', difficulty: 'beginner', instructions: 'Lie on back, knees bent, feet flat. Drive hips up squeezing glutes, pause, lower slowly.' },
  { name: 'Calf raises', muscleGroup: 'legs', type: 'reps', difficulty: 'beginner', instructions: 'Stand tall (hold a wall for balance), rise onto toes, pause, lower slowly. Use a step edge for range.' },
  { name: 'Superman', muscleGroup: 'back', type: 'reps', difficulty: 'beginner', instructions: 'Lie face down, lift arms, chest and legs a few cm off the floor, hold 2 s, lower.' },
  { name: 'Bird dog', muscleGroup: 'core', type: 'reps', difficulty: 'beginner', instructions: 'On all fours, extend opposite arm and leg, keep hips level, hold 2 s, switch sides.' },
  { name: 'Walking', muscleGroup: 'cardio', type: 'time', difficulty: 'beginner', instructions: 'Brisk pace where talking is possible but slightly effortful.' },
  { name: 'Mobility flow', muscleGroup: 'mobility', type: 'time', difficulty: 'beginner', instructions: 'Neck rolls, arm circles, hip circles, cat-cow, deep squat hold, world’s greatest stretch.' },
  { name: 'Stretching', muscleGroup: 'mobility', type: 'time', difficulty: 'beginner', instructions: 'Hamstrings, quads, hip flexors, chest, shoulders — 30 s each side, no bouncing.' },
  { name: 'Jumping jacks', muscleGroup: 'cardio', type: 'time', difficulty: 'beginner', instructions: 'Optional cardio. Land softly; swap for step-jacks if needed.' },
] as const;

type PlanItem = { name: string; sets: number; reps?: number; durationSec?: number; restSec?: number };
export const SEED_WORKOUT_PLAN: { dayOfWeek: number; title: string; focus: 'strength' | 'recovery' | 'conditioning' | 'rest'; items: PlanItem[] }[] = [
  { dayOfWeek: 1, title: 'Push', focus: 'strength', items: [
    { name: 'Incline push-ups', sets: 3, reps: 12 }, { name: 'Knee push-ups', sets: 3, reps: 10 },
    { name: 'Pike push-ups', sets: 3, reps: 8 }, { name: 'Plank', sets: 3, durationSec: 30 } ] },
  { dayOfWeek: 2, title: 'Legs', focus: 'strength', items: [
    { name: 'Squats', sets: 3, reps: 15 }, { name: 'Reverse lunges', sets: 3, reps: 10 },
    { name: 'Glute bridges', sets: 3, reps: 15 }, { name: 'Calf raises', sets: 3, reps: 20 } ] },
  { dayOfWeek: 3, title: 'Recovery', focus: 'recovery', items: [
    { name: 'Walking', sets: 1, durationSec: 1200, restSec: 0 }, { name: 'Mobility flow', sets: 1, durationSec: 300, restSec: 0 },
    { name: 'Stretching', sets: 1, durationSec: 300, restSec: 0 } ] },
  { dayOfWeek: 4, title: 'Upper body', focus: 'strength', items: [
    { name: 'Incline push-ups', sets: 3, reps: 12 }, { name: 'Knee push-ups', sets: 3, reps: 10 },
    { name: 'Superman', sets: 3, reps: 12 }, { name: 'Bird dog', sets: 3, reps: 10 } ] },
  { dayOfWeek: 5, title: 'Full body', focus: 'strength', items: [
    { name: 'Squats', sets: 3, reps: 15 }, { name: 'Push-ups', sets: 3, reps: 6 },
    { name: 'Glute bridges', sets: 3, reps: 15 }, { name: 'Plank', sets: 3, durationSec: 30 } ] },
  { dayOfWeek: 6, title: 'Conditioning', focus: 'conditioning', items: [
    { name: 'Walking', sets: 1, durationSec: 1800, restSec: 0 }, { name: 'Stretching', sets: 1, durationSec: 300, restSec: 0 },
    { name: 'Jumping jacks', sets: 3, durationSec: 45, restSec: 45 } ] },
  { dayOfWeek: 0, title: 'Rest', focus: 'rest', items: [] },
];

const SRC = 'Approximate reference values — not verified. Check the pack label or IFCT 2017 and correct.';
type F = [name: string, category: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, unitName?: string, gramsPerUnit?: number];
/** per 100 g (dry/raw weight unless the name says cooked) */
const FOODS: F[] = [
  ['Egg (whole)', 'protein', 143, 12.6, 0.7, 9.5, 0, 'egg', 50],
  ['Milk (toned)', 'dairy', 58, 3.1, 4.7, 3, 0, 'glass (250 ml)', 250],
  ['Curd / dahi', 'dairy', 60, 3.5, 4.7, 3.1, 0, 'bowl', 150],
  ['Paneer', 'dairy', 265, 18, 3.6, 20, 0],
  ['Soy chunks (dry)', 'protein', 345, 52, 33, 0.5, 13],
  ['Toor dal (dry)', 'legume', 343, 22, 58, 1.5, 15],
  ['Moong dal (dry)', 'legume', 348, 24, 59, 1.2, 16],
  ['Kala chana (dry)', 'legume', 364, 19, 61, 6, 17],
  ['Rajma (dry)', 'legume', 333, 23, 60, 0.8, 24],
  ['Sattu (roasted gram flour)', 'legume', 400, 22, 62, 5, 16],
  ['Roasted chana', 'snack', 370, 19, 58, 5.5, 15],
  ['Besan', 'legume', 387, 22, 58, 6.7, 11],
  ['Rice (white, raw)', 'grain', 360, 7, 79, 0.6, 1.3],
  ['Roti (whole wheat, cooked)', 'grain', 297, 9.8, 55, 3.7, 9, 'roti', 40],
  ['Poha (dry)', 'grain', 350, 6.6, 77, 1.2, 2],
  ['Oats (rolled)', 'grain', 389, 13, 66, 7, 10],
  ['Banana', 'fruit', 89, 1.1, 23, 0.3, 2.6, 'banana', 118],
  ['Apple', 'fruit', 52, 0.3, 14, 0.2, 2.4, 'apple', 180],
  ['Seasonal fruit (mixed)', 'fruit', 60, 0.8, 15, 0.2, 2.5],
  ['Mixed vegetables (sabzi, cooked)', 'vegetable', 90, 2.5, 10, 4.5, 3.5, 'katori', 150],
  ['Spinach / palak (raw)', 'vegetable', 23, 2.9, 3.6, 0.4, 2.2],
  ['Peanuts (raw)', 'nuts', 567, 25.8, 16, 49, 8.5],
];
export const SEED_FOODS = FOODS.map(([name, category, kcal, protein, carbs, fat, fiber, unitName = '', gramsPerUnit = 0]) => ({
  name, category, per100g: { kcal, protein, carbs, fat, fiber }, unitName, gramsPerUnit, verified: false, source: SRC,
}));

/** Weekly vegetarian + egg plan, ~85–95 g protein/day with the seed values. [food, grams] per meal. */
type M = [string, number][];
const day = (b: M, l: M, s: M, d: M) => ({ breakfast: b, lunch: l, snacks: s, dinner: d });
export const SEED_MEAL_PLAN: Record<number, ReturnType<typeof day>> = {
  1: day([['Oats (rolled)', 50], ['Milk (toned)', 250], ['Egg (whole)', 100], ['Banana', 118]], [['Roti (whole wheat, cooked)', 120], ['Toor dal (dry)', 50], ['Mixed vegetables (sabzi, cooked)', 150], ['Curd / dahi', 150]], [['Roasted chana', 40], ['Peanuts (raw)', 15]], [['Rice (white, raw)', 60], ['Soy chunks (dry)', 40], ['Mixed vegetables (sabzi, cooked)', 150]]),
  2: day([['Poha (dry)', 60], ['Egg (whole)', 150], ['Milk (toned)', 200]], [['Roti (whole wheat, cooked)', 120], ['Rajma (dry)', 50], ['Curd / dahi', 150]], [['Sattu (roasted gram flour)', 40], ['Apple', 180]], [['Roti (whole wheat, cooked)', 80], ['Paneer', 75], ['Spinach / palak (raw)', 150]]),
  3: day([['Oats (rolled)', 50], ['Milk (toned)', 250], ['Egg (whole)', 100]], [['Rice (white, raw)', 60], ['Moong dal (dry)', 50], ['Mixed vegetables (sabzi, cooked)', 150], ['Curd / dahi', 150]], [['Roasted chana', 40], ['Banana', 118]], [['Roti (whole wheat, cooked)', 120], ['Soy chunks (dry)', 40], ['Mixed vegetables (sabzi, cooked)', 150]]),
  4: day([['Besan', 50], ['Egg (whole)', 100], ['Milk (toned)', 200]], [['Roti (whole wheat, cooked)', 120], ['Kala chana (dry)', 50], ['Curd / dahi', 150]], [['Peanuts (raw)', 20], ['Seasonal fruit (mixed)', 150]], [['Rice (white, raw)', 60], ['Toor dal (dry)', 50], ['Paneer', 50]]),
  5: day([['Oats (rolled)', 50], ['Milk (toned)', 250], ['Egg (whole)', 100], ['Banana', 118]], [['Roti (whole wheat, cooked)', 120], ['Rajma (dry)', 50], ['Mixed vegetables (sabzi, cooked)', 150]], [['Sattu (roasted gram flour)', 40], ['Roasted chana', 20]], [['Roti (whole wheat, cooked)', 80], ['Soy chunks (dry)', 40], ['Curd / dahi', 150]]),
  6: day([['Poha (dry)', 60], ['Egg (whole)', 150], ['Milk (toned)', 200]], [['Rice (white, raw)', 70], ['Kala chana (dry)', 50], ['Curd / dahi', 150]], [['Peanuts (raw)', 20], ['Apple', 180]], [['Roti (whole wheat, cooked)', 120], ['Paneer', 75], ['Mixed vegetables (sabzi, cooked)', 150]]),
  0: day([['Besan', 50], ['Egg (whole)', 100], ['Curd / dahi', 150]], [['Rice (white, raw)', 70], ['Rajma (dry)', 50], ['Mixed vegetables (sabzi, cooked)', 150]], [['Roasted chana', 40], ['Seasonal fruit (mixed)', 150]], [['Roti (whole wheat, cooked)', 120], ['Moong dal (dry)', 50], ['Egg (whole)', 100]]),
};

export const SEED_LEARNING_PATHS = [
  { title: 'Month 1 · Python fundamentals', description: 'Core Python plus data handling with Pandas and Excel.', topics: ['Variables', 'Data types', 'Conditions', 'Loops', 'Functions', 'Lists', 'Dictionaries', 'File handling', 'Pandas', 'Excel automation'],
    resources: [{ title: 'Official Python tutorial', url: 'https://docs.python.org/3/tutorial/', kind: 'docs' }, { title: 'Pandas getting started', url: 'https://pandas.pydata.org/docs/getting_started/index.html', kind: 'docs' }] },
  { title: 'Month 2 · Automation', description: 'APIs, data stores and workflow automation.', topics: ['REST APIs', 'JSON', 'Requests library', 'MongoDB integration', 'n8n workflows', 'Email automation', 'Document automation'],
    resources: [{ title: 'Requests docs', url: 'https://requests.readthedocs.io/', kind: 'docs' }, { title: 'n8n docs', url: 'https://docs.n8n.io/', kind: 'docs' }, { title: 'PyMongo tutorial', url: 'https://pymongo.readthedocs.io/en/stable/tutorial.html', kind: 'docs' }] },
  { title: 'Month 3 · AI automation', description: 'LLM APIs, extraction, RAG and agents, shipped to production.', topics: ['LLM APIs', 'Prompt engineering', 'Structured outputs', 'AI document extraction', 'RAG fundamentals', 'AI agents', 'Error handling', 'Deployment'],
    resources: [{ title: 'Anthropic docs', url: 'https://docs.claude.com/', kind: 'docs' }, { title: 'OpenAI docs', url: 'https://platform.openai.com/docs', kind: 'docs' }] },
];

export const SEED_PROJECTS = [
  { title: 'Excel report automation', description: 'Python + Pandas script that cleans a raw Excel export and produces a summary sheet.', status: 'idea', techStack: ['Python', 'Pandas', 'openpyxl'] },
  { title: 'Invoice data extractor', description: 'Extract fields from PDF invoices with an LLM into JSON, store in MongoDB.', status: 'idea', techStack: ['Python', 'LLM API', 'MongoDB'] },
];

export const SEED_BUDGET = [
  { name: 'Fitness / Healthy Food', limit: 900 },
  { name: 'Clothing', limit: 800 },
  { name: 'Grooming', limit: 400 },
  { name: 'Miscellaneous', limit: 400 },
];

export const SEED_GROOMING = [
  { title: 'Face wash (morning)', category: 'skincare', frequency: 'daily' },
  { title: 'Sunscreen before leaving', category: 'skincare', frequency: 'daily' },
  { title: 'Face wash + moisturiser (night)', category: 'skincare', frequency: 'daily' },
  { title: 'Brush teeth twice', category: 'dental', frequency: 'daily' },
  { title: 'Floss', category: 'dental', frequency: 'daily' },
  { title: 'Beard trim / shave', category: 'beard', frequency: 'weekly', daysOfWeek: [3, 6] },
  { title: 'Nail trim', category: 'other', frequency: 'weekly', daysOfWeek: [0] },
  { title: 'Iron clothes for the week', category: 'clothing', frequency: 'weekly', daysOfWeek: [0] },
  { title: 'Haircut', category: 'hair', frequency: 'interval', intervalDays: 30 },
  { title: 'Replace toothbrush', category: 'dental', frequency: 'interval', intervalDays: 90 },
] as const;

export const SEED_GOALS = [
  { title: 'Improve physical fitness', category: 'fitness', milestones: ['Complete 4 workouts a week for 4 weeks', '20 full push-ups in one set', 'Hold a 90 s plank'] },
  { title: 'Build lean muscle', category: 'fitness', milestones: ['Hit protein target 5 days a week', 'Reach 59 kg', 'Reach 61 kg'] },
  { title: 'Develop Python skills', category: 'learning', milestones: ['Finish Month 1 topics', 'Automate one Excel report', 'Finish Month 2 topics'] },
  { title: 'Build AI automation projects', category: 'learning', milestones: ['Ship invoice extractor v1', 'Build one n8n workflow end-to-end'] },
  { title: 'Improve dressing and grooming', category: 'grooming', milestones: ['Buy 2 well-fitting shirts', 'Follow the skincare routine 25 days in a month'] },
  { title: 'Maintain financial discipline', category: 'finance', milestones: ['Stay within budget for 3 months'] },
  { title: 'Improve sleep consistency', category: 'sleep', milestones: ['Sleep by 11 PM on 20 nights in a month'] },
];

export const SEED_REMINDERS = [
  { title: 'Wake up', type: 'wake', time: '06:15', skipOnLeave: true },
  { title: 'Workout time', type: 'workout', time: '06:25', skipOnLeave: true },
  { title: 'Study session', type: 'study', time: '07:15' },
  { title: 'Breakfast', type: 'meal', time: '08:00' },
  { title: 'Drink water', type: 'water', time: '11:00' },
  { title: 'Drink water', type: 'water', time: '16:00' },
  { title: 'Dinner', type: 'meal', time: '21:15' },
  { title: 'Wind down for sleep', type: 'sleep', time: '22:40' },
  { title: 'Weekly review', type: 'review', time: '10:00', days: [0] },
  { title: 'Check this month’s budget', type: 'budget', time: '19:00', days: [6] },
] as const;

export const WEEKEND_ROUTINES = {
  saturday: [
    { title: 'Wake up', start: '07:00', end: '07:10', category: 'routine', priority: 'medium' },
    { title: 'Conditioning workout', start: '07:15', end: '08:00', category: 'fitness', priority: 'high' },
    { title: 'Breakfast', start: '08:15', end: '08:45', category: 'meal', priority: 'medium' },
    { title: 'Project work (Python)', start: '09:30', end: '11:30', category: 'learning', priority: 'high' },
    { title: 'Groceries + meal prep', start: '12:00', end: '13:30', category: 'chores', priority: 'medium' },
    { title: 'Laundry + grooming', start: '16:00', end: '17:00', category: 'grooming', priority: 'low' },
    { title: 'Sleep', start: '23:00', end: '23:10', category: 'sleep', priority: 'high' },
  ],
  sunday: [
    { title: 'Wake up', start: '07:30', end: '07:40', category: 'routine', priority: 'medium' },
    { title: 'Walk + stretching', start: '07:45', end: '08:15', category: 'fitness', priority: 'medium' },
    { title: 'Learning (revision)', start: '10:00', end: '11:30', category: 'learning', priority: 'high' },
    { title: 'Weekly review + plan next week', start: '11:30', end: '12:00', category: 'review', priority: 'high' },
    { title: 'Iron clothes, prep outfits', start: '17:00', end: '17:45', category: 'grooming', priority: 'medium' },
    { title: 'Sleep', start: '22:45', end: '22:55', category: 'sleep', priority: 'high' },
  ],
};

/** On-demand routine (no weekdays) used when a day is marked as leave/holiday. */
export const LEAVE_ROUTINE = [
  { title: 'Wake up (no alarm)', start: '07:30', end: '07:40', category: 'routine', priority: 'low' },
  { title: 'Workout + stretching', start: '08:00', end: '08:45', category: 'fitness', priority: 'high' },
  { title: 'Breakfast', start: '09:00', end: '09:30', category: 'meal', priority: 'medium' },
  { title: 'Deep learning block (Python)', start: '10:00', end: '12:00', category: 'learning', priority: 'high' },
  { title: 'Lunch + rest', start: '13:00', end: '14:30', category: 'meal', priority: 'low' },
  { title: 'Project work', start: '15:00', end: '17:00', category: 'learning', priority: 'medium' },
  { title: 'Walk / outdoor time', start: '17:30', end: '18:30', category: 'fitness', priority: 'medium' },
  { title: 'Grooming + next-day prep', start: '20:00', end: '20:30', category: 'grooming', priority: 'low' },
  { title: 'Sleep', start: '23:00', end: '23:10', category: 'sleep', priority: 'high' },
];
