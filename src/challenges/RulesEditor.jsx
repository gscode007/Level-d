import { useState, useRef, useId, cloneElement } from 'react';
import styles from '../styles.module.css';
export const uuid = () => crypto.randomUUID();
export const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const periodText = q => q.frequency === 'daily' ? 'Every day' : q.frequency === 'weekly' ? `${q.target} distinct days per week${q.extra ? ` · extra frequency: ${q.extra}` : ''}` : q.days.map(d => weekdays[d]).join(', ');
export function Field({ label, children }) {
  const id = useId();
  return <div className="ch-field"><label className={styles.fLbl} htmlFor={id}>{label}</label>{cloneElement(children, { id, className: `${styles.fInput} ${children.props.className || ''}` })}</div>;
}
const newQuest = () => ({ id: uuid(), requirement: '', frequency: 'daily', days: [1,2,3,4,5], target: 4, extra: 0, assignment: 'both', surge: '', proof: 'none' });
const defaultRules = () => ({ quests: [newQuest()], missedPunishment: '', shortfallPunishment: '', rewardBasis: 'days', rewardTarget: 3, reward: '' });
export function RuleSummary({ rules, challenge }) {
  return <div className="ch-rules"><ul>{rules.quests.map(q => <li key={q.id}><strong>{q.requirement}</strong><span>{periodText(q)} · {q.assignment === 'both' ? 'Both participants' : challenge.names[q.assignment === 'owner' ? challenge.owner : challenge.members[1]]} · {q.proof === 'none' ? 'No proof required' : `${q.proof} proof`}</span><span>Extra effort: {q.surge}</span></li>)}</ul><p>Each missed day: {rules.missedPunishment}<br/>Each weekly shortfall: {rules.shortfallPunishment}<br/>Weekly reward: {rules.reward} after {rules.rewardTarget} {rules.rewardBasis === 'days' ? 'surge days' : 'weekly quest surges'}.</p></div>;
}
export default function RulesEditor({ initial, challenge, busy, onSubmit, onCancel }) {
  const [rules, setRules] = useState(() => structuredClone(initial || defaultRules()));
  const requestId = useRef(uuid());
  const change = (key, value) => setRules(r => ({ ...r, [key]: value }));
  const qc = (id, key, value) => setRules(r => ({ ...r, quests: r.quests.map(q => q.id === id ? { ...q, [key]: value } : q) }));
  return <form className="ch-card" onSubmit={e => { e.preventDefault(); onSubmit(rules, requestId.current); }}>
    <h2>{initial ? 'Propose a new agreement' : 'Agree on your first quests'}</h2><p className="ch-muted">Your submission is your approval. Your partner must accept the complete agreement. {initial ? 'Changes activate next Monday; past results stay under their original rules.' : 'Initial rules activate when your partner accepts.'}</p>
    {rules.quests.map((q, index) => <fieldset key={q.id}><legend>Quest {index + 1}</legend><Field label="Requirement"><input required maxLength={300} value={q.requirement} onChange={e => qc(q.id, 'requirement', e.target.value)} placeholder="Run for 20 minutes"/></Field>
      <div className="ch-grid"><Field label="Frequency"><select value={q.frequency} onChange={e => qc(q.id, 'frequency', e.target.value)}><option value="daily">Daily</option><option value="weekdays">Selected weekdays</option><option value="weekly">Flexible weekly target</option></select></Field><Field label="Assigned to"><select value={q.assignment} onChange={e => qc(q.id, 'assignment', e.target.value)}><option value="both">Both participants</option><option value="owner">{challenge.names[challenge.owner]}</option><option value="partner">{challenge.names[challenge.members[1]]}</option></select></Field></div>
      {q.frequency === 'weekdays' && <div className="ch-days" role="group" aria-label={`Due weekdays for quest ${index + 1}`}>{[1,2,3,4,5,6,0].map(day => <label key={day}><input type="checkbox" checked={q.days.includes(day)} onChange={e => qc(q.id, 'days', e.target.checked ? [...q.days, day] : q.days.filter(d => d !== day))}/>{weekdays[day]}</label>)}</div>}
      {q.frequency === 'weekly' && <div className="ch-grid"><Field label="Weekly target (distinct days)"><input type="number" required min={1} max={7} value={q.target} onChange={e => qc(q.id, 'target', Number(e.target.value))}/></Field><Field label="Extra frequency (optional)"><input type="number" min={Number(q.target) + 1} max={7} value={q.extra || ''} onChange={e => qc(q.id, 'extra', Number(e.target.value))}/></Field></div>}
      <Field label="Extra-effort threshold"><input required maxLength={300} value={q.surge} onChange={e => qc(q.id, 'surge', e.target.value)} placeholder="Run for 40 minutes"/></Field>
      <Field label="Proof collected at completion"><select value={q.proof} onChange={e => qc(q.id, 'proof', e.target.value)}><option value="none">None</option><option value="checkin">Written check-in</option><option value="timer">Timer</option><option value="photo">Private photo (up to 160 KB)</option></select></Field>
      {rules.quests.length > 1 && <button type="button" onClick={() => change('quests', rules.quests.filter(item => item.id !== q.id))}>Remove quest {index + 1}</button>}
    </fieldset>)}
    {rules.quests.length < 12 && <button type="button" onClick={() => change('quests', [...rules.quests, newQuest()])}>+ Add challenge quest</button>}
    <h3>Commitments and rewards</h3><Field label="Punishment for each missed day"><input required maxLength={300} value={rules.missedPunishment} onChange={e => change('missedPunishment', e.target.value)} placeholder="Do an extra household chore"/></Field><Field label="Punishment for each weekly shortfall"><input required maxLength={300} value={rules.shortfallPunishment} onChange={e => change('shortfallPunishment', e.target.value)}/></Field>
    <div className="ch-grid"><Field label="Weekly reward basis"><select value={rules.rewardBasis} onChange={e => { change('rewardBasis', e.target.value); change('rewardTarget', 1); }}><option value="days">Surge days</option><option value="weekly">Weekly quest surges</option></select></Field><Field label="Weekly reward target"><input type="number" required min={1} max={rules.rewardBasis === 'days' ? 7 : 12} value={rules.rewardTarget} onChange={e => change('rewardTarget', Number(e.target.value))}/></Field></div>
    <Field label="Reward earned once per week"><input required maxLength={300} value={rules.reward} onChange={e => change('reward', e.target.value)} placeholder="A relaxed movie night"/></Field><p className="ch-muted">These are self-reported commitments. Nothing is charged or purchased. Accountability follows quest frequency; there is no rest-day setting.</p><div className="ch-actions"><button className="ch-primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Submit for partner approval'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
