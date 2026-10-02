import { useEffect, useState } from "react";
import Modal from "../appointments/Modal";
import { createOverride, getOverrideImpact, removeOverrides } from "../../api/availabilityApi";
import { apiError, formatShortDate, formatTime } from "../appointments/appointmentUtils";
import { REASONS, todayKey, addDaysKey, formatRange, formatHours, dayCount } from "./availabilityUtils";

const inputClass =
  "w-full bg-white border border-[#EFE6DA] rounded-2xl px-4 py-2.5 text-sm text-[#2B221E] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition";

const QUICK_LENGTHS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];

const TypeOption = ({ active, onClick, title, hint, color, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 text-left rounded-2xl border p-3.5 transition ${
      active ? "bg-white shadow-sm" : "bg-transparent border-[#EFE6DA] hover:border-[#E5DCD3]"
    }`}
    style={active ? { borderColor: color, boxShadow: `0 0 0 3px ${color}1F` } : undefined}
  >
    <span
      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm mb-2"
      style={{ backgroundColor: active ? color : "#D8CFC5" }}
    >
      {icon}
    </span>
    <p className="text-sm font-semibold text-[#2B221E]">{title}</p>
    <p className="text-xs text-[#8A7A6D] mt-0.5">{hint}</p>
  </button>
);

// `initial` may describe an existing range (with ids) to edit, or just a starting date
const TimeOffModal = ({ initial, onClose, onSaved }) => {
  const isEdit = !!initial.ids?.length;
  const [type, setType] = useState(initial.type || "blocked");
  const [from, setFrom] = useState(initial.from || todayKey());
  const [to, setTo] = useState(initial.to || initial.from || todayKey());
  const [startTime, setStartTime] = useState(initial.startTime || "10:00");
  const [endTime, setEndTime] = useState(initial.endTime || "14:00");
  const [reason, setReason] = useState(initial.reason || "");

  const [impact, setImpact] = useState(null); // { days, affected } | { error }
  const [handling, setHandling] = useState("cancel"); // "cancel" | "keep"
  const [notifyClients, setNotifyClients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const endDate = to < from ? from : to;
  const timesValid = type === "blocked" || endTime > startTime;

  // Live check of which bookings this change would clash with
  useEffect(() => {
    if (!timesValid) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      setImpact(null);
      getOverrideImpact({
        date: from,
        endDate,
        type,
        ...(type === "custom" ? { startTime, endTime } : {}),
      })
        .then((res) => alive && setImpact(res.data))
        .catch((err) => alive && setImpact({ error: apiError(err) }));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [type, from, endDate, startTime, endTime, timesValid]);

  const affected = impact?.affected || [];
  const days = dayCount(from, endDate);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await createOverride({
        date: from,
        endDate,
        type,
        startTime: type === "custom" ? startTime : undefined,
        endTime: type === "custom" ? endTime : undefined,
        reason,
        cancelAffected: affected.length > 0 && handling === "cancel",
        notifyClients,
      });

      // When editing a range, drop the days that are no longer part of it
      if (isEdit) {
        const keep = new Set(res.data.overrides.map((o) => o.id));
        const stale = initial.ids.filter((id) => !keep.has(id));
        if (stale.length) await removeOverrides(stale);
      }

      onSaved(res.data);
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  const actionLabel =
    type === "blocked"
      ? `Block ${days === 1 ? "this day" : `${days} days`}`
      : `Set special hours${days > 1 ? ` for ${days} days` : ""}`;

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-xl"
      title={isEdit ? "Edit availability change" : "Change your availability"}
      subtitle="Block days off or open different hours for specific dates."
      footer={
        <>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !timesValid || !impact || !!impact.error}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : actionLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3 mb-5">
        <TypeOption
          active={type === "blocked"}
          onClick={() => setType("blocked")}
          title="Time off"
          hint="No bookings on these days"
          color="#C8553D"
          icon="☾"
        />
        <TypeOption
          active={type === "custom"}
          onClick={() => setType("custom")}
          title="Special hours"
          hint="Different hours than usual"
          color="#B7791F"
          icon="◐"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <label className="block">
          <span className="block text-xs font-medium text-[#8A7A6D] mb-1.5">From</span>
          <input
            type="date"
            value={from}
            min={todayKey()}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-[#8A7A6D] mb-1.5">Until</span>
          <input
            type="date"
            value={endDate}
            min={from}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {QUICK_LENGTHS.map((q) => {
          const active = days === q.days;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => setTo(addDaysKey(from, q.days - 1))}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                active
                  ? "bg-[#FFF3E6] border-[#FFD9AE] text-[#D96B00] font-medium"
                  : "bg-white border-[#EFE6DA] text-[#6B5B52] hover:border-[#FF9E4C]"
              }`}
            >
              {q.label}
            </button>
          );
        })}
      </div>

      {/* Hours */}
      {type === "custom" && (
        <div className="mb-5 animate-fade-up">
          <span className="block text-xs font-medium text-[#8A7A6D] mb-1.5">Open hours on these days</span>
          <div className="flex items-center gap-3">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
            <span className="text-xs text-[#8A7A6D]">to</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          </div>
          {!timesValid && <p className="text-xs text-[#9C3B2E] mt-1.5">End time must be after start time.</p>}
          <p className="text-xs text-[#A89C8F] mt-1.5">Session length and buffer follow your usual weekly settings.</p>
        </div>
      )}

      {/* Reason */}
      <span className="block text-xs font-medium text-[#8A7A6D] mb-1.5">
        Label <span className="text-[#A89C8F] font-normal">(shown to clients if sessions are cancelled)</span>
      </span>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(reason === r ? "" : r)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              reason === r
                ? "bg-[#211A16] border-[#211A16] text-white"
                : "bg-white border-[#EFE6DA] text-[#6B5B52] hover:border-[#2B221E]/30"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={reason}
        maxLength={200}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Or write your own…"
        className={`${inputClass} mb-5`}
      />

      {/* Impact */}
      <div className="rounded-2xl border border-[#EFE6DA] bg-[#FBF8F3] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#2B221E]">
            {formatRange(from, endDate)}
            {type === "custom" && timesValid && (
              <span className="text-[#B7791F]"> · {formatHours(startTime, endTime)}</span>
            )}
          </p>
          <span className="text-xs text-[#A89C8F] shrink-0">
            {days} day{days > 1 ? "s" : ""}
          </span>
        </div>

        {!timesValid ? null : !impact ? (
          <div className="skeleton h-4 w-40 rounded-full mt-3" />
        ) : impact.error ? (
          <p className="text-sm text-[#9C3B2E] mt-2">{impact.error}</p>
        ) : affected.length === 0 ? (
          <p className="text-sm text-[#4F7161] mt-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-[#4F7161] text-white text-[10px] flex items-center justify-center">✓</span>
            No booked sessions are affected.
          </p>
        ) : (
          <div className="mt-3 animate-fade-up">
            <p className="text-sm text-[#7A5414] font-medium mb-2">
              {affected.length} booked session{affected.length > 1 ? "s" : ""}{" "}
              {affected.length > 1 ? "fall" : "falls"} {type === "blocked" ? "on these days" : "outside these hours"}:
            </p>
            <ul className="space-y-1.5 mb-3">
              {affected.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm bg-white rounded-xl px-3 py-2 border border-[#F6DFA8]">
                  <span className="truncate text-[#2B221E]">{s.client?.name || "Unknown client"}</span>
                  <span className="text-xs text-[#8A7A6D] shrink-0">
                    {formatShortDate(s.date)} · {formatTime(s.startTime)}
                  </span>
                </li>
              ))}
              {affected.length > 4 && (
                <li className="text-xs text-[#8A7A6D] pl-1">+ {affected.length - 4} more</li>
              )}
            </ul>

            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { key: "cancel", title: "Cancel them", hint: "Frees the slots" },
                { key: "keep", title: "Keep them booked", hint: "I'll sort it out myself" },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setHandling(o.key)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition ${
                    handling === o.key ? "bg-white border-[#B7791F] shadow-sm" : "border-[#EFE6DA] hover:border-[#F6DFA8]"
                  }`}
                >
                  <p className="text-sm font-medium text-[#2B221E]">{o.title}</p>
                  <p className="text-xs text-[#8A7A6D]">{o.hint}</p>
                </button>
              ))}
            </div>
            {handling === "cancel" && (
              <label className="flex items-center gap-2.5 text-sm text-[#6B5B52] mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifyClients}
                  onChange={(e) => setNotifyClients(e.target.checked)}
                  className="w-4 h-4 accent-[#B7791F]"
                />
                Email the affected clients
              </label>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
};

export default TimeOffModal;
