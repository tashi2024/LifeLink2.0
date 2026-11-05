// src/services/appointments/appointmentService.js
import {
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';
import { getDonorById, recordDonation } from '../donor/donorService';
import {
  BOOKING_WINDOW_DAYS,
  MIN_LEAD_MINUTES,
  SLOT_CAPACITY,
  getFacility,
  isFacilityOpen,
  slotIdFor,
} from '../../utils/facilities';
import { HOUR_MS, slotTimestamp, toDateKey } from '../../utils/appointmentUtils';
import { formatDate } from '../../utils/dateUtils';

const APPOINTMENTS = 'appointments';
const SLOT_COUNTS = 'slot_counts';

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  return uid;
}

// Firebase errors have a .code and get a friendly message; our own errors pass through unchanged
function toFriendly(error) {
  return error?.code ? new Error(friendlyMessage(error)) : error;
}

const countOf = (snap) => (snap.exists() ? Number(snap.data().count) || 0 : 0);

// Checks that the chosen place, day and time make sense
function checkSlot(facilityId, dateKey, timeKey) {
  const facility = getFacility(facilityId);
  if (!facility) throw new Error('Choose a hospital or blood bank.');
  if (!dateKey) throw new Error('Choose a date.');
  if (!facility.slots.includes(timeKey)) throw new Error('Choose a time slot.');

  const scheduledAt = slotTimestamp(dateKey, timeKey);
  const now = Date.now();
  if (!isFacilityOpen(facility, new Date(scheduledAt))) {
    throw new Error(`${facility.name} does not take donations on that day.`);
  }
  if (scheduledAt < now + MIN_LEAD_MINUTES * 60 * 1000) {
    throw new Error('Choose a time at least 1 hour from now.');
  }
  if (scheduledAt > now + BOOKING_WINDOW_DAYS * 24 * HOUR_MS) {
    throw new Error(`You can book up to ${BOOKING_WINDOW_DAYS} days ahead.`);
  }
  return { facility, scheduledAt };
}

// A donor resting after a donation cannot book a date before they are eligible again
function checkEligibility(donor, scheduledAt) {
  if (!donor) throw new Error('Register as a donor first.');
  if (donor.inCooldown) {
    const earliest = toDateKey(new Date(donor.nextEligibleDate));
    if (toDateKey(new Date(scheduledAt)) < earliest) {
      throw new Error(`You can donate again from ${formatDate(donor.nextEligibleDate)}. Choose a later date.`);
    }
  }
}

// ---------- Reading ----------

// Live list of my appointments, soonest first
export function observeMyAppointments(onChange, onError) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, APPOINTMENTS), where('donorUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.scheduledAt - b.scheduledAt)
      );
    },
    (error) => {
      console.log('observeMyAppointments failed:', error.code);
      if (onError) onError(new Error(friendlyMessage(error)));
    }
  );
}

// How many places are left in each time slot of a facility on a day: { '09:00': 2, '10:30': 0, ... }
export async function getSlotAvailability(facilityId, dateKey) {
  const facility = getFacility(facilityId);
  if (!facility) return {};
  const ids = facility.slots.map((t) => slotIdFor(facilityId, dateKey, t));
  try {
    const snapshot = await getDocs(query(collection(db, SLOT_COUNTS), where(documentId(), 'in', ids)));
    const counts = {};
    snapshot.forEach((d) => {
      counts[d.id] = Number(d.data().count) || 0;
    });
    const result = {};
    facility.slots.forEach((t) => {
      result[t] = Math.max(0, SLOT_CAPACITY - (counts[slotIdFor(facilityId, dateKey, t)] ?? 0));
    });
    return result;
  } catch (error) {
    console.log('getSlotAvailability failed:', error.code);
    throw toFriendly(error);
  }
}

// ---------- Booking ----------

export async function bookAppointment({ facilityId, dateKey, timeKey, requestId }) {
  const uid = requireUid();
  const { facility, scheduledAt } = checkSlot(facilityId, dateKey, timeKey);
  try {
    const donor = await getDonorById(uid);
    checkEligibility(donor, scheduledAt);

    // One upcoming appointment at a time
    const mine = await getDocs(query(collection(db, APPOINTMENTS), where('donorUid', '==', uid)));
    const hasUpcoming = mine.docs.some((d) => d.data().status === 'booked' && d.data().scheduledAt > Date.now());
    if (hasUpcoming) throw new Error('You already have an upcoming appointment. Reschedule or cancel it first.');

    const slotId = slotIdFor(facilityId, dateKey, timeKey);
    const slotRef = doc(db, SLOT_COUNTS, slotId);
    const apptRef = doc(collection(db, APPOINTMENTS));
    const now = Date.now();
    const record = {
      donorUid: uid,
      donorName: donor.name,
      bloodGroup: donor.bloodGroup,
      contactNumber: donor.contactNumber,
      facilityId,
      facilityName: facility.name,
      facilityType: facility.type,
      dateKey,
      timeKey,
      scheduledAt,
      slotId,
      status: 'booked',
      createdAt: now,
      updatedAt: now,
    };
    if (requestId) record.requestId = requestId;

    // The counter and the booking are saved together, or not at all
    await runTransaction(db, async (tx) => {
      const slotSnap = await tx.get(slotRef);
      const count = countOf(slotSnap);
      if (count >= SLOT_CAPACITY) throw new Error('That time slot is full. Please choose another.');
      tx.set(slotRef, { count: count + 1 });
      tx.set(apptRef, record);
    });
    return { id: apptRef.id, ...record };
  } catch (error) {
    console.log('bookAppointment failed:', error.code || error.message);
    throw toFriendly(error);
  }
}

