import { formatDateMDY } from './timeUtils';

export function parseDaysOff(daysOffStr) {
  if (!daysOffStr) return [];
  const map = { MON:1, TUE:2, WED:3, THU:4, FRI:5, SAT:6, SUN:7 };
  return daysOffStr.split(/[-,;|]/).map(s => map[s.trim().toUpperCase()] || parseInt(s)).filter(Boolean);
}

export function isDateConsecutive(selectedDates, newDate) {
  if (!selectedDates.length) return false;
  const sorted = [...selectedDates, newDate].map(d => new Date(d)).sort((a,b)=>a-b);
  let maxStreak = 1, cur = 1;
  for (let i=1;i<sorted.length;i++) {
    const diff = (sorted[i]-sorted[i-1])/(86400000);
    if (diff===1) { cur++; maxStreak = Math.max(maxStreak,cur); if (maxStreak>=3) return true; }
    else cur = 1;
  }
  return false;
}

export function isTotalConsecutiveDaysValid(leaveDatesStr, disabledDays) {
  const dates = leaveDatesStr.split(',').map(s=>new Date(s.trim())).filter(d=>!isNaN(d));
  if (!dates.length) return true;
  dates.sort((a,b)=>a-b);
  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length-1]);
  let maxStreak=0, cur=0;
  for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) {
    const dow = d.getDay()||7;
    const onLeave = dates.some(dl => formatDateMDY(dl)===formatDateMDY(d));
    const dayOff = disabledDays.includes(dow);
    if (onLeave || dayOff) { cur++; maxStreak=Math.max(maxStreak,cur); if (maxStreak>5) return false; }
    else cur=0;
  }
  return true;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate()+days);
  return d;
}

export function isBeforeToday(dateStr) {
  const d = new Date(dateStr);
  const t = new Date();
  t.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return d < t;
}

export function isFutureDate(dateStr) {
  const d = new Date(dateStr);
  const t = new Date();
  t.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return d > t;
}