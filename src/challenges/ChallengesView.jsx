import { useEffect, useRef, useState } from 'react';
import { challengeApi } from './client.js';
import { Field, uuid } from './RulesEditor.jsx';
import ChallengeDetail from './ChallengeDetail.jsx';
import './challenges.css';
import styles from '../styles.module.css';
export default function ChallengesView({ user, api = challengeApi }) {
  const [listing, setListing] = useState(null); const [selected, setSelected] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [creating, setCreating] = useState(false); const [link, setLink] = useState(''); const [linkInvite, setLinkInvite] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [title, setTitle] = useState(''); const [email, setEmail] = useState(''); const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const requestId = useRef(uuid()); const alive = useRef(true); const listRequest = useRef(0); const inviteToken = useRef(/^#challenge-invite=([\w-]+)$/.exec(window.location.hash)?.[1] || null);
  async function refresh() {
    const request = ++listRequest.current;
    try { const result = await api('list'); if (alive.current && request === listRequest.current) { setListing(result); setError(''); } }
    catch (e) { if (alive.current && request === listRequest.current) setError(e.message); }
  }
  useEffect(() => {
    alive.current = true;
    const readInvitation = () => {
      refresh();
      const hash = window.location.hash;
      inviteToken.current = /^#challenge-invite=([\w-]+)$/.exec(hash)?.[1] || null;
      setLinkInvite(null); setInviteError('');
      if (hash.startsWith('#challenge-invite=') && !inviteToken.current) setInviteError('Invalid invitation link. Ask your partner for the complete link.');
      if (inviteToken.current) {
        const token = inviteToken.current;
        api('invitation', { token }).then(result => { if (alive.current && inviteToken.current === token) { setLinkInvite(result); setSelected(null); } }).catch(e => { if (alive.current && inviteToken.current === token) setInviteError(e.message); });
      }
    };
    readInvitation(); window.addEventListener('hashchange', readInvitation);
    const timer = setInterval(refresh, 30000);
    return () => { alive.current = false; window.removeEventListener('hashchange', readInvitation); clearInterval(timer); };
  }, [user.uid]);
  async function decide(invite, accept) {
    setBusy(true); setError('');
    try { await api('invitation', { id: invite.id, accept }); setLinkInvite(null); setInviteError(''); if (inviteToken.current) { history.replaceState(null, '', window.location.pathname + window.location.search); inviteToken.current = null; } if (accept) setSelected(invite.id); await refresh(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const invites = [...new Map([...(listing?.invites || []), ...(linkInvite ? [linkInvite] : [])].map(i => [i.id, i])).values()];
  return <div className={`${styles.page} ch-page`}><header className={`${styles.pageHead} ch-header`}><div><p className={styles.eyebrow}>Shared accountability</p><h1 className={styles.pageH1}>Challenges</h1><p className="ch-muted ch-intro">Two people. One agreement. Independent progress.</p></div>{!selected && <button className="ch-primary" disabled={busy} onClick={() => setCreating(v => !v)}>{creating ? 'Close form' : '+ Create challenge'}</button>}</header>
    {error && <p className="ch-error" role="alert">{error}<button disabled={busy} onClick={refresh}>Retry</button></p>}
    {inviteError && <p className="ch-error" role="alert">{inviteError}</p>}
    {selected ? <ChallengeDetail key={`${user.uid}:${selected}`} id={selected} user={user} api={api} back={() => { setSelected(null); refresh(); }}/> : <>
      {creating && <form className="ch-card" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { const result = await api('create', { title, email, timezone, requestId: requestId.current }); setLink(`${window.location.origin}${window.location.pathname}#challenge-invite=${result.token}`); requestId.current = uuid(); setCreating(false); setTitle(''); setEmail(''); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}><h2>Invite one partner</h2><Field label="Challenge name"><input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)}/></Field><Field label="Partner’s sign-in email"><input required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></Field><Field label="Agreed timezone (IANA)"><input required value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Asia/Kolkata"/></Field><p className="ch-muted">The invitation is tied to this verified email, expires after seven days and can be redeemed once. No message is sent. Share the link yourself, or ask your partner to open their Challenges inbox. This timezone remains fixed; changing your personal settings won't change it.</p><button disabled={busy} className="ch-primary" type="submit">{busy ? 'Creating…' : 'Create private invitation'}</button></form>}
      {link && <section className="ch-card"><h2>Invitation ready</h2><Field label="Invitation link"><input readOnly value={link} onFocus={e => e.target.select()}/></Field><button onClick={async () => { try { await navigator.clipboard.writeText(link); } catch { setError('Copy the invitation link from the field above.'); } }}>Copy link</button><p className="ch-muted">Share this with your selected partner. The link exposes no quest or rule content.</p></section>}
      {!listing && !error && <p role="status">Loading challenges and invitations…</p>}
      {invites.length > 0 && <section className="ch-card"><h2>Pending invitations</h2>{invites.map(invite => <article className="ch-quest" key={invite.id}><div><strong>{invite.inviter} invited you</strong><span className="ch-muted">Expires {new Date(invite.expires).toLocaleString()}. Joining adds you as the only partner; quests still require your separate approval.</span></div><div className="ch-actions"><button className="ch-primary" disabled={busy} onClick={() => decide(invite, true)}>Accept invitation</button><button disabled={busy} onClick={() => decide(invite, false)}>Decline</button></div></article>)}</section>}
      {listing && <section><h2>Your challenges</h2>{!listing.challenges.length && <div className="ch-card"><h3>Build a commitment together</h3><p className="ch-muted">Invite one partner, agree on quests and track your own effort. Your personal quests stay independent.</p></div>}<div className="ch-grid">{listing.challenges.map(c => <button className="ch-card ch-challenge-button" key={c.id} onClick={() => setSelected(c.id)}><span className="ch-kicker">{c.status === 'active' ? 'ACTIVE' : c.status === 'draft' ? 'AWAITING AGREEMENT' : `INVITATION ${c.inviteStatus.toUpperCase()}`}</span><strong>{c.title}</strong><span className="ch-muted">{c.members.map(uid => c.names[uid]).join(' + ')} · {c.timezone}{c.pendingProposal ? ' · Pending approval' : ''}</span></button>)}</div></section>}
    </>}
  </div>;
}
