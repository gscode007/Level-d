import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase.js';
import { useStrictCheckin } from '../hooks/useStrictCheckin.js';
import StrictCheckin from '../components/StrictCheckin.jsx';
import { recordWidgetHabit } from './data.js';

export default function Widget() {
  const [user, setUser] = useState(undefined);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const wasActive = useRef(false);
  const inFlight = useRef(false);
  const checkin = useStrictCheckin(user?.uid, state, state?.checkinControl);
  useEffect(() => {
    if (!user?.uid || !state?.setupDone || !checkin.schedule) return;
    const publish = () => updateDoc(doc(db, 'users', user.uid), {
      checkinStatus: { ...checkin.schedule, active: !!checkin.active, updatedAt: Date.now() },
    }).catch(() => setError('Check-in settings could not sync. Reconnect to update the website.'));
    publish();
    const timer = setInterval(publish, 60_000);
    return () => clearInterval(timer);
  }, [user?.uid, state?.setupDone, checkin.schedule, checkin.active]);
  useEffect(() => window.leveldDesktop?.onOpenSettings?.(() => setExpanded(true)), []);

  useEffect(() => onAuthStateChanged(auth, next => { setUser(next); setState(null); setError(''); }), []);
  useEffect(() => {
    if (!user) { setLoading(user === undefined); return; }
    setLoading(true);
    return onSnapshot(doc(db, 'users', user.uid), snapshot => {
      setState(snapshot.exists() ? snapshot.data() : null);
      setLoading(false);
    }, () => { setLoading(false); setError('Could not sync your quests. Check your connection and sign-in.'); });
  }, [user]);

  const needsAccount = !loading && (!user || !state?.setupDone);
  useEffect(() => { if (needsAccount) setExpanded(true); }, [needsAccount]);
  useEffect(() => { if (user && state?.setupDone) setExpanded(false); }, [user?.uid, state?.setupDone]);
  useEffect(() => {
    window.leveldDesktop?.setWidgetView?.({ expanded: expanded || checkin.active });
  }, [expanded, checkin.active]);
  useEffect(() => {
    if (wasActive.current && !checkin.active) setExpanded(false);
    wasActive.current = checkin.active;
  }, [checkin.active]);

  async function login() {
    setBusy('login'); setError('');
    try { await signInWithPopup(auth, googleProvider); }
    catch { setError('Sign-in did not finish. Try again and use your Level’d Google account.'); }
    finally { setBusy(null); }
  }
  async function complete(goalId) {
    if (inFlight.current) return;
    if (!navigator.onLine) { setError('You’re offline. Reconnect to record this habit, or choose a later check-in.'); return; }
    inFlight.current = true; setBusy(goalId); setError('');
    try { await recordWidgetHabit(user.uid, goalId); }
    catch { setError('Could not save the completion. Reconnect and try again, or choose a later check-in.'); }
    finally { inFlight.current = false; setBusy(null); }
  }

  const open = expanded;
  const next = checkin.schedule?.settings.enabled
    ? new Date(checkin.schedule.nextAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Off';
  return (
    <div className={`widget-shell ${open || checkin.active ? 'widget-open' : ''}`}>
      <header className="widget-header">
        <span className="widget-mark">◇</span><strong>LEVEL’D</strong>
        {open && !checkin.active && <button className="widget-toggle" onClick={() => setExpanded(false)}>Done</button>}
      </header>
      {open && !checkin.active && <section className="widget-panel">
        {!user ? <>
          <h1>Your quests. Right here.</h1>
          <p>Sign in once to connect this independent widget to Level’d.</p>
          <button className="widget-primary" disabled={!!busy || loading} onClick={login}>{busy ? 'Signing in…' : 'Connect Google account'}</button>
        </> : loading ? <p>Syncing your quests…</p> : !state?.setupDone ? <>
          <h1>No quests connected yet.</h1><p>Finish setup in Level’d using this Google account. This widget will pick up your quests automatically.</p>
        </> : <>
          <h1>{checkin.pending.length ? `${checkin.pending.length} quests remaining` : 'All recorded for now.'}</h1>
          <p>Next check-in: {next}. Complete your quests or choose a later time when it appears.</p>
          <button className="widget-primary" disabled={!checkin.pending.length} onClick={() => { setError(''); checkin.checkNow(); }}>Check in now</button>
          <label className="widget-setting">Every
            <select aria-label="Check-in interval" value={checkin.schedule?.settings.intervalMinutes || 120}
              onChange={event => checkin.configure({ intervalMinutes: Number(event.target.value) })}>
              {[30, 60, 120, 180, 240].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
          <label className="widget-setting">From
            <select aria-label="Reminder start hour" value={checkin.schedule?.settings.startHour ?? 9}
              onChange={event => checkin.configure({ startHour: Number(event.target.value) })}>
              {Array.from({ length: 23 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
            </select>
          </label>
          <label className="widget-setting">Until
            <select aria-label="Reminder end hour" value={checkin.schedule?.settings.endHour ?? 22}
              onChange={event => checkin.configure({ endHour: Number(event.target.value) })}>
              {Array.from({ length: 24 - (checkin.schedule?.settings.startHour ?? 9) }, (_, index) => (checkin.schedule?.settings.startHour ?? 9) + index + 1)
                .map(hour => <option key={hour} value={hour}>{hour === 24 ? 'Midnight' : `${String(hour).padStart(2, '0')}:00`}</option>)}
            </select>
          </label>
          <label className="widget-setting">Check-ins enabled<input type="checkbox" checked={checkin.schedule?.settings.enabled !== false}
            onChange={event => checkin.configure({ enabled: event.target.checked })} /></label>
          <small>Reminder hours use this computer’s time.</small>
        </>}
        {(error || checkin.error) && <p role="alert" className="widget-error">{error || checkin.error}</p>}
        {user && <footer><span>{user.email}</span><button onClick={() => signOut(auth).catch(() => setError('Could not sign out. Try again.'))}>Sign out</button></footer>}
      </section>}
      {checkin.active && <StrictCheckin checkin={{ ...checkin, error: error || checkin.error }} onComplete={complete} busyGoalId={busy} />}
    </div>
  );
}
