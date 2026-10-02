import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import Modal from "./Modal";
import { getRescheduleSlots, rescheduleAppointment } from "../../api/appointmentApi";
import { formatShortDate, formatTime, partOfDay, apiError } from "./appointmentUtils";

const PARTS = ["Morning", "Afternoon", "Evening"];

const RescheduleModal = ({ appointment, onClose, onDone }) => {
  const [days, setDays] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [message, setMessage] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getRescheduleSlots(appointment.id)
      .then((res) => {
        const open = res.data.slots.filter((d) => d.slots.length > 0);
        setDays(open);
        setSelectedDate(open[0]?.date ?? null);
      })
      .catch((err) => setLoadError(apiError(err, "Couldn't load available times.")));
  }, [appointment.id]);

  const daySlots = days?.find((d) => d.date === selectedDate)?.slots || [];

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    setError("");
    try {
      const res = await rescheduleAppointment(appointment.id, {
        date: selectedDate,
        startTime: selectedSlot.startTime,
        message,
        notifyClient,
      });
      onDone(res.data);
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-xl"
      title="Reschedule session"
      subtitle={`with ${appointment.client?.name || "client"}`}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition"
          >
            Keep current time
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedSlot || saving}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? "Moving…"
              : selectedSlot
                ? `Move to ${formatShortDate(selectedDate)} · ${formatTime(selectedSlot.startTime)}`
                : "Pick a new time"}
          </button>
        </>
      }
    >
      {/* Current → new */}
      <div className="flex items-center gap-3 mb-5 text-sm">
        <div className="flex-1 rounded-2xl border border-dashed border-[#E5DCD3] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-[#A89C8F] mb-0.5">Current</p>
          <p className="text-[#8A7A6D] line-through decoration-[#C8553D]/50">
            {formatShortDate(appointment.date)} · {formatTime(appointment.startTime)}
          </p>
        </div>
        <span className="text-[#D96B00] text-lg">→</span>
        <div
          className={`flex-1 rounded-2xl px-4 py-3 transition ${
            selectedSlot ? "bg-[#FFF3E6] border border-[#FFD9AE]" : "border border-[#EFE6DA]"
          }`}
        >
          <p className="text-[11px] uppercase tracking-wider text-[#A89C8F] mb-0.5">New</p>
          <p className={selectedSlot ? "text-[#2B221E] font-medium" : "text-[#C4B8AC]"}>
            {selectedSlot
              ? `${formatShortDate(selectedDate)} · ${formatTime(selectedSlot.startTime)}`
              : "Not selected"}
          </p>
        </div>
      </div>

      {loadError && <p className="text-sm text-[#9C3B2E] mb-4">{loadError}</p>}

      {!days && !loadError && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton w-16 h-20 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      )}

      {days && days.length === 0 && (
        <div className="text-center py-8 px-4 rounded-2xl bg-[#FBF8F3] border border-[#EFE6DA]">
          <p className="text-[#2B221E] font-medium mb-1">No open slots in the next 30 days</p>
          <p className="text-sm text-[#8A7A6D]">Add more hours on your Availability page, then try again.</p>
        </div>
      )}

      {days && days.length > 0 && (
        <>
          {/* Date strip */}
          <div className="flex gap-2 overflow-x-auto scroll-thin pb-3 -mx-1 px-1 mb-3">
            {days.map((d) => {
              const date = parseISO(d.date);
              const active = d.date === selectedDate;
              return (
                <button
                  key={d.date}
                  onClick={() => {
                    setSelectedDate(d.date);
                    setSelectedSlot(null);
                  }}
                  className={`shrink-0 w-16 rounded-2xl py-2.5 flex flex-col items-center border transition ${
                    active
                      ? "bg-[#211A16] border-[#211A16] text-white shadow-md"
                      : "bg-white border-[#EFE6DA] text-[#2B221E] hover:border-[#FF9E4C]"
                  }`}
                >
                  <span className={`text-[10px] uppercase tracking-wider ${active ? "text-[#FFB877]" : "text-[#A89C8F]"}`}>
                    {format(date, "EEE")}
                  </span>
                  <span className="font-serif text-xl leading-tight">{format(date, "d")}</span>
                  <span className={`text-[10px] ${active ? "text-white/60" : "text-[#A89C8F]"}`}>
                    {d.slots.length} open
                  </span>
                </button>
              );
            })}
          </div>

          {/* Slots by part of day */}
          <div className="space-y-4">
            {PARTS.map((part) => {
              const slots = daySlots.filter((s) => partOfDay(s.startTime) === part);
              if (slots.length === 0) return null;
              return (
                <div key={part}>
                  <p className="text-xs font-medium text-[#8A7A6D] mb-2">{part}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot) => {
                      const active = selectedSlot?.startTime === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2.5 rounded-xl text-sm border transition ${
                            active
                              ? "bg-[#FF9E4C] border-[#FF9E4C] text-[#211A16] font-semibold shadow-sm"
                              : "bg-white border-[#EFE6DA] text-[#2B221E] hover:border-[#FF9E4C] hover:bg-[#FFF8F0]"
                          }`}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 space-y-3">
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              placeholder="Add a note for your client (optional)"
              className="w-full bg-white border border-[#EFE6DA] rounded-2xl px-4 py-3 text-sm placeholder-[#A89C8F] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition resize-none"
            />
            <label className="flex items-center gap-2.5 text-sm text-[#6B5B52] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notifyClient}
                onChange={(e) => setNotifyClient(e.target.checked)}
                className="w-4 h-4 accent-[#D96B00]"
              />
              Email {appointment.client?.name?.split(" ")[0] || "the client"} about the new time
            </label>
          </div>
        </>
      )}

      {error && (
        <div className="mt-4 bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
};

export default RescheduleModal;
