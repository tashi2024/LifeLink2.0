// src/components/DonorLocationCard.js
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import AppButton from './AppButton';
import { saveMyLocation, clearMyLocation } from '../services/donor/donorLocationService';
import { openLocationSettings } from '../services/location/locationService';
import { formatDate } from '../utils/dateUtils';
import { colors } from '../utils/theme';

export default function DonorLocationCard({ donor }) {
  const [busy, setBusy] = useState(false);
  const hasLocation = Boolean(donor.geohash);

  const showError = (error) => {
    if (error.type === 'blocked') {
      // Android will not ask again, so send the user to the settings page
      Alert.alert('Location is turned off', error.message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: openLocationSettings },
      ]);
    } else {
      Alert.alert('Could not save location', error.message);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await saveMyLocation();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () => {
    Alert.alert(
      'Remove location?',
      'You will no longer appear in "Near me" searches. People can still find you by Dzongkhag.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await clearMyLocation();
            } catch (error) {
              Alert.alert('Could not remove location', error.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>GPS location</Text>

      {hasLocation ? (
        <View>
          <Text style={styles.status}>Location saved</Text>
          {donor.locationUpdatedAt > 0 ? (
            <Text style={styles.hint}>Updated {formatDate(donor.locationUpdatedAt)}</Text>
          ) : null}
          <Text style={styles.hint}>
            Other users see only your approximate distance, never your coordinates.
          </Text>
          <AppButton
            title={busy ? 'Getting location...' : 'Update location'}
            variant="outline"
            onPress={handleSave}
            loading={busy}
            style={styles.button}
          />
          <AppButton variant="text" title="Remove my location" onPress={confirmRemove} disabled={busy} />
        </View>
      ) : (
        <View>
          <Text style={styles.text}>
            Save your location so people nearby can find you quickly in an emergency. Only an approximate
            position (about 1 km) is stored.
          </Text>
          <AppButton title="Use my current location" onPress={handleSave} loading={busy} style={styles.button} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  status: { fontSize: 16, fontWeight: '600', color: colors.success, marginBottom: 4 },
  text: { fontSize: 15, color: colors.textPrimary },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  button: { marginTop: 12 },
});