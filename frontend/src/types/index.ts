export type User = { _id: string; name: string; email: string; role: 'user' | 'admin'; avatarUrl: string | null; createdAt: string };

export type ScheduleBlock = { key: string; label: string; start: string; end: string };

export type Profile = {
  personal: {
    ageRange: string | null; gender: string | null; heightCm: number | null; currentWeightKg: number | null;
    fitnessGoal: string | null; dietType: string | null; cooking: string | null; workoutLocation: string | null;
    equipment: string[]; currency: string; timezone: string; monthlyBudget: number;
  };
  targets: { proteinMinG: number; proteinMaxG: number; waterMl: number; sleepHours: number; studyMinutesPerDay: number; workoutMinutesPerDay: number };
  schedule: { wakeUp: string; sleep: string; blocks: ScheduleBlock[] };
  careerGoals: string[];
};

export type Widget = { key: string; visible: boolean; size: 'sm' | 'md' | 'lg' };
export type Preferences = { theme: 'light' | 'dark' | 'system'; dashboardWidgets: Widget[]; waterQuickAdd: number[]; weekStartsOn: 0 | 1 };

export const HABIT_CATEGORIES = ['routine', 'fitness', 'nutrition', 'learning', 'finance', 'grooming', 'sleep', 'mind', 'other'] as const;
export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

export type Habit = {
  _id: string; name: string; description: string; category: HabitCategory; icon: string; color: string | null;
  frequency: 'daily' | 'weekly'; daysOfWeek: number[]; order: number; archived: boolean;
  scheduledToday: boolean; completedToday: boolean;
  streak: { current: number; best: number };
  last7: { date: string; scheduled: boolean; done: boolean }[];
};

export type WaterEntry = { _id: string; amountMl: number; loggedAt: string; date: string };

export type Dashboard = {
  today: string; timezone: string; score: number;
  scoreComponents: { key: string; label: string; ratio: number }[];
  habits: { done: number; scheduled: number; topStreak: number; items: { _id: string; name: string; icon: string; category: HabitCategory; completedToday: boolean; streak: number }[] };
  water: { totalMl: number; targetMl: number; quickAdd: number[] };
  schedule: Profile['schedule'];
  targets: Profile['targets'];
  personal: Profile['personal'];
  weekly: { date: string; habitPct: number; waterMl: number }[];
  widgets: Widget[];
  routine: { override: DayOverride | null; name: string | null; activities: { _id: string; title: string; start: string; end: string; status: string | null; isNow: boolean }[]; stats: { total: number; done: number; missed: number } };
  workout: { title: string | null; focus: string; exercises: number; isRest: boolean; done: boolean; minutes: number };
  nutrition: Macros & { proteinMinG: number; proteinMaxG: number; hasEstimates: boolean };
  study: { minutes: number; targetMinutes: number };
  sleep: { hours: number | null; quality: number | null; bedtime: string | null; wakeTime: string | null; targetHours: number };
  finance: { spentToday: number; monthSpent: number; monthLimit: number; pct: number };
  goals: { active: number; top: { _id: string; title: string; progress: number; deadline: string }[] };
  work: WorkSummary;
};

/* ---------- Phase 2 ---------- */
export type Priority = 'low' | 'medium' | 'high';
export type Activity = { _id: string; title: string; start: string; end: string; priority: Priority; category: string; notes: string };
export type Routine = { _id: string; name: string; days: number[]; isActive: boolean; activities: Activity[]; order: number };
export type DayOverride = { _id: string; type: string; note: string; groupId: string | null };
export type RoutineDay = {
  date: string; routine: { _id: string; name: string } | null; note: string; override: DayOverride | null;
  activities: (Activity & { status: 'done' | 'missed' | 'skipped' | null; explicit: boolean; isNow: boolean })[];
  stats: { total: number; done: number; missed: number };
};

export type Exercise = { _id: string; name: string; muscleGroup: string; type: 'reps' | 'time'; difficulty: string; instructions: string; videoUrl: string };
export type PlanItem = { exercise: string | null; name: string; sets: number; reps: number; durationSec: number; restSec: number };
export type WorkoutPlan = { _id: string; dayOfWeek: number; title: string; focus: 'strength' | 'recovery' | 'conditioning' | 'rest'; items: PlanItem[] };
export type WorkoutLog = { _id: string; date: string; title: string; durationMin: number; completed: boolean; notes: string; entries: { exercise: string | null; name: string; sets: { reps: number; durationSec: number }[] }[] };
export type Measurement = { _id: string; date: string; weightKg: number | null; waistCm: number | null; chestCm: number | null; armCm: number | null; thighCm: number | null; notes: string };
export type ProgressPhoto = { _id: string; date: string; note: string };

