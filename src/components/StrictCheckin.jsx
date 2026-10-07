import { useEffect, useRef, useState } from "react";
import "./strict-checkin.css";

export default function StrictCheckin({ checkin, onComplete, busyGoalId = null }) {
  const dialog = useRef(null);
  const [later, setLater] = useState("");
  const [validation, setValidation] = useState("");
  const [sessionHabits] = useState(checkin.pending);
  const pendingIds = new Set(checkin.pending.map(goal => goal.id));
  // A check-in can remain open across midnight: include newly due habits too.
  const displayedHabits = [...sessionHabits, ...checkin.pending.filter(goal => !sessionHabits.some(initial => initial.id === goal.id))];

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
    const controls = [...dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled])')];
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
      <div className="checkin-eyebrow"><span className="checkin-dot" /> LEVEL’D · CHECK-IN</div>
      <h1 id="checkin-title">Time to follow through.</h1>
      <p id="checkin-description">Already did it? Record it here. Still to do? Choose when you’ll check back in.</p>
      <div className="checkin-count">{checkin.pending.length} {checkin.pending.length === 1 ? "habit" : "habits"} to record</div>
      <div className="checkin-habits">
        {displayedHabits.map(goal => (
          <label className={`checkin-habit${pendingIds.has(goal.id) ? "" : " checkin-habit-recorded"}`} key={goal.id}>
            <input type="checkbox" checked={!pendingIds.has(goal.id)} disabled={!!busyGoalId || !pendingIds.has(goal.id)} onChange={() => onComplete(goal.id, { suppressNote: true })} />
            <span><strong>{goal.name}</strong>
              <small>{goal.category}{(goal.frequency || 7) < 7 ? ` · ${goal.frequency} times / week` : " · Daily"}</small>
              {goal.anchor?.cue && <em>{goal.anchor.cue}</em>}
            </span>
            <span className="checkin-record">{busyGoalId === goal.id ? "Saving…" : pendingIds.has(goal.id) ? "Done" : "Recorded"}</span>
          </label>
        ))}
      </div>
      <div className="checkin-later">
        <h2>Check back later</h2>
        <p>The remaining habits will be waiting for you.</p>
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
      </div>
      {(validation || checkin.error) && <p role="alert" className="checkin-error">{checkin.error || validation}</p>}
      <p className="checkin-rule">Record every remaining habit or set your next check-in to continue.</p>
    </dialog>
  );
}
