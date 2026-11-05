// src/services/notifications/usePushNotifications.js
import { useEffect } from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications, savePushToken } from './notificationService';
import { navigateSoon } from '../../navigation/navigationRef';

// What happens when the user taps a notification
function handleTap(data) {
  if (!data) return;
  if (data.type === 'test') {
    Alert.alert('LifeLink test', 'You tapped the test notification.');
  } else if (data.type === 'new_request' && data.requestId) {
    navigateSoon('RequestDetail', { requestId: data.requestId });
  } else if (data.type === 'donor_response' && data.requestId) {
    navigateSoon('RequestResponses', { requestId: data.requestId });
  } else if (data.type === 'appointment_reminder' || data.type === 'appointment_reminder_test') {
    navigateSoon('Appointments');
  }
}

// Runs once after login: asks permission, saves the push token, and reacts to notifications
export default function usePushNotifications() {
  // The notification the user tapped most recently (also covers tapping it to launch the app from closed)
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await registerForPushNotifications();
      console.log('Push registration:', result.status);
      if (result.status === 'granted' && !cancelled) {
        console.log('Expo push token:', result.token);
        try {
          await savePushToken(result.token);
        } catch (error) {
          console.log('savePushToken failed:', error.code || error.message);
        }
      }
    })();

    // A notification arrived while the app was open
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content.title);
    });

    return () => {
      cancelled = true;
      receivedSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    handleTap(lastResponse.notification.request.content.data);
    Notifications.clearLastNotificationResponse(); // so the same tap is not handled twice
  }, [lastResponse]);
}