import type { Completion, Habit } from '../types';
export const localDate = (date = new Date()) => {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
export function arcDay(start: string | null, duration: number, today = new Date()) {
  if (!start) return 0;
  const begin = new Date(`${start}T00:00:00`); const now = new Date(`${localDate(today)}T00:00:00`);
  return Math.max(0, Math.min(duration, Math.floor((now.getTime() - begin.getTime()) / 86400000) + 1));
}
export function arcEndDate(start: string, duration: number) {
  const end = new Date(`${start}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + duration - 1); return end.toISOString().slice(0, 10);
}
export function arcDateAt(start: string, dayNumber: number) {
  const date = new Date(`${start}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + dayNumber - 1); return date.toISOString().slice(0, 10);
}
export function calculateDailyCompletion(habits: Habit[], completions: Completion[]) {
  const count = habits.filter(h => h.type === 'BOOLEAN' ? completions.some(c => c.habit_id === h.id && c.completed) : completions.some(c => c.habit_id === h.id && (c.value ?? 0) >= (h.target ?? 0))).length;
  return { count, total: habits.length, percent: habits.length ? Math.round(count / habits.length * 100) : 0 };
}
