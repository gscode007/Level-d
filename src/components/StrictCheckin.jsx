import { useEffect, useRef, useState } from "react";
import "./strict-checkin.css";

export default function StrictCheckin({ checkin, onComplete, busyGoalId = null, extraContent = null }) {
  const dialog = useRef(null);
  const [later, setLater] = useState("");
  const [validation, setValidation] = useState("");
  const [sessionHabits] = useState(checkin.pending);
  const keyOf = goal => `${goal.type}:${goal.id}`;
  const pendingIds = new Set(checkin.pending.map(keyOf));
  // A check-in can remain open across midnight: include newly due habits too.
  const displayedHabits = [...sessionHabits, ...checkin.pending.filter(goal => !sessionHabits.some(initial => keyOf(initial) === keyOf(goal)))];

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function chooseTime(event) {
    event.preventDefault();
    const until = new Date(later).getTime();
    if (!checkin.snooze(until)) setValidation("Choose a time 1 minute to 24 hours from now.");
  }

  function keepFocusInside(event) {
    if (event.key !== "Tab") return;
    const controls = [...dialog.current.querySelectorAll('button, input, select, textarea')].filter(element => !element.matches(':disabled'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <dialog ref={dialog} className="strict-checkin" aria-labelledby="checkin-title" aria-describedby="checkin-description"
      onCancel={event => event.preventDefault()} onKeyDown={keepFocusInside}>
      <div className="checkin-frame" aria-hidden="true" />
      <div className="checkin-eyebrow"><span className="checkin-dot" /> LEVEL’D · QUEST CHECKPOINT</div>
      <h1 id="checkin-title">Your quest log awaits.</h1>
      <p id="checkin-description">Already did it? Record it here. Still to do? Continue with your schedule or choose a different time.</p>
      <div className="checkin-count">{checkin.pending.length} {checkin.pending.length === 1 ? "quest" : "quests"} to record</div>
      <div className="checkin-habits">
        {[...displayedHabits.filter(goal => goal.type !== 'sideQuest'), ...displayedHabits.filter(goal => goal.type === 'sideQuest')].map(goal => (
          <label className={`checkin-habit${pendingIds.has(keyOf(goal)) ? "" : " checkin-habit-recorded"}${goal.type === 'sideQuest' ? ' checkin-side-quest' : ''}`} key={keyOf(goal)}>
            <input type="checkbox" checked={!pendingIds.has(keyOf(goal))} disabled={!!busyGoalId || !pendingIds.has(keyOf(goal))} onChange={() => onComplete(goal.id, { suppressNote: true, sideQuest: goal.type === 'sideQuest' })} />
            <span><strong>{goal.name}</strong>
              <small>{goal.type === 'sideQuest'
                ? `Side Quest / ${goal.category} · +${goal.xp || 0} XP${goal.signature ? ' · Signature' : ''}`
                : `${(goal.frequency || 7) === 7 ? 'Daily Quest' : 'Weekly Quest'} / ${goal.category}${(goal.frequency || 7) < 7 ? ` · ${goal.frequency} times / week` : ' · Daily'}`}</small>
              {goal.anchor?.cue && <em>{goal.anchor.cue}</em>}
            </span>
            <span className="checkin-record">{busyGoalId === goal.id ? "Saving…" : pendingIds.has(keyOf(goal)) ? "Done" : "Recorded"}</span>
          </label>
        ))}
      </div>
      <div className="checkin-later">
        <button className="checkin-continue" type="button" disabled={!!busyGoalId}
          onClick={() => { setValidation(""); checkin.continueWithSchedule(); }}>
          Continue with schedule
        </button>
        <p className="checkin-schedule-hint">Your saved interval and reminder hours will be used.</p>
        <h2>Choose a different time (optional)</h2>
        <p>The remaining quests will be waiting for you.</p>
        <div className="checkin-presets">
          {[15, 30, 60].map(minutes => <button key={minutes} type="button" onClick={() => checkin.snooze(Date.now() + minutes * 60_000)}>In {minutes} min</button>)}
        </div>
        <form onSubmit={chooseTime}>
          <label htmlFor="checkin-later-time">Or choose a time</label>
          <div className="checkin-time-row">
            <input id="checkin-later-time" type="datetime-local" required value={later} onChange={event => { setLater(event.target.value); setValidation(""); }} />
            <button type="submit">Set check-in</button>
          </div>
        </form>
        <p className="checkin-footnote">Device time · Within the next 24 hours{checkin.schedule.snoozes > 0 ? ` · Rescheduled ${checkin.schedule.snoozes} ${checkin.schedule.snoozes === 1 ? "time" : "times"}` : ""}</p>
        {extraContent}
      </div>
      {(validation || checkin.error) && <p role="alert" className="checkin-error">{checkin.error || validation}</p>}
      <p className="checkin-rule">Record your quests, continue with your schedule, or choose a different check-in time.</p>
    </dialog>
  );
}
