// src/utils/dateUtils.js
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Milliseconds -> "3 Nov 2026"
export function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Milliseconds -> "14:30" (24-hour clock)
export function formatTimeOfDay(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Milliseconds -> "3 Nov 2026, 14:30"
export function formatDateTime(ms) {
  if (!ms) return '';
  return `${formatDate(ms)}, ${formatTimeOfDay(ms)}`;
}