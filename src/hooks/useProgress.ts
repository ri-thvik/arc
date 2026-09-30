import { useMemo } from 'react';
import { buildProgressData } from '../lib/progress';
import type { Completion, Habit } from '../types';

export function useProgress(habits: Habit[], completions: Completion[], startDate: string | null, duration: number, today: string) {
  return useMemo(() => buildProgressData(habits, completions, startDate, duration, today), [habits, completions, startDate, duration, today]);
}
