// src/services/donor/alertSettingsService.js
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';

const ALLOWED_RADII = [0, 1, 5, 10, 25]; // 0 means "no alerts"

// Saves how far away a donor wants to be alerted: donors/{uid}.alertRadiusKm
export async function setAlertRadius(km) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  if (!ALLOWED_RADII.includes(km)) throw new Error('Choose Off, 1, 5, 10 or 25 km.');
  try {
    await updateDoc(doc(db, 'donors', uid), { alertRadiusKm: km });
  } catch (error) {
    console.log('setAlertRadius failed:', error.code);
    if (error.code === 'not-found') throw new Error('Register as a donor first.');
    throw new Error(friendlyMessage(error));
  }
}