// src/services/donor/donorLocationService.js
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';
import { getCurrentCoords, roundCoord } from '../location/locationService';

const DONORS = 'donors';

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  return uid;
}

// Reads the phone's GPS, rounds it, and saves: latitude, longitude, geohash, locationUpdatedAt
export async function saveMyLocation() {
  const uid = requireUid();
  const coords = await getCurrentCoords(); // may throw a LocationError

  const latitude = roundCoord(coords.latitude);
  const longitude = roundCoord(coords.longitude);
  const geohash = geohashForLocation([latitude, longitude]); // computed from the ROUNDED position

  try {
    await updateDoc(doc(db, DONORS, uid), {
      latitude,
      longitude,
      geohash,
      locationUpdatedAt: Date.now(),
    });
  } catch (error) {
    console.log('saveMyLocation failed:', error.code);
    if (error.code === 'not-found') throw new Error('Register as a donor first.');
    throw new Error(friendlyMessage(error));
  }
}

// Lets a donor hide their location (they stay findable through manual Dzongkhag search)
export async function clearMyLocation() {
  const uid = requireUid();
  try {
    await updateDoc(doc(db, DONORS, uid), {
      latitude: deleteField(),
      longitude: deleteField(),
      geohash: deleteField(),
      locationUpdatedAt: deleteField(),
    });
  } catch (error) {
    console.log('clearMyLocation failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}