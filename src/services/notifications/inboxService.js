// src/services/notifications/inboxService.js
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { friendlyMessage } from '../auth/authService';

function inboxRef(uid) {
  return collection(db, 'users', uid, 'inbox');
}

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be logged in.');
  return uid;
}

// Adds an inbox item to each user's inbox.
// items: [{ uid, type, title, body, requestId? }]  (type: 'new_request' | 'donor_response' | 'reminder')
export async function addInboxItems(items) {
  const senderUid = requireUid();
  const now = Date.now();
  for (let i = 0; i < items.length; i += 400) { // Firestore allows 500 writes per batch
    const batch = writeBatch(db);
    items.slice(i, i + 400).forEach((item) => {
      const record = {
        type: item.type,
        title: item.title,
        body: item.body,
        senderUid,
        createdAt: now,
        read: false,
      };
      if (item.requestId) record.requestId = item.requestId;
      batch.set(doc(inboxRef(item.uid)), record); // doc() with no id creates a new unique id
    });
    await batch.commit();
  }
}

// Live list of my 50 newest inbox items
export function observeMyInbox(onChange, onError) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onChange([]);
    return () => {};
  }
  const q = query(inboxRef(uid), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.log('observeMyInbox failed:', error.code);
      if (onError) onError(new Error(friendlyMessage(error)));
    }
  );
}

// Live count of unread items (for the bell badge)
export function observeUnreadCount(onChange) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onChange(0);
    return () => {};
  }
  const q = query(inboxRef(uid), where('read', '==', false));
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.size),
    (error) => {
      console.log('observeUnreadCount failed:', error.code);
      onChange(0);
    }
  );
}

export async function markRead(itemId) {
  const uid = requireUid();
  await updateDoc(doc(db, 'users', uid, 'inbox', itemId), { read: true });
}

export async function markAllRead() {
  const uid = requireUid();
  try {
    const snapshot = await getDocs(query(inboxRef(uid), where('read', '==', false), limit(400)));
    if (snapshot.empty) return;
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (error) {
    console.log('markAllRead failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}

export async function deleteInboxItem(itemId) {
  const uid = requireUid();
  try {
    await deleteDoc(doc(db, 'users', uid, 'inbox', itemId));
  } catch (error) {
    console.log('deleteInboxItem failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}