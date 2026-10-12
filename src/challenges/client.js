import { auth } from '../firebase.js';
export async function challengeApi(action, input = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to use Challenges.');
  const response = await fetch('/api/challenges', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ ...input, action }) });
  let result;
  try { result = await response.json(); } catch { throw new Error('Challenges API is unavailable. Run the API server locally or open the configured hosted app.'); }
  if (!response.ok) throw new Error(result.error || 'Could not save. Retry when connected.');
  return result;
}
