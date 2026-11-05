// src/screens/settings/DevToolsScreen.js  (TESTING ONLY)
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db } from '../../services/firebase/firebaseConfig';
import { getCurrentCoords, roundCoord } from '../../services/location/locationService';
import { donorFromDoc } from '../../services/donor/donorService';
import { searchNearbyDonors } from '../../services/donor/nearbyDonorService';
import AppButton from '../../components/AppButton';
import { BLOOD_GROUPS } from '../../utils/constants';
import { DAY_MS } from '../../utils/donorAvailability';
import { distanceKm } from '../../utils/geo';
import { compatibleDonorGroups } from '../../utils/bloodCompatibility';
import { colors } from '../../utils/theme';

const SEED_PREFIX = 'seed_';
const AREAS = ['Thimphu', 'Paro', 'Chhukha', 'Punakha'];
const NO_GPS_COUNT = 10;
// How many fake donors to place in each distance band (km from you)
const BANDS = [
  { min: 0.2, max: 1, count: 12 },
  { min: 1, max: 5, count: 24 },
  { min: 5, max: 10, count: 30 },
  { min: 10, max: 25, count: 36 },
  { min: 25, max: 45, count: 18 },
];

const randomBetween = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// A point `km` kilometres away from `center` in the direction `bearing` (radians)
function pointAt(center, km, bearing) {
  const dLat = (km * Math.cos(bearing)) / 111.32;
  const dLon = (km * Math.sin(bearing)) / (111.32 * Math.cos((center.latitude * Math.PI) / 180));
  return { latitude: center.latitude + dLat, longitude: center.longitude + dLon };
}

function generateDonors(center) {
  const now = Date.now();
  const donors = [];
  let n = 0;

  const makeDonor = (extra) => {
    n += 1;
    const number = String(n).padStart(3, '0');
    const r = Math.random();
    let status;
    if (r < 0.1) status = { available: false, lastDonationDate: 0, nextEligibleDate: 0 }; // switched off
    else if (r < 0.18) status = { available: false, lastDonationDate: now - 10 * DAY_MS, nextEligibleDate: now + 80 * DAY_MS }; // cooldown
    else status = { available: true, lastDonationDate: 0, nextEligibleDate: 0 };

    return {
      uid: `${SEED_PREFIX}${number}`,
      name: `Test Donor ${number}`,
      bloodGroup: pick(BLOOD_GROUPS),
      contactNumber: `17${Math.floor(100000 + Math.random() * 900000)}`,
      location: `Seed area ${1 + Math.floor(Math.random() * 5)}, ${pick(AREAS)}`,
      ...status,
      ...extra,
    };
  };

  // Donors with GPS, placed in distance bands
  BANDS.forEach((band) => {
    for (let i = 0; i < band.count; i += 1) {
      const point = pointAt(center, randomBetween(band.min, band.max), Math.random() * 2 * Math.PI);
      const latitude = roundCoord(point.latitude); // same rounding as real donors
      const longitude = roundCoord(point.longitude);
      donors.push(
        makeDonor({
          latitude,
          longitude,
          geohash: geohashForLocation([latitude, longitude]),
          locationUpdatedAt: now,
        })
      );
    }
  });

  // Donors without GPS (only findable through "By area")
  for (let i = 0; i < NO_GPS_COUNT; i += 1) donors.push(makeDonor({}));

  return donors;
}

