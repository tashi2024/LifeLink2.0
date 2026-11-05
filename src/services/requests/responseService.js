// src/services/requests/responseService.js
import { collection, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';
import { requestFromDoc } from './requestService';
import { donorFromDoc } from '../donor/donorService';
import { sendPushMessages, ticketProblem } from '../notifications/pushSender';
import { CHANNELS } from '../notifications/notificationService';
import { addInboxItems } from '../notifications/inboxService';
import { compatibleDonorGroups } from '../../utils/bloodCompatibility';
import { ALLOW_SELF_RESPONSE } from '../../utils/testFlags';

const REQUESTS = 'blood_requests';

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  return uid;
}

function reportError(label, onError) {
  return (error) => {
    console.log(`${label} failed:`, error.code);
    if (onError) onError(new Error(friendlyMessage(error)));
  };
}

// Live view of one request (null if it no longer exists)
export function observeRequest(requestId, onChange, onError) {
  return onSnapshot(
    doc(db, REQUESTS, requestId),
    (snap) => onChange(snap.exists() ? requestFromDoc(snap.id, snap.data()) : null),
    reportError('observeRequest', onError)
  );
}

// Live view of the signed-in donor's own answer to a request (null if none yet)
export function observeMyResponse(requestId, onChange, onError) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, REQUESTS, requestId, 'responses', uid),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    reportError('observeMyResponse', onError)
  );
}

// Live list of all answers to a request (only the requester may read this).
// "Can donate" answers come first, then the newest.
export function observeResponses(requestId, onChange, onError) {
  return onSnapshot(
    collection(db, REQUESTS, requestId, 'responses'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'accepted' ? -1 : 1;
          return (b.respondedAt || 0) - (a.respondedAt || 0);
        });
      onChange(list);
    },
    reportError('observeResponses', onError)
  );
}

// Name and phone of another user (null if unreadable)
export async function getUserContact(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { name: snap.data().name ?? '', phone: snap.data().phone ?? '' };
  } catch (error) {
    console.log('getUserContact failed:', error.code);
    return null;
  }
}

// status: 'accepted' (I can donate) or 'declined' (Not available).
// Saves the answer, then tells the requester (inbox item + push). Returns { notified }.
export async function respondToRequest(request, status) {
  const uid = requireUid();
  if (status !== 'accepted' && status !== 'declined') throw new Error('Invalid answer.');
  if (request.userId === uid && !ALLOW_SELF_RESPONSE) throw new Error('You cannot answer your own request.');
  if (request.status !== 'Open') throw new Error('This request is no longer open.');

  let donor;
  try {
    const donorSnap = await getDoc(doc(db, 'donors', uid));
    if (!donorSnap.exists()) throw new Error('Register as a donor first.');
    donor = donorFromDoc(uid, donorSnap.data());
  } catch (error) {
    if (error.code) throw new Error(friendlyMessage(error));
    throw error;
  }

  if (status === 'accepted') {
    if (!donor.available) throw new Error('You are marked unavailable. Turn on availability first.');
    if (!compatibleDonorGroups(request.bloodGroup).includes(donor.bloodGroup)) {
      throw new Error(`Your blood group (${donor.bloodGroup}) cannot donate to a ${request.bloodGroup} patient.`);
    }
  }

  // The phone number is only shared when the donor says "I can donate"
  const record = {
    donorUid: uid,
    donorName: donor.name,
    bloodGroup: donor.bloodGroup,
    status,
    respondedAt: Date.now(),
  };
  if (status === 'accepted') record.contactNumber = donor.contactNumber;

  try {
    await setDoc(doc(db, REQUESTS, request.id, 'responses', uid), record); // replaces any earlier answer
  } catch (error) {
    console.log('respondToRequest failed:', error.code);
    if (error.code === 'permission-denied') {
      throw new Error('Your answer could not be saved. The request may have been closed.');
    }
    throw new Error(friendlyMessage(error));
  }

  // Tell the requester. Failure here never undoes the saved answer.
  const accepted = status === 'accepted';
  const title = accepted ? `${donor.name} can donate` : `${donor.name} is not available`;
  const body = accepted
    ? `For your ${request.bloodGroup} request at ${request.location}. Tap to see their contact details.`
    : `For your ${request.bloodGroup} request at ${request.location}.`;

  // 1. In-app inbox (works even if push is unavailable)
  try {
    await addInboxItems([{ uid: request.userId, type: 'donor_response', title, body, requestId: request.id }]);
  } catch (error) {
    console.log('Inbox write failed:', error.code || error.message);
  }

  // 2. Push notification
  let notified = false;
  try {
    const tokenSnap = await getDoc(doc(db, 'push_tokens', request.userId));
    const token = tokenSnap.exists() ? tokenSnap.data().token : null;
    if (token) {
      const tickets = await sendPushMessages([
        {
          to: token,
          title,
          body,
          data: { type: 'donor_response', requestId: request.id, status },
          channelId: CHANNELS.RESPONSES,
          sound: 'default',
          priority: 'high',
        },
      ]);
      notified = !ticketProblem(tickets[0]);
    }
  } catch (error) {
    console.log('Could not notify requester:', error.message);
  }
  return { notified };
}