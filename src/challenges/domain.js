// Challenge calendar and accounting. Civil dates are compared only inside one
// immutable agreed timezone; UTC arithmetic here advances calendar dates, not instants.
export class ChallengeError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function insist(value, message, status = 400) { if (!value) throw new ChallengeError(message, status); }
export function dayAt(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const addDays = (day, count) => new Date(Date.parse(`${day}T12:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
export const weekday = day => new Date(`${day}T12:00:00Z`).getUTCDay();
export const weekOf = day => addDays(day, -((weekday(day) + 6) % 7));
export const nextMonday = day => addDays(weekOf(day), 7);
export function text(value, label, max = 300) {
  insist(typeof value === 'string' && value.trim() && value.trim().length <= max, `${label} is required (up to ${max} characters).`);
  return value.trim();
}
export function validateRules(input) {
  insist(input && typeof input === 'object', 'Rules are required.');
  insist(Array.isArray(input.quests) && input.quests.length > 0 && input.quests.length <= 12, 'Agree on 1–12 quests.');
  const quests = input.quests.map(q => {
    insist(q && typeof q === 'object' && (!q.days || Array.isArray(q.days)), 'Invalid quest definition.');
    const id = text(q.id, 'Quest ID', 60);
    insist(/^[a-zA-Z0-9_-]+$/.test(id), 'Invalid quest ID.');
    insist(['daily', 'weekdays', 'weekly'].includes(q.frequency), 'Choose a quest frequency.');
    insist(['both', 'owner', 'partner'].includes(q.assignment), 'Choose a participant assignment.');
    insist(['none', 'photo', 'timer', 'checkin'].includes(q.proof), 'Choose a supported proof type.');
    const days = [...new Set(q.days || [])].sort();
    if (q.frequency === 'weekdays') insist(days.length && days.every(d => Number.isInteger(d) && d >= 0 && d <= 6), 'Select due weekdays.');
    const target = q.frequency === 'weekly' ? Number(q.target) : 0;
    const extra = q.frequency === 'weekly' && q.extra ? Number(q.extra) : 0;
    if (q.frequency === 'weekly') {
      insist(Number.isInteger(target) && target >= 1 && target <= 7, 'Weekly target must be 1–7 distinct days.');
      insist(!extra || (Number.isInteger(extra) && extra > target && extra <= 7), 'Extra frequency must exceed the base target and be at most seven.');
    }
    return { id, requirement: text(q.requirement, 'Requirement'), frequency: q.frequency, days, target, extra,
      assignment: q.assignment, surge: text(q.surge, 'Extra-effort threshold'), proof: q.proof };
  });
  insist(new Set(quests.map(q => q.id)).size === quests.length, 'Quest IDs must be unique.');
  insist(['days', 'weekly'].includes(input.rewardBasis), 'Choose the reward basis.');
  const rewardTarget = Number(input.rewardTarget);
  insist(Number.isInteger(rewardTarget) && rewardTarget >= 1 && rewardTarget <= (input.rewardBasis === 'days' ? 7 : 12), 'Invalid reward target.');
  return { quests, missedPunishment: text(input.missedPunishment, 'Missed-day commitment'),
    shortfallPunishment: text(input.shortfallPunishment, 'Weekly-shortfall commitment'),
    rewardBasis: input.rewardBasis, rewardTarget, reward: text(input.reward, 'Reward') };
}
export function member(challenge, uid) {
  insist(challenge?.members?.includes(uid), 'Only challenge participants have access.', 403);
}
export const assigned = (q, challenge, uid) => q.assignment === 'both' || (q.assignment === 'owner' ? uid === challenge.owner : uid === challenge.members[1]);
export const due = (q, date) => q.frequency === 'daily' || (q.frequency === 'weekdays' && q.days.includes(weekday(date)));
export function versionAt(versions, date) {
  return versions.filter(v => v.effective <= date).sort((a, b) => b.effective.localeCompare(a.effective))[0];
}
export const weeklyStarts = v => v.weeklyStart || (v.effective === weekOf(v.effective) ? v.effective : nextMonday(v.effective));
export function dayResult(challenge, versions, date, records) {
  const version = versionAt(versions, date);
  if (!version) return null;
  return { date, versionId: version.id, timezone: challenge.timezone,
    participants: challenge.members.map(uid => {
      const quests = version.rules.quests.filter(q => assigned(q, challenge, uid));
      const completions = records.filter(c => c.uid === uid && c.date === date && c.versionId === version.id);
      const misses = quests.filter(q => due(q, date) && !completions.some(c => c.questId === q.id)).map(q => ({ questId: q.id, requirement: q.requirement }));
      return { uid, misses, missedDay: misses.length > 0, surgeDay: !misses.length && completions.some(c => c.surge), punishment: version.rules.missedPunishment };
    }) };
}
export function weekResult(challenge, versions, week, records, days) {
  const version = versionAt(versions, week);
  // Activation midweek still permits surge-day rewards, but skips weekly quotas.
  const rewardVersion = version || versionAt(versions, addDays(week, 6));
  if (!rewardVersion) return null;
  return { week, versionId: rewardVersion.id, timezone: challenge.timezone,
    participants: challenge.members.map(uid => {
      const weekly = (version?.rules.quests || []).filter(q => q.frequency === 'weekly' && assigned(q, challenge, uid) && weeklyStarts(version) <= week).map(q => {
        const dates = new Set(records.filter(c => c.uid === uid && c.questId === q.id && c.versionId === version.id && c.date >= week && c.date <= addDays(week, 6)).map(c => c.date));
        return { questId: q.id, requirement: q.requirement, actual: dates.size, target: q.target, shortfalls: Math.max(0, q.target - dates.size), surge: !!q.extra && dates.size >= q.extra };
      });
      const surgeDays = days.filter(d => d.date >= week && d.date <= addDays(week, 6) && d.participants.some(p => p.uid === uid && p.surgeDay)).length;
      const weeklySurges = weekly.filter(q => q.surge).length;
      const rules = rewardVersion.rules;
      return { uid, weekly, shortfalls: weekly.reduce((n, q) => n + q.shortfalls, 0), surgeDays, weeklySurges,
        rewardEarned: (rules.rewardBasis === 'days' ? surgeDays : weeklySurges) >= rules.rewardTarget,
        punishment: rules.shortfallPunishment, reward: rules.reward };
    }) };
}
export function authorizeProposal(challenge, proposal, uid) {
  member(challenge, uid);
  insist(challenge.members.length === 2, 'Your partner must join first.');
  insist(proposal.status === 'pending', 'This proposal has already been reviewed.', 409);
  insist(proposal.proposer !== uid, 'Your submission already counts as your approval.', 403);
}
export function completionInput(challenge, versions, uid, input, now) {
  member(challenge, uid);
  const date = dayAt(now, challenge.timezone);
  insist(!input.date || input.date === date, 'Closed dates cannot be backdated or edited.', 409);
  const version = versionAt(versions, date);
  insist(version, 'Rules have not activated yet.', 409);
  const quest = version.rules.quests.find(q => q.id === input.questId);
  insist(quest && assigned(quest, challenge, uid), 'This quest is not assigned to you.', 403);
  insist(quest.frequency === 'weekly' || due(quest, date), 'This quest is not due today.');
  let proof = null;
  if (quest.proof !== 'none') {
    insist(input.proof?.type === quest.proof, `Provide ${quest.proof} proof.`);
    if (quest.proof === 'checkin') proof = { type: 'checkin', note: text(input.proof.note, 'Check-in', 1000) };
    if (quest.proof === 'timer') {
      insist(Number.isInteger(input.proof.seconds) && input.proof.seconds > 0 && input.proof.seconds <= 86400, 'Record a timer between 1 second and 24 hours.');
      proof = { type: 'timer', seconds: input.proof.seconds };
    }
    if (quest.proof === 'photo') proof = { type: 'photo' }; // Image bytes validated and stored by trusted service.
  }
  return { uid, date, questId: quest.id, versionId: version.id, surge: input.surge === true, proof, createdAt: now };
}
