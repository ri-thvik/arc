import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, Check, ChevronDown, CircleHelp, Flame, LayoutDashboard, LogOut, Moon, Plus, Settings2, Sparkles, Target, TrendingUp, Waves, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './lib/supabase';
import { arcEndDate, localDate } from './lib/calculations';
import { completionForDay } from './lib/progress';
import { useProgress } from './hooks/useProgress';
import { CalendarPage, DayDetail, ProgressPage } from './components/ProgressPage';
import { SettingsPage } from './components/SettingsPage';
import { authErrorMessage } from './lib/authErrors';
import { addHabits, archiveHabit, hasCompletionOutsideArc, loadTracker, putCompletion, putNumericCompletion, saveProfile, upsertHabit } from './services/tracker';
import type { Completion, DailyProgress, Habit, HabitType, Profile } from './types';
import './App.css';

type Screen = 'overview' | 'habits' | 'progress' | 'calendar' | 'settings';
interface ProfileChanges { name: string; motto: string | null; start_date: string; duration: number }
const screenPaths: Record<Screen, string> = { overview: '/', habits: '/habits', progress: '/progress', calendar: '/calendar', settings: '/settings' };
function screenFromPath(path: string): Screen { const normalized = path.replace(/\/+$/, '') || '/'; return normalized === '/habits' ? 'habits' : normalized === '/progress' ? 'progress' : normalized === '/calendar' ? 'calendar' : normalized === '/settings' ? 'settings' : 'overview'; }
const starterNames = ['Workout', '10,000 Steps', 'Drink Water', 'Read / Learn', 'Meditate', 'Sleep On Time'];
const accents = ['#b4c5a6', '#9ebcd0', '#d0b99e', '#b9a8d0', '#c7a5a5'];
const iconFor = (name: string) => name.toLowerCase().includes('water') ? 'water' : name.toLowerCase().includes('sleep') ? 'moon' : name.toLowerCase().includes('work') ? 'activity' : name.toLowerCase().includes('read') ? 'book' : 'spark';

