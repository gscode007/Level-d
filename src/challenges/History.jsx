import { useEffect, useRef, useState } from 'react';
import { addDays } from './domain.js';
import { Field, RuleSummary } from './RulesEditor.jsx';
export function Ledger({ kind, records, challenge, versions, onPhoto, onSettle, user, busy }) {
  if (!records.length) return <p className="ch-muted">No {kind} records yet.</p>;
  return <div className="ch-ledger">{records.map(record => <article className="ch-record" key={record.id || record.date || record.week}>
    {kind === 'days' && <><strong>{record.date} · Closed day</strong>{record.participants.map(p => <p key={p.uid}>{challenge.names[p.uid]}: {p.missedDay ? '1 missed day' : 'No missed day'} · {p.surgeDay ? '1 surge day' : 'No surge day'}{p.misses.length > 0 && <span className="ch-muted">Quest misses: {p.misses.map(q => q.requirement).join('; ')}</span>}</p>)}</>}
    {kind === 'weeks' && <><strong>{record.week} – {addDays(record.week, 6)} · Closed week</strong>{record.participants.map(p => <div key={p.uid}><p>{challenge.names[p.uid]}: {p.shortfalls} weekly shortfalls · {p.surgeDays} surge days · {p.weeklySurges} weekly quest surges · {p.rewardEarned ? 'Reward earned' : 'Reward target unmet'}</p>{p.weekly.map(q => <p className="ch-muted" key={q.questId}>{q.requirement}: {q.actual}/{q.target} completions · {q.shortfalls} shortfalls{q.surge ? ' · Weekly quest surge' : ''}</p>)}</div>)}</>}
    {kind === 'proposals' && <><strong>{record.status} · {challenge.names[record.proposer]}</strong><p className="ch-muted">{record.effective ? `Effective ${record.effective}` : 'No active rule change'}</p><RuleSummary rules={record.rules} challenge={challenge}/></>}
    {kind === 'obligations' && <><strong>{challenge.names[record.uid]} · {record.kind}</strong><p>{record.description}</p><p className="ch-muted">{record.period} · {record.settledAt ? (record.kind === 'reward' ? 'Claimed' : 'Fulfilled') : 'Pending'}</p>{user?.uid === record.uid && !record.settledAt && <button disabled={busy} onClick={async () => { await onSettle(record.id); }}>{record.kind === 'reward' ? 'Mark claimed' : 'Mark fulfilled'}</button>}</>}
    {kind === 'completions' && <><strong>{challenge.names[record.uid]} · {record.date}</strong><p>{versions.find(v => v.id === record.versionId)?.rules.quests.find(q => q.id === record.questId)?.requirement || 'Archived quest'}{record.surge ? ' · Extra effort reported' : ''}</p>{record.proof?.note && <p>{record.proof.note}</p>}{record.proof?.seconds && <p>Timer: {record.proof.seconds}s</p>}{record.proof?.type === 'photo' && <button onClick={() => onPhoto(record.id)}>View private photo</button>}</>}
    {record.versionId && versions.find(v => v.id === record.versionId) && <details><summary>Rules used for this record</summary><RuleSummary rules={versions.find(v => v.id === record.versionId).rules} challenge={challenge}/></details>}
  </article>)}</div>;
}
export default function History({ id, challenge, versions, api, onPhoto, onSettle, user, busy }) {
  const [kind, setKind] = useState('days'); const [records, setRecords] = useState([]); const [next, setNext] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const generation = useRef(0);
  async function load(append = false) {
    const current = ++generation.current; setLoading(true); setError('');
    try { const result = await api('history', { id, kind, before: append ? next : null }); if (current !== generation.current) return; setRecords(prev => append ? [...prev, ...result.records] : result.records); setNext(result.next); }
    catch (e) { if (current === generation.current) setError(e.message); }
    finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => { setRecords([]); load(); return () => { generation.current++; }; }, [kind]);
  return <section className="ch-card"><h2>Complete history</h2><Field label="Record type"><select value={kind} onChange={e => setKind(e.target.value)}><option value="days">Closed days and quest misses</option><option value="weeks">Closed weeks and shortfalls</option><option value="proposals">All proposals</option><option value="obligations">Punishments and rewards</option><option value="completions">Completion records</option></select></Field>{error && <p role="alert">{error}<button onClick={() => load()}>Retry</button></p>}<Ledger kind={kind} records={records} challenge={challenge} versions={versions} onPhoto={onPhoto} user={user} busy={busy} onSettle={async recordId => { try { await onSettle(recordId); await load(); } catch (e) { setError(e.message); } }}/>{loading && <p role="status">Loading history…</p>}{next && <button disabled={loading} onClick={() => load(true)}>Load older records</button>}</section>;
}
