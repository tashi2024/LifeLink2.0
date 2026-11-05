// src/utils/session.js
import { Alert } from 'react-native';

// Shows "Are you sure?" and logs out only if the user confirms
export function confirmLogout(logout) {
  Alert.alert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: () => logout() },
  ]);
}