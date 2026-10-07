import { useEffect, useState } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_CHECKIN, normalizeSettings, validSnooze } from '../checkin/schedule.js';
import styles from '../styles.module.css';

export default function CheckinSettings({ uid }) {
  const [remote, setRemote] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_CHECKIN);
  const [later, setLater] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(doc(db, 'users', uid), snapshot => {
    const data = snapshot.data() || {};
    setRemote(data);
  }, () => setError('Could not load check-in settings. Reconnect and try again.')), [uid]);
  const status = remote?.checkinStatus;
  const command = remote?.checkinControl;
  const pending = !!command?.id && command.id !== status?.commandId;
  const savedSettings = pending && command.type === 'settings' ? command.settings : status?.settings;
  useEffect(() => { setSettings(normalizeSettings(savedSettings)); }, [JSON.stringify(savedSettings)]);

  async function send(type) {
    const until = new Date(later).getTime();
    if (type === 'later' && !validSnooze(until, Date.now())) {
      setError('Choose a time 1 minute to 24 hours ahead.'); return;
    }
    if (!navigator.onLine) { setError('Reconnect to send changes to your widget.'); return; }
    setBusy(true); setError('');
    try {
      const reference = doc(db, 'users', uid);
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(reference);
        const current = snapshot.data();
        if (!current) throw new Error('Account not found.');
        if (type === 'settings' && current.checkinStatus?.active) throw new Error('Choose a later time or finish the active check-in first.');
        transaction.update(reference, { checkinControl: {
          id: crypto.randomUUID(), type, ...(type === 'settings' ? { settings: normalizeSettings(settings) } : { until }),
        } });
      });
    } catch (err) { setError(err.message || 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  }
  const inputStyle = { background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: 9, width: '100%' };
  return <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13 }}>
    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 0 }}>Control your desktop popup here. It runs even when this website is closed. Reminder hours use your computer’s time.</p>
    <p role="status">{!remote ? 'Loading…' : pending ? 'Waiting for your desktop widget to apply changes…' : status ? status.active ? 'Check-in active — complete your habits or choose a later time.' : status.settings.enabled ? `Next check-in: ${new Date(status.nextAt).toLocaleString()}` : 'Check-ins are off.' : 'Open and connect the desktop widget to start syncing.'}</p>
    {status?.updatedAt && <p style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Widget last synced: {new Date(status.updatedAt).toLocaleString()}</p>}
    <fieldset disabled={!remote || busy || pending || status?.active} style={{ border: 0, padding: 0, margin: '16px 0', display: 'grid', gap: 12 }}>
      <label><input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} /> Enable periodic check-ins</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        <label>Every<select style={inputStyle} value={settings.intervalMinutes} onChange={e => setSettings({ ...settings, intervalMinutes: Number(e.target.value) })}>{[30,60,120,180,240].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
        <label>From<select style={inputStyle} value={settings.startHour} onChange={e => setSettings(normalizeSettings({ ...settings, startHour: Number(e.target.value) }))}>{Array.from({ length: 23 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></label>
        <label>Until<select style={inputStyle} value={settings.endHour} onChange={e => setSettings({ ...settings, endHour: Number(e.target.value) })}>{Array.from({ length: 24 - settings.startHour }, (_, i) => settings.startHour + i + 1).map(h => <option key={h} value={h}>{h === 24 ? 'Midnight' : `${String(h).padStart(2,'0')}:00`}</option>)}</select></label>
      </div>
      <button className={styles.ghostBtn} onClick={() => send('settings')}>Save check-in settings</button>
    </fieldset>
    <form onSubmit={e => { e.preventDefault(); send('later'); }} style={{ display: 'grid', gap: 10 }}>
      <label>Next check-in time<input aria-label="Next check-in time" style={inputStyle} type="datetime-local" required value={later} onChange={e => setLater(e.target.value)} /></label>
      <small style={{ color: 'var(--text-tertiary)' }}>Choose 1 minute to 24 hours ahead, in your browser’s local time. This also postpones an active check-in.</small>
      <button className={styles.ghostBtn} disabled={!remote || busy || pending} type="submit">Set next check-in</button>
    </form>
    {(error || (!pending && status?.commandError)) && <p role="alert" style={{ color: 'var(--red)' }}>{error || status.commandError}</p>}
  </div>;
}
