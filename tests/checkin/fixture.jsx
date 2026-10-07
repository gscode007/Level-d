// Dev-server-only integration fixture. Never part of the production entry graph.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useStrictCheckin } from '../../src/hooks/useStrictCheckin';
import StrictCheckin from '../../src/components/StrictCheckin';
import { tzToday } from '../../src/gamification/time';
import '../../src/index.css';
import '../../src/widget/widget.css';

const key = 'leveld-checkin-v1:integration-test';
const now = Date.now();
if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
  settings: { enabled: true, intervalMinutes: 120, startHour: 0, endHour: 24 },
  active: true, nextAt: now, explicit: false, snoozes: 0,
}));
function Fixture() {
  const [state, setState] = useState(() => JSON.parse(localStorage.getItem('checkin-fixture-progress') || 'null') || {
    setupDone: true, timezone: 'Asia/Kolkata', currentLevelId: 'test', lastCompletions: {},
    levels: [{ id: 'test', goals: [
      { id: 'read', name: 'Read for 20 minutes', category: 'Intellectual', type: 'habitual', frequency: 7, anchor: { cue: 'After morning coffee' } },
      { id: 'walk', name: 'Take a walk outside', category: 'Physical', type: 'habitual', frequency: 3 },
    ] }],
  });
  const [command, setCommand] = useState(null);
  window.sendCheckinCommand = setCommand;
  const checkin = useStrictCheckin('integration-test', state, command);
  function complete(id) {
    setState(old => {
      const next = { ...old, lastCompletions: { ...old.lastCompletions, [id]: tzToday(old.timezone) } };
      localStorage.setItem('checkin-fixture-progress', JSON.stringify(next));
      return next;
    });
  }
  return <main style={{ padding: 40, color: 'white' }}>
    <h1>Check-in integration fixture</h1>
    <button onClick={checkin.checkNow}>Check in now</button>
    <output data-testid="active">{checkin.active ? 'active' : 'inactive'}</output>
    <output data-testid="remaining">{checkin.pending.length}</output>
    {checkin.active && <StrictCheckin checkin={checkin} onComplete={complete} />}
  </main>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture /></StrictMode>);
