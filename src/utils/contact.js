// src/utils/contact.js
import { Alert, Linking } from 'react-native';

// Opens the phone dialer with the number filled in
export async function callNumber(number) {
  const cleaned = (number ?? '').replace(/[^\d+]/g, ''); // keep digits and +
  if (!cleaned) {
    Alert.alert('No phone number', 'This donor has no contact number.');
    return;
  }
  try {
    await Linking.openURL(`tel:${cleaned}`);
  } catch (error) {
    Alert.alert('Cannot open dialer', 'Your device could not open the phone app.');
  }
}