// src/screens/auth/RegisterScreen.js
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import AppInput from '../../components/AppInput';
import AppButton from '../../components/AppButton';
import { colors } from '../../utils/theme';
import { isValidEmail, isValidPhone } from '../../utils/validation';

export default function RegisterScreen({ navigation }) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Enter your full name.';
    if (!isValidEmail(email)) newErrors.email = 'Enter a valid email address.';
    if (!isValidPhone(phone)) newErrors.phone = 'Enter an 8-digit phone number.';
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters.';
    if (confirm !== password) newErrors.confirm = 'Passwords do not match.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp({ name, email, phone, password });
      // On success the app switches to the main screens automatically
    } catch (error) {
      setLoading(false);
      Alert.alert('Sign up failed', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join LifeLink to donate or request blood</Text>

          <AppInput label="Full name" placeholder="Your name" value={name} onChangeText={setName} error={errors.name} />
          <AppInput
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
          />
          <AppInput
            label="Phone number"
            placeholder="17123456"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            error={errors.phone}
          />
          <AppInput
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            error={errors.password}
          />
          <AppInput
            label="Confirm password"
            placeholder="Type the password again"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            error={errors.confirm}
          />

          <AppButton title="Sign up" onPress={handleRegister} loading={loading} style={styles.mainButton} />
          <AppButton variant="text" title="Already have an account? Log in" onPress={() => navigation.goBack()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.primary, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  mainButton: { marginTop: 8 },
});