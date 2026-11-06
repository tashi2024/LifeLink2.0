// src/utils/testFlags.js
// TESTING ONLY. The one switch to change is SOLO_TEST_MODE.
//
// true  = test with ONE phone: you also alert yourself and can answer your own request.
// false = normal behaviour (use this for two-phone tests and the demo).
//
// This only works in development. A build for testers ignores it, even if it is left on.
const SOLO_TEST_MODE = false;

export const ALERT_REQUESTER_TOO = __DEV__ && SOLO_TEST_MODE;
export const ALLOW_SELF_RESPONSE = __DEV__ && SOLO_TEST_MODE;