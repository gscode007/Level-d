import crypto from 'node:crypto';
import { ChallengeError, insist, text, validateRules, member, dayAt, nextMonday, weekOf, addDays, dayResult, weekResult, authorizeProposal, completionInput } from './domain.js';

export const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const data = snap => snap.exists ? { ...snap.data(), id: snap.id } : null;
const rows = snap => snap.docs.map(data);
const safeId = id => { insist(typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id), 'Invalid record ID.'); return id; };
const emailOf = actor => { insist(actor.email_verified && actor.email, 'Sign in with a verified email to use invitations.', 403); return actor.email.toLowerCase(); };
export function validatePhoto(proof) {
  insist(proof && typeof proof.image === 'string' && proof.image.length <= 220000, 'Use a PNG, JPEG or WebP photo under 160 KB.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(proof.image);
  insist(match, 'Use a PNG, JPEG or WebP photo.');
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  insist(valid && bytes.length <= 163840, 'Invalid image or photo larger than 160 KB.');
  return { image: proof.image };
}
export class ChallengeService {
  constructor(db, clock = () => Date.now()) { this.db = db; this.clock = clock; }
  ref(id) { return this.db.collection('challenges').doc(safeId(id)); }
  async versions(ref, tx) { return rows(await (tx ? tx.get(ref.collection('versions')) : ref.collection('versions').get())); }
  async create(actor, input) {
    const email = emailOf(actor);
    const invitedEmail = text(input.email, 'Partner email', 254).toLowerCase();
    insist(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail) && invitedEmail !== email, 'Invite a different valid email address.');
    const timezone = text(input.timezone, 'Timezone', 100);
    try { dayAt(this.clock(), timezone); } catch { throw new ChallengeError('Use a valid IANA timezone, such as Asia/Kolkata.'); }
    const requestId = safeId(input.requestId);
    const ref = this.ref(hashToken(`${actor.uid}:${requestId}`));
    // Stable token for retries, never derived from public IDs; receipt contains it server-side only.
    const token = crypto.randomBytes(32).toString('base64url');
    const now = this.clock();
    return this.db.runTransaction(async tx => {
      const previous = data(await tx.get(ref));
      if (previous) { member(previous, actor.uid); return { id: ref.id, token: previous.inviteToken }; }
      tx.set(ref, { title: text(input.title, 'Challenge name', 80), owner: actor.uid, members: [actor.uid],
        names: { [actor.uid]: (actor.name || email).slice(0, 100) }, timezone, invitedEmail, inviteToken: token,
        inviteExpires: now + 7 * 86400000, inviteStatus: 'pending', status: 'inviting', createdAt: now,
        pendingProposal: null, scheduled: null, cursor: null });
      tx.set(this.db.collection('challengeInvites').doc(hashToken(token)), { challengeId: ref.id });
      return { id: ref.id, token };
    });
  }
  async list(actor) {
    const challenges = rows(await this.db.collection('challenges').where('members', 'array-contains', actor.uid).get());
    let invites = [];
    if (actor.email_verified && actor.email) {
      invites = rows(await this.db.collection('challenges').where('invitedEmail', '==', actor.email.toLowerCase()).get())
        .filter(c => c.inviteStatus === 'pending' && c.inviteExpires > this.clock() && !c.members.includes(actor.uid))
        .map(c => ({ id: c.id, inviter: c.names[c.owner], expires: c.inviteExpires }));
    }
    return { challenges: challenges.map(({ inviteToken, invitedEmail, ...c }) => c), invites, now: this.clock() };
  }
  async invitation(actor, input) {
    const email = emailOf(actor);
    let id = input.id;
    if (input.token) {
      insist(typeof input.token === 'string' && /^[\w-]{43}$/.test(input.token), 'Invalid invitation.', 404);
      const invite = data(await this.db.collection('challengeInvites').doc(hashToken(input.token)).get());
      insist(invite, 'Invitation not found.', 404); id = invite.challengeId;
    }
    const ref = this.ref(id);
    return this.db.runTransaction(async tx => {
      const c = data(await tx.get(ref));
      insist(c && c.invitedEmail === email && c.owner !== actor.uid, 'This invitation belongs to another email address.', 403);
      if (c.inviteStatus === 'accepted' && c.members.includes(actor.uid) && input.accept === true) return { id: ref.id };
      insist(c.inviteStatus === 'pending' && c.inviteExpires > this.clock() && c.members.length === 1, 'Invitation expired, declined, or already redeemed.', 409);
      if (input.accept === undefined) return { id: ref.id, inviter: c.names[c.owner], expires: c.inviteExpires };
      insist(typeof input.accept === 'boolean', 'Choose accept or decline.');
      tx.update(ref, { inviteStatus: input.accept ? 'accepted' : 'declined', inviteToken: null,
        ...(input.accept ? { members: [c.owner, actor.uid], names: { ...c.names, [actor.uid]: (actor.name || email).slice(0, 100) }, status: 'draft' } : {}) });
      return { id: ref.id };
    });
  }
  async propose(actor, input) {
    const ref = this.ref(input.id); const rules = validateRules(input.rules); const pid = safeId(input.requestId);
    return this.db.runTransaction(async tx => {
      const c = data(await tx.get(ref)); member(c, actor.uid);
      insist(c.members.length === 2, 'Your partner must accept the invitation first.');
      const proposalRef = ref.collection('proposals').doc(pid);
      const existing = data(await tx.get(proposalRef));
      if (existing) { insist(existing.proposer === actor.uid, 'Proposal ID already used.', 409); return { proposalId: pid }; }
      insist(!c.pendingProposal, 'Review the pending proposal before proposing another change.', 409);
      const today = dayAt(this.clock(), c.timezone);
      insist(!c.scheduled || c.scheduled.effective <= today, 'An approved change is already scheduled. Wait for it to activate.', 409);
      tx.set(proposalRef, { rules, proposer: actor.uid, status: 'pending', createdAt: this.clock() });
      tx.update(ref, { pendingProposal: pid, scheduled: c.scheduled?.effective > today ? c.scheduled : null });
      return { proposalId: pid };
    });
  }
  async review(actor, input) {
    insist(typeof input.accept === 'boolean', 'Choose accept or reject.');
    const ref = this.ref(input.id); const proposalRef = ref.collection('proposals').doc(safeId(input.proposalId));
    return this.db.runTransaction(async tx => {
      const c = data(await tx.get(ref)); const p = data(await tx.get(proposalRef));
      member(c, actor.uid); insist(p, 'Proposal not found.', 404);
      if (p.reviewer === actor.uid && p.status === (input.accept ? 'approved' : 'rejected')) return { effective: p.effective || null };
      authorizeProposal(c, p, actor.uid);
      insist(c.pendingProposal === p.id, 'Proposal is no longer current.', 409);
      const now = this.clock(); const today = dayAt(now, c.timezone);
      const effective = input.accept ? (c.status === 'draft' ? today : nextMonday(today)) : null;
      tx.update(proposalRef, { status: input.accept ? 'approved' : 'rejected', reviewer: actor.uid, reviewedAt: now, effective });
      tx.update(ref, { pendingProposal: null, ...(input.accept ? { status: 'active', scheduled: { id: p.id, effective }, ...(c.status === 'draft' ? { activationDate: today, activatedAt: now, cursor: today } : {}) } : {}) });
      if (input.accept) tx.set(ref.collection('versions').doc(p.id), { rules: p.rules, effective, weeklyStart: c.status === 'draft' ? nextMonday(today) : effective, approvedAt: now, approvals: [p.proposer, actor.uid] });
      return { effective };
    });
  }
  async complete(actor, input) {
    const ref = this.ref(input.id);
    return this.db.runTransaction(async tx => {
      const c = data(await tx.get(ref)); member(c, actor.uid);
      const versions = await this.versions(ref, tx);
      const record = completionInput(c, versions, actor.uid, input, this.clock());
      const recordId = hashToken(`${actor.uid}:${record.questId}:${record.date}`);
      const completionRef = ref.collection('completions').doc(recordId);
      const existing = data(await tx.get(completionRef));
      // Append-only completions. Retries never alter an earlier proof or surge choice.
      if (existing) return { record: existing, duplicate: true };
      const photo = record.proof?.type === 'photo' ? validatePhoto(input.proof) : null;
      tx.set(completionRef, record);
      if (photo) tx.set(ref.collection('proofs').doc(recordId), { ...photo, uid: actor.uid, createdAt: record.createdAt });
      return { record: { ...record, id: recordId } };
    });
  }
  async proof(actor, input) {
    const ref = this.ref(input.id); member(data(await ref.get()), actor.uid);
    const proof = data(await ref.collection('proofs').doc(safeId(input.recordId)).get());
    insist(proof, 'Photo proof not found.', 404); return proof;
  }
  async settle(actor, input) {
    const ref = this.ref(input.id); const obligationRef = ref.collection('obligations').doc(safeId(input.recordId));
    return this.db.runTransaction(async tx => {
      member(data(await tx.get(ref)), actor.uid);
      const obligation = data(await tx.get(obligationRef));
      insist(obligation && obligation.uid === actor.uid, 'You can only fulfill or claim your own commitments.', 403);
      if (!obligation.settledAt) tx.update(obligationRef, { settledAt: this.clock() });
      return { ok: true };
    });
  }
  async reconcile(id, maxDays = 35) {
    const ref = this.ref(id); let processed = 0;
    while (processed < maxDays) {
      const changed = await this.db.runTransaction(async tx => {
        const c = data(await tx.get(ref));
        if (!c || c.status !== 'active' || c.cursor >= dayAt(this.clock(), c.timezone)) return false;
        const date = c.cursor; const week = weekOf(date); const versions = await this.versions(ref, tx);
        const records = rows(await tx.get(ref.collection('completions').where('date', '>=', week).where('date', '<=', date)));
        const day = dayResult(c, versions, date, records);
        let weekLedger = null;
        if (date === addDays(week, 6)) {
          const days = rows(await tx.get(ref.collection('days').where('date', '>=', week).where('date', '<', date)));
          weekLedger = weekResult(c, versions, week, records, [...days, day]);
        }
        const obligation = (key, uid, kind, description, period, versionId) => tx.set(ref.collection('obligations').doc(key), { uid, kind, description, period, versionId, createdAt: this.clock(), settledAt: null });
        if (day) {
          tx.set(ref.collection('days').doc(date), day);
          for (const p of day.participants) if (p.missedDay) obligation(hashToken(`day:${date}:${p.uid}`), p.uid, 'missed-day', p.punishment, date, day.versionId);
        }
        if (weekLedger) {
          tx.set(ref.collection('weeks').doc(week), weekLedger);
          for (const p of weekLedger.participants) {
            for (const quest of p.weekly) for (let i = 0; i < quest.shortfalls; i++) obligation(hashToken(`week:${week}:${p.uid}:${quest.questId}:${i}`), p.uid, 'weekly-shortfall', p.punishment, week, weekLedger.versionId);
            if (p.rewardEarned) obligation(hashToken(`reward:${week}:${p.uid}`), p.uid, 'reward', p.reward, week, weekLedger.versionId);
          }
        }
        tx.update(ref, { cursor: addDays(date, 1) }); return true;
      });
      if (!changed) break; processed++;
    }
    return { processed };
  }
  async get(actor, input) {
    const ref = this.ref(input.id); member(data(await ref.get()), actor.uid);
    await this.reconcile(ref.id);
    const c = data(await ref.get());
    const today = dayAt(this.clock(), c.timezone); const start = weekOf(today);
    const [versions, proposals, completions, days, weeks, obligations, pending] = await Promise.all([
      this.versions(ref), ref.collection('proposals').orderBy('createdAt', 'desc').limit(30).get().then(rows),
      ref.collection('completions').where('date', '>=', start).get().then(rows),
      ref.collection('days').orderBy('date', 'desc').limit(35).get().then(rows),
      ref.collection('weeks').orderBy('week', 'desc').limit(12).get().then(rows),
      ref.collection('obligations').orderBy('period', 'desc').limit(100).get().then(rows),
      ref.collection('obligations').where('settledAt', '==', null).get().then(rows),
    ]);
    const merged = new Map([...obligations, ...pending].map(o => [o.id, o]));
    const { inviteToken, invitedEmail, ...challenge } = c;
    return { challenge, versions, proposals, completions, days, weeks, obligations: [...merged.values()], today, week: start, now: this.clock(), catchingUp: !!c.cursor && c.cursor < today };
  }
  async history(actor, input) {
    const ref = this.ref(input.id); member(data(await ref.get()), actor.uid);
    insist(['days', 'weeks', 'proposals', 'obligations', 'completions'].includes(input.kind), 'Invalid history type.');
    const field = { days: 'date', weeks: 'week', proposals: 'createdAt', obligations: 'period', completions: 'date' }[input.kind];
    let query = ref.collection(input.kind).orderBy(field, 'desc').orderBy('__name__', 'desc').limit(50);
    if (input.before) { insist(Array.isArray(input.before) && input.before.length === 2, 'Invalid page cursor.'); query = query.startAfter(...input.before); }
    const records = rows(await query.get());
    return { records, next: records.length === 50 ? [records.at(-1)[field], records.at(-1).id] : null };
  }
}
