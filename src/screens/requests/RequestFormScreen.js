// src/screens/requests/RequestFormScreen.js
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { createRequest, updateRequest } from '../../services/requests/requestService';
import { alertNearbyDonors } from '../../services/notifications/requestAlertService';
import { getCurrentCoords, roundCoord } from '../../services/location/locationService';
import AppInput from '../../components/AppInput';
import AppButton from '../../components/AppButton';
import OptionSelector from '../../components/OptionSelector';
import { BLOOD_GROUPS, REQUEST_STATUSES, URGENCY_LEVELS } from '../../utils/constants';
import { colors } from '../../utils/theme';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Turns the alert result into one sentence for the user
function describeAlerts(summary) {
  if (summary.eligible === 0) return 'No eligible donors were found nearby.';
  if (summary.inboxed === 0 && summary.sent === 0) {
    return `${plural(summary.eligible, 'eligible donor')} found, but the alerts could not be delivered.`;
  }
  let text = `${plural(summary.eligible, 'eligible donor')} nearby, ${summary.sent} notified by push.`;
  if (summary.inboxed > 0 && summary.sent < summary.eligible) {
    text += ' The others will see it in their in-app inbox.';
  }
  return text;
}

// Asks whether to save when the GPS is not available. Resolves true (save) or false (cancel).
function confirmWithoutAlerts(reason) {
  return new Promise((resolve) => {
    Alert.alert(
      'Could not get your location',
      `${reason}\n\nSave the request without alerting nearby donors?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Save without alerts', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export default function RequestFormScreen({ navigation, route }) {
  const existing = route.params?.request; // present when editing, absent when creating
  const isEdit = Boolean(existing);

  const [bloodGroup, setBloodGroup] = useState(existing?.bloodGroup ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [urgency, setUrgency] = useState(existing?.urgency ?? 'Medium');
  const [quantity, setQuantity] = useState(String(existing?.quantity ?? 1));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'Open');
  const [alertDonors, setAlertDonors] = useState(true);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit blood request' : 'New blood request' });
  }, [navigation, isEdit]);

  const validate = () => {
    const newErrors = {};
    const units = Number(quantity);
    if (!bloodGroup) newErrors.bloodGroup = 'Select the blood group needed.';
    if (!location.trim()) newErrors.location = 'Location is required.';
    if (!Number.isInteger(units) || units < 1) newErrors.quantity = 'Enter a whole number of 1 or more.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const data = { bloodGroup, location, urgency, quantity: Number(quantity), notes };
    try {
      // Editing: just save (no alerts are sent for edits)
      if (isEdit) {
        await updateRequest(existing.id, { ...data, status });
        Alert.alert('Saved', 'Request saved.');
        navigation.goBack();
        return;
      }

      // New request: get the GPS position first, so nearby donors can be alerted
      let coords = null;
      if (alertDonors) {
        try {
          const position = await getCurrentCoords();
          coords = { latitude: roundCoord(position.latitude), longitude: roundCoord(position.longitude) };
        } catch (error) {
          const proceed = await confirmWithoutAlerts(error.message);
          if (!proceed) return; // the user cancelled, so nothing is saved
        }
      }

      const requestId = await createRequest({ ...data, ...(coords ?? {}) });

      let message = 'Request saved.';
      if (coords) {
        try {
          const summary = await alertNearbyDonors({ requestId, ...data, ...coords });
          message = `Request saved. ${describeAlerts(summary)}`;
        } catch (error) {
          // The request itself is safe, only the alerts failed
          message = `Request saved, but alerts could not be sent: ${error.message}`;
        }
      }
      Alert.alert('Saved', message);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <OptionSelector
          label="Blood group needed"
          options={BLOOD_GROUPS}
          value={bloodGroup}
          onChange={setBloodGroup}
          error={errors.bloodGroup}
        />

        <AppInput
          label="Location (hospital / area)"
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. JDWNRH, Thimphu"
          error={errors.location}
        />

        <OptionSelector label="Urgency" options={URGENCY_LEVELS} value={urgency} onChange={setUrgency} />

        <AppInput
          label="Quantity (units)"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          error={errors.quantity}
        />

        <AppInput
          label="Additional notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Patient condition, ward, contact person..."
          multiline
          numberOfLines={3}
          style={styles.notesField}
        />

        {/* Alerts are only offered for new requests */}
        {!isEdit ? (
          <View style={styles.switchCard}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Alert nearby donors</Text>
              <Text style={styles.hint}>
                Uses your current GPS position as the patient location and notifies compatible, available donors
                close by. Only an approximate position (about 1 km) is saved.
              </Text>
            </View>
            <Switch
              value={alertDonors}
              onValueChange={setAlertDonors}
              trackColor={{ true: colors.primaryLight, false: colors.border }}
              thumbColor={alertDonors ? colors.primary : '#f4f3f4'}
            />
          </View>
        ) : null}

        {/* Status can only be changed when editing, new requests always start as Open */}
        {isEdit ? <OptionSelector label="Status" options={REQUEST_STATUSES} value={status} onChange={setStatus} /> : null}

        <AppButton title="Save request" onPress={handleSave} loading={saving} style={styles.save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  notesField: { minHeight: 80 },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  switchText: { flex: 1, paddingRight: 12 },
  switchTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  save: { marginTop: 8, marginBottom: 24 },
});