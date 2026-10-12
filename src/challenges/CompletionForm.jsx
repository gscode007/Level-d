import { useEffect, useRef, useState } from 'react';
import { Field } from './RulesEditor.jsx';
export function Modal({ title, children, onClose, busy }) {
  const dialog = useRef(null);
  useEffect(() => { const el = dialog.current; el.showModal(); return () => el.close(); }, []);
  return <dialog className="ch-modal" ref={dialog} aria-labelledby="ch-modal-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><div className="ch-modal-head"><h2 id="ch-modal-title">{title}</h2><button disabled={busy} onClick={onClose} aria-label="Close dialog">×</button></div>{children}</dialog>;
}
export default function CompletionForm({ quest, today, busy, submit, onClose }) {
  const [surge, setSurge] = useState(false); const [note, setNote] = useState(''); const [image, setImage] = useState(null); const [error, setError] = useState('');
  const [started, setStarted] = useState(null); const [seconds, setSeconds] = useState(0);
  const timerStart = useRef(null); const timerElapsed = useRef(0);
  useEffect(() => { if (!started) return; const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000) + timerElapsed.current), 250); return () => clearInterval(timer); }, [started]);
  async function photo(file) {
    setError(''); setImage(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 163840) { setError('Choose a JPEG, PNG or WebP photo under 160 KB.'); return; }
    const reader = new FileReader(); reader.onload = () => setImage(reader.result); reader.onerror = () => setError('Could not read the photo. Choose it again.'); reader.readAsDataURL(file);
  }
  const proof = quest.proof === 'none' ? null : quest.proof === 'timer' ? { type: 'timer', seconds } : quest.proof === 'checkin' ? { type: 'checkin', note } : { type: 'photo', image };
  return <Modal title="Record completion" onClose={onClose} busy={busy}><form onSubmit={async e => { e.preventDefault(); setError(''); try { await submit({ questId: quest.id, date: today, surge, proof }); onClose(); } catch (e) { setError(e.message); } }}><p><strong>{quest.requirement}</strong></p><p className="ch-muted">{today} · One completion per calendar day. This record is final after submission.</p><label className="ch-check"><input type="checkbox" checked={surge} onChange={e => setSurge(e.target.checked)}/>I met the extra-effort threshold: {quest.surge}</label>
    {quest.proof === 'checkin' && <Field label="Check-in proof"><textarea required maxLength={1000} value={note} onChange={e => setNote(e.target.value)}/></Field>}
    {quest.proof === 'photo' && <><Field label="Private photo proof"><input type="file" required accept="image/png,image/jpeg,image/webp" onChange={e => photo(e.target.files[0])}/></Field>{image && <img className="ch-proof" src={image} alt="Selected completion proof"/>}<p className="ch-muted">Visible only to you and your partner. Up to 160 KB.</p></>}
    {quest.proof === 'timer' && <div className="ch-timer"><output>{seconds}s</output><button type="button" onClick={() => { if (started) { timerElapsed.current += Math.floor((Date.now() - timerStart.current) / 1000); setSeconds(timerElapsed.current); setStarted(null); } else { timerStart.current = Date.now(); setStarted(timerStart.current); } }}>{started ? 'Pause timer' : 'Start timer'}</button><p className="ch-muted">Timer proof is self-reported. Pause before submitting.</p></div>}
    {error && <p role="alert" className="ch-error">{error}</p>}<button type="submit" className="ch-primary" disabled={busy || !!started || (quest.proof === 'photo' && !image) || (quest.proof === 'timer' && seconds < 1)}>{busy ? 'Saving…' : 'Record completion'}</button></form></Modal>;
}
