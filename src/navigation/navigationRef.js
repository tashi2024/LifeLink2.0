// src/navigation/navigationRef.js
import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside a screen (like the notification handler) open a screen
export const navigationRef = createNavigationContainerRef();

// If the app was closed, the navigator may not be ready yet, so keep trying for up to 5 seconds
export function navigateSoon(name, params, tries = 0) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return;
  }
  if (tries < 25) {
    setTimeout(() => navigateSoon(name, params, tries + 1), 200);
  }
}