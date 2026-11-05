// src/services/requests/requestService.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';
import { roundCoord } from '../location/locationService';
import { BLOOD_GROUPS, REQUEST_STATUSES, URGENCY_LEVELS } from '../../utils/constants';

const COLLECTION = 'blood_requests'; // same collection name as Project I

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  return uid;
}

// Same rules as BloodRequestRepository.validate in Project I
function validateRequest({ bloodGroup, location, urgency, quantity }) {
  if (!BLOOD_GROUPS.includes(bloodGroup)) throw new Error('Select a valid blood group.');
  if (!location?.trim()) throw new Error('Location is required.');
  if (!URGENCY_LEVELS.includes(urgency)) throw new Error('Select a valid urgency level.');
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Quantity must be at least 1.');
}

// Turns a Firestore document into a request object (same defaults as BloodRequest.fromMap)
export function requestFromDoc(id, data = {}) {
  const quantity = Math.trunc(Number(data.quantity));
  const createdAt = typeof data.createdAt === 'number' ? data.createdAt : 0;
  return {
    ...data,
    id,
    userId: data.userId ?? '',
    bloodGroup: data.bloodGroup ?? '',
    location: data.location ?? '',
    urgency: data.urgency ?? 'Medium',
    quantity: Number.isFinite(quantity) ? quantity : 1,
    notes: data.notes ?? '',
    status: data.status ?? 'Open',
    createdAt,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : createdAt,
  };
}

// Live list of the signed-in user's requests, newest first.
// Filters by userId only and sorts on the device, so no Firestore index is needed (as in Project I).
// Returns an unsubscribe function.
export function observeMyRequests(onChange, onError) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, COLLECTION), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => requestFromDoc(d.id, d.data()))
        .sort((a, b) => b.createdAt - a.createdAt);
      onChange(list);
    },
    (error) => {
      console.log('observeMyRequests failed:', error.code);
      if (onError) onError(new Error(friendlyMessage(error)));
    }
  );
}

// New requests always start as "Open".
// latitude/longitude are optional: when given, they are rounded (about 1 km) and saved with a geohash
// so that nearby donors can be alerted.
export async function createRequest({ bloodGroup, location, urgency, quantity, notes, latitude, longitude }) {
  const uid = requireUid();
  validateRequest({ bloodGroup, location, urgency, quantity });
  const now = Date.now();

  const record = {
    userId: uid,
    bloodGroup,
    location: location.trim(),
    urgency,
    quantity,
    notes: (notes ?? '').trim(),
    status: 'Open',
    createdAt: now,
    updatedAt: now,
  };

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    const lat = roundCoord(latitude);
    const lon = roundCoord(longitude);
    record.latitude = lat;
    record.longitude = lon;
    record.geohash = geohashForLocation([lat, lon]);
  }

  try {
    const ref = await addDoc(collection(db, COLLECTION), record);
    return ref.id;
  } catch (error) {
    console.log('createRequest failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}

// Updates only the editable fields. createdAt, userId and any other fields are left alone.
export async function updateRequest(id, { bloodGroup, location, urgency, quantity, notes, status }) {
  requireUid();
  if (!id) throw new Error('Missing request id.');
  validateRequest({ bloodGroup, location, urgency, quantity });
  if (!REQUEST_STATUSES.includes(status)) throw new Error('Select a valid status.');
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      bloodGroup,
      location: location.trim(),
      urgency,
      quantity,
      notes: (notes ?? '').trim(),
      status,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.log('updateRequest failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}

export async function deleteRequest(id) {
  requireUid();
  if (!id) throw new Error('Missing request id.');
  try {
    await deleteDoc(doc(db, COLLECTION, id));
  } catch (error) {
    console.log('deleteRequest failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}