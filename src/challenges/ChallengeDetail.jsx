import { useEffect, useRef, useState } from 'react';
import { assigned, due, versionAt, weeklyStarts, addDays, weekOf } from './domain.js';
import RulesEditor, { RuleSummary, periodText } from './RulesEditor.jsx';
import CompletionForm, { Modal } from './CompletionForm.jsx';
import History, { Ledger } from './History.jsx';
export default function ChallengeDetail({ id, user, api, back }) {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [editing, setEditing] = useState(false); const [completing, setCompleting] = useState(null); const [photo, setPhoto] = useState(null); const [showHistory, setShowHistory] = useState(false); const alive = useRef(true); const loading = useRef(null);
  async function refresh(afterMutation = false) {
    if (loading.current) { await loading.current; if (!afterMutation) return; }
    const request = (async () => { try { const result = await api('get', { id }); if (alive.current) { setData(result); setError(''); } } catch (e) { if (alive.current) setError(e.message); } })();
    loading.current = request;
    try { await request; } finally { if (loading.current === request) loading.current = null; }
  }
  useEffect(() => { alive.current = true; refresh(); const timer = setInterval(refresh, 30000); return () => { alive.current = false; clearInterval(timer); }; }, [id]);
  async function mutate(action, input) { setBusy(true); setError(''); try { const result = await api(action, { id, ...input }); await refresh(true); return result; } catch (e) { setError(e.message); throw e; } finally { setBusy(false); } }
  async function action(action, input) { try { await mutate(action, input); } catch {} }
  async function viewPhoto(recordId) { try { const result = await mutate('proof', { recordId }); setPhoto(result.image); } catch {} }
  if (!data) return <section><button onClick={back}>← All challenges</button>{error ? <p role="alert">{error}<button onClick={refresh}>Retry</button></p> : <p role="status">Loading challenge…</p>}</section>;
  const { challenge: c, versions, proposals, completions, days, weeks, obligations, today, week } = data;
  const active = versionAt(versions, today); const pending = proposals.find(p => p.id === c.pendingProposal); const scheduled = versions.find(v => v.effective > today);
  const myQuests = (active?.rules.quests || []).filter(q => assigned(q, c, user.uid));
  const weekDays = days.filter(d => weekOf(d.date) === week);
  return <>
    <div className="ch-actions"><button onClick={back}>← All challenges</button><button disabled={busy} onClick={refresh}>Refresh</button></div><h2>{c.title}</h2><p className="ch-muted">{c.members.map(uid => c.names[uid]).join(' + ')} · {c.timezone} (fixed for this challenge)</p><div className="ch-boundary"><strong>Today: {today} · Week: {week} – {addDays(week, 6)}</strong><p>Days close at local midnight; weeks close Sunday at midnight in {c.timezone}. Closed records cannot be changed. Surge days finalize at day end; weekly shortfalls, weekly surges and rewards finalize at week end.</p></div>
    {error && <p className="ch-error" role="alert">{error}</p>}{data.catchingUp && <p role="status">Catching up on closed periods. Refresh to continue; saved completions are safe.</p>}
    {c.status === 'inviting' && <section className="ch-card"><h3>Waiting for your partner</h3><p>{c.inviteStatus === 'declined' ? 'Your partner declined this invitation. Create a new challenge if you want to invite again.' : `Invitation ${c.inviteExpires < data.now ? 'expired' : 'expires'} ${new Date(c.inviteExpires).toLocaleString()}. Your partner can also find it in their invitation inbox.`}</p><p className="ch-muted">No quests or punishments are active.</p></section>}
    {pending && <section className="ch-card ch-pending"><h3>Pending mutual approval</h3><p>{c.names[pending.proposer]} proposed this agreement. {pending.proposer === user.uid ? 'Your partner must explicitly accept.' : 'Review every quest and commitment before accepting.'}</p><RuleSummary rules={pending.rules} challenge={c}/>{pending.proposer !== user.uid && <div className="ch-actions"><button className="ch-primary" disabled={busy} onClick={() => action('review', { proposalId: pending.id, accept: true })}>Accept agreement</button><button disabled={busy} onClick={() => action('review', { proposalId: pending.id, accept: false })}>Reject agreement</button></div>}</section>}
    {scheduled && <section className="ch-card"><h3>Approved · Activates Monday {scheduled.effective}</h3><RuleSummary rules={scheduled.rules} challenge={c}/></section>}
    {active && <details className="ch-card"><summary>Active agreement · Effective {active.effective}</summary><RuleSummary rules={active.rules} challenge={c}/></details>}
    {c.members.length === 2 && !pending && !scheduled && !editing && <button className="ch-primary" onClick={() => setEditing(true)}>{active ? 'Propose quest or rule changes' : 'Propose initial quests and rules'}</button>}
    {editing && <RulesEditor initial={active?.rules} challenge={c} busy={busy} onCancel={() => setEditing(false)} onSubmit={async (rules, requestId) => { try { await mutate('propose', { rules, requestId }); setEditing(false); } catch {} }}/ >}
    {active && <><section className="ch-card"><h3>Your quests today</h3>{!myQuests.length && <p className="ch-muted">This agreement assigns no quests to you.</p>}{myQuests.map(q => {
      const done = completions.find(r => r.uid === user.uid && r.questId === q.id && r.date === today);
      const isDue = q.frequency === 'weekly' || due(q, today); const skip = q.frequency === 'weekly' && weeklyStarts(active) > week;
      return <article className="ch-quest" key={q.id}><div><strong>{q.requirement}</strong><span className="ch-muted">{periodText(q)} · Extra effort: {q.surge}</span>{skip && <span className="ch-muted">Weekly quota starts {weeklyStarts(active)} (first full week). You can record completion and extra effort today.</span>}</div><button className={done ? '' : 'ch-primary'} disabled={busy || !!done || !isDue} onClick={() => setCompleting(q)}>{done ? (done.surge ? 'Complete · Extra effort' : 'Complete') : isDue ? 'Record' : 'Not due today'}</button></article>;
    })}<p className="ch-muted">Completions are self-reported and need no partner approval. Several extra-effort completions can produce one surge day only, and every quest due that day must be complete.</p></section>
    <div className="ch-grid">{c.members.map(uid => {
      const participantDays = weekDays.map(d => d.participants.find(p => p.uid === uid)).filter(Boolean);
      const missed = participantDays.filter(p => p.missedDay).length; const surges = participantDays.filter(p => p.surgeDay).length;
      const todayDone = completions.filter(r => r.uid === uid && r.date === today);
      const allDueDone = active.rules.quests.filter(q => assigned(q, c, uid) && due(q, today)).every(q => todayDone.some(r => r.questId === q.id));
      return <section className="ch-card" key={uid}><h3>{c.names[uid]}{uid === user.uid ? ' · You' : ''}</h3><div className="ch-stats"><div><strong>{missed}</strong><span>Missed days this week</span></div><div><strong>{surges}</strong><span>Final surge days this week</span></div></div><p className="ch-muted">Today: {todayDone.length} completions · {todayDone.some(r => r.surge) && allDueDone ? 'Surge candidate; final at midnight' : 'No surge candidate yet'}</p>
      {active.rules.quests.filter(q => assigned(q, c, uid)).map(q => { const records = completions.filter(r => r.uid === uid && r.questId === q.id && r.versionId === active.id); const count = new Set(records.map(r => r.date)).size; return <div className="ch-progress" key={q.id}><strong>{q.requirement}</strong><p>{q.frequency === 'weekly' ? (weeklyStarts(active) > week ? `Quota starts ${weeklyStarts(active)}` : `${count}/${q.target} distinct days · ${Math.max(0, q.target - count)} remaining${q.extra && count >= q.extra ? ' · Weekly quest surge reached (final at week end)' : ''}`) : (records.some(r => r.date === today) ? 'Complete today' : due(q, today) ? 'Due today' : 'Not due today')}</p></div>; })}
      <h4>Shared completion proof</h4><Ledger kind="completions" records={completions.filter(r => r.uid === uid)} challenge={c} versions={versions} onPhoto={viewPhoto}/>
      </section>;
    })}</div>
    <section className="ch-card"><h3>Recent closed days</h3><Ledger kind="days" records={days.slice(0, 7)} challenge={c} versions={versions}/></section><section className="ch-card"><h3>Recent closed weeks</h3><Ledger kind="weeks" records={weeks.slice(0, 4)} challenge={c} versions={versions}/></section>
    <section className="ch-card"><h3>Punishments and earned rewards</h3><p className="ch-muted">Each missed day creates one commitment; each weekly shortfall creates a separate commitment. Each participant can report fulfillment or claim their own rewards.</p>{!obligations.length && <p className="ch-muted">No commitments or earned rewards yet.</p>}{obligations.map(o => <article className="ch-quest" key={o.id}><div><strong>{c.names[o.uid]} · {o.kind === 'reward' ? 'Earned reward' : o.kind === 'missed-day' ? 'Missed-day punishment' : 'Weekly-shortfall punishment'}</strong><p>{o.description}</p><span className="ch-muted">Period: {o.period}{o.settledAt ? ` · ${o.kind === 'reward' ? 'Claimed' : 'Fulfilled'} ${new Date(o.settledAt).toLocaleDateString()}` : ' · Pending'}</span></div>{o.uid === user.uid && !o.settledAt && <button disabled={busy} onClick={() => action('settle', { recordId: o.id })}>{o.kind === 'reward' ? 'Mark claimed' : 'Mark fulfilled'}</button>}</article>)}</section></>}
    <button onClick={() => setShowHistory(v => !v)}>{showHistory ? 'Hide complete history' : 'Browse complete history'}</button>{showHistory && <History id={id} challenge={c} versions={versions} api={api} onPhoto={viewPhoto} user={user} busy={busy} onSettle={recordId => mutate('settle', { recordId })}/>}
    {completing && <CompletionForm quest={completing} today={today} busy={busy} submit={input => mutate('complete', input)} onClose={() => setCompleting(null)}/>} {photo && <Modal title="Private completion proof" onClose={() => setPhoto(null)}><img className="ch-proof" src={photo} alt="Photo proof submitted by a challenge participant"/></Modal>}
  </>;
}
