// src/services/notifications/useAppointmentReminders.js
import { useEffect } from 'react';
import { observeMyAppointments } from '../appointments/appointmentService';
import { syncAppointmentReminders } from './appointmentReminders';

// While logged in, keeps this phone's appointment reminders matching the appointments in Firestore
export default function useAppointmentReminders() {
  useEffect(
    () =>
      observeMyAppointments(
        (list) => {
          syncAppointmentReminders(list);
        },
        (error) => console.log('Reminder sync unavailable:', error.message)
      ),
    []
  );
}