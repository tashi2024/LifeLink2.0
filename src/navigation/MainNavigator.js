// src/navigation/MainNavigator.js
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import DonorFormScreen from '../screens/donor/DonorFormScreen';
import RequestFormScreen from '../screens/requests/RequestFormScreen';
import RequestDetailScreen from '../screens/requests/RequestDetailScreen';
import RequestResponsesScreen from '../screens/requests/RequestResponsesScreen';
import AppointmentsScreen from '../screens/appointments/AppointmentsScreen';
import BookAppointmentScreen from '../screens/appointments/BookAppointmentScreen';
import DonorDetailScreen from '../screens/search/DonorDetailScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import InboxScreen from '../screens/settings/InboxScreen';
import DevToolsScreen from '../screens/settings/DevToolsScreen';
import usePushNotifications from '../services/notifications/usePushNotifications';
import useAppointmentReminders from '../services/notifications/useAppointmentReminders';
import { colors } from '../utils/theme';

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  // This navigator only exists while a user is logged in, so this setup runs once per login
  usePushNotifications();
  useAppointmentReminders();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
      }}
    >
      {/* The four tabs */}
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      {/* Screens that open on top of the tabs */}
      <Stack.Screen name="DonorForm" component={DonorFormScreen} options={{ title: 'Donor profile' }} />
      <Stack.Screen name="RequestForm" component={RequestFormScreen} options={{ title: 'Blood request' }} />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} options={{ title: 'Blood request' }} />
      <Stack.Screen name="RequestResponses" component={RequestResponsesScreen} options={{ title: 'Responses' }} />
      <Stack.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Appointments' }} />
      <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ title: 'Book appointment' }} />
      <Stack.Screen name="DonorDetail" component={DonorDetailScreen} options={{ title: 'Donor details' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My profile' }} />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: 'Inbox' }} />
      <Stack.Screen name="DevTools" component={DevToolsScreen} options={{ title: 'Developer tools' }} />
    </Stack.Navigator>
  );
}