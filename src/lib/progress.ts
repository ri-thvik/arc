import { arcDateAt, arcEndDate, calculateDailyCompletion } from './calculations';
import type { ArcStats, CalendarStatus, Completion, DailyProgress, Habit, HabitStats, ProgressData } from '../types';

function scheduledOn(habit: Habit, date: string) {
  if (habit.created_at.slice(0, 10) > date) return false;
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if (habit.frequency.toLowerCase() === 'weekdays') return weekday >= 1 && weekday <= 5;
  if (habit.frequency.toLowerCase() === 'weekends') return weekday === 0 || weekday === 6;
  return true;
}

function completionOn(habit: Habit, rows: Completion[], date: string) {
  const record = rows.find(row => row.habit_id === habit.id && row.date === date);
  return habit.type === 'BOOLEAN' ? Boolean(record?.completed) : record?.value !== null && record?.value !== undefined && record.value >= (habit.target ?? 1);
}

function streakStats(expectedDates: string[], completedDates: Set<string>, today: string) {
  let longest = 0; let run = 0;
  for (const date of expectedDates) {
    if (completedDates.has(date)) { run += 1; longest = Math.max(longest, run); }
    else run = 0;
  }
  let current = 0;
  const currentIndex = expectedDates.findIndex(date => date === today);
  let index = currentIndex >= 0 ? currentIndex : expectedDates.length - 1;
  if (currentIndex >= 0 && !completedDates.has(today)) index -= 1;
  for (; index >= 0; index -= 1) {
    if (!completedDates.has(expectedDates[index])) break;
    current += 1;
  }
  return { current, longest };
}

export function buildProgressData(habits: Habit[], rows: Completion[], startDate: string | null, duration: number, today: string): ProgressData {
  const endDate = startDate ? arcEndDate(startDate, duration) : null;
  if (!startDate || !endDate) {
    const emptyArc: ArcStats = { startDate: null, endDate: null, currentDay: 0, totalDays: duration, completedDays: 0, arcProgress: 0, consistency: 0, currentStreak: 0, longestStreak: 0, hasHistory: false };
    return { days: [], arc: emptyArc, habits: [] };
  }

  const currentDay = today < startDate ? 0 : Math.min(duration, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1);
  const lastElapsedDate = today < startDate ? startDate : (today > endDate ? endDate : today);
  const activeHabitIds = new Set(habits.map(habit => habit.id));
  const arcRows = rows.filter(row => activeHabitIds.has(row.habit_id) && row.date >= startDate && row.date <= endDate);
  const firstTrackedDate = arcRows.length ? arcRows.reduce((first, row) => row.date < first ? row.date : first, arcRows[0].date) : null;
  const days: DailyProgress[] = Array.from({ length: duration }, (_, index) => {
    const date = arcDateAt(startDate, index + 1);
    const expected = habits.filter(habit => scheduledOn(habit, date));
    const dayRows = rows.filter(row => row.date === date);
    const completed = expected.filter(habit => completionOn(habit, dayRows, date)).length;
    const summary = calculateDailyCompletion(expected, dayRows);
    let status: CalendarStatus;
    if (date > today) status = 'future';
    else if (!expected.length || (date === today && completed === 0) || !firstTrackedDate || date < firstTrackedDate) status = 'no-data';
    else if (summary.percent === 100) status = 'completed';
    else if (completed > 0) status = 'partial';
    else status = 'missed';
    return { date, dayNumber: index + 1, completed, total: expected.length, percentage: summary.percent, status, isToday: date === today };
  });

  const elapsedDays = today < startDate ? [] : days.filter(day => day.date <= lastElapsedDate);
  const completedDays = elapsedDays.filter(day => day.status === 'completed').length;
  const expectedInstances = elapsedDays.reduce((sum, day) => sum + day.total, 0);
  const completedInstances = elapsedDays.reduce((sum, day) => sum + day.completed, 0);
  const completedArcDates = new Set(elapsedDays.filter(day => day.status === 'completed').map(day => day.date));
  const overallExpectedDates = elapsedDays.filter(day => day.total > 0).map(day => day.date);
  const overallStreak = streakStats(overallExpectedDates, completedArcDates, today);
  const arc: ArcStats = {
    startDate, endDate, currentDay, totalDays: duration, completedDays,
    arcProgress: duration ? Math.round(completedDays / duration * 100) : 0,
    consistency: expectedInstances ? Math.round(completedInstances / expectedInstances * 100) : 0,
    currentStreak: overallStreak.current, longestStreak: overallStreak.longest,
    hasHistory: today >= startDate && arcRows.some(row => row.date <= lastElapsedDate),
  };

  const habitStats: HabitStats[] = habits.map(habit => {
    const expectedDates = elapsedDays.filter(day => scheduledOn(habit, day.date)).map(day => day.date);
    const completedDates = new Set(expectedDates.filter(date => completionOn(habit, rows, date)));
    const streak = streakStats(expectedDates, completedDates, today);
    const completed = completedDates.size;
    return { habit, completed, expected: expectedDates.length, percentage: expectedDates.length ? Math.round(completed / expectedDates.length * 100) : 0, currentStreak: streak.current, longestStreak: streak.longest };
  });
  return { days, arc, habits: habitStats };
}

export function completionForDay(habits: Habit[], rows: Completion[], date: string) {
  const scheduled = habits.filter(habit => scheduledOn(habit, date));
  return { ...calculateDailyCompletion(scheduled, rows.filter(row => row.date === date)), habits: scheduled.map(habit => ({ habit, completed: completionOn(habit, rows, date) })) };
}