export type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
export type Food = { _id: string; name: string; category: string; per100g: Macros; unitName: string; gramsPerUnit: number; verified: boolean; source: string };
export const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export type MealEntry = { _id: string; date: string; mealType: MealType; food: string; foodName: string; quantityG: number; estimated: boolean; macros: Macros };
export type NutritionDay = { date: string; meals: Record<MealType, { entries: MealEntry[]; totals: Macros }>; totals: Macros; hasEstimates: boolean; targets: { proteinMinG: number; proteinMaxG: number } };
export type MealPlan = { _id: string; dayOfWeek: number; items: { mealType: MealType; food: string; foodName: string; quantityG: number }[] };

/* ---------- Phase 3 ---------- */
export type Topic = { _id?: string; title: string; done: boolean; doneAt?: string | null; notes: string; subtopics: { title: string; done: boolean }[] };
export type LearningPath = { _id: string; title: string; description: string; order: number; startDate: string | null; targetDate: string | null; proficiency: number; topics: Topic[]; resources: { _id?: string; title: string; url: string; kind: string }[]; archived: boolean };
export type StudySession = { _id: string; date: string; minutes: number; path: string | null; topic: string; mode: string; kind: string; notes: string };
export type Project = { _id: string; title: string; description: string; status: 'idea' | 'building' | 'done' | 'paused'; techStack: string[]; repoUrl: string; progress: number };
export type Expense = { _id: string; date: string; amount: number; category: string; note: string; recurring: boolean };
export type FinanceSummary = {
  month: string; totalLimit: number; spent: number; remaining: number; pct: number; alertAtPct: number;
  categories: { name: string; limit: number; spent: number; remaining: number; pct: number | null }[];
  daily: { date: string; total: number }[]; history: { month: string; spent: number; saved: number }[];
};
export type GroomingTask = { _id: string; title: string; category: string; frequency: 'daily' | 'weekly' | 'interval'; daysOfWeek: number[]; intervalDays: number; due: boolean; doneToday: boolean; lastDone: string | null; nextDue: string | null };
export type ClothingItem = { _id: string; name: string; category: string; color: string; condition: string; wishlist: boolean; price: number; priority: Priority };
export type Outfit = { _id: string; date: string; items: string[]; note: string };
export type SleepRecord = { _id: string; date: string; bedtime: string; wakeTime: string; durationMin: number; quality: number; notes: string };
export type Goal = { _id: string; title: string; description: string; category: string; horizon: 30 | 60 | 90; startDate: string; deadline: string; priority: Priority; status: 'active' | 'completed' | 'paused' | 'dropped'; progress: number; milestones: { _id?: string; title: string; done: boolean; dueDate?: string | null }[] };
export type JournalEntry = { _id: string; date: string; mood: number; achievements: string; challenges: string; reflection: string; ideas: string; tags: string[] };
export type Reminder = { _id: string; title: string; type: string; time: string; days: number[]; enabled: boolean; skipOnLeave: boolean };
export type AppNotification = { _id: string; title: string; body: string; kind: string; link: string | null; readAt: string | null; createdAt: string };

/* ---------- Work ---------- */
export type WorkPriority = 'low' | 'medium' | 'high' | 'urgent';
export type Stakeholder = { _id: string; name: string; department: string; role: string; note: string };
export type WorkProject = {
  _id: string; name: string; description: string; department: string; stakeholders: string[];
  status: 'planning' | 'in_progress' | 'on_hold' | 'live' | 'done'; priority: WorkPriority;
  startDate: string | null; targetDate: string | null; progress: number; links: { label: string; url: string }[]; techStack: string[]; archived: boolean;
};
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type WorkTask = {
  _id: string; title: string; description: string; project: string | { _id: string; name: string } | null; status: TaskStatus; blockedReason: string;
  priority: WorkPriority; dueDate: string | null; checklist: { _id?: string; title: string; done: boolean }[]; estimateHours: number | null;
  assignee: string; order: number; completedDate: string | null; source: { kind: 'manual' | 'requirement' | 'meeting'; id: string | null };
};
export type Requirement = {
  _id: string; title: string; details: string; project: string | null; stakeholder: string | null; requestedBy: string; department: string;
  date: string; priority: WorkPriority; status: 'new' | 'accepted' | 'in_progress' | 'delivered' | 'rejected'; task: string | null;
};
export type Meeting = {
  _id: string; title: string; date: string; project: string | null; attendees: string[]; notes: string; decisions: string;
  actionItems: { _id?: string; text: string; assignee: string; dueDate: string | null; task: string | null }[];
};
export type WorkLogEntry = { _id: string; date: string; project: string | { _id: string; name: string } | null; task: string | null; description: string; minutes: number };
export type ChangeEntry = { _id: string; project: string; date: string; version: string; type: 'feature' | 'fix' | 'config' | 'data'; environment: 'dev' | 'uat' | 'live'; summary: string };
export type WorkSummary = {
  dueToday: (Pick<WorkTask, '_id' | 'title' | 'priority' | 'status' | 'dueDate'> & { project: { name: string } | null })[];
  overdue: (Pick<WorkTask, '_id' | 'title' | 'priority' | 'status' | 'dueDate'> & { project: { name: string } | null })[];
  dueTodayCount: number; overdueCount: number; blocked: number; minutesToday: number;
};
