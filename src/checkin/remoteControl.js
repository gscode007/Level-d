import { nextCheckin, normalizeSettings, validSnooze } from './schedule.js';

export function applyCheckinCommand(schedule, command, now = Date.now()) {
  if (!command?.id || command.id === schedule.commandId) return schedule;
  let next = { ...schedule, commandId: command.id, commandError: '' };
  if (command.type === 'settings') {
    if (schedule.active) return { ...next, commandError: 'Finish the active check-in or choose a later time before changing settings.' };
    const settings = normalizeSettings(command.settings);
    return { ...next, settings, nextAt: schedule.explicit ? schedule.nextAt : nextCheckin(now, settings) };
  }
  if (command.type === 'later' && validSnooze(command.until, now)) {
    return { ...next, settings: { ...schedule.settings, enabled: true }, active: false, explicit: true, nextAt: command.until, snoozes: schedule.snoozes + 1 };
  }
  return { ...next, commandError: 'That check-in time has expired. Choose a time 1 minute to 24 hours ahead.' };
}
