import { supabase } from '../lib/supabase';
import { arcEndDate } from '../lib/calculations';
import type { Completion, Habit, Profile } from '../types';
const client = () => { if (!supabase) throw new Error('Supabase is not configured. Add your project URL and anon key to .env.local.'); return supabase; };
export async function loadTracker(userId: string, date: string) {
  const db = client();
  const [profile, habits, today] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).maybeSingle(),
    db.from('habits').select('*').eq('user_id', userId).eq('active', true).order('created_at'),
    db.from('habit_completions').select('*').eq('user_id', userId).eq('date', date),
  ]);
  for (const result of [profile, habits, today]) if (result.error) throw result.error;
  const currentProfile = profile.data as Profile | null;
  const history: Completion[] = [];
  if (currentProfile?.start_date) {
    const endDate = arcEndDate(currentProfile.start_date, currentProfile.duration);
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db.from('habit_completions').select('*').eq('user_id', userId)
        .gte('date', currentProfile.start_date).lte('date', endDate).order('date', { ascending: true }).range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as Completion[];
      history.push(...page);
      if (page.length < pageSize) break;
    }
  }
  return { profile: currentProfile, habits: habits.data as Habit[], today: today.data as Completion[], history };
}
export async function saveProfile(userId: string, values: { name: string; start_date: string; duration: number; goal: string | null; motto: string | null }) {
  const { error } = await client().from('profiles').upsert({ id: userId, ...values, onboarding_complete: true }, { onConflict: 'id' }); if (error) throw error;
}
export async function hasCompletionOutsideArc(userId: string, startDate: string, endDate: string) {
  const { data, error } = await client().from('habit_completions').select('id').eq('user_id', userId)
    .or(`date.lt.${startDate},date.gt.${endDate}`).limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
export async function addHabits(userId: string, habits: Array<Pick<Habit, 'name' | 'description' | 'icon' | 'accent' | 'type' | 'target' | 'unit' | 'frequency'>>) {
  const { error } = await client().from('habits').insert(habits.map(h => ({ ...h, user_id: userId, active: true }))); if (error) throw error;
}
export async function upsertHabit(userId: string, habit: Pick<Habit, 'name' | 'description' | 'icon' | 'accent' | 'type' | 'target' | 'unit' | 'frequency'>, id?: string) {
  let query = client().from('habits').upsert({ ...habit, user_id: userId, active: true, ...(id ? { id } : {}) }); const { error } = await query; if (error) throw error;
}
export async function archiveHabit(userId: string, id: string) { const { error } = await client().from('habits').update({ active: false }).eq('user_id', userId).eq('id', id); if (error) throw error; }
export async function putCompletion(userId: string, habitId: string, date: string, completed: boolean) {
  if (completed) { const { error } = await client().from('habit_completions').upsert({ habit_id: habitId, user_id: userId, date, completed: true, value: null }, { onConflict: 'user_id,habit_id,date' }); if (error) throw error; }
  else { const { error } = await client().from('habit_completions').delete().eq('user_id', userId).eq('habit_id', habitId).eq('date', date); if (error) throw error; }
}
export async function putNumericCompletion(userId: string, habitId: string, date: string, value: number, target: number) {
  const { error } = await client().from('habit_completions').upsert({ habit_id: habitId, user_id: userId, date, value, completed: value >= target }, { onConflict: 'user_id,habit_id,date' }); if (error) throw error;
}