// Moves a booked appointment to another day, time or place
export async function rescheduleAppointment({ appointment, facilityId, dateKey, timeKey }) {
  const uid = requireUid();
  const { facility, scheduledAt } = checkSlot(facilityId, dateKey, timeKey);
  try {
    const donor = await getDonorById(uid);
    checkEligibility(donor, scheduledAt);

    const newSlotId = slotIdFor(facilityId, dateKey, timeKey);
    const apptRef = doc(db, APPOINTMENTS, appointment.id);
    const newSlotRef = doc(db, SLOT_COUNTS, newSlotId);

    await runTransaction(db, async (tx) => {
      const apptSnap = await tx.get(apptRef);
      if (!apptSnap.exists()) throw new Error('This appointment no longer exists.');
      const current = apptSnap.data();
      if (current.donorUid !== uid) throw new Error('This is not your appointment.');
      if (current.status !== 'booked' || current.scheduledAt <= Date.now()) {
        throw new Error('Only upcoming appointments can be rescheduled.');
      }
      if (current.slotId === newSlotId) throw new Error('That is already your appointment time.');

      // All reads come before all writes
      const oldSlotRef = doc(db, SLOT_COUNTS, current.slotId);
      const oldSnap = await tx.get(oldSlotRef);
      const newSnap = await tx.get(newSlotRef);
      const newCount = countOf(newSnap);
      const oldCount = countOf(oldSnap);
      if (newCount >= SLOT_CAPACITY) throw new Error('That time slot is full. Please choose another.');

      tx.set(newSlotRef, { count: newCount + 1 });
      if (oldCount > 0) tx.set(oldSlotRef, { count: oldCount - 1 });
      tx.update(apptRef, {
        facilityId,
        facilityName: facility.name,
        facilityType: facility.type,
        dateKey,
        timeKey,
        scheduledAt,
        slotId: newSlotId,
        updatedAt: Date.now(),
      });
    });
  } catch (error) {
    console.log('rescheduleAppointment failed:', error.code || error.message);
    throw toFriendly(error);
  }
}

// Cancels a booked appointment and frees its place
export async function cancelAppointment(appointment) {
  const uid = requireUid();
  try {
    const apptRef = doc(db, APPOINTMENTS, appointment.id);
    await runTransaction(db, async (tx) => {
      const apptSnap = await tx.get(apptRef);
      if (!apptSnap.exists()) throw new Error('This appointment no longer exists.');
      const current = apptSnap.data();
      if (current.donorUid !== uid) throw new Error('This is not your appointment.');
      if (current.status !== 'booked') throw new Error('This appointment is already closed.');

      const slotRef = doc(db, SLOT_COUNTS, current.slotId);
      const slotSnap = await tx.get(slotRef);
      const count = countOf(slotSnap);
      const now = Date.now();

      tx.update(apptRef, { status: 'cancelled', cancelledAt: now, updatedAt: now });
      if (count > 0) tx.set(slotRef, { count: count - 1 });
    });
  } catch (error) {
    console.log('cancelAppointment failed:', error.code || error.message);
    throw toFriendly(error);
  }
}

// ---------- After the appointment time ----------

// "I donated": records the donation (starting the cooldown from 7A) and closes the appointment
export async function completeAppointment(appointment) {
  const uid = requireUid();
  if (appointment.status !== 'booked') throw new Error('This appointment is already closed.');
  if (appointment.scheduledAt > Date.now()) {
    throw new Error('You can confirm a donation once the appointment time has started.');
  }
  try {
    const donor = await getDonorById(uid);
    // If the donation was already recorded on the Donor tab, do not record it twice
    if (donor && !donor.inCooldown) await recordDonation();
    const now = Date.now();
    await updateDoc(doc(db, APPOINTMENTS, appointment.id), { status: 'completed', completedAt: now, updatedAt: now });
  } catch (error) {
    console.log('completeAppointment failed:', error.code || error.message);
    throw toFriendly(error);
  }
}

// "I did not go"
export async function markMissed(appointment) {
  requireUid();
  if (appointment.status !== 'booked') throw new Error('This appointment is already closed.');
  try {
    const now = Date.now();
    await updateDoc(doc(db, APPOINTMENTS, appointment.id), { status: 'missed', updatedAt: now });
  } catch (error) {
    console.log('markMissed failed:', error.code || error.message);
    throw toFriendly(error);
  }
}