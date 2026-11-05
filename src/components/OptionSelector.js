// src/components/OptionSelector.js
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../utils/theme';

export default function OptionSelector({ label, options, value, onChange, error }) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onChange(option)}
              activeOpacity={0.8}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 15, color: colors.textPrimary },
  chipTextSelected: { color: colors.white, fontWeight: '600' },
  error: { color: colors.error, fontSize: 12, marginTop: 2 },
}); 