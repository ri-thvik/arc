import { Activity, Check, Flame, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { completionForDay } from '../lib/progress';
import type { Completion, DailyProgress, Habit, HabitStats, ProgressData } from '../types';

export function ProgressPage({ data, today }: { data: ProgressData; today: string }) {
  const { arc, days, habits } = data;
  const elapsed = days.filter(day => day.date <= today);
  return <>
    <section className="welcome-row phase-heading"><div><div className="eyebrow">YOUR PROGRESS</div><h1>The work is adding up.</h1><p className="muted">See your consistency, momentum, and progress across your Winter Arc.</p></div></section>
    <section className="progress-summary" aria-label="Arc progress summary">
      <SummaryCard title="ARC PROGRESS" icon={<Target size={15}/>} value={`${arc.arcProgress}%`} detail={`${arc.completedDays} of ${arc.totalDays} days complete`} foot={arc.currentDay ? `Currently on day ${arc.currentDay}` : 'Your arc has not started yet'} percent={arc.arcProgress}/>
      <SummaryCard title="CURRENT STREAK" icon={<Flame size={15}/>} value={`${arc.currentStreak}`} unit="days" detail="Consecutive complete days" foot={arc.currentStreak ? 'Keep your rhythm going.' : 'A fresh start is one day away.'}/>
      <SummaryCard title="LONGEST STREAK" icon={<Sparkles size={15}/>} value={`${arc.longestStreak}`} unit="days" detail="Best run this arc" foot="Built one day at a time."/>
      <SummaryCard title="HABIT CONSISTENCY" icon={<Activity size={15}/>} value={`${arc.consistency}%`} detail="Completed habit instances" foot="Across expected days so far." percent={arc.consistency}/>
    </section>
    <section className="analytics-card consistency-card"><div className="analytics-heading"><div><div className="eyebrow">THE LONG VIEW</div><h2>Daily consistency</h2></div><span className="quiet-badge">{elapsed.length} DAYS LOGGED</span></div>
      {arc.hasHistory ? <ConsistencyChart days={elapsed}/> : <EmptyAnalytics title="Your story starts here." copy="Complete your first habit to begin building your progress history."/>}
    </section>
    <section className="analytics-card performance-card"><div className="analytics-heading"><div><div className="eyebrow">THE DAILY PRACTICE</div><h2>Habit performance <span className="heading-count">{habits.length}</span></h2></div><span className="quiet-badge">ACTIVE HABITS</span></div>
      {habits.length ? <div className="performance-list">{habits.map(stat => <HabitPerformance key={stat.habit.id} stat={stat}/>)}</div> : <EmptyAnalytics title="No active habits yet." copy="Add a habit to start seeing your consistency here."/>}
    </section>
    <footer className="page-foot"><span>WINTER ARC <i>·</i> YOUR STORY, IN THE MAKING</span><span>CONSISTENCY OVER INTENSITY.</span></footer>
  </>;
}

function SummaryCard({ title, icon, value, unit, detail, foot, percent }: { title: string; icon: ReactNode; value: string; unit?: string; detail: string; foot: string; percent?: number }) {
  return <article className="stat-card progress-stat"><div className="stat-head"><span>{title}</span><div className="stat-icon pale">{icon}</div></div><div className="progress-stat-value">{value}{unit && <small>{unit}</small>}</div><div className="progress-stat-detail">{detail}</div>{percent !== undefined && <div className="progress-stat-track"><span style={{ width: `${percent}%` }}/></div>}<div className="progress-stat-foot">{foot}</div></article>;
}

function ConsistencyChart({ days }: { days: DailyProgress[] }) {
  const width = 660; const height = 220; const left = 38; const right = 12; const top = 15; const bottom = 28;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const xAt = (index: number) => left + (days.length <= 1 ? plotWidth / 2 : index / (days.length - 1) * plotWidth);
  const point = (day: DailyProgress, index: number) => ({ x: xAt(index), y: top + (100 - day.percentage) / 100 * plotHeight });
  const observed = days.map((day, index) => day.status === 'future' || day.status === 'no-data' ? null : point(day,index));
  const segments: Array<Array<{x:number;y:number}>> = []; let segment: Array<{x:number;y:number}> = [];
  observed.forEach(p => { if (p) segment.push(p); else if (segment.length) { segments.push(segment); segment=[]; } }); if (segment.length) segments.push(segment);
  const futureStart = days.findIndex(day => day.status === 'future');
  const labels = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])].filter(index => index >= 0);
  return <div className="chart-wrap"><div className="chart-key"><span><i/> COMPLETION RATE</span><small>Full arc · {days.filter(day => day.status !== 'future').length} elapsed of {days.length} days</small></div><svg className="consistency-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily percentage of scheduled habits completed during the arc">
    {futureStart >= 0 && <rect x={xAt(futureStart)} y={top} width={Math.max(0,width-right-xAt(futureStart))} height={plotHeight} className="chart-future-area"/>}
    {[0, 50, 100].map(value => { const y = top + (100 - value) / 100 * plotHeight; return <g key={value}><line x1={left} x2={width-right} y1={y} y2={y} className="chart-gridline"/><text x="0" y={y+3} className="chart-axis-label">{value}%</text></g>; })}
    {segments.map((points,index) => { const line = points.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '); const area = points.length > 1 ? `${line} L ${points[points.length-1].x.toFixed(2)} ${top+plotHeight} L ${points[0].x.toFixed(2)} ${top+plotHeight} Z` : ''; return <g key={index}>{area && <path d={area} className="chart-area"/>}<path d={line} className="chart-line"/></g>; })}
    {days.map((day,index)=>{const p=observed[index];return p?<circle key={day.date} cx={p.x} cy={p.y} r={day.isToday?4:2.5} className={day.status==='completed'?'chart-point complete':'chart-point'}><title>{`Day ${day.dayNumber}: ${day.percentage}% (${day.completed}/${day.total})`}</title></circle>:day.status==='no-data'?<text key={day.date} x={xAt(index)} y={top+plotHeight-2} textAnchor="middle" className="chart-no-data"><title>{`Day ${day.dayNumber}: no completion data`}</title>·</text>:null;})}
    {labels.map(index => <text key={index} x={xAt(index)} y={height-4} textAnchor={index===0?'start':index===days.length-1?'end':'middle'} className="chart-axis-label">Day {days[index].dayNumber}</text>)}
  </svg><div className="chart-foot"><span>Each point reflects completed habits divided by habits scheduled that day.</span><span>0—100%</span></div></div>;
}

function HabitPerformance({ stat }: { stat: HabitStats }) {
  return <article className="performance-row"><div className="performance-icon" style={{ color: stat.habit.accent, background: `${stat.habit.accent}18` }}><HabitGlyph name={stat.habit.icon}/></div><div className="performance-main"><div className="performance-title"><div><b>{stat.habit.name}</b><small>{stat.habit.description || 'Daily practice'}</small></div><strong>{stat.percentage}%</strong></div><div className="performance-track"><span style={{ width: `${stat.percentage}%`, background: stat.habit.accent }}/></div><div className="performance-facts"><span>STREAK <b>{stat.currentStreak}d</b></span><span>BEST <b>{stat.longestStreak}d</b></span><span>COMPLETED <b>{stat.completed}/{stat.expected}</b></span></div></div></article>;
}

function HabitGlyph({ name }: { name: string }) { return name === 'water' ? <span>≈</span> : name === 'moon' ? <span>☾</span> : name === 'activity' ? <Activity size={17}/> : name === 'book' ? <span>▤</span> : <Sparkles size={16}/>; }
function EmptyAnalytics({ title, copy }: { title: string; copy: string }) { return <div className="analytics-empty"><div className="empty-icon"><Check size={17}/></div><b>{title}</b><p>{copy}</p></div>; }

export function CalendarPage({ data, today, onSelectDay }: { data: ProgressData; today: string; onSelectDay: (day: DailyProgress) => void }) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'partial' | 'missed'>('all');
  const first = data.days[0]; const startWeekday = first ? new Date(`${first.date}T00:00:00.000Z`).getUTCDay() : 0;
  const monthLabel = data.arc.startDate && data.arc.endDate ? (() => {
    const start = new Date(`${data.arc.startDate}T00:00:00.000Z`); const end = new Date(`${data.arc.endDate}T00:00:00.000Z`);
    const startMonth = start.toLocaleDateString('en-US',{month:'long',timeZone:'UTC'}); const endMonth = end.toLocaleDateString('en-US',{month:'long',timeZone:'UTC'});
    const startYear = start.getUTCFullYear(); const endYear = end.getUTCFullYear();
    if (startMonth === endMonth && startYear === endYear) return `${startMonth} ${startYear}`;
    if (startYear === endYear) return `${startMonth} — ${endMonth} ${endYear}`;
    return `${startMonth} ${startYear} — ${endMonth} ${endYear}`;
  })() : 'Your Winter Arc';
  return <>
    <section className="welcome-row phase-heading"><div><div className="eyebrow">YOUR CALENDAR</div><h1>Every day leaves a mark.</h1><p className="muted">See how consistently you've shown up throughout your Winter Arc.</p></div></section>
    <section className="calendar-card"><div className="calendar-top"><div><div className="eyebrow">YOUR ARC · {data.arc.totalDays} DAYS</div><h2>{monthLabel}<small> · DAY 1 — {data.arc.totalDays}</small></h2></div><div className="calendar-filters" role="group" aria-label="Filter calendar days">{(['all','completed','partial','missed'] as const).map(value => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value[0].toUpperCase()+value.slice(1)}</button>)}</div></div>
      {!data.arc.hasHistory && <div className="calendar-empty-note"><span className="empty-icon"><Check size={15}/></span><div><b>No marks yet.</b><small>Start showing up and your days will appear here.</small></div></div>}
      <div className="calendar-grid" role="grid" aria-label={`${data.arc.totalDays}-day Winter Arc calendar`}>
        {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(label => <div key={label} className="calendar-weekday" role="columnheader">{label}</div>)}
        {Array.from({length:startWeekday},(_,i)=><div key={`blank-${i}`} className="calendar-blank" aria-hidden="true"/>)}
        {data.days.map(day => {
          const dimmed = filter !== 'all' && day.status !== filter;
          const isToday = day.isToday || day.date === today;
          return <button key={day.date} role="gridcell" className={`calendar-day status-${day.status} ${isToday ? 'is-today' : ''} ${dimmed ? 'filter-dimmed' : ''}`} disabled={day.status === 'future'} aria-label={`Day ${day.dayNumber}, ${new Date(`${day.date}T00:00:00.000Z`).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'})}: ${day.status}${isToday ? ', today' : ''}`} onClick={() => onSelectDay(day)}><span className="calendar-day-number">{day.dayNumber}</span>{day.status === 'completed' ? <Check size={12} className="calendar-day-check"/> : isToday ? <span className="today-tag">TODAY</span> : <span className="calendar-day-pct">{day.status === 'future' || day.status === 'no-data' ? '—' : `${day.percentage}%`}</span>}</button>;
        })}
      </div>
      <div className="calendar-legend"><span><i className="legend-completed"/> Completed</span><span><i className="legend-partial"/> Partial</span><span><i className="legend-missed"/> Missed</span><span><i className="legend-future"/> Future</span><span className="legend-today">Today</span></div>
    </section>
    <footer className="page-foot"><span>WINTER ARC <i>·</i> THE DAYS BECOME THE STORY</span><span>ONE MARK AT A TIME.</span></footer>
  </>;
}

