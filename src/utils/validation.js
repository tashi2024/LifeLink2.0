// src/utils/validation.js

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Bhutan mobile numbers have 8 digits, optionally starting with +975
export function isValidPhone(phone) {
  return /^(\+975)?\d{8}$/.test(phone.replace(/[\s-]/g, ''));
} 