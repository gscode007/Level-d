import { useEffect, useState, useCallback } from "react";
import { applyCheckinCommand } from '../checkin/remoteControl.js';
import { inReminderWindow, nextCheckin, nextReminderWindow, normalizeSettings, pendingHabits, readSchedule, validSnooze } from "../checkin/schedule.js";

export function useStrictCheckin(uid, state, command = null) {
  const key = uid ? `leveld-checkin-v1:${uid}` : null;
  const [record, setRecord] = useState(null);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const schedule = record?.key === key ? record.schedule : null;
  const ready = !!(key && state?.setupDone && schedule);
  const pending = pendingHabits(state, now);

  useEffect(() => {
    if (!key) { setRecord(null); return; }
    try {
      const value = readSchedule(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
      setRecord({ key, schedule: value });
      setError("");
    } catch {
      setRecord({ key, schedule: readSchedule(null) });
      setError("Check-in timing could not be saved on this device. Allow site storage and try again.");
    }
  }, [key]);

  const commit = useCallback(value => {
    if (!key) return false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setRecord({ key, schedule: value });
      setError("");
      return true;
    } catch {
      setError("The next check-in could not be saved. Allow site storage and try again.");
      return false;
    }
  }, [key]);

  useEffect(() => {
    if (!schedule || !command?.id || command.id === schedule.commandId) return;
    commit(applyCheckinCommand(schedule, command));
  }, [schedule, command, commit]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    const unsubscribe = window.leveldDesktop?.onCheckinWake(tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!ready || !schedule.settings.enabled) return;
    if (schedule.active) {
      if (!pending.length) commit({ ...schedule, active: false, explicit: false, snoozes: 0, nextAt: nextCheckin(now, schedule.settings) });
      return;
    }
    if (now < schedule.nextAt) return;
    if (!schedule.explicit && !inReminderWindow(now, schedule.settings)) {
      commit({ ...schedule, nextAt: nextReminderWindow(now, schedule.settings) });
    } else if (pending.length) {
      // Even if persistence fails, a due check-in still appears in this session.
      const active = { ...schedule, active: true };
      if (!commit(active)) setRecord({ key, schedule: active });
    } else {
      commit({ ...schedule, explicit: false, snoozes: 0, nextAt: nextCheckin(now, schedule.settings) });
    }
  }, [ready, schedule, now, pending.length, commit, key]);

  const active = ready && schedule.settings.enabled && schedule.active && pending.length > 0;
  useEffect(() => {
    window.leveldDesktop?.setCheckin({
      enabled: ready && schedule.settings.enabled,
      active: !!active,
      nextAt: ready ? schedule.nextAt : null,
    });
  }, [ready, schedule?.settings.enabled, schedule?.nextAt, active]);

  function snooze(until) {
    const time = Date.now();
    if (!validSnooze(until, time)) {
      setError("Choose a time at least one minute ahead and within the next 24 hours.");
      return false;
    }
    return commit({ ...schedule, active: false, explicit: true, nextAt: until, snoozes: schedule.snoozes + 1 });
  }

  function configure(patch) {
    // A currently due check-in must be resolved before settings can change.
    if (!schedule || active) return;
    const settings = normalizeSettings({ ...schedule.settings, ...patch });
    commit({ ...schedule, settings, active: false,
      nextAt: schedule.explicit ? schedule.nextAt : nextCheckin(Date.now(), settings) });
  }

  function checkNow() {
    if (!schedule || !pending.length) return;
    commit({ ...schedule, settings: { ...schedule.settings, enabled: true }, nextAt: Date.now(), active: true });
  }

  return { active, pending, schedule, error, snooze, configure, checkNow };
}
