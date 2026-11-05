// src/context/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/firebaseConfig';
import * as authService from '../services/auth/authService';
import { unregisterPushToken } from '../services/notifications/notificationService';
import { cancelAppointmentReminders } from '../services/notifications/appointmentReminders';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);          // Firebase user or null
  const [profile, setProfile] = useState(null);    // users/{uid} document
  const [initializing, setInitializing] = useState(true); // true until the first check finishes

  // Firebase calls this on app start (restoring a saved session) and on every login/logout
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setProfile(await authService.getUserProfile(firebaseUser.uid));
      } else {
        setProfile(null);
      }
      setInitializing(false);
    });
    return unsubscribe; // stop listening when the app closes
  }, []);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      setProfile(await authService.getUserProfile(auth.currentUser.uid));
    }
  };

  const signUp = async (data) => {
    const newUser = await authService.signUp(data);
    await refreshProfile(); // the profile document is written just after the account is created
    return newUser;
  };

  const logout = async () => {
    await unregisterPushToken();        // stop alerts for this user on this phone (never blocks logout)
    await cancelAppointmentReminders(); // remove this user's scheduled reminders from this phone
    await authService.logout();
  };

  const value = {
    user,
    profile,
    initializing,
    refreshProfile,
    signUp,
    login: authService.login,
    logout,
    resetPassword: authService.resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Any screen can call: const { user, login, logout } = useAuth();
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}