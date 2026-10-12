import { useId, useState } from 'react';
import { USER_CATEGORIES } from '../constants.js';
import { getGamificationConfig } from '../gamification.config.js';
import './side-quest.css';

export default function SideQuestForm({ state, onAdd, busy = false }) {
  const prefix = useId();
  const config = getGamificationConfig(state);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dimension, setDimension] = useState('Emotional');
  const [band, setBand] = useState(config.quests.defaultBand);
  const [signature, setSignature] = useState(false);
  const [chapterLinked, setChapterLinked] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const disabled = busy || saving;
  async function submit(event) {
    event.preventDefault();
    if (disabled || !title.trim()) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await onAdd({ title: title.trim(), dimension, band, signature, chapterLinked });
      setTitle(''); setSignature(false); setChapterLinked(true); setOpen(false);
      setMessage('Side quest added. It’s available in Level’d.');
    } catch (err) { setError(err.message || 'Could not add the side quest. Please try again.'); }
    finally { setSaving(false); }
  }
  return <section className="widget-side-quest">
    <button type="button" className="quest-form-toggle" disabled={disabled} aria-expanded={open} aria-controls={`${prefix}-form`}
      onClick={() => { setOpen(!open); setMessage(''); }}>{open ? 'Cancel side quest' : '+ Add side quest'}</button>
    {open && <form id={`${prefix}-form`} onSubmit={submit}>
      <fieldset disabled={disabled}>
        <label htmlFor={`${prefix}-title`}>Side quest title</label>
        <input id={`${prefix}-title`} required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Ship the portfolio site" />
        <div className="quest-form-columns">
          <label>Identity dimension<select value={dimension} onChange={e => setDimension(e.target.value)}>{USER_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
          <label>Reward band<select value={band} onChange={e => setBand(e.target.value)}>{Object.entries(config.quests.bands).map(([key, xp]) => <option key={key} value={key}>{key} · +{xp} XP</option>)}</select></label>
        </div>
        <label className="quest-form-check"><input type="checkbox" checked={signature} onChange={e => setSignature(e.target.checked)} />Signature side quest</label>
        <label className="quest-form-check"><input type="checkbox" checked={chapterLinked} onChange={e => setChapterLinked(e.target.checked)} />Link to current chapter</label>
        <small>XP is awarded when you complete the side quest.</small>
        <button type="submit" disabled={!title.trim()}>{saving ? 'Adding…' : 'Add Side Quest'}</button>
      </fieldset>
    </form>}
    {error && <p role="alert" className="quest-form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