export default function DevToolsScreen() {
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);

  const addLog = (line) => setLog((previous) => [...previous, line]);

  // Runs a task: disables buttons meanwhile and reports any error
  const run = async (task) => {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      addLog(`ERROR: ${error.message}`);
      Alert.alert('Something went wrong', error.message);
    } finally {
      setBusy(false);
    }
  };

  const seed = () =>
    run(async () => {
      addLog('Getting your GPS position...');
      const center = await getCurrentCoords();
      const donors = generateDonors(center);
      addLog(`Writing ${donors.length} donors...`);
      for (let i = 0; i < donors.length; i += 200) {
        const batch = writeBatch(db);
        donors.slice(i, i + 200).forEach((d) => batch.set(doc(db, 'donors', d.uid), d));
        await batch.commit();
      }
      addLog(`Done: ${donors.length} test donors created (${donors.length - NO_GPS_COUNT} with GPS, ${NO_GPS_COUNT} without).`);
    });

  const verify = () =>
    run(async () => {
      addLog('--- Verify GPS search ---');
      const center = await getCurrentCoords();
      const snapshot = await getDocs(collection(db, 'donors'));
      const seeds = snapshot.docs
        .filter((d) => d.id.startsWith(SEED_PREFIX))
        .map((d) => ({ data: d.data(), donor: donorFromDoc(d.id, d.data()) }));

      if (seeds.length === 0) {
        addLog('No test donors found. Tap "Create test donors" first.');
        return;
      }

      // Correct answer, counted by brute force over every test donor
      const expectedCount = (radiusKm, groups) =>
        seeds.filter(
          (s) =>
            typeof s.data.latitude === 'number' &&
            s.donor.available &&
            (groups.length === 0 || groups.includes(s.donor.bloodGroup)) &&
            distanceKm(center.latitude, center.longitude, s.data.latitude, s.data.longitude) <= radiusKm
        ).length;

      const check = async (radiusKm, groups, label) => {
        const started = Date.now();
        const found = await searchNearbyDonors({ ...center, radiusKm, groups });
        const ms = Date.now() - started;
        const foundSeeds = found.filter((f) => f.uid.startsWith(SEED_PREFIX)).length;
        const expected = expectedCount(radiusKm, groups);
        const sorted = found.every((f, i) => i === 0 || found[i - 1].distanceKm <= f.distanceKm);
        const pass = expected === foundSeeds && sorted && ms < 3000;
        addLog(
          `${label}: expected ${expected}, found ${foundSeeds}, sorted ${sorted ? 'yes' : 'NO'}, ${ms} ms  ${pass ? 'PASS' : 'FAIL'}`
        );
      };

      for (const radius of [1, 5, 10, 25]) {
        await check(radius, [], `${radius} km, any group`);
      }
      await check(10, compatibleDonorGroups('A+'), '10 km, A+ compatible');
      addLog('--- Finished ---');
    });

  const confirmDelete = () =>
    Alert.alert('Delete all test donors?', 'Only donors whose id starts with "seed_" are removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            const snapshot = await getDocs(collection(db, 'donors'));
            const refs = snapshot.docs.filter((d) => d.id.startsWith(SEED_PREFIX)).map((d) => d.ref);
            for (let i = 0; i < refs.length; i += 400) {
              const batch = writeBatch(db);
              refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
              await batch.commit();
            }
            addLog(`Deleted ${refs.length} test donors.`);
          }),
      },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.warning}>
        Testing only. Test donors are placed around your current GPS position. Delete them before user testing.
      </Text>

      <AppButton title="1. Create test donors" onPress={seed} disabled={busy} style={styles.button} />
      <AppButton title="2. Verify GPS search" variant="outline" onPress={verify} disabled={busy} style={styles.button} />
      <AppButton title="3. Delete test donors" variant="outline" onPress={confirmDelete} disabled={busy} style={styles.button} />
      {busy ? <Text style={styles.working}>Working... please wait</Text> : null}

      <View style={styles.logBox}>
        <Text style={styles.logTitle}>Log</Text>
        {log.length === 0 ? <Text style={styles.logLine}>Nothing yet.</Text> : null}
        {log.map((line, index) => (
          <Text key={index} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </View>
      <AppButton variant="text" title="Clear log" onPress={() => setLog([])} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  warning: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  button: { marginBottom: 10 },
  working: { fontSize: 14, color: colors.primary, textAlign: 'center', marginBottom: 8 },
  logBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 8,
  },
  logTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 6 },
  logLine: { fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
});