// Who is told about what, and how. The NotificationService reads this table;
// features only announce events. To change notifications, edit this file —
// no feature code needs to change.
//
// Each rule: { channel: "email" | "whatsapp" | "in_app", to: "client" | "therapist", when? }
// `when(payload)` can skip a rule, e.g. when the therapist unticked "email the client".

const clientOptedIn = (p) => p.notifyClient !== false;

export const NOTIFICATION_RULES = {
  "booking.confirmed": [
    { channel: "email", to: "client" },
    { channel: "email", to: "therapist" },
    { channel: "whatsapp", to: "client" },
    { channel: "in_app", to: "therapist" },
  ],
  "session.cancelled": [
    { channel: "email", to: "client", when: clientOptedIn },
    { channel: "whatsapp", to: "client", when: clientOptedIn },
  ],
  "session.rescheduled": [
    { channel: "email", to: "client", when: clientOptedIn },
    { channel: "whatsapp", to: "client", when: clientOptedIn },
  ],
  "session.reminder": [
    { channel: "email", to: "client" },
    { channel: "whatsapp", to: "client" },
    { channel: "in_app", to: "therapist" },
  ],
  "session.followUp": [{ channel: "email", to: "client" }],
  "note.shared": [{ channel: "email", to: "client" }],
  "message.sent": [
    // Therapist -> client: email only when the client is offline (decided by the email template)
    { channel: "email", to: "client", when: (p) => p.sender === "therapist" },
    // Client -> therapist: in the bell
    { channel: "in_app", to: "therapist", when: (p) => p.sender === "client" },
  ],
  "payment.refunded": [
    { channel: "email", to: "client", when: (p) => p.reason === "slot_taken" },
    { channel: "in_app", to: "therapist" },
  ],
};

// Timing for scheduled notifications
export const SCHEDULE = {
  reminderHoursBefore: 24,
  followUpHoursAfter: 2, // send the follow-up this long after a completed session ends
  followUpWithinDays: 3, // don't follow up on sessions older than this
  tickMinutes: 5,
};
