// src/components/InboxBell.js
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { observeUnreadCount } from '../services/notifications/inboxService';
import { colors } from '../utils/theme';

// Bell icon for the header, with the number of unread inbox items
export default function InboxBell() {
  const navigation = useNavigation();
  const [count, setCount] = useState(0);

  useEffect(() => observeUnreadCount(setCount), []);

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Inbox')}
      style={styles.button}
      accessibilityLabel="Notification inbox"
    >
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={26} color={colors.white} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { marginLeft: 16, padding: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: 'bold' },
});