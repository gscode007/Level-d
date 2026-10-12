import React from 'react';
import { createRoot } from 'react-dom/client';
import { connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { auth, db } from '../../src/firebase.js';
import ChallengesView from '../../src/challenges/ChallengesView.jsx';
import App from '../../src/App.jsx';
import styles from '../../src/styles.module.css';
import '../../src/index.css';
const name = new URLSearchParams(location.search).get('actor') || 'alice';
connectAuthEmulator(auth, 'http://127.0.0.1:29099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 28080);
try {
  await signInWithEmailAndPassword(auth, `${name}@example.com`, 'ChallengeTest123!');
  window.challengeTestActor = auth.currentUser.uid;
  createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('shell') ? <App/> : <div className={styles.app}><ChallengesView user={auth.currentUser}/></div>);
} catch (e) { document.getElementById('root').textContent = e.message; }
