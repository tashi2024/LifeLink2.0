// src/screens/settings/InboxScreen.js
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  deleteInboxItem,
  markAllRead,
  markRead,
  observeMyInbox,
} from '../../services/notifications/inboxService';
import AppButton from '../../components/AppButton';
import { formatDateTime } from '../../utils/dateUtils';
import { colors } from '../../utils/theme';

const ICONS = {
  new_request: 'water',
  donor_response: 'people',
  reminder: 'alarm',
};

export default function InboxScreen({ navigation }) {
  const [items, setItems] = useState(undefined); // undefined = loading
  const [error, setError] = useState('');

  useEffect(
    () =>
      observeMyInbox(setItems, (e) => {
        setError(e.message);
        setItems([]);
      }),
    []
  );

  const unread = (items ?? []).filter((item) => !item.read).length;

  const openItem = (item) => {
    if (!item.read) markRead(item.id).catch((e) => console.log('markRead failed:', e.code));
    if (item.type === 'new_request' && item.requestId) {
      navigation.navigate('RequestDetail', { requestId: item.requestId });
    } else if (item.type === 'donor_response' && item.requestId) {
      navigation.navigate('RequestResponses', { requestId: item.requestId });
    }
  };

  const removeItem = (item) =>
    deleteInboxItem(item.id).catch((e) => Alert.alert('Could not delete', e.message));

  const readAll = () => markAllRead().catch((e) => Alert.alert('Could not update', e.message));

  if (items === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        unread > 0 ? (
          <AppButton
            variant="outline"
            title={`Mark all ${unread} as read`}
            onPress={readAll}
            style={styles.markAll}
          />
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{error ? 'Something went wrong' : 'No notifications yet'}</Text>
          <Text style={styles.emptyText}>
            {error || 'Blood request alerts and donor responses will appear here.'}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, !item.read && styles.cardUnread]}
          activeOpacity={0.85}
          onPress={() => openItem(item)}
        >
          <View style={styles.icon}>
            <Ionicons name={ICONS[item.type] || 'notifications'} size={22} color={colors.white} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
          </View>
          <TouchableOpacity onPress={() => removeItem(item)} style={styles.delete} accessibilityLabel="Delete">
            <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  markAll: { marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { borderColor: colors.primary, borderWidth: 1.5 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, color: colors.textPrimary },
  titleUnread: { fontWeight: 'bold' },
  body: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  time: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  delete: { padding: 8 },
});