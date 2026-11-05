// src/services/notifications/pushSender.js
// Sends notifications through Expo's push service (free, no Blaze plan needed)

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MAX_PER_REQUEST = 100; // Expo accepts at most 100 messages per request

const HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

// messages: [{ to, title, body, data, channelId, sound, priority }]
// Returns one "ticket" per message: { status: 'ok', id } or { status: 'error', message, details }
export async function sendPushMessages(messages) {
  const tickets = [];
  for (let i = 0; i < messages.length; i += MAX_PER_REQUEST) {
    const chunk = messages.slice(i, i + MAX_PER_REQUEST);
    const response = await fetch(SEND_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(chunk),
    });
    if (!response.ok) throw new Error(`Push service error (HTTP ${response.status}).`);
    const json = await response.json();
    if (json.errors?.length) throw new Error(json.errors[0].message || 'Push service rejected the request.');
    tickets.push(...(json.data ?? []));
  }
  return tickets;
}

// Plain-English problem for a failed ticket (or null when it is fine)
export function ticketProblem(ticket) {
  if (!ticket) return 'No answer from the push service.';
  if (ticket.status === 'ok') return null;
  if (ticket.details?.error === 'DeviceNotRegistered') {
    return 'This phone is no longer registered for notifications. Reopen the app and try again.';
  }
  return ticket.message || 'The push service rejected the message.';
}

// A receipt shows whether Expo handed the message to Google (FCM) successfully.
// ids: ticket ids. Returns an object keyed by id.
export async function getPushReceipts(ids) {
  const response = await fetch(RECEIPTS_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) throw new Error(`Push service error (HTTP ${response.status}).`);
  const json = await response.json();
  return json.data ?? {};
}