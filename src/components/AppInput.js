// src/components/AppInput.js
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../utils/theme';

export default function AppInput({ label, error, secureTextEntry, style, ...props }) {
  const [hidden, setHidden] = useState(true);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={isPassword && hidden}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setHidden(!hidden)}>
            <Text style={styles.toggle}>{hidden ? 'Show' : 'Hide'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  inputRowError: { borderColor: colors.error },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textPrimary },
  toggle: { color: colors.primary, fontWeight: '600', marginLeft: 8 },
  error: { color: colors.error, fontSize: 12, marginTop: 4 },
}); 