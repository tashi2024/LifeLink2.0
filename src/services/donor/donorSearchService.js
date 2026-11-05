// src/services/donor/donorSearchService.js
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';
import { donorFromDoc } from './donorService';

const DONORS = 'donors';

// "  Thimphu " -> "thimphu"
function normalize(text) {
  return (text ?? '').trim().toLowerCase();
}

// bloodGroup: '' means any group. location: '' means any location.
// Returns available donors, sorted by name.
export async function searchDonors({ bloodGroup = '', location = '' } = {}) {
  try {
    const donorsRef = collection(db, DONORS);
    // Only the blood group goes to Firestore (a single-field query needs no index)
    const q = bloodGroup ? query(donorsRef, where('bloodGroup', '==', bloodGroup)) : donorsRef;
    const snapshot = await getDocs(q);

    const wanted = normalize(location);
    return snapshot.docs
      .map((d) => donorFromDoc(d.id, d.data()))
      .filter((donor) => donor.available) // hide unavailable donors
      .filter((donor) => !wanted || normalize(donor.location).includes(wanted)) // case-insensitive "contains"
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.log('searchDonors failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
} 