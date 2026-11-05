// src/navigation/MainTabs.js
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/home/HomeScreen';
import DonorScreen from '../screens/donor/DonorScreen';
import RequestListScreen from '../screens/requests/RequestListScreen';
import SearchScreen from '../screens/search/SearchScreen';
import InboxBell from '../components/InboxBell';
import { colors } from '../utils/theme';

const Tab = createBottomTabNavigator();

// Icon names for each tab: [selected, not selected]
const ICONS = {
  Home: ['home', 'home-outline'],
  Donor: ['water', 'water-outline'],
  Requests: ['medkit', 'medkit-outline'],
  Search: ['search', 'search-outline'],
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerLeft: () => <InboxBell />, // notification bell with unread count, on every tab
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Donor" component={DonorScreen} options={{ title: 'Donor profile' }} />
      <Tab.Screen name="Requests" component={RequestListScreen} options={{ title: 'My requests' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Find donors' }} />
    </Tab.Navigator>
  );
}