import { useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import AvailabilityCalendar from "./AvailabilityCalendar";
import TimeOffModal from "./TimeOffModal";
import { getAvailabilityCalendar, getMyOverrides, removeOverrides } from "../../api/availabilityApi";
import { apiError } from "../appointments/appointmentUtils";
import { useToast } from "../../context/toastContext";
import { groupOverrides, formatRange, formatHours, dayCount, todayKey } from "./availabilityUtils";

const GroupCard = ({ group, onEdit, onRemove }) => {
  const [confirming, setConfirming] = useState(false);
  const blocked = group.type === "blocked";
  const days = dayCount(group.from, group.to);

  return (
    <div className="group flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-[#EFE6DA] hover:border-[#E5DCD3] hover:shadow-sm transition animate-fade-up">
      <span
        className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-base"
        style={
          blocked
            ? { backgroundImage: "repeating-linear-gradient(135deg, #FDECEA 0 5px, #F9D9D3 5px 10px)", color: "#9C3B2E" }
            : { backgroundColor: "#FFF8E6", color: "#B7791F" }
        }
      >
        {blocked ? "☾" : "◐"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#2B221E] truncate">
          {group.reason || (blocked ? "Time off" : "Special hours")}
        </p>
        <p className="text-xs text-[#8A7A6D] mt-0.5">
          {formatRange(group.from, group.to)}
          {days > 1 && ` · ${days} days`}
        </p>
        {!blocked && <p className="text-xs font-medium text-[#B7791F] mt-0.5">{formatHours(group.startTime, group.endTime)}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {confirming ? (
          <>
            <button
              onClick={() => onRemove(group)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#C8553D] text-white hover:bg-[#A9432E] transition"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs px-2 py-1.5 rounded-lg text-[#8A7A6D] hover:bg-[#F3EBDF] transition"
            >
              Keep
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEdit(group)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-[#6B5B52] hover:bg-[#FFF3E6] hover:text-[#D96B00] transition"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-[#9C3B2E]/70 hover:bg-[#FDECEA] hover:text-[#9C3B2E] transition"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const TimeOffPlanner = () => {
  const { notify } = useToast();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [days, setDays] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [overrides, setOverrides] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState(null);

  const gridFrom = format(startOfWeek(month, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const gridTo = format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd");

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => alive && setCalendarLoading(true));
    getAvailabilityCalendar(gridFrom, gridTo)
      .then((res) => alive && setDays(res.data.days))
      .catch((err) => alive && notify(apiError(err, "Couldn't load the calendar."), { type: "error" }))
      .finally(() => alive && setCalendarLoading(false));
    return () => {
      alive = false;
    };
  }, [gridFrom, gridTo, reloadKey, notify]);

  useEffect(() => {
    let alive = true;
    getMyOverrides()
      .then((res) => alive && setOverrides(res.data.overrides))
      .catch(() => alive && setOverrides([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const groups = useMemo(() => groupOverrides(overrides || []), [overrides]);

  const monthStats = useMemo(() => {
    const inMonth = days.filter((d) => d.date.startsWith(format(month, "yyyy-MM")));
    return {
      working: inMonth.filter((d) => d.kind === "working" || d.kind === "custom").length,
      blocked: inMonth.filter((d) => d.kind === "blocked").length,
      booked: inMonth.reduce((n, d) => n + d.sessions.length, 0),
    };
  }, [days, month]);

  const openForDay = (day) => {
    const group = groups.find((g) => g.from <= day.date && day.date <= g.to);
    if (group) {
      setEditor(group);
    } else {
      // Opening a usual day off means adding hours; on a working day, blocking it is more likely
      setEditor({ from: day.date, to: day.date, type: day.kind === "off" ? "custom" : "blocked" });
    }
  };

  const handleRemove = async (group) => {
    try {
      await removeOverrides(group.ids);
      notify(`${group.reason || (group.type === "blocked" ? "Time off" : "Special hours")} removed`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    }
  };

  const handleSaved = ({ message, cancelledSessions, emailsSent }) => {
    setEditor(null);
    const extra = cancelledSessions
      ? ` · ${cancelledSessions} session${cancelledSessions > 1 ? "s" : ""} cancelled${emailsSent ? `, ${emailsSent} notified` : ""}`
      : "";
    notify(`${message}${extra}`);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
      <AvailabilityCalendar
        month={month}
        days={days}
        loading={calendarLoading}
        onPrev={() => setMonth((m) => addMonths(m, -1))}
        onNext={() => setMonth((m) => addMonths(m, 1))}
        onToday={() => setMonth(startOfMonth(new Date()))}
        onSelect={openForDay}
      />

      <aside className="space-y-4 xl:sticky xl:top-24">
        <button
          onClick={() => setEditor({ from: todayKey(), to: todayKey(), type: "blocked" })}
          className="w-full relative overflow-hidden rounded-3xl bg-[#211A16] text-white p-5 text-left group"
        >
          <span
            className="pointer-events-none absolute -top-16 -right-10 w-44 h-44 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-70"
            style={{ background: "radial-gradient(circle, #FF9E4C 0%, #C9602E 50%, transparent 75%)" }}
          />
          <span className="relative block text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB877] mb-1">Plan ahead</span>
          <span className="relative block font-serif text-xl">Add time off</span>
          <span className="relative block text-sm text-[#D8C9BC] mt-1">Holidays, leave, or special hours</span>
          <span className="absolute right-5 bottom-5 w-9 h-9 rounded-full bg-[#FF9E4C] text-[#211A16] flex items-center justify-center text-lg font-semibold transition-transform group-hover:rotate-90">
            +
          </span>
        </button>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Open days", value: monthStats.working, color: "#4F7161" },
            { label: "Days off", value: monthStats.blocked, color: "#C8553D" },
            { label: "Booked", value: monthStats.booked, color: "#D96B00" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white border border-[#EFE6DA] px-3 py-2.5 text-center">
              <p className="font-serif text-2xl leading-none" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[11px] text-[#A89C8F] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A89C8F] mb-2.5 px-1">Upcoming changes</h3>
          {overrides === null ? (
            <div className="space-y-2">
              <div className="skeleton h-16 rounded-2xl" />
              <div className="skeleton h-16 rounded-2xl" />
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5DCD3] px-4 py-6 text-center">
              <p className="text-sm text-[#6B5B52]">No time off planned.</p>
              <p className="text-xs text-[#A89C8F] mt-1">Tap any day on the calendar to block it.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <GroupCard key={g.key} group={g} onEdit={setEditor} onRemove={handleRemove} />
              ))}
            </div>
          )}
        </div>
      </aside>

      {editor && (
        <TimeOffModal
          key={`${editor.from}-${editor.ids?.join(",") || "new"}`}
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default TimeOffPlanner;
