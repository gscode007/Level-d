import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore';
export async function verifyClientRules(db) {
  setLogLevel('silent');
  const id = 'privacy-probe';
  await db.collection('challenges').doc(id).set({ members: ['alice', 'bob'], title: 'Private' });
  await db.collection('challenges').doc(id).collection('proofs').doc('photo').set({ image: 'private' });
  for (const name of ['alice', 'bob', 'eve', 'anonymous']) {
    const app = initializeApp({ projectId: 'demo-leveld-challenges', apiKey: 'fake-api-key' }, `rules-${name}`);
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:29099', { disableWarnings: true });
    if (name !== 'anonymous') await signInWithEmailAndPassword(auth, `${name}@example.com`, 'ChallengeTest123!');
    const firestore = getFirestore(app); connectFirestoreEmulator(firestore, '127.0.0.1', 28080);
    for (const path of [`challenges/${id}`, `challenges/${id}/proofs/photo`, 'challengeInvites/secret', 'challengeJobs/reconcile']) {
      await assert.rejects(getDoc(doc(firestore, path)), error => error.code === 'permission-denied');
      await assert.rejects(setDoc(doc(firestore, path), { hacked: true }), error => error.code === 'permission-denied');
    }
    if (name === 'alice') { await setDoc(doc(firestore, 'users/alice'), { preserved: true }); assert.equal((await getDoc(doc(firestore, 'users/alice'))).data().preserved, true); await setDoc(doc(firestore, 'users/alice/xpAudit/event'), { amount: 1 }); }
    if (name === 'eve') await assert.rejects(getDoc(doc(firestore, 'users/alice')), error => error.code === 'permission-denied');
    await deleteApp(app);
  }
  await db.collection('challenges').doc(id).collection('proofs').doc('photo').delete();
  await db.collection('challenges').doc(id).delete();
  console.log('PASS: Firestore rules deny client access to Challenges, proof, invitation tokens and cron state; personal data remains owner scoped.');
}