export default function App() {
  const [now] = useState(() => new Date());
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>(() => screenFromPath(window.location.pathname));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [history, setHistory] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const authSubmitLock = useRef(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [logging, setLogging] = useState<Habit | null>(null);
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedHabits, setSelectedHabits] = useState<string[]>(['Workout', 'Drink Water', 'Read / Learn']);
  const [goal, setGoal] = useState('');
  const [customName, setCustomName] = useState('');
  const [selectedDay, setSelectedDay] = useState<DailyProgress | null>(null);
  const [profileModal, setProfileModal] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [pendingProfile, setPendingProfile] = useState<ProfileChanges | null>(null);
  const profileSubmitLock = useRef(false);
  const today = localDate(now);
  const inFlightRefresh = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const navigate = useCallback((next: Screen) => {
    setScreen(next);
    const path = screenPaths[next];
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
  }, []);

  const refresh = useCallback((userId: string) => {
    if (inFlightRefresh.current?.userId === userId) return inFlightRefresh.current.promise;
    const promise = loadTracker(userId, today).then(data => {
      setProfile(data.profile); setHabits(data.habits); setCompletions(data.today); setHistory(data.history);
      if (data.profile?.name) setUserName(data.profile.name);
    });
    inFlightRefresh.current = { userId, promise };
    void promise.finally(() => { if (inFlightRefresh.current?.promise === promise) inFlightRefresh.current = null; }).catch(() => undefined);
    return promise;
  }, [today]);

  useEffect(() => {
    if (!supabase) return;
    const showLoadError = (error: unknown) => {
      if (import.meta.env.DEV) console.error('Could not load Winter Arc progress', error);
      setMessage("Couldn't load your progress. Please try again.");
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      setSession(data.session);
      if (data.session) refresh(data.session.user.id).catch(showLoadError).finally(() => setLoading(false)); else setLoading(false);
    }).catch(error => { showLoadError(error); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) { setProfile(null); setHabits([]); setCompletions([]); setHistory([]); setLoading(false); }
      else { setLoading(true); window.setTimeout(() => refresh(next.user.id).catch(showLoadError).finally(() => setLoading(false)), 0); }
    });
    return () => listener.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    const onPopState = () => setScreen(screenFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const analytics = useProgress(habits, history, profile?.start_date ?? null, profile?.duration ?? 30, today);
  const todaySummary = useMemo(() => completionForDay(habits, completions, today), [habits, completions, today]);
  const progress = { count: todaySummary.count, total: todaySummary.total, percent: todaySummary.percent };
  const streak = { current: analytics.arc.currentStreak, longest: analytics.arc.longestStreak };
  const day = analytics.arc.currentDay;
  const greetName = userName.trim().split(/\s+/)[0] || 'there';
  const avatarLetters = String(userName.trim() || session?.user.user_metadata?.name || 'WA').split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase();

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || authSubmitLock.current) return;
    authSubmitLock.current = true; setAuthBusy(true); setMessage('');
    const form = new FormData(event.currentTarget); const email = String(form.get('email')).trim(); const password = String(form.get('password'));
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { name: String(form.get('name')).trim() } } });
        if (error) {
          const friendlyMessage = authErrorMessage(error, 'signup');
          setMessage(friendlyMessage);
          if (friendlyMessage.startsWith('Too many signup attempts')) setAuthMode('login');
          return;
        }
        setMessage('Account created! Check your email to confirm your account.'); setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMessage(authErrorMessage(error, 'login'));
      }
    } catch (err) { setMessage(authErrorMessage(err, authMode)); }
    finally { authSubmitLock.current = false; setAuthBusy(false); }
  }

  async function startArc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return; setAuthBusy(true); setMessage('');
    const fd = new FormData(event.currentTarget); const name = String(fd.get('name')).trim(); const startDate = String(fd.get('startDate')); const duration = Number(fd.get('duration'));
    try {
      const chosen = [...selectedHabits]; const custom = customName.trim(); if (custom) chosen.push(custom);
      await saveProfile(session.user.id, { name, start_date: startDate, duration, goal: goal || null, motto: null });
      if (chosen.length) await addHabits(session.user.id, chosen.map((habit, i) => ({ name: habit, description: null, icon: iconFor(habit), accent: accents[i % accents.length], type: 'BOOLEAN' as HabitType, target: null, unit: null, frequency: 'daily' })));
      await refresh(session.user.id); setMessage('');
    } catch { setMessage('We could not save your Winter Arc. Please try again.'); }
    finally { setAuthBusy(false); }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || profileSubmitLock.current) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name')).trim();
    const motto = String(form.get('motto')).trim();
    const startDate = String(form.get('startDate'));
    const targetRaw = String(form.get('targetDays')).trim();
    if (!name) { setProfileError('Name cannot be empty.'); return; }
    if (!/^\d+$/.test(targetRaw) || Number(targetRaw) < 1 || Number(targetRaw) > 365) { setProfileError('Target days must be between 1 and 365.'); return; }
    const parsedStart = new Date(`${startDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(parsedStart.getTime()) || parsedStart.toISOString().slice(0, 10) !== startDate) { setProfileError('Enter a valid Arc start date.'); return; }
    if (motto.length > 120) { setProfileError('Motto must be 120 characters or fewer.'); return; }
    const changes: ProfileChanges = { name, motto: motto || null, start_date: startDate, duration: Number(targetRaw) };
    setProfileError(''); setProfileBusy(true); profileSubmitLock.current = true;
    try {
      const arcChanged = changes.start_date !== profile?.start_date || changes.duration !== profile?.duration;
      if (arcChanged) {
        const endDate = arcEndDate(changes.start_date, changes.duration);
        const inMemoryOutside = history.some(row => row.date < changes.start_date || row.date > endDate);
        const outside = inMemoryOutside || await hasCompletionOutsideArc(session.user.id, changes.start_date, endDate);
        if (outside) { setPendingProfile(changes); return; }
      }
      await persistProfile(changes);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Could not save Winter Arc profile', error);
      setProfileError("Couldn't save your changes. Please try again.");
    } finally { profileSubmitLock.current = false; setProfileBusy(false); }
  }

  async function persistProfile(changes: ProfileChanges) {
    if (!session) return;
    await saveProfile(session.user.id, { ...changes, goal: profile?.goal ?? null });
    setProfile(current => current ? { ...current, ...changes } : current);
    setUserName(changes.name);
    setProfileModal(false); setPendingProfile(null); setProfileError(''); setMessage('Changes saved.');
    if (changes.start_date !== profile?.start_date || changes.duration !== profile?.duration) {
      try { await refresh(session.user.id); }
      catch (error) {
        if (import.meta.env.DEV) console.error('Profile saved, but the arc data could not refresh', error);
        setMessage("Changes saved. Couldn't refresh your progress; reload to see the updated Arc.");
      }
    }
  }

  async function confirmProfileChange() {
    if (!pendingProfile || profileSubmitLock.current) return;
    profileSubmitLock.current = true; setProfileBusy(true);
    try { await persistProfile(pendingProfile); }
    catch (error) {
      if (import.meta.env.DEV) console.error('Could not save Winter Arc profile', error);
      setProfileError("Couldn't save your changes. Please try again.");
    } finally { profileSubmitLock.current = false; setProfileBusy(false); }
  }

  async function toggle(habit: Habit) {
    const prior = completions; const done = completions.some(c => c.habit_id === habit.id && (habit.type === 'BOOLEAN' ? c.completed : (c.value ?? 0) >= (habit.target ?? 0)));
    if (habit.type !== 'BOOLEAN') { setLogging(habit); return; }
    const optimistic = done ? completions.filter(c => c.habit_id !== habit.id) : [...completions, { id: `optimistic-${habit.id}`, habit_id: habit.id, user_id: session!.user.id, date: today, value: null, completed: true }];
    setCompletions(optimistic);
    try { await putCompletion(session!.user.id, habit.id, today, !done); if (!done) setHistory(h => [...h.filter(c => !(c.habit_id === habit.id && c.date === today)), optimistic[optimistic.length - 1]]); else setHistory(h => h.filter(c => !(c.habit_id === habit.id && c.date === today))); }
    catch { setCompletions(prior); setMessage('That update did not save. Check your connection and try again.'); }
  }

  async function saveHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return; const fd = new FormData(event.currentTarget);
    const type = String(fd.get('type')) as HabitType; const name = String(fd.get('name')).trim();
    try { await upsertHabit(session.user.id, { name, description: String(fd.get('description')).trim() || null, icon: iconFor(name), accent: String(fd.get('accent')), type, target: type === 'BOOLEAN' ? null : Number(fd.get('target')) || 1, unit: type === 'BOOLEAN' ? null : String(fd.get('unit') || 'times'), frequency: 'daily' }, editing?.id); await refresh(session.user.id); setModal(false); setEditing(null); setMessage(''); }
    catch { setMessage('Could not save that habit. Please try again.'); }
  }

  async function saveNumeric(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session || !logging) return;
    const fd = new FormData(event.currentTarget); const value = Number(fd.get('value'));
    if (!Number.isFinite(value) || value < 0) return;
    const habit = logging; const prior = completions; const priorHistory = history;
    const next = [...completions.filter(c => c.habit_id !== habit.id), { id: `optimistic-${habit.id}`, habit_id: habit.id, user_id: session.user.id, date: today, value, completed: value >= (habit.target ?? 1) }];
    setCompletions(next); setHistory(h => [...h.filter(c => !(c.habit_id === habit.id && c.date === today)), next[next.length - 1]]); setLogging(null);
    try { await putNumericCompletion(session.user.id, habit.id, today, value, habit.target ?? 1); }
    catch { setCompletions(prior); setHistory(priorHistory); setMessage('That update did not save. Check your connection and try again.'); }
  }

  async function removeHabit(habit: Habit) { try { await archiveHabit(session!.user.id, habit.id); await refresh(session!.user.id); setModal(false); setEditing(null); } catch { setMessage('Could not archive that habit. Try again.'); } }

  if (!supabaseConfigured) return <SetupScreen />;
  if (loading) return <div className="loading-screen"><div className="brand-mark"><Mountain /></div><span className="eyebrow">PREPARING YOUR ARC</span><div className="load-track"><span /></div></div>;
  if (!session) return <main className="auth-shell"><div className="auth-visual"><div className="auth-brand"><Mountain /><span>WINTER ARC</span></div><div className="auth-copy"><span className="eyebrow">A SEASON TO BECOME</span><h1>Progress is<br /><em>built daily.</em></h1><p>Small promises kept, day after day.<br />Start your next chapter here.</p></div><div className="auth-foot">BETTER HABITS <i>·</i> BIGGER RESULTS <span>EST. 2026</span></div></div><div className="auth-panel"><div className="auth-card"><div className="mobile-brand"><Mountain /> WINTER ARC</div><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h2>{authMode === 'signup' ? 'Begin your arc' : 'Welcome back'}</h2><p className="muted">{authMode === 'signup' ? 'Create an account to start building momentum.' : 'Sign in to pick up where you left off.'}</p><form onSubmit={submitAuth} className="stack-form">{authMode === 'signup' && <label>Your name<input name="name" placeholder="Alex Morgan" autoComplete="name" required /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required /></label><button className="button button-primary full" disabled={authBusy}>{authBusy ? 'PLEASE WAIT…' : authMode === 'signup' ? 'CREATE MY ACCOUNT' : 'SIGN IN'} <span>↗</span></button></form>{message && <p className="notice">{message}</p>}<p className="auth-switch">{authMode === 'signup' ? 'Already have an account?' : 'New to Winter Arc?'} <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setMessage(''); }}>{authMode === 'signup' ? 'Sign in' : 'Create an account'}</button></p><p className="fine-print"><CircleHelp size={13} /> Your habits are private and only visible to you.</p></div></div></main>;

  if (!profile?.onboarding_complete) return <Onboarding name={userName || session.user.user_metadata?.name || ''} selected={selectedHabits} setSelected={setSelectedHabits} customName={customName} setCustomName={setCustomName} goal={goal} setGoal={setGoal} submit={startArc} busy={authBusy} message={message} email={session.user.email ?? ''} />;

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-icon"><Mountain /></div><div><b>WINTER ARC</b><small>BETTER HABITS · BIGGER RESULTS</small></div></div><div className="nav-label">YOUR SPACE</div><nav className="side-nav"><button className={screen === 'overview' ? 'selected' : ''} onClick={() => navigate('overview')}><LayoutDashboard size={17} /> Overview <span className="nav-dot" /></button><button className={screen === 'habits' ? 'selected' : ''} onClick={() => navigate('habits')}><Check size={17} /> My habits <span className="nav-count">{habits.length}</span></button><button className={screen === 'progress' ? 'selected' : ''} onClick={() => navigate('progress')}><TrendingUp size={17} /> Progress</button><button className={screen === 'calendar' ? 'selected' : ''} onClick={() => navigate('calendar')}><Target size={17} /> Calendar</button></nav><div className="sidebar-bottom"><div className="arc-small"><span className="eyebrow">YOUR CURRENT ARC</span><b>Day {day} <i>of {profile.duration}</i></b><div className="mini-track"><span style={{ width: `${analytics.arc.arcProgress}%` }} /></div><small>{analytics.arc.arcProgress}% days complete</small></div><button className="profile-button" onClick={() => navigate('settings')} aria-label="Open profile and settings"><span className="avatar">{avatarLetters || 'WA'}</span><span><b>{userName || greetName}</b><small>{session.user.email}</small></span><Settings2 size={16} /></button><button className="sidebar-settings" onClick={() => navigate('settings')}><Settings2 size={15}/> Settings</button><button className="signout" onClick={() => supabase?.auth.signOut()}><LogOut size={15} /> Sign out</button></div></aside>
    <main className="main-area"><header className="topbar"><div className="crumb"><span>YOUR SPACE</span><b>/</b> {screen === 'overview' ? 'Overview' : screen === 'habits' ? 'My habits' : screen === 'progress' ? 'Progress' : screen === 'calendar' ? 'Calendar' : 'Settings'}</div><div className="top-actions"><div className="date-chip"><span className="live-dot" /> {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><button className="avatar small-avatar" onClick={() => navigate('settings')} aria-label="Open profile and settings">{avatarLetters || 'WA'}</button></div></header>
      <div className="content-wrap">{message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss"><X size={15} /></button></div>}
      {screen === 'settings' ? <SettingsPage name={profile.name} email={session.user.email ?? ''} motto={profile.motto} startDate={profile.start_date ?? today} targetDays={profile.duration} onEditProfile={() => { setProfileError(''); setProfileModal(true); }} onSignOut={() => supabase?.auth.signOut()} /> : screen === 'overview' ? <><section className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> YOUR WINTER ARC · DAY {day}</div><h1>Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, {greetName}.</h1><p className="muted">Show up for the person you’re becoming.</p></div><button className="button button-outline" onClick={() => { setEditing(null); setModal(true); }}><Plus size={16} /> New habit</button></section>
        <section className="hero-card"><div className="hero-mountains"><Mountain /></div><div className="hero-content"><div className="eyebrow">THE WORK ADDS UP</div><h2>One day at a time.</h2><p>You’re on day <strong>{day}</strong> of your {profile.duration} day arc. Keep your promises to yourself.</p><div className="hero-line"><span>ARC PROGRESS · {analytics.arc.completedDays}/{profile.duration} DAYS</span><b>{analytics.arc.arcProgress}%</b></div><div className="hero-track"><span style={{ width: `${analytics.arc.arcProgress}%` }} /></div></div><div className="hero-day"><span>DAY</span><b>{String(day).padStart(2,'0')}</b><i>/ {profile.duration}</i><div className="day-rule" /></div><span className="hero-ornament">WINTER<br />ARC <i>— 01</i></span></section>
        <section className="stats-grid"><article className="stat-card"><div className="stat-head"><span>TODAY’S MOMENTUM</span><div className="stat-icon pale"><Check size={16} /></div></div><div className="stat-main"><b>{progress.percent}<small>%</small></b><span>{progress.count} of {progress.total}<br />habits completed</span></div><div className="stat-bottom"><div className="thin-track"><span style={{ width: `${progress.percent}%` }} /></div><small>{progress.total ? (progress.count === progress.total ? 'Every promise kept.' : `${progress.total - progress.count} left to go today`) : 'Add your first habit to begin'}</small></div></article><article className="stat-card"><div className="stat-head"><span>CONSISTENCY STREAK</span><div className="stat-icon warm"><Flame size={17} /></div></div><div className="stat-main"><b>{streak.current}<small className="stat-unit">days</small></b><span>Longest: {streak.longest}<br />day{streak.longest === 1 ? '' : 's'}</span></div><div className="stat-bottom"><div className="streak-note"><span className="streak-spark">✳</span>{streak.current > 0 ? 'You’re building a rhythm.' : 'Start a new streak today.'}</div></div></article><article className="stat-card stat-quote"><div className="stat-head"><span>A NOTE TO SELF</span><div className="stat-icon gray"><Sparkles size={16} /></div></div><blockquote>“The secret of getting ahead is getting started.”</blockquote><small>— MARK TWAIN</small><div className="quote-lines">✳ &nbsp; SHOW UP. DO THE WORK. REPEAT.</div></article></section>
        <section className="habits-section"><div className="section-heading"><div><div className="eyebrow">THE DAILY PRACTICE</div><h2>Today’s habits <span>{progress.count}/{progress.total}</span></h2></div><button className="text-link" onClick={() => navigate('habits')}>Manage habits <span>↗</span></button></div>{habits.length ? <div className="habit-grid">{habits.map(habit => <HabitTile key={habit.id} habit={habit} done={todaySummary.habits.find(item => item.habit.id === habit.id)?.completed ?? false} onClick={() => toggle(habit)} onEdit={() => { setEditing(habit); setModal(true); }} />)}<button className="add-tile" onClick={() => { setEditing(null); setModal(true); }}><span><Plus size={19} /></span><b>Add a habit</b><small>Build a better routine</small></button></div> : <EmptyHabits onAdd={() => setModal(true)} />}</section>
        <footer className="page-foot"><span>WINTER ARC <i>·</i> A SEASON TO BECOME</span><span>YOUR PACE. YOUR PROGRESS.</span></footer></> : screen === 'habits' ? <><section className="welcome-row manage-heading"><div><div className="eyebrow">YOUR ROUTINE</div><h1>Build your daily practice.</h1><p className="muted">Choose the habits that carry you forward. Small, consistent actions make the difference.</p></div><button className="button button-primary" onClick={() => { setEditing(null); setModal(true); }}><Plus size={16} /> Add a habit</button></section><div className="manage-card"><div className="manage-top"><span>ACTIVE HABITS</span><span>{habits.length} TOTAL</span></div>{habits.length ? habits.map((habit, i) => <div key={habit.id} className="manage-row"><div className="habit-icon" style={{ color: habit.accent, background: `${habit.accent}18` }}><IconFor name={habit.icon} /></div><div className="manage-name"><b>{habit.name}</b><small>{habit.description || (habit.type === 'BOOLEAN' ? 'Daily practice' : `${habit.target} ${habit.unit ?? ''} · Daily target`)}</small></div><span className="frequency">DAILY</span><button className="manage-edit" onClick={() => { setEditing(habit); setModal(true); }}>Edit</button><span className="row-number">{String(i + 1).padStart(2,'0')}</span></div>) : <EmptyHabits onAdd={() => setModal(true)} />}</div></> : screen === 'progress' ? <ProgressPage data={analytics} today={today}/> : <CalendarPage data={analytics} today={today} onSelectDay={setSelectedDay}/>}
      </div></main><nav className="mobile-nav"><button className={screen === 'overview' ? 'active' : ''} onClick={() => navigate('overview')}><LayoutDashboard size={18}/><span>Home</span></button><button className={screen === 'habits' ? 'active' : ''} onClick={() => navigate('habits')}><Check size={18}/><span>Habits</span></button><button className={screen === 'progress' ? 'active' : ''} onClick={() => navigate('progress')}><TrendingUp size={18}/><span>Progress</span></button><button className={screen === 'calendar' ? 'active' : ''} onClick={() => navigate('calendar')}><Target size={18}/><span>Calendar</span></button><button className={screen === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={18}/><span>Settings</span></button></nav>
    {modal && <HabitModal habit={editing} save={saveHabit} remove={editing ? () => removeHabit(editing) : undefined} close={() => { setModal(false); setEditing(null); }} />}
    {logging && <LogValueModal habit={logging} current={completions.find(c => c.habit_id === logging.id)?.value ?? 0} save={saveNumeric} close={() => setLogging(null)} />}
    {selectedDay && <DayDetail day={selectedDay} habits={habits} rows={history} onClose={() => setSelectedDay(null)}/>}
    {profileModal && <ProfileModal profile={profile} busy={profileBusy} error={profileError} onSubmit={submitProfile} onClose={() => { setProfileModal(false); setProfileError(''); }} />}
    {pendingProfile && <ProfileConfirmModal busy={profileBusy} onCancel={() => setPendingProfile(null)} onConfirm={confirmProfileChange} />}
  </div>;
}

function Mountain() { return <svg viewBox="0 0 48 32" fill="none" aria-hidden="true"><path d="M3 27 17.5 7l8.2 11.2 5.1-6.7L45 27H3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m14.4 11.2 3.1 4 2-2.2m8.1 8.5 3.2-4.2 3.4 4.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function IconFor({ name }: { name: string }) { return name === 'water' ? <Waves size={19}/> : name === 'moon' ? <Moon size={19}/> : name === 'activity' ? <Activity size={19}/> : name === 'spark' ? <Sparkles size={19}/> : <Target size={19}/> }
function HabitTile({ habit, done, onClick, onEdit }: { habit: Habit; done: boolean; onClick: () => void; onEdit: () => void }) { return <article className={`habit-tile ${done ? 'is-done' : ''}`}><button className="habit-toggle" onClick={onClick} aria-label={`${done ? 'Mark' : 'Complete'} ${habit.name}`}><span className="habit-icon" style={{ color: habit.accent, background: `${habit.accent}18` }}><IconFor name={habit.icon}/></span><span className="habit-copy"><b>{habit.name}</b><small>{done ? 'COMPLETED · NICE WORK' : habit.description || (habit.type === 'BOOLEAN' ? 'DAILY PRACTICE' : `${habit.target} ${habit.unit ?? ''} TARGET`)}</small></span><span className="check-circle">{done && <Check size={15}/>}</span></button><button className="tile-edit" onClick={onEdit} aria-label={`Edit ${habit.name}`}><ChevronDown size={14}/></button></article> }
function EmptyHabits({ onAdd }: { onAdd: () => void }) { return <div className="empty-state"><div className="empty-icon"><Sparkles size={20}/></div><b>Your next chapter starts with one habit.</b><p>Create a daily practice and make it yours.</p><button className="button button-outline" onClick={onAdd}><Plus size={15}/> Add your first habit</button></div> }

function Onboarding({ name, selected, setSelected, customName, setCustomName, goal, setGoal, submit, busy, message, email }: { name: string; selected: string[]; setSelected: (v: string[]) => void; customName: string; setCustomName: (v: string) => void; goal: string; setGoal: (v: string) => void; submit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean; message: string; email: string }) {
  const [stage, setStage] = useState(1); const toggle = (label: string) => setSelected(selected.includes(label) ? selected.filter(x => x !== label) : [...selected, label]);
  return <main className="onboard-shell"><div className="onboard-brand"><div className="brand-icon"><Mountain /></div><div><b>WINTER ARC</b><small>BETTER HABITS · BIGGER RESULTS</small></div></div><div className="onboard-content"><div className="onboard-progress"><span>SET UP YOUR ARC</span><span>0{stage} <i>/ 02</i></span><div className="onboard-track"><span style={{ width: `${stage * 50}%` }}/></div></div>{stage === 1 ? <div className="onboard-step"><div className="eyebrow">FIRST, SET YOUR INTENTION</div><h1>Give this season<br/>a <em>starting point.</em></h1><p>Choose a goal that feels meaningful. You can always change direction as you grow.</p><label className="field-label">WHAT SHOULD WE CALL YOU?<input defaultValue={name} name="displayName" placeholder="Your name" /></label><div className="goal-suggestions"><span className="eyebrow">A FEW PLACES TO START</span><div>{['Build discipline', 'Feel stronger', 'Find focus', 'Sleep better'].map((label,i) => <button className={`goal-pill ${goal === label ? 'chosen' : ''}`} key={label} onClick={() => setGoal(label)}>{['↗','✳','◎','☾'][i]} {label}</button>)}</div></div><button className="button button-primary" onClick={() => { const input = document.querySelector<HTMLInputElement>('input[name="displayName"]'); if (input?.value) sessionStorage.setItem('winterArcName', input.value); setStage(2); }}>CONTINUE <span>↗</span></button></div> : <form className="onboard-step" onSubmit={submit}><div className="eyebrow">BUILD YOUR FOUNDATION</div><h1>Choose the habits<br/>you’ll <em>show up for.</em></h1><p>Keep it simple. You can add or adjust habits any time.</p><div className="starter-grid">{starterNames.map((habit,i) => <button type="button" className={`starter-pill ${selected.includes(habit) ? 'chosen' : ''}`} key={habit} onClick={() => toggle(habit)}><span>{['↗','◎','≈','▤','✳','☾'][i]}</span>{habit}<i>{selected.includes(habit) && <Check size={13}/>}</i></button>)}</div><input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Add a custom habit…" aria-label="Custom habit name"/><div className="onboard-fields"><label>ARC START DATE<input name="startDate" type="date" defaultValue={localDate()} required/></label><label>ARC LENGTH<select name="duration" defaultValue="30"><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label></div><input name="name" value={sessionStorage.getItem('winterArcName') || name || ''} onChange={() => {}} hidden/><button className="button button-primary" disabled={busy}>{busy ? 'SETTING UP…' : 'START MY WINTER ARC'} <span>↗</span></button>{message && <p className="notice">{message}</p>}</form>}<div className="onboard-foot"><span>YOUR PACE. YOUR PROGRESS.</span><span>{email}</span></div></div></main>
}

function HabitModal({ habit, save, remove, close }: { habit: Habit | null; save: (e: FormEvent<HTMLFormElement>) => void; remove?: () => void; close: () => void }) {
  const [type, setType] = useState<HabitType>(habit?.type ?? 'BOOLEAN');
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="habit-modal" role="dialog" aria-modal="true" aria-labelledby="habit-title"><header><div><div className="eyebrow">YOUR DAILY PRACTICE</div><h2 id="habit-title">{habit ? 'Shape this habit.' : 'Start a new habit.'}</h2></div><button className="icon-button" onClick={close} aria-label="Close"><X size={18}/></button></header><form onSubmit={save}><label>HABIT NAME<input name="name" defaultValue={habit?.name} placeholder="e.g. Morning workout" required maxLength={60}/></label><label>WHAT DOES IT MEAN TO YOU?<input name="description" defaultValue={habit?.description ?? ''} placeholder="A little context (optional)" maxLength={100}/></label><label>TRACKING STYLE<select name="type" value={type} onChange={e => setType(e.target.value as HabitType)}><option value="BOOLEAN">Done / not done</option><option value="NUMBER">Count toward a number</option><option value="DURATION">Track a duration</option></select></label>{type !== 'BOOLEAN' && <div className="target-fields"><label>TARGET<input name="target" type="number" min="1" defaultValue={habit?.target ?? 1}/></label><label>UNIT<input name="unit" defaultValue={habit?.unit ?? 'times'} placeholder="liters, minutes…"/></label></div>}<label>ACCENT COLOR<select name="accent" defaultValue={habit?.accent ?? accents[0]}>{accents.map(c=><option key={c} value={c}>{c === accents[0] ? 'Sage' : c === accents[1] ? 'Glacier' : c === accents[2] ? 'Sand' : c === accents[3] ? 'Lavender' : 'Rose'}</option>)}</select></label><div className="modal-actions">{remove && <button type="button" className="archive-button" onClick={remove}>Archive habit</button>}<button type="button" className="button button-quiet" onClick={close}>Cancel</button><button type="submit" className="button button-primary">{habit ? 'SAVE CHANGES' : 'ADD HABIT'} <span>↗</span></button></div></form></section></div>
}

function LogValueModal({ habit, current, save, close }: { habit: Habit; current: number; save: (e: FormEvent<HTMLFormElement>) => void; close: () => void }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="habit-modal log-modal" role="dialog" aria-modal="true" aria-labelledby="log-title"><header><div><div className="eyebrow">TODAY’S PROGRESS</div><h2 id="log-title">{habit.name}</h2></div><button className="icon-button" onClick={close} aria-label="Close"><X size={18}/></button></header><form onSubmit={save}><p className="muted">Target: {habit.target} {habit.unit ?? ''}</p><label>AMOUNT COMPLETED TODAY<input name="value" type="number" min="0" step="any" defaultValue={current} autoFocus /></label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={close}>Cancel</button><button type="submit" className="button button-primary">SAVE PROGRESS <span>↗</span></button></div></form></section></div>
}

function ProfileModal({ profile, busy, error, onSubmit, onClose }: { profile: Profile | null; busy: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  if (!profile) return null;
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="habit-modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><header><div><div className="eyebrow">MAKE IT YOURS</div><h2 id="profile-title">Edit your details.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close" disabled={busy}><X size={18}/></button></header><form onSubmit={onSubmit}><label>YOUR NAME<input name="name" defaultValue={profile.name} maxLength={80} autoComplete="name" required/></label><label>PERSONAL MOTTO <span className="field-optional">OPTIONAL</span><input name="motto" defaultValue={profile.motto ?? ''} maxLength={120} placeholder="A reminder for this season"/></label><div className="profile-divider"><span>YOUR WINTER ARC</span></div><div className="target-fields"><label>START DATE<input name="startDate" type="date" defaultValue={profile.start_date ?? ''} required/></label><label>TARGET DAYS<input name="targetDays" type="number" min="1" max="365" step="1" defaultValue={profile.duration} required/></label></div>{error && <p className="profile-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'SAVING…' : 'SAVE CHANGES'}</button></div></form></section></div>;
}

function ProfileConfirmModal({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop confirm-backdrop"><section className="habit-modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="arc-confirm-title" aria-describedby="arc-confirm-copy"><div className="eyebrow">ARC DATE CHANGE</div><h2 id="arc-confirm-title">Some progress falls outside these dates.</h2><p id="arc-confirm-copy">Your existing completions will stay saved, but completions outside the new Arc dates won’t count toward this Arc’s progress. Do you want to continue?</p><div className="modal-actions"><button className="button button-quiet" onClick={onCancel} disabled={busy}>Go back</button><button className="button button-primary" onClick={onConfirm} disabled={busy}>{busy ? 'SAVING…' : 'CONTINUE'}</button></div></section></div>;
}

function SetupScreen() { return <main className="setup-shell"><div className="setup-card"><div className="brand-icon"><Mountain/></div><div className="eyebrow">ONE LAST SETUP STEP</div><h1>Connect your<br/><em>Winter Arc.</em></h1><p>Configure a Supabase project to securely save your account, habits, and daily progress.</p><ol><li><span>01</span> Create a Supabase project and run <code>supabase/schema.sql</code>.</li><li><span>02</span> Copy <code>.env.example</code> to <code>.env.local</code>.</li><li><span>03</span> Add your project URL and anon key, then restart Vite.</li></ol><p className="setup-note">The browser uses only your public anon key. Database access is protected with row level security.</p></div></main> }
