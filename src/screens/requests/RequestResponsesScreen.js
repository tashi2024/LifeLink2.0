// src/screens/requests/RequestResponsesScreen.js
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { observeRequest, observeResponses } from '../../services/requests/responseService';
import AppButton from '../../components/AppButton';
import { callNumber } from '../../utils/contact';
import { formatDate } from '../../utils/dateUtils';
import { colors } from '../../utils/theme';

function formatTime(ms) {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(ms)}, ${hh}:${mm}`;
}

function ResponseCard({ item }) {
  const accepted = item.status === 'accepted';
  return (
    <View style={[styles.card, !accepted && styles.cardMuted]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitle}>
          <Text style={styles.name}>{item.donorName}</Text>
          <Text style={styles.group}>{item.bloodGroup}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: accepted ? colors.success : colors.textSecondary }]}>
          <Text style={styles.pillText}>{accepted ? 'Can donate' : 'Not available'}</Text>
        </View>
      </View>
      <Text style={styles.time}>Answered {formatTime(item.respondedAt)}</Text>
      {accepted && item.contactNumber ? (
        <View>
          <Text style={styles.line}>Contact: {item.contactNumber}</Text>
          <AppButton title="Call donor" onPress={() => callNumber(item.contactNumber)} style={styles.call} />
        </View>
      ) : null}
    </View>
  );
}

export default function RequestResponsesScreen({ route }) {
  const requestId = route.params?.requestId;
  const [request, setRequest] = useState(undefined); // undefined = loading, null = not found
  const [responses, setResponses] = useState(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setResponses([]);
      return undefined;
    }
    const stopRequest = observeRequest(requestId, setRequest, (e) => {
      setRequest(null);
      setError(e.message);
    });
    const stopResponses = observeResponses(requestId, setResponses, (e) => {
      setResponses([]);
      setError(e.message);
    });
    return () => {
      stopRequest();
      stopResponses();
    };
  }, [requestId]);

  if (request === undefined || responses === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (request === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{error ? 'Something went wrong' : 'Request not found'}</Text>
        <Text style={styles.emptyText}>{error || 'This request no longer exists.'}</Text>
      </View>
    );
  }

  const canDonate = responses.filter((r) => r.status === 'accepted').length;
  const notAvailable = responses.length - canDonate;

  const header = (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <View style={styles.bloodBadge}>
          <Text style={styles.bloodBadgeText}>{request.bloodGroup}</Text>
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryTitle}>{request.location}</Text>
          <Text style={styles.summarySub}>
            {request.urgency} · {request.quantity} unit{request.quantity === 1 ? '' : 's'} · {request.status}
          </Text>
        </View>
      </View>
      <Text style={styles.counts}>
        {canDonate} can donate · {notAvailable} not available
      </Text>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={responses}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          No answers yet. You will get a notification when a donor responds.
        </Text>
      }
      renderItem={({ item }) => <ResponseCard item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginBottom: 6 },
  emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bloodBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodBadgeText: { color: colors.white, fontSize: 17, fontWeight: 'bold' },
  summaryText: { flex: 1, marginLeft: 14 },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  summarySub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  counts: { fontSize: 15, fontWeight: '600', color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMuted: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { flex: 1, paddingRight: 8 },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  group: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
  pill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14 },
  pillText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  time: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  line: { fontSize: 15, color: colors.textPrimary, marginTop: 8 },
  call: { marginTop: 10 },
});