// src/services/donor/nearbyDonorService.js
import { collection, endAt, getDocs, orderBy, query, startAt, where } from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';
import { donorFromDoc } from './donorService';
import { distanceKm } from '../../utils/geo';

const DONORS = 'donors';

function normalize(text) {
  return (text ?? '').trim().toLowerCase();
}

// Removes the coordinates before a donor is handed to any screen (privacy)
function publicDonor(donor, distance) {
  // eslint-disable-next-line no-unused-vars
  const { latitude, longitude, geohash, locationUpdatedAt, ...rest } = donor;
  return distance === undefined ? rest : { ...rest, distanceKm: distance };
}

// groups: donor blood groups to include ([] = any group)
// Returns available donors within radiusKm, nearest first.
export async function searchNearbyDonors({ latitude, longitude, radiusKm, groups = [] }) {
  try {
    // 1. A circle becomes a few geohash ranges (Firestore cannot query a radius directly)
    const bounds = geohashQueryBounds([latitude, longitude], radiusKm * 1000);

    // 2. Run the range queries at the same time
    const snapshots = await Promise.all(
      bounds.map((b) =>
        getDocs(query(collection(db, DONORS), orderBy('geohash'), startAt(b[0]), endAt(b[1])))
      )
    );

    // 3. Keep only donors that are really inside the circle and match the filters
    const myUid = auth.currentUser?.uid;
    const seen = new Set();
    const results = [];

    for (const snapshot of snapshots) {
      for (const d of snapshot.docs) {
        if (seen.has(d.id) || d.id === myUid) continue;
        seen.add(d.id);

        const data = d.data();
        if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') continue;

        const donor = donorFromDoc(d.id, data);
        if (!donor.available) continue; // unavailable or in cooldown
        if (groups.length > 0 && !groups.includes(donor.bloodGroup)) continue;

        const km = distanceKm(latitude, longitude, data.latitude, data.longitude);
        if (km > radiusKm) continue; // the geohash ranges are a bit larger than the circle

        results.push(publicDonor(donor, km));
      }
    }

    // 4. Nearest first
    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (error) {
    console.log('searchNearbyDonors failed:', error.code, error.message);
    throw new Error(friendlyMessage(error));
  }
}

// Manual fallback (no GPS): filter by dzongkhag and/or an area typed by the user.
// The donor's location is free text, so this checks whether it CONTAINS the text.
export async function searchByArea({ groups = [], dzongkhag = '', area = '' }) {
  try {
    const donorsRef = collection(db, DONORS);
    const q = groups.length > 0 ? query(donorsRef, where('bloodGroup', 'in', groups)) : donorsRef;
    const snapshot = await getDocs(q);

    const myUid = auth.currentUser?.uid;
    const wantedDzongkhag = normalize(dzongkhag);
    const wantedArea = normalize(area);

    return snapshot.docs
      .filter((d) => d.id !== myUid)
      .map((d) => donorFromDoc(d.id, d.data()))
      .filter((donor) => donor.available)
      .filter((donor) => {
        const location = normalize(donor.location);
        return (!wantedDzongkhag || location.includes(wantedDzongkhag)) &&
               (!wantedArea || location.includes(wantedArea));
      })
      .map((donor) => publicDonor(donor))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.log('searchByArea failed:', error.code, error.message);
    throw new Error(friendlyMessage(error));
  }
}