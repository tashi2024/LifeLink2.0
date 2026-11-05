// src/screens/donor/DonorFormScreen.js
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { saveDonor } from '../../services/donor/donorService';
import AppInput from '../../components/AppInput';
import AppButton from '../../components/AppButton';
import OptionSelector from '../../components/OptionSelector';
import { BLOOD_GROUPS } from '../../utils/constants';
import { isValidPhone } from '../../utils/validation';
import { colors } from '../../utils/theme';

export default function DonorFormScreen({ navigation, route }) {
  const { profile } = useAuth();
  const existing = route.params?.donor; // present when editing, absent when registering
  const isEdit = Boolean(existing);

  // When registering, pre-fill name and phone from the account profile
  const [name, setName] = useState(existing?.name ?? profile?.name ?? '');
  const [bloodGroup, setBloodGroup] = useState(existing?.bloodGroup ?? '');
  const [contactNumber, setContactNumber] = useState(existing?.contactNumber ?? profile?.phone ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit donor profile' : 'Register as donor' });
  }, [navigation, isEdit]);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Enter your full name.';
    if (!bloodGroup) newErrors.bloodGroup = 'Select your blood group.';
    if (!isValidPhone(contactNumber)) newErrors.contactNumber = 'Enter an 8-digit phone number.';
    if (!location.trim()) newErrors.location = 'Enter your location (city or area).';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // New donors start as available. Editing never touches availability or the cooldown.
      await saveDonor({
        name,
        bloodGroup,
        contactNumber,
        location,
        ...(isEdit ? {} : { available: true }),
      });
      Alert.alert('Saved', 'Donor profile saved.');
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
        <AppInput label="Full name" value={name} onChangeText={setName} placeholder="Your name" error={errors.name} />

        <OptionSelector
          label="Blood group"
          options={BLOOD_GROUPS}
          value={bloodGroup}
          onChange={setBloodGroup}
          error={errors.bloodGroup}
        />

        <AppInput
          label="Contact number"
          value={contactNumber}
          onChangeText={setContactNumber}
          placeholder="17123456"
          keyboardType="phone-pad"
          error={errors.contactNumber}
        />

        <AppInput
          label="Location (city / area)"
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Thimphu"
          error={errors.location}
        />

        <AppButton title="Save donor profile" onPress={handleSave} loading={saving} style={styles.save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  save: { marginTop: 8, marginBottom: 24 },
});