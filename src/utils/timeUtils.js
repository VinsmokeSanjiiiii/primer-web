export function parseTimeToMinutes(hhmm) {
  if (!hhmm) throw new Error('time string is null');
  const parts = hhmm.trim().split(':');
  if (parts.length < 2) throw new Error('invalid time format: ' + hhmm);
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  h = ((h % 24) + 24) % 24;
  m = ((m % 60) + 60) % 60;
  return h * 60 + m;
}

export function signedMinutesDiff(scheduledHhMm, actualHhMm) {
  const s = parseTimeToMinutes(scheduledHhMm);
  const a = parseTimeToMinutes(actualHhMm);
  let delta = (a - s + 1440) % 1440;
  if (delta <= 720) return delta;
  return delta - 1440;
}

export function formatDateMDY(d) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
}

export function formatTimeHM(d) {
  const dt = new Date(d);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function toManilaTime(ms) {
  return new Date(ms).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}