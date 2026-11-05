// src/components/DonorResultCard.js
import { StyleSheet, Text, View } from 'react-native';
import AppButton from './AppButton';
import { formatDistance } from '../utils/geo';
import { colors } from '../utils/theme';

export default function DonorResultCard({ donor, onCall, onDetails }) {
  const hasDistance = typeof donor.distanceKm === 'number';

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.title}>
          <Text style={styles.name}>{donor.name}</Text>
          <Text style={styles.group}>{donor.bloodGroup}</Text>
        </View>
        <View style={styles.pills}>
          {hasDistance ? (
            <View style={styles.distancePill}>
              <Text style={styles.pillText}>{formatDistance(donor.distanceKm)}</Text>
            </View>
          ) : null}
          <View style={styles.availablePill}>
            <Text style={styles.pillText}>Available</Text>
          </View>
        </View>
      </View>

      <Text style={styles.line}>Location: {donor.location}</Text>
      <Text style={styles.line}>Contact: {donor.contactNumber}</Text>

      <View style={styles.buttons}>
        <AppButton title="Call" onPress={() => onCall(donor)} style={styles.buttonHalf} />
        <AppButton title="View details" variant="outline" onPress={() => onDetails(donor)} style={styles.buttonHalf} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { flex: 1, paddingRight: 8 },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  group: { fontSize: 20, fontWeight: 'bold', color: colors.primary },
  pills: { alignItems: 'flex-end' },
  distancePill: { backgroundColor: colors.secondary, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4 },
  availablePill: { backgroundColor: colors.success, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14 },
  pillText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  line: { fontSize: 15, color: colors.textPrimary, marginBottom: 3 },
  buttons: { flexDirection: 'row', marginTop: 12 },
  buttonHalf: { flex: 1, marginHorizontal: 4 },
});