// src/services/notifications/requestAlertService.js
import {
  collection,
  doc,
  documentId,
  endAt,
  getDocs,
  orderBy,
  query,
  startAt,
  updateDoc,
  where,
} from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';
import { donorFromDoc } from '../donor/donorService';
import { sendPushMessages, ticketProblem } from './pushSender';
import { CHANNELS } from './notificationService';
import { addInboxItems } from './inboxService';
import { compatibleDonorGroups } from '../../utils/bloodCompatibility';
import { distanceKm, formatDistance } from '../../utils/geo';
import { ALERT_REQUESTER_TOO } from '../../utils/testFlags';

export const DEFAULT_ALERT_RADIUS_KM = 10; // used when a donor has not chosen a radius
export const MAX_ALERT_RADIUS_KM = 25;     // nobody is ever alerted from further away than this

function chunk(list, size) {
  const parts = [];
  for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size));
  return parts;
}

// Donors who may be alerted about this request: [{ uid, km }]
async function findEligibleDonors({ latitude, longitude, bloodGroup }) {
  const groups = compatibleDonorGroups(bloodGroup);

  // Same geohash technique as the GPS search: a circle becomes a few geohash ranges
  const bounds = geohashQueryBounds([latitude, longitude], MAX_ALERT_RADIUS_KM * 1000);
  const snapshots = await Promise.all(
    bounds.map((b) =>
      getDocs(query(collection(db, 'donors'), orderBy('geohash'), startAt(b[0]), endAt(b[1])))
    )
  );

  const myUid = auth.currentUser?.uid;
  const seen = new Set();
  const eligible = [];

  for (const snapshot of snapshots) {
    for (const d of snapshot.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      if (d.id === myUid && !ALERT_REQUESTER_TOO) continue;

      const data = d.data();
      if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') continue;

      const donor = donorFromDoc(d.id, data);
      if (!donor.available) continue; // switched off or resting after a donation
      if (!groups.includes(donor.bloodGroup)) continue;

      const radius = typeof data.alertRadiusKm === 'number' ? data.alertRadiusKm : DEFAULT_ALERT_RADIUS_KM;
      if (radius <= 0) continue; // the donor turned alerts off

      const km = distanceKm(latitude, longitude, data.latitude, data.longitude);
      if (km > Math.min(radius, MAX_ALERT_RADIUS_KM)) continue;

      eligible.push({ uid: d.id, km });
    }
  }
  return eligible;
}

// Reads push tokens for a list of user ids -> { uid: token }
async function fetchTokens(uids) {
  const tokens = {};
  for (const part of chunk(uids, 30)) { // Firestore allows 30 ids per "in" query
    const snapshot = await getDocs(query(collection(db, 'push_tokens'), where(documentId(), 'in', part)));
    snapshot.forEach((d) => {
      if (d.data().token) tokens[d.id] = d.data().token;
    });
  }
  return tokens;
}

// Alerts eligible donors about a new request, in two ways:
//  1. an item in each donor's in-app inbox (works even without push)
//  2. a push notification, for donors who have a push token
// Returns { eligible, inboxed, withToken, sent, failed, ms }
export async function alertNearbyDonors({ requestId, bloodGroup, quantity, location, urgency, latitude, longitude }) {
  const started = Date.now();
  try {
    const eligible = await findEligibleDonors({ latitude, longitude, bloodGroup });

    const title = `${bloodGroup} blood needed nearby`;
    const bodyFor = (km) =>
      `${urgency} urgency · ${quantity} unit${quantity === 1 ? '' : 's'} at ${location} · ` +
      `${formatDistance(km)} away. Tap to respond.`;

    // 1. In-app inbox for every eligible donor
    let inboxed = 0;
    if (eligible.length > 0) {
      try {
        await addInboxItems(
          eligible.map((e) => ({ uid: e.uid, type: 'new_request', title, body: bodyFor(e.km), requestId }))
        );
        inboxed = eligible.length;
      } catch (error) {
        console.log('Inbox write failed:', error.code || error.message);
      }
    }

    // 2. Push notification for donors with a token
    let sent = 0;
    let withToken = 0;
    try {
      const tokens = await fetchTokens(eligible.map((e) => e.uid));
      const recipients = eligible.filter((e) => tokens[e.uid]);
      withToken = recipients.length;
      if (recipients.length > 0) {
        const tickets = await sendPushMessages(
          recipients.map((e) => ({
            to: tokens[e.uid],
            title,
            body: bodyFor(e.km),
            data: { type: 'new_request', requestId },
            channelId: CHANNELS.EMERGENCY,
            sound: 'default',
            priority: 'high',
            ttl: 3600, // if the phone is offline, drop the push after 1 hour (it is no longer useful)
          }))
        );
        sent = tickets.filter((t) => !ticketProblem(t)).length;
      }
    } catch (error) {
      console.log('Push step failed:', error.code || error.message);
    }

    const summary = {
      eligible: eligible.length,
      inboxed,
      withToken,
      sent,
      failed: withToken - sent,
      ms: Date.now() - started,
    };
    console.log(
      `Alerts: ${summary.eligible} eligible, ${summary.inboxed} in inbox, ${summary.sent} pushed, ${summary.ms} ms`
    );

    // Remember on the request how many donors were alerted (not fatal if this fails)
    try {
      await updateDoc(doc(db, 'blood_requests', requestId), {
        alertedCount: Math.max(inboxed, sent),
        pushedCount: sent,
        alertedAt: Date.now(),
      });
    } catch (error) {
      console.log('Could not record alert counts:', error.code);
    }
    return summary;
  } catch (error) {
    console.log('alertNearbyDonors failed:', error.code, error.message);
    throw new Error(error.code ? friendlyMessage(error) : error.message);
  }
}