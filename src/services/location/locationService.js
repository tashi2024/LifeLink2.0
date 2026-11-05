// src/services/location/locationService.js
import { Linking } from 'react-native';
import * as Location from 'expo-location';

// Coordinates are rounded before being saved. 2 decimals is about 1 km (privacy).
export const COORD_DECIMALS = 2;

export function roundCoord(value) {
  const factor = 10 ** COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}

// An error with a "type" so screens can react differently:
// 'denied' | 'blocked' | 'services_off' | 'unavailable'
export class LocationError extends Error {
  constructor(type, message) {
    super(message);
    this.type = type;
  }
}

export function openLocationSettings() {
  Linking.openSettings();
}

// Asks for permission if needed. Throws a LocationError if it is not granted.
export async function ensureLocationPermission() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    if (permission.canAskAgain) {
      throw new LocationError('denied', 'Location permission was denied.');
    }
    throw new LocationError('blocked', 'Location permission is turned off. Enable it in your phone settings.');
  }
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Returns { latitude, longitude } of the phone right now (exact, not rounded)
export async function getCurrentCoords() {
  await ensureLocationPermission();

  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) {
    throw new LocationError('services_off', 'Turn on Location (GPS) in your phone settings and try again.');
  }

  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      15000
    );
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch (error) {
    // GPS is slow indoors, so fall back to the last position the phone knows
    const last = await Location.getLastKnownPositionAsync();
    if (last) {
      return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }
    throw new LocationError('unavailable', 'Could not get your location. Try near a window or outdoors.');
  }
}