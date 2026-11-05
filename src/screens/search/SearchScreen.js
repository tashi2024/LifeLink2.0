// src/screens/search/SearchScreen.js
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { getCurrentCoords, openLocationSettings } from '../../services/location/locationService';
import { searchNearbyDonors, searchByArea } from '../../services/donor/nearbyDonorService';
import AppInput from '../../components/AppInput';
import AppButton from '../../components/AppButton';
import OptionSelector from '../../components/OptionSelector';
import SelectField from '../../components/SelectField';
import DonorResultCard from '../../components/DonorResultCard';
import { BLOOD_GROUPS } from '../../utils/constants';
import { DZONGKHAGS } from '../../utils/dzongkhags';
import { compatibleDonorGroups } from '../../utils/bloodCompatibility';
import { callNumber } from '../../utils/contact';
import { colors } from '../../utils/theme';

const GROUP_OPTIONS = ['Any', ...BLOOD_GROUPS];
const RADIUS_OPTIONS = ['1 km', '5 km', '10 km', '25 km'];
const ANY_DZONGKHAG = 'Any dzongkhag';
const AREA_OPTIONS = [ANY_DZONGKHAG, ...DZONGKHAGS];

export default function SearchScreen({ navigation }) {
  const [mode, setMode] = useState('near'); // 'near' (GPS) or 'area' (manual)
  const [group, setGroup] = useState('Any');
  const [includeCompatible, setIncludeCompatible] = useState(true);
  const [radiusLabel, setRadiusLabel] = useState('10 km');
  const [dzongkhag, setDzongkhag] = useState(ANY_DZONGKHAG);
  const [area, setArea] = useState('');

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // { message, type }
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearch, setLastSearch] = useState({ mode: 'near', radiusKm: 10, ms: 0 });

  const radiusKm = parseInt(radiusLabel, 10);

  // Which donor blood groups to look for ([] means any)
  const wantedGroups = () => {
    if (group === 'Any') return [];
    return includeCompatible ? compatibleDonorGroups(group) : [group];
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setResults([]);
    setError(null);
    setHasSearched(false);
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      let found;
      let started;
      if (mode === 'near') {
        const coords = await getCurrentCoords(); // may throw a LocationError
        started = Date.now(); // time only the database search, not the GPS wait
        found = await searchNearbyDonors({ ...coords, radiusKm, groups: wantedGroups() });
      } else {
        started = Date.now();
        found = await searchByArea({
          groups: wantedGroups(),
          dzongkhag: dzongkhag === ANY_DZONGKHAG ? '' : dzongkhag,
          area,
        });
      }
      const ms = Date.now() - started;
      console.log(`Search (${mode}) found ${found.length} donors in ${ms} ms`);
      setLastSearch({ mode, radiusKm, ms });
      setResults(found);
    } catch (e) {
      setError({ message: e.message, type: e.type });
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const header = (
    <View>
      {/* Mode switch */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'near' && styles.modeButtonActive]}
          onPress={() => switchMode('near')}
        >
          <Text style={[styles.modeText, mode === 'near' && styles.modeTextActive]}>Near me</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'area' && styles.modeButtonActive]}
          onPress={() => switchMode('area')}
        >
          <Text style={[styles.modeText, mode === 'area' && styles.modeTextActive]}>By area</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <OptionSelector label="Blood group needed" options={GROUP_OPTIONS} value={group} onChange={setGroup} />

        {group !== 'Any' ? (
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Include compatible groups</Text>
              <Text style={styles.hint}>
                {includeCompatible
                  ? `Searching: ${compatibleDonorGroups(group).join(', ')}`
                  : `Exact match only: ${group}`}
              </Text>
            </View>
            <Switch
              value={includeCompatible}
              onValueChange={setIncludeCompatible}
              trackColor={{ true: colors.primaryLight, false: colors.border }}
              thumbColor={includeCompatible ? colors.primary : '#f4f3f4'}
            />
          </View>
        ) : null}

        {mode === 'near' ? (
          <View>
            <OptionSelector label="Search radius" options={RADIUS_OPTIONS} value={radiusLabel} onChange={setRadiusLabel} />
            <AppButton title="Find nearby donors" onPress={handleSearch} loading={loading} />
          </View>
        ) : (
          <View>
            <SelectField label="Dzongkhag" value={dzongkhag} options={AREA_OPTIONS} onChange={setDzongkhag} />
            <AppInput
              label="Area or town (optional)"
              value={area}
              onChangeText={setArea}
              placeholder="e.g. Babesa"
              autoCapitalize="none"
            />
            <AppButton title="Search" onPress={handleSearch} loading={loading} />
          </View>
        )}
      </View>

      {hasSearched && !loading && !error && results.length > 0 ? (
        <Text style={styles.count}>
          {results.length} available donor{results.length === 1 ? '' : 's'}
          {lastSearch.mode === 'near' ? ` within ${lastSearch.radiusKm} km` : ' found'} ·{' '}
          {(lastSearch.ms / 1000).toFixed(1)} s
        </Text>
      ) : null}
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />;
    }

    if (error) {
      return (
        <View style={styles.message}>
          <Text style={styles.messageTitle}>
            {mode === 'near' ? 'Could not search nearby' : 'Something went wrong'}
          </Text>
          <Text style={styles.messageText}>{error.message}</Text>
          {error.type === 'blocked' ? (
            <AppButton title="Open settings" onPress={openLocationSettings} style={styles.messageButton} />
          ) : null}
          <AppButton title="Retry" variant="outline" onPress={handleSearch} style={styles.messageButton} />
          {mode === 'near' ? (
            <AppButton variant="text" title="Search by area instead" onPress={() => switchMode('area')} />
          ) : null}
        </View>
      );
    }

    if (!hasSearched) {
      return (
        <View style={styles.message}>
          <Text style={styles.messageText}>
            {mode === 'near'
              ? 'Choose a blood group and radius, then tap Find nearby donors.'
              : 'Choose a blood group and area, then tap Search.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.message}>
        <Text style={styles.messageTitle}>No donors found</Text>
        <Text style={styles.messageText}>
          {lastSearch.mode === 'near'
            ? `No available donors within ${lastSearch.radiusKm} km. Try a larger radius or search by area.`
            : 'Try different filters.'}
        </Text>
        {lastSearch.mode === 'near' ? (
          <AppButton title="Search by area" variant="outline" onPress={() => switchMode('area')} style={styles.messageButton} />
        ) : null}
      </View>
    );
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={loading || error ? [] : results}
      keyExtractor={(item) => item.uid}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={renderEmpty}
      renderItem={({ item }) => (
        <DonorResultCard
          donor={item}
          onCall={(d) => callNumber(d.contactNumber)}
          onDetails={(d) => navigation.navigate('DonorDetail', { donor: d })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  modeButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  modeButtonActive: { backgroundColor: colors.primary },
  modeText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  modeTextActive: { color: colors.white },
  filters: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  switchText: { flex: 1, paddingRight: 12 },
  switchTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  count: { fontSize: 14, color: colors.textSecondary, marginBottom: 10 },
  spinner: { marginTop: 32 },
  message: { alignItems: 'center', padding: 16 },
  messageTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 6 },
  messageText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  messageButton: { alignSelf: 'stretch', marginBottom: 8 },
});