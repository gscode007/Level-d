export function prepareDashboardWrite(remote, desired, expectedRevision) {
  if ((remote?.widgetRevision || 0) !== expectedRevision) throw new Error('widget-sync-conflict');
  const result = { ...desired, widgetRevision: expectedRevision };
  // These fields belong to the check-in controller, not dashboard progress.
  for (const key of ['checkinControl', 'checkinStatus']) {
    if (remote?.[key] !== undefined) result[key] = remote[key];
    else delete result[key];
  }
  return result;
}
