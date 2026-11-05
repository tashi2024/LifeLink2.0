// src/services/auth/authService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

const USERS = 'users'; // same collection name as Project I

// Turns Firebase error codes into messages a normal user can understand
export function friendlyMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/email-already-in-use':
      return 'That email is already registered.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in the Firebase Console.';
    case 'permission-denied':
      return 'Firestore permission denied. Check your database rules.';
    case 'unavailable':
      return 'Firestore is unavailable. Check your internet connection.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
}

// Create account, then save the profile in users/{uid}
export async function signUp({ name, email, phone, password }) {
  let user;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    user = credential.user;
  } catch (error) {
    console.log('Signup failed:', error.code);
    throw new Error(friendlyMessage(error));
  }

  // Like Project I: if saving the profile fails, the account still exists
  try {
    await setDoc(doc(db, USERS, user.uid), {
      uid: user.uid,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
  } catch (error) {
    console.log('Profile save failed after signup:', error.code);
  }
  return user;
}

export async function login(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return credential.user;
  } catch (error) {
    console.log('Login failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}

export async function logout() {
  await signOut(auth);
}

// New in Project II: sends a password reset email
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    console.log('Password reset failed:', error.code);
    throw new Error(friendlyMessage(error));
  }
}

// Reads users/{uid}. Returns null if missing or unreadable.
export async function getUserProfile(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, USERS, uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  } catch (error) {
    console.log('getUserProfile failed:', error.code);
    return null;
  }
}