export function DayDetail({ day, habits, rows, onClose }: { day: DailyProgress; habits: Habit[]; rows: Completion[]; onClose: () => void }) {
  const summary = completionForDay(habits, rows, day.date);
  const formatted = new Date(`${day.date}T00:00:00.000Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const showHabitStates = day.status !== 'no-data' || day.isToday;
  return <div className="modal-backdrop day-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="day-detail-panel" role="dialog" aria-modal="true" aria-labelledby="day-detail-title"><header className="day-detail-head"><div><div className="eyebrow">{day.isToday ? 'TODAY · ' : ''}DAY {String(day.dayNumber).padStart(2,'0')}</div><h2 id="day-detail-title">Your day, in focus.</h2><p>{formatted}</p></div><button className="icon-button" onClick={onClose} aria-label="Close day details">×</button></header><div className="day-detail-score"><div><span>DAILY COMPLETION</span><b>{summary.total ? `${summary.percent}%` : '—'}</b></div><div className="day-detail-score-track"><span style={{ width: `${summary.percent}%` }}/></div><small>{summary.count} of {summary.total} scheduled habits completed</small></div><div className="day-detail-list"><div className="eyebrow">THE DAILY PRACTICE</div>{!showHabitStates && <div className="day-detail-empty">No completion records were saved for this day.</div>}{showHabitStates && (summary.habits.length ? summary.habits.map(({ habit, completed }) => <div key={habit.id} className={`day-detail-habit ${completed ? 'done' : ''}`}><span className="detail-check">{completed ? <Check size={13}/> : '·'}</span><span><b>{habit.name}</b><small>{completed ? habit.type === 'BOOLEAN' ? 'Completed' : `${rows.find(row => row.habit_id === habit.id && row.date === day.date)?.value ?? 0} / ${habit.target} ${habit.unit ?? ''}` : habit.description || 'Not completed'}</small></span></div>) : <div className="day-detail-empty">No habits were scheduled for this day.</div>)}</div><button className="button button-outline day-detail-close" onClick={onClose}>CLOSE</button></section></div>;
}
