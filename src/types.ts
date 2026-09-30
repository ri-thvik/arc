export type HabitType = 'BOOLEAN' | 'NUMBER' | 'DURATION';
export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  accent: string;
  type: HabitType;
  target: number | null;
  unit: string | null;
  frequency: string;
  active: boolean;
  created_at: string;
}
export interface Completion {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  value: number | null;
  completed: boolean;
  created_at?: string;
}
export interface Profile {
  id: string;
  name: string;
  start_date: string | null;
  duration: number;
  goal: string | null;
  motto: string | null;
  onboarding_complete: boolean;
}

export type CalendarStatus = 'completed' | 'partial' | 'missed' | 'future' | 'no-data';
export interface DailyProgress {
  date: string;
  dayNumber: number;
  completed: number;
  total: number;
  percentage: number;
  status: CalendarStatus;
  isToday: boolean;
}
export interface HabitStats {
  habit: Habit;
  completed: number;
  expected: number;
  percentage: number;
  currentStreak: number;
  longestStreak: number;
}
export interface ArcStats {
  startDate: string | null;
  endDate: string | null;
  currentDay: number;
  totalDays: number;
  completedDays: number;
  arcProgress: number;
  consistency: number;
  currentStreak: number;
  longestStreak: number;
  hasHistory: boolean;
}
export interface ProgressData {
  days: DailyProgress[];
  arc: ArcStats;
  habits: HabitStats[];
}
