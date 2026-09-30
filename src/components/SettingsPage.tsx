import { LogOut, Pencil, UserRound } from 'lucide-react';
import { arcEndDate } from '../lib/calculations';

export function SettingsPage({ name, email, motto, startDate, targetDays, onEditProfile, onSignOut }: { name: string; email: string; motto: string | null; startDate: string; targetDays: number; onEditProfile: () => void; onSignOut: () => void }) {
  const endDate = arcEndDate(startDate, targetDays);
  const displayDate = (value: string) => new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'WA';
  return <>
    <section className="welcome-row phase-heading"><div><div className="eyebrow">YOUR SETTINGS</div><h1>A space that fits you.</h1><p className="muted">Keep your profile and your Winter Arc up to date.</p></div></section>
    <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><UserRound size={17}/></div><div><div className="eyebrow">PROFILE</div><h2>Your details</h2></div><button className="button button-outline settings-edit" onClick={onEditProfile}><Pencil size={13}/> EDIT PROFILE</button></div><div className="settings-profile"><div className="avatar settings-avatar">{initials}</div><div className="settings-profile-info"><b>{name || 'Your name'}</b><small>{email}</small>{motto && <p>“{motto}”</p>}</div></div></section>
    <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon arc-settings-icon">✳</div><div><div className="eyebrow">WINTER ARC</div><h2>Your current season</h2></div><button className="button button-outline settings-edit" onClick={onEditProfile}><Pencil size={13}/> EDIT ARC</button></div><div className="arc-settings-grid"><div><small>TARGET DAYS</small><b>{targetDays} <i>days</i></b></div><div><small>START DATE</small><b>{displayDate(startDate)}</b></div><div><small>END DATE</small><b>{displayDate(endDate)}</b></div></div></section>
    <section className="settings-card account-settings"><div className="settings-card-heading"><div className="settings-icon"><LogOut size={16}/></div><div><div className="eyebrow">ACCOUNT</div><h2>Sign out of Winter Arc</h2></div><button className="button button-outline settings-edit" onClick={onSignOut}><LogOut size={13}/> SIGN OUT</button></div></section>
    <footer className="page-foot"><span>WINTER ARC <i>·</i> YOUR SPACE, YOUR PACE</span><span>KEEP IT SIMPLE. KEEP SHOWING UP.</span></footer>
  </>;
}
