import type { Completion, Habit, Profile } from '../types';
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile & { email: string | null; created_at: string; updated_at: string }; Insert: Omit<Profile, 'name' | 'duration' | 'goal' | 'onboarding_complete'> & { name?: string; duration?: number; goal?: string | null; onboarding_complete?: boolean; email?: string | null }; Update: Partial<Profile> & { email?: string | null; updated_at?: string } ; Relationships: [] };
      habits: { Row: Habit; Insert: Omit<Habit, 'id' | 'created_at' | 'description' | 'icon' | 'accent' | 'type' | 'target' | 'unit' | 'frequency' | 'active'> & { description?: string | null; icon?: string; accent?: string; type?: Habit['type']; target?: number | null; unit?: string | null; frequency?: string; active?: boolean }; Update: Partial<Omit<Habit, 'id' | 'user_id'>>; Relationships: [] };
      habit_completions: { Row: Completion & { created_at: string }; Insert: Omit<Completion, 'id' | 'value' | 'completed'> & { value?: number | null; completed?: boolean }; Update: Partial<Omit<Completion, 'id' | 'user_id' | 'habit_id' | 'date'>>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
