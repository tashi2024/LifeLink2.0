// src/services/notifications/appointmentReminders.js
// Local reminders, scheduled on the phone, 24 hours before each booked appointment.
import * as Notifications from 'expo-notifications';
import { auth } from '../firebase/firebaseConfig';
import { CHANNELS } from './notificationService';
import { HOUR_MS, describeSlot } from '../../utils/appointmentUtils';

export const REMINDER_LEAD_MS = 24 * HOUR_MS;

const TYPE = 'appointment_reminder';

function isReminder(notification) {
  return notification.content.data?.type === TYPE;
}

// Makes the phone's scheduled reminders match the list of appointments:
// adds missing ones, removes ones for cancelled or moved appointments.
async function doSync(appointments) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const now = Date.now();

  // Which appointments should have a reminder? (booked, and 24 h before is still in the future)
  const wanted = new Map();
  appointments.forEach((a) => {
    if (a.status === 'booked' && a.scheduledAt - REMINDER_LEAD_MS > now + 30000) wanted.set(a.id, a);
  });

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const present = new Set();

  for (const notification of scheduled) {
    if (!isReminder(notification)) continue;
    const data = notification.content.data;
    const appointment = wanted.get(data.appointmentId);
    const stillValid =
      appointment &&
      data.donorUid === uid &&
      data.scheduledAt === appointment.scheduledAt &&
      !present.has(appointment.id);
    if (stillValid) {
      present.add(appointment.id);
    } else {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  for (const [id, appointment] of wanted) {
    if (present.has(id)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Donation appointment reminder',
        body: `${appointment.facilityName}, ${describeSlot(appointment.scheduledAt)}. Tap to view or change it.`,
        data: { type: TYPE, appointmentId: id, donorUid: uid, scheduledAt: appointment.scheduledAt },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(appointment.scheduledAt - REMINDER_LEAD_MS),
        channelId: CHANNELS.REMINDERS,
      },
    });
  }
}

// Runs one sync at a time, so quick changes cannot create duplicate reminders
let queue = Promise.resolve();
export function syncAppointmentReminders(appointments) {
  queue = queue
    .then(() => doSync(appointments))
    .catch((error) => console.log('syncAppointmentReminders failed:', error.message));
  return queue;
}

// Called on logout, so the next person on this phone does not get someone else's reminders
export async function cancelAppointmentReminders() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (isReminder(notification)) await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  } catch (error) {
    console.log('cancelAppointmentReminders failed:', error.message);
  }
}

// ---------- Developer helpers (used by the Appointments screen in development only) ----------

export async function listScheduledReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter(isReminder).map((n) => {
    const at = (n.content.data.scheduledAt ?? 0) - REMINDER_LEAD_MS;
    return `${n.content.body}\nCalculated time: ${describeSlot(at)}\nSystem trigger: ${JSON.stringify(n.trigger)}`;
  });
}

// A reminder that fires in 60 seconds, to check that the whole pipeline works with the app closed
export async function scheduleTestReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test reminder',
      body: 'This is the 1-minute test reminder. Tap to open Appointments.',
      data: { type: 'appointment_reminder_test' },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      channelId: CHANNELS.REMINDERS,
    },
  });
}