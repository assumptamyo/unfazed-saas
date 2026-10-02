import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { addWeeks, format, parseISO, startOfWeek, endOfWeek, isSameMonth } from "date-fns";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import AppointmentsOverview from "../../components/appointments/AppointmentsOverview";
import AppointmentCard from "../../components/appointments/AppointmentCard";
import AppointmentDrawer from "../../components/appointments/AppointmentDrawer";
import WeekBoard from "../../components/appointments/WeekBoard";
import RescheduleModal from "../../components/appointments/RescheduleModal";
import CancelModal from "../../components/appointments/CancelModal";
import { getAppointments, updateAppointmentStatus } from "../../api/appointmentApi";
import { relativeDayLabel, formatShortDate, formatTime, apiError } from "../../components/appointments/appointmentUtils";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/toastContext";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "attention", label: "Needs outcome" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const EMPTY_COPY = {
  upcoming: ["No upcoming sessions", "New bookings from your public page will land here."],
  attention: ["You're all caught up", "Every finished session has an outcome recorded."],
  past: ["No past sessions yet", "Completed and no-show sessions will appear here."],
  cancelled: ["Nothing cancelled", "Cancelled sessions are kept here for your records."],
  all: ["No appointments yet", "Once clients book, you'll see everything here."],
};

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" />
  </svg>
);

const WeekIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="9" x2="9" y2="21" /><line x1="15" y1="9" x2="15" y2="21" />
  </svg>
);

const EmptyState = ({ tab, searching }) => {
  const [title, body] = searching ? ["No matches", "Try a different name or email."] : EMPTY_COPY[tab];
  return (
    <div className="flex flex-col items-center text-center py-16 px-6 rounded-3xl border border-dashed border-[#E5DCD3] bg-white/50 animate-fade-up">
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none" className="mb-4">
        <circle cx="44" cy="44" r="40" fill="#FFF3E6" />
        <rect x="24" y="28" width="40" height="34" rx="7" fill="white" stroke="#FFD9AE" strokeWidth="2" />
        <line x1="24" y1="38" x2="64" y2="38" stroke="#FFD9AE" strokeWidth="2" />
        <line x1="34" y1="23" x2="34" y2="31" stroke="#D96B00" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="54" y1="23" x2="54" y2="31" stroke="#D96B00" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="44" cy="50" r="4" fill="#FF9E4C" />
      </svg>
      <p className="font-serif text-lg text-[#2B221E]">{title}</p>
      <p className="text-sm text-[#8A7A6D] mt-1 max-w-xs">{body}</p>
    </div>
  );
};

const LoadingState = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4">
      <div className="skeleton h-[220px] rounded-[28px]" />
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[104px] rounded-3xl" />
        ))}
      </div>
    </div>
    <div className="skeleton h-11 w-full max-w-lg rounded-2xl mt-6" />
    {[0, 1, 2].map((i) => (
      <div key={i} className="skeleton h-20 rounded-2xl" />
    ))}
  </div>
);

const useNow = (intervalMs = 30000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
};

const Appointments = () => {
  const { therapist } = useAuth();
  const { notify } = useToast();
  const now = useNow();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [tab, setTab] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("list");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const [selectedId, setSelectedId] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    getAppointments({ view: "all" })
      .then((res) => {
        if (!alive) return;
        setData(res.data);
        setLoadError("");
      })
      .catch((err) => alive && setLoadError(apiError(err, "Couldn't load appointments.")));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Swap in the server's updated copy right away, then refetch counts & summary
  const applyUpdate = useCallback(
    (updated) => {
      setData((prev) =>
        prev
          ? { ...prev, appointments: prev.appointments.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)) }
          : prev
      );
      refresh();
    },
    [refresh]
  );

  const appointments = useMemo(() => data?.appointments ?? [], [data]);
  const counts = data?.counts ?? {};
  const selected = appointments.find((a) => a.id === selectedId) || null;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tab === "all" ? appointments : appointments.filter((a) => a.phase === tab);
    if (q) {
      list = list.filter(
        (a) => a.client?.name.toLowerCase().includes(q) || a.client?.email.toLowerCase().includes(q)
      );
    }
    const asc = (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
    return [...list].sort(tab === "upcoming" ? asc : (a, b) => asc(b, a));
  }, [appointments, tab, search]);

  const weekItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? appointments.filter(
          (a) => a.client?.name.toLowerCase().includes(q) || a.client?.email.toLowerCase().includes(q)
        )
      : appointments;
  }, [appointments, search]);

  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach((a) => {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date).push(a);
    });
    return [...map.entries()];
  }, [visible]);

  const handleStatus = async (appt, status) => {
    setBusyId(appt.id);
    try {
      const res = await updateAppointmentStatus(appt.id, status);
      applyUpdate(res.data.appointment);
      const label = { completed: "Marked as completed", "no-show": "Marked as no-show", confirmed: "Outcome cleared" }[status];
      notify(`${label} · ${appt.client?.name}`, {
        action:
          status !== "confirmed"
            ? {
                label: "Undo",
                onClick: async () => {
                  try {
                    const undo = await updateAppointmentStatus(appt.id, "confirmed");
                    applyUpdate(undo.data.appointment);
                  } catch (err) {
                    notify(apiError(err), { type: "error" });
                  }
                },
              }
            : undefined,
      });
    } catch (err) {
      notify(apiError(err), { type: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const handleRescheduled = ({ appointment, emailSent }) => {
    setRescheduleTarget(null);
    applyUpdate(appointment);
    notify(
      `Moved to ${formatShortDate(appointment.date)} · ${formatTime(appointment.startTime)}${emailSent ? " — client notified" : ""}`
    );
  };

  const handleCancelled = ({ appointment, emailSent }) => {
    setCancelTarget(null);
    applyUpdate(appointment);
    notify(`Session cancelled${emailSent ? " — client notified" : ""}`, { type: "info" });
  };

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekLabel = isSameMonth(weekStart, weekEnd)
    ? `${format(weekStart, "MMMM d")} – ${format(weekEnd, "d, yyyy")}`
    : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-6xl w-full mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">
              {format(now, "EEEE, MMMM d")}
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Appointments</h1>
          </div>
          <Link
            to="/therapist/schedule"
            className="text-sm font-medium text-[#6B5B52] hover:text-[#D96B00] px-4 py-2.5 rounded-full border border-[#E5DCD3] bg-white hover:border-[#FF9E4C] transition"
          >
            Edit availability
          </Link>
        </div>

        {loadError && !data && (
          <div className="rounded-3xl bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm">{loadError}</p>
            <button onClick={refresh} className="text-sm font-semibold hover:underline">
              Try again
            </button>
          </div>
        )}

        {!data && !loadError && <LoadingState />}

        {data && (
          <>
            <AppointmentsOverview
              summary={data.summary}
              now={now}
              slug={therapist?.slug}
              onOpen={(a) => setSelectedId(a.id)}
              onReschedule={setRescheduleTarget}
            />

            {/* Needs-outcome nudge */}
            {counts.attention > 0 && tab !== "attention" && mode === "list" && (
              <button
                onClick={() => setTab("attention")}
                className="w-full mb-6 flex items-center gap-3 text-left rounded-2xl bg-gradient-to-r from-[#FFF8E6] to-[#FFFDF9] border border-[#F6DFA8] px-4 py-3 hover:shadow-sm transition animate-fade-up"
              >
                <span className="w-8 h-8 shrink-0 rounded-full bg-[#B7791F] text-white flex items-center justify-center text-sm font-bold">
                  {counts.attention}
                </span>
                <span className="flex-1 text-sm text-[#7A5414]">
                  <strong className="font-semibold">
                    {counts.attention} finished session{counts.attention > 1 ? "s" : ""}
                  </strong>{" "}
                  {counts.attention > 1 ? "need" : "needs"} an outcome — mark them completed or no-show.
                </span>
                <span className="text-sm font-semibold text-[#B7791F] shrink-0">Review →</span>
              </button>
            )}

            {/* Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-6">
              {mode === "list" ? (
                <div className="flex gap-1 p-1 bg-[#F3EBDF]/70 rounded-2xl overflow-x-auto no-scrollbar self-start max-w-full">
                  {TABS.map((t) => {
                    const active = tab === t.key;
                    const count = counts[t.key] ?? 0;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                          active ? "bg-white text-[#2B221E] shadow-sm" : "text-[#8A7A6D] hover:text-[#2B221E]"
                        }`}
                      >
                        {t.label}
                        {count > 0 && (
                          <span
                            className={`text-[11px] min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center ${
                              t.key === "attention"
                                ? "bg-[#B7791F] text-white"
                                : active
                                  ? "bg-[#FF9E4C] text-[#211A16]"
                                  : "bg-white/70 text-[#8A7A6D]"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWeekStart((w) => addWeeks(w, -1))}
                    className="w-10 h-10 rounded-xl border border-[#E5DCD3] bg-white text-[#6B5B52] hover:border-[#FF9E4C] transition"
                    aria-label="Previous week"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                    className="h-10 px-4 whitespace-nowrap rounded-xl border border-[#E5DCD3] bg-white text-sm font-medium text-[#6B5B52] hover:border-[#FF9E4C] transition"
                  >
                    This week
                  </button>
                  <button
                    onClick={() => setWeekStart((w) => addWeeks(w, 1))}
                    className="w-10 h-10 rounded-xl border border-[#E5DCD3] bg-white text-[#6B5B52] hover:border-[#FF9E4C] transition"
                    aria-label="Next week"
                  >
                    ›
                  </button>
                  <p className="font-serif text-base sm:text-lg text-[#2B221E] ml-1 sm:ml-2 leading-tight">{weekLabel}</p>
                </div>
              )}

              <div className="flex items-center gap-3 xl:ml-auto">
                <div className="relative flex-1 xl:w-64">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89C8F] pointer-events-none">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search client…"
                    className="w-full bg-white border border-[#E5DCD3] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition"
                  />
                </div>
                <div className="flex p-1 bg-[#F3EBDF]/70 rounded-xl shrink-0" role="group" aria-label="View mode">
                  {[
                    { key: "list", icon: <ListIcon />, label: "List" },
                    { key: "week", icon: <WeekIcon />, label: "Week" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMode(m.key)}
                      aria-pressed={mode === m.key}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        mode === m.key ? "bg-white text-[#D96B00] shadow-sm" : "text-[#8A7A6D] hover:text-[#2B221E]"
                      }`}
                    >
                      {m.icon}
                      <span className="hidden sm:inline">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            {mode === "week" ? (
              <>
                <WeekBoard
                  appointments={weekItems}
                  weekStart={weekStart}
                  now={now}
                  onOpen={(a) => setSelectedId(a.id)}
                />
                <div className="flex flex-wrap gap-4 mt-4 text-xs text-[#8A7A6D]">
                  {[
                    ["#D96B00", "Upcoming"],
                    ["#B7791F", "Needs outcome"],
                    ["#4F7161", "Completed"],
                    ["#8A5C77", "No-show"],
                    ["#9C3B2E", "Cancelled"],
                  ].map(([c, l]) => (
                    <span key={l} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                      {l}
                    </span>
                  ))}
                </div>
              </>
            ) : groups.length === 0 ? (
              <EmptyState tab={tab} searching={!!search.trim()} />
            ) : (
              <div className="space-y-6">
                {groups.map(([dateKey, items]) => {
                  const d = parseISO(dateKey);
                  const relative = relativeDayLabel(dateKey);
                  return (
                    <section key={dateKey}>
                      <div className="sticky top-[73px] z-10 -mx-2 px-2 py-2 mb-1 bg-[#F9F6F0]/90 backdrop-blur-sm flex items-center gap-3">
                        <span className="font-serif text-3xl text-[#2B221E] leading-none w-12 text-center tabular-nums">
                          {format(d, "d")}
                        </span>
                        <div className="leading-tight">
                          <p className="text-sm font-semibold text-[#2B221E]">{format(d, "EEEE")}</p>
                          <p className="text-xs text-[#A89C8F]">{format(d, "MMMM yyyy")}</p>
                        </div>
                        {relative && (
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                              relative === "Today" ? "bg-[#FF9E4C] text-[#211A16]" : "bg-white border border-[#EFE6DA] text-[#6B5B52]"
                            }`}
                          >
                            {relative}
                          </span>
                        )}
                        <span className="flex-1 h-px bg-[#EAE0D4]" />
                        <span className="text-xs text-[#A89C8F]">
                          {items.length} session{items.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div>
                        {items.map((a) => (
                          <AppointmentCard
                            key={a.id}
                            appointment={a}
                            now={now}
                            busy={busyId === a.id}
                            onOpen={(x) => setSelectedId(x.id)}
                            onStatus={handleStatus}
                            onReschedule={setRescheduleTarget}
                            onCancel={setCancelTarget}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <AppointmentDrawer
          appointment={selected}
          now={now}
          busy={busyId === selected.id}
          onClose={() => setSelectedId(null)}
          onStatus={handleStatus}
          onReschedule={setRescheduleTarget}
          onCancel={setCancelTarget}
        />
      )}

      {rescheduleTarget && (
        <RescheduleModal
          key={rescheduleTarget.id}
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onDone={handleRescheduled}
        />
      )}

      {cancelTarget && (
        <CancelModal
          key={cancelTarget.id}
          appointment={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={handleCancelled}
        />
      )}
    </DashboardLayout>
  );
};

export default Appointments;
