// src/services/notifications/notificationService.js
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { colors } from '../../utils/theme';

const PUSH_TOKENS = 'push_tokens';

// Android notification channels (the user can mute each one separately in phone settings)
export const CHANNELS = {
  EMERGENCY: 'emergency',
  RESPONSES: 'responses',
  REMINDERS: 'reminders',
};

// While the app is open, still show incoming notifications as a banner
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function createAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNELS.EMERGENCY, {
    name: 'Emergency blood requests',
    description: 'Urgent requests that match your blood group nearby',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 250, 400],
    lightColor: colors.primary,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.RESPONSES, {
    name: 'Donor responses',
    description: 'When a donor answers your blood request',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.REMINDERS, {
    name: 'Appointment reminders',
    description: 'Reminders before your donation appointments',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// Asks for permission (if needed) and gets this phone's Expo push token.
// Returns { status, token?, message? } where status is:
// 'granted' | 'denied' | 'blocked' | 'unsupported' | 'error'
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    return { status: 'unsupported', message: 'Push notifications only work on a real phone.' };
  }
  try {
    // Android 13+ shows the permission prompt only after a channel exists
    await createAndroidChannels();

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) {
      return permission.canAskAgain
        ? { status: 'denied', message: 'Notifications are off, so you will not receive emergency alerts.' }
        : { status: 'blocked', message: 'Notifications are blocked. Turn them on in your phone settings.' };
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return { status: 'error', message: 'Expo project ID is missing. Check extra.eas.projectId in app.json.' };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token };
  } catch (error) {
    console.log('registerForPushNotifications failed:', error.message);
    return { status: 'error', message: `Could not get a push token: ${error.message}` };
  }
}

// Saves this phone's token under the signed-in user: push_tokens/{uid}
export async function savePushToken(token) {
  const uid = auth.currentUser?.uid;
  if (!uid || !token) return;
  await setDoc(doc(db, PUSH_TOKENS, uid), {
    token,
    platform: Platform.OS,
    updatedAt: Date.now(),
  });
}

// Called on logout, so alerts for this user stop arriving on this phone. Never throws.
export async function unregisterPushToken() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await deleteDoc(doc(db, PUSH_TOKENS, uid));
  } catch (error) {
    console.log('unregisterPushToken failed:', error.code);
  }
}