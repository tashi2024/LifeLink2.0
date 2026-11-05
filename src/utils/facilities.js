// src/utils/facilities.js
// Seeded list of places where donors can book a donation appointment.
// PLACEHOLDER DATA: confirm names, open days and slot times with each facility before your demo.

export const SLOT_CAPACITY = 3;        // donors per slot. If you change this, change the 3 in the Firestore rules too.
export const BOOKING_WINDOW_DAYS = 21; // how far ahead a donor can book
export const MIN_LEAD_MINUTES = 60;    // a slot must start at least this far in the future

const WEEKDAYS_ONLY = [0, 6]; // closed on Sunday (0) and Saturday (6)

export const FACILITIES = [
  {
    id: 'jdwnrh',
    name: 'JDWNRH, Thimphu',
    fullName: 'Jigme Dorji Wangchuck National Referral Hospital',
    type: 'Hospital',
    dzongkhag: 'Thimphu',
    slots: ['09:00', '10:30', '14:00'],
    closedWeekdays: WEEKDAYS_ONLY,
  },
  {
    id: 'national-blood-bank',
    name: 'National Blood Bank, Thimphu',
    fullName: 'National Blood Bank',
    type: 'Blood bank',
    dzongkhag: 'Thimphu',
    slots: ['09:00', '10:30', '14:00', '15:30'],
    closedWeekdays: WEEKDAYS_ONLY,
  },
  {
    id: 'phuentsholing-hospital',
    name: 'Phuentsholing Hospital',
    fullName: 'Phuentsholing Hospital',
    type: 'Hospital',
    dzongkhag: 'Chhukha',
    slots: ['09:00', '11:00', '14:00'],
    closedWeekdays: WEEKDAYS_ONLY,
  },
  {
    id: 'paro-hospital',
    name: 'Paro Hospital',
    fullName: 'Paro Hospital',
    type: 'Hospital',
    dzongkhag: 'Paro',
    slots: ['09:00', '11:00', '14:00'],
    closedWeekdays: WEEKDAYS_ONLY,
  },
  {
    id: 'punakha-hospital',
    name: 'Punakha Hospital',
    fullName: 'Punakha Hospital',
    type: 'Hospital',
    dzongkhag: 'Punakha',
    slots: ['09:00', '11:00', '14:00'],
    closedWeekdays: WEEKDAYS_ONLY,
  },
  {
    id: 'wangdue-hospital',
    name: 'Wangdue Phodrang Hospital',
    fullName: 'Wangdue Phodrang Hospital',
    type: 'Hospital',
    dzongkhag: 'Wangdue Phodrang',
    slots: ['09:00', '11:00', '14:00'],
    closedWeekdays: WEEKDAYS_ONLY,
  },
  {
    id: 'mongar-rrh',
    name: 'Eastern Regional Referral Hospital, Mongar',
    fullName: 'Eastern Regional Referral Hospital',
    type: 'Hospital',
    dzongkhag: 'Mongar',
    slots: ['09:00', '11:00', '14:00'],
    closedWeekdays: WEEKDAYS_ONLY,
  },
  {
    id: 'gelephu-rrh',
    name: 'Central Regional Referral Hospital, Gelephu',
    fullName: 'Central Regional Referral Hospital',
    type: 'Hospital',
    dzongkhag: 'Sarpang',
    slots: ['09:00', '11:00', '14:00'],
    closedWeekdays: WEEKDAYS_ONLY,
  },
];

export function getFacility(id) {
  return FACILITIES.find((f) => f.id === id) ?? null;
}

// date: a JavaScript Date
export function isFacilityOpen(facility, date) {
  return !facility.closedWeekdays.includes(date.getDay());
}

// One id per facility + day + time, e.g. "jdwnrh_2026-11-14_1030"
export function slotIdFor(facilityId, dateKey, timeKey) {
  return `${facilityId}_${dateKey}_${timeKey.replace(':', '')}`;
}