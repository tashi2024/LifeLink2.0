// src/utils/appointmentUtils.js
import { formatDate } from './dateUtils';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const HOUR_MS = 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

// A Date -> "2026-11-14" (in the phone's own time zone)
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "2026-11-14" + "10:30" -> milliseconds
export function slotTimestamp(dateKey, timeKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = timeKey.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

// Today and the following days: [{ dateKey, date }]
export function nextDays(count) {
  const today = new Date();
  const days = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    days.push({ dateKey: toDateKey(date), date });
  }
  return days;
}

// Milliseconds -> "Sat, 14 Nov 2026 at 10:30"
export function describeSlot(ms) {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]}, ${formatDate(ms)} at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}