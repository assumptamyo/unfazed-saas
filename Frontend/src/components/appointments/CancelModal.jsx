import { useState } from "react";
import Modal from "./Modal";
import ClientAvatar from "./ClientAvatar";
import { cancelAppointment } from "../../api/appointmentApi";
import { formatLongDate, formatTime, apiError } from "./appointmentUtils";

const QUICK_REASONS = [
  "I'm unavailable at this time",
  "Client asked to cancel",
  "Feeling unwell",
  "Emergency came up",
];

const CancelModal = ({ appointment, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await cancelAppointment(appointment.id, { reason, notifyClient });
      onDone(res.data);
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  const firstName = appointment.client?.name?.split(" ")[0] || "the client";

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel this session?"
      subtitle="The slot will open up again for new bookings."
      footer={
        <>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition"
          >
            Keep session
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#C8553D] text-white hover:bg-[#A9432E] transition disabled:opacity-50"
          >
            {saving ? "Cancelling…" : "Cancel session"}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#FBF8F3] border border-[#EFE6DA] mb-5">
        <ClientAvatar name={appointment.client?.name} />
        <div className="min-w-0">
          <p className="font-medium text-[#2B221E] truncate">{appointment.client?.name}</p>
          <p className="text-sm text-[#8A7A6D]">
            {formatLongDate(appointment.date)} · {formatTime(appointment.startTime)}
          </p>
        </div>
      </div>

      <p className="text-xs font-medium text-[#8A7A6D] mb-2">Reason (shared with {firstName} if notified)</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_REASONS.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              reason === r
                ? "bg-[#FDECEA] border-[#F5C2BE] text-[#9C3B2E]"
                : "bg-white border-[#EFE6DA] text-[#6B5B52] hover:border-[#C8553D]/40"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={1000}
        placeholder="Write a short message (optional)"
        className="w-full bg-white border border-[#EFE6DA] rounded-2xl px-4 py-3 text-sm placeholder-[#A89C8F] focus:outline-none focus:ring-2 focus:ring-[#C8553D]/30 focus:border-[#C8553D]/50 transition resize-none mb-3"
      />
      <label className="flex items-center gap-2.5 text-sm text-[#6B5B52] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={notifyClient}
          onChange={(e) => setNotifyClient(e.target.checked)}
          className="w-4 h-4 accent-[#C8553D]"
        />
        Email {firstName} that the session is cancelled
      </label>

      {error && (
        <div className="mt-4 bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
};

export default CancelModal;
