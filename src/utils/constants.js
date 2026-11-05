// src/utils/constants.js
// Values copied from Project I (Donor.kt and BloodRequest.kt)

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const URGENCY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

export const REQUEST_STATUSES = ['Open', 'Fulfilled', 'Cancelled']; 


// Used when no cooldown is configured in Firestore (app_config/donation).
// PLACEHOLDER: confirm the official period with the national blood bank.
export const DEFAULT_COOLDOWN_DAYS = 90;