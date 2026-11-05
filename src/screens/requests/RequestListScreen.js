// src/screens/requests/RequestListScreen.js
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { observeMyRequests, deleteRequest } from '../../services/requests/requestService';
import { formatDate } from '../../utils/dateUtils';
import { colors } from '../../utils/theme';

const URGENCY_COLORS = {
  Low: colors.success,
  Medium: colors.warning,
  High: '#E64A19',
  Critical: colors.primaryDark,
};

const STATUS_COLORS = {
  Open: colors.secondary,
  Fulfilled: colors.success,
  Cancelled: colors.textSecondary,
};

function RequestCard({ item, onEdit, onDelete, onResponses, deleting }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => onEdit(item)}>
      <View style={styles.cardTop}>
        <View style={styles.bloodBadge}>
          <Text style={styles.bloodBadgeText}>{item.bloodGroup}</Text>
        </View>
        <View style={styles.pills}>
          <View style={[styles.pill, { backgroundColor: URGENCY_COLORS[item.urgency] || colors.warning }]}>
            <Text style={styles.pillText}>{item.urgency}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: STATUS_COLORS[item.status] || colors.secondary }]}>
            <Text style={styles.pillText}>{item.status}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.line}>Location: {item.location}</Text>
      <Text style={styles.line}>Units needed: {item.quantity}</Text>
      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
      {typeof item.alertedCount === 'number' ? (
        <Text style={styles.alerted}>
          {item.alertedCount} nearby donor{item.alertedCount === 1 ? '' : 's'} alerted
        </Text>
      ) : null}
      <Text style={styles.date}>Created {formatDate(item.createdAt)}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onResponses(item)}>
          <Ionicons name="people-outline" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Responses</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(item)}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => onDelete(item)} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={colors.primary} />
          )}
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function RequestListScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Subscribe to this user's requests while the screen exists
  useEffect(() => {
    const unsubscribe = observeMyRequests(
      (list) => {
        setRequests(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        Alert.alert('Could not load requests', error.message);
      }
    );
    return unsubscribe;
  }, []);

  const confirmDelete = (item) => {
    Alert.alert('Delete request?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(item.id);
          try {
            await deleteRequest(item.id);
          } catch (error) {
            Alert.alert('Delete failed', error.message);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const openForm = (request) => navigation.navigate('RequestForm', request ? { request } : undefined);
  const openResponses = (request) => navigation.navigate('RequestResponses', { requestId: request.id });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard
            item={item}
            onEdit={openForm}
            onDelete={confirmDelete}
            onResponses={openResponses}
            deleting={deletingId === item.id}
          />
        )}
        contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No blood requests yet.{'\n'}Tap + to create one.</Text>
        }
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => openForm()}>
        <Ionicons name="add" size={32} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  listContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bloodBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodBadgeText: { color: colors.white, fontSize: 17, fontWeight: 'bold' },
  pills: { flexDirection: 'row' },
  pill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, marginLeft: 6 },
  pillText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  line: { fontSize: 15, color: colors.textPrimary, marginBottom: 3 },
  notes: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  alerted: { fontSize: 13, color: colors.secondary, marginTop: 6, fontWeight: '600' },
  date: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', marginLeft: 18, paddingVertical: 4 },
  actionText: { color: colors.primary, fontWeight: '600', marginLeft: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});