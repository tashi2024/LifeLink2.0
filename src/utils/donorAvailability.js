// src/utils/donorAvailability.js

export const DAY_MS = 24 * 60 * 60 * 1000;

// nextEligibleDate: milliseconds, or 0 when there is no cooldown.
//  - in the future  -> still resting after a donation: NOT available
//  - in the past    -> the cooldown has finished: available again
//  - 0              -> no cooldown, so use the donor's own Available/Unavailable choice
export function isAvailableNow({ available, nextEligibleDate }, now = Date.now()) {
  if (nextEligibleDate > now) return false;
  if (nextEligibleDate > 0) return true;
  return Boolean(available);
}

// Whole days remaining until the donor is eligible again (rounded up)
export function daysLeft(nextEligibleDate, now = Date.now()) {
  return Math.max(0, Math.ceil((nextEligibleDate - now) / DAY_MS));
} 