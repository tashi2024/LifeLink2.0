// src/services/donor/donorService.js
import { deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';
import { BLOOD_GROUPS, DEFAULT_COOLDOWN_DAYS } from '../../utils/constants';
import { DAY_MS, isAvailableNow } from '../../utils/donorAvailability';
import { formatDate } from '../../utils/dateUtils';

const DONORS = 'donors'; // same collection name as Project I

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  return uid;
}

// Same rules as DonorRepository.saveDonor in Project I
function validateDonor({ name, bloodGroup, contactNumber, location }) {
  if (!name?.trim() || !bloodGroup || !contactNumber?.trim() || !location?.trim()) {
    throw new Error('Please fill in all donor fields.');
  }
  if (!BLOOD_GROUPS.includes(bloodGroup)) {
    throw new Error('Select a valid blood group.');
  }
}

// Turns a Firestore document into a donor object.
// NOTE: in the app, donor.available is the EFFECTIVE availability (it already
// accounts for the donation cooldown), so every screen can simply use donor.available.
export function donorFromDoc(uid, data = {}, now = Date.now()) {
  const nextEligibleDate = typeof data.nextEligibleDate === 'number' ? data.nextEligibleDate : 0;
  const lastDonationDate = typeof data.lastDonationDate === 'number' ? data.lastDonationDate : 0;
  const storedAvailable = data.available ?? true;
  return {
    ...data,
    uid,
    name: data.name ?? '',
    bloodGroup: data.bloodGroup ?? '',
    contactNumber: data.contactNumber ?? '',
    location: data.location ?? '',
    available: isAvailableNow({ available: storedAvailable, nextEligibleDate }, now),
    lastDonationDate,
    nextEligibleDate,
    inCooldown: nextEligibleDate > now,
    cooldownExpired: nextEligibleDate > 0 && nextEligibleDate <= now,
  };
}

// ---------- Cooldown configuration ----------

let cachedCooldownDays = null;

// Reads the cooldown length (in days) from Firestore: app_config/donation -> cooldownDays.
// Falls back to DEFAULT_COOLDOWN_DAYS if the document is missing or unreadable.
// The value is remembered until the app restarts.
export async function getCooldownDays() {
  if (cachedCooldownDays) return cachedCooldownDays;
  try {
    const snap = await getDoc(doc(db, 'app_config', 'donation'));
    const days = snap.exists() ? Number(snap.data().cooldownDays) : NaN;
    cachedCooldownDays = Number.isFinite(days) && days >= 1 ? Math.floor(days) : DEFAULT_COOLDOWN_DAYS;
    return cachedCooldownDays;
  } catch (error) {
    console.log('getCooldownDays failed, using default:', error.code);
    return DEFAULT_COOLDOWN_DAYS;
  }
}

// ---------- Reading ----------

// Called when a cooldown has ended: the donor's own phone tidies up the document
async function finishCooldown() {
  const uid = requireUid();
  await updateDoc(doc(db, DONORS, uid), { available: true, nextEligibleDate: 0 });
}

let finishingCooldown = false;

// Live updates for the signed-in user's donor profile (null if none).
// Returns an unsubscribe function: call it when the screen closes.
export function observeMyDonor(onChange, onError) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, DONORS, uid),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const donor = donorFromDoc(uid, snap.data());

      // Cooldown finished -> switch the donor back to available (once)
      if (donor.cooldownExpired && !finishingCooldown && !snap.metadata.hasPendingWrites) {
        finishingCooldown = true;
        finishCooldown()
          .catch((error) => console.log('finishCooldown failed:', error.code))
          .finally(() => {
            finishingCooldown = false;
          });
      }
      onChange(donor);
    },
    (error) => {
      console.log('observeMyDonor failed:', error.code);
      if (onError) onError(new Error(friendlyMessage(error)));
    }
  );
}

export async function getDonorById(uid) {
  try {
    const snap = await getDoc(doc(db, DONORS, uid));
    return snap.exists() ? donorFromDoc(uid, snap.data()) : null;
  } catch (error) {
    console.log('getDonorById failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}

// ---------- Writing ----------

// Create OR update (the document ID is the user's uid, so there is one profile per account).
// "available" is only written when it is passed in (new registrations), so editing
// a profile never changes availability or the cooldown.
export async function saveDonor({ name, bloodGroup, contactNumber, location, available }) {
  const uid = requireUid();
  validateDonor({ name, bloodGroup, contactNumber, location });
  const data = {
    uid,
    name: name.trim(),
    bloodGroup,
    contactNumber: contactNumber.trim(),
    location: location.trim(),
  };
  if (typeof available === 'boolean') data.available = available;
  try {
    await setDoc(doc(db, DONORS, uid), data, { merge: true });
  } catch (error) {
    console.log('saveDonor failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}

export async function deleteMyDonor() {
  const uid = requireUid();
  try {
    await deleteDoc(doc(db, DONORS, uid));
  } catch (error) {
    console.log('deleteMyDonor failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}

// ---------- Availability and donation records ----------

async function getMyCurrentDonor() {
  const uid = requireUid();
  const snap = await getDoc(doc(db, DONORS, uid));
  if (!snap.exists()) throw new Error('Register as a donor first.');
  return donorFromDoc(uid, snap.data());
}

// Donor switches Available / Unavailable (not allowed during a cooldown)
export async function setAvailability(isAvailable) {
  const uid = requireUid();
  try {
    const donor = await getMyCurrentDonor();
    if (donor.inCooldown) {
      throw new Error(`You cannot change this until ${formatDate(donor.nextEligibleDate)}.`);
    }
    // nextEligibleDate: 0 clears any leftover cooldown value
    await updateDoc(doc(db, DONORS, uid), { available: Boolean(isAvailable), nextEligibleDate: 0 });
  } catch (error) {
    if (error.code) {
      console.log('setAvailability failed:', error.code);
      throw new Error(friendlyMessage(error));
    }
    throw error;
  }
}

// "I donated today": records the donation and starts the cooldown
export async function recordDonation() {
  const uid = requireUid();
  try {
    const donor = await getMyCurrentDonor();
    if (donor.inCooldown) {
      throw new Error(`A donation is already recorded. You are eligible again on ${formatDate(donor.nextEligibleDate)}.`);
    }
    const days = await getCooldownDays();
    const now = Date.now();
    const nextEligibleDate = now + days * DAY_MS;
    await updateDoc(doc(db, DONORS, uid), {
      lastDonationDate: now,
      nextEligibleDate,
      available: false,
    });
    return nextEligibleDate;
  } catch (error) {
    if (error.code) {
      console.log('recordDonation failed:', error.code);
      throw new Error(friendlyMessage(error));
    }
    throw error;
  }
}

// For a donation recorded by mistake: clears the cooldown and makes the donor available again
export async function undoDonation() {
  const uid = requireUid();
  try {
    await updateDoc(doc(db, DONORS, uid), {
      lastDonationDate: 0,
      nextEligibleDate: 0,
      available: true,
    });
  } catch (error) {
    console.log('undoDonation failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}