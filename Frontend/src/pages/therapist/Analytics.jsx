import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getAnalyticsOverview, getAnalyticsAdvanced } from "../../api/subscriptionApi";
import { formatRupees } from "../../api/billingApi";
import { useEntitlement } from "../../context/entitlementContext";

// Validated palette (contrast ≥3:1, colour-blind safe as adjacent series)
const C = { completed: "#2F855A", noShow: "#A0458C", cancelled: "#D96B00", revenue: "#D96B00", clients: "#2F855A" };
const axis = { fontSize: 12, fill: "#8A7A6D" };
const monthLabel = (m) => format(parseISO(`${m}-01`), "MMM");

const Kpi = ({ label, value, hint, accent }) => (
  <div className="relative overflow-hidden rounded-3xl bg-white border border-[#EFE6DA] p-5">
    <span className="absolute top-0 left-5 right-5 h-[3px] rounded-b-full" style={{ backgroundColor: accent }} />
    <p className="text-xs font-medium text-[#8A7A6D]">{label}</p>
    <p className="font-serif text-3xl text-[#2B221E] mt-2 leading-none">{value}</p>
    {hint && <p className="text-[11px] text-[#A89C8F] mt-2">{hint}</p>}
  </div>
);

const Card = ({ title, subtitle, children, legend }) => (
  <div className="bg-white border border-[#EFE6DA] rounded-3xl p-5 sm:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
      <h3 className="font-serif text-lg text-[#2B221E]">
        {title} {subtitle && <span className="font-sans text-sm text-[#A89C8F]">{subtitle}</span>}
      </h3>
      {legend}
    </div>
    {children}
  </div>
);

const TipBox = ({ active, payload, label, rows }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-[#EFE6DA] rounded-xl px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-[#2B221E] mb-1">{format(parseISO(`${label || d.month}-01`), "MMMM yyyy")}</p>
      {rows(d).map(([name, value, color]) => (
        <p key={name} className="flex items-center gap-1.5 text-[#2B221E]">
          {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
          {name}: <strong>{value}</strong>
        </p>
      ))}
    </div>
  );
};

const Legend = ({ items }) => (
  <div className="flex flex-wrap gap-3 text-xs text-[#6B5B52]">
    {items.map(([label, color]) => (
      <span key={label} className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
        {label}
      </span>
    ))}
  </div>
);

// Shown instead of the trend charts on plans without advanced analytics
const LockedPreview = ({ onUpgrade }) => (
  <div className="relative rounded-3xl overflow-hidden border border-[#EFE6DA] bg-white">
    <div className="grid md:grid-cols-2 gap-4 p-6 blur-[6px] opacity-60 pointer-events-none select-none" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="h-48 flex items-end gap-3 px-4">
          {[40, 65, 50, 80, 70, 95].map((h, j) => (
            <div key={j} className="flex-1 rounded-t-md" style={{ height: `${h - i * 10}%`, backgroundColor: i ? C.completed : C.revenue }} />
          ))}
        </div>
      ))}
    </div>
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="text-center max-w-sm bg-white/90 backdrop-blur rounded-3xl border border-[#EFE6DA] p-6 shadow-[0_16px_40px_rgba(33,26,22,0.12)]">
        <p className="text-2xl mb-2">🔒</p>
        <p className="font-serif text-xl text-[#2B221E]">See how your practice is growing</p>
        <p className="text-sm text-[#8A7A6D] mt-1.5">Revenue trends, no-show rate, active clients and retention are on paid plans.</p>
        <button
          onClick={onUpgrade}
          className="mt-4 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition"
        >
          Unlock advanced analytics
        </button>
      </div>
    </div>
  </div>
);

const Analytics = () => {
  const { can, promptUpgrade, tier } = useEntitlement();
  const advancedAllowed = can("analytics.advanced");
  const [overview, setOverview] = useState(null);
  const [advanced, setAdvanced] = useState(null);
  const [months, setMonths] = useState(6);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    getAnalyticsOverview()
      .then((res) => setOverview(res.data))
      .catch(() => setOverview({}));
  }, []);

  useEffect(() => {
    if (!advancedAllowed) return;
    let alive = true;
    getAnalyticsAdvanced(months)
      .then((res) => alive && setAdvanced(res.data))
      .catch(() => alive && setAdvanced(null));
    return () => {
      alive = false;
    };
  }, [advancedAllowed, months, tier?.key]);

  // Period totals from the already-aggregated monthly rows
  const totals = useMemo(() => {
    if (!advanced) return null;
    const sum = (rows, k) => rows.reduce((n, r) => n + (r[k] || 0), 0);
    const completed = sum(advanced.sessions, "completed");
    const noShow = sum(advanced.sessions, "noShow");
    return {
      net: sum(advanced.revenue, "net"),
      noShowRate: completed + noShow ? Math.round((noShow / (completed + noShow)) * 1000) / 10 : null,
    };
  }, [advanced]);

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-6xl w-full mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">Practice insights</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Analytics</h1>
          </div>
          {advancedAllowed && (
            <div className="flex gap-1 p-1 bg-[#F3EBDF]/70 rounded-2xl" role="group" aria-label="Time range">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  aria-pressed={months === m}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${
                    months === m ? "bg-white text-[#2B221E] shadow-sm" : "text-[#8A7A6D] hover:text-[#2B221E]"
                  }`}
                >
                  {m} months
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Basic numbers — every plan */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {!overview ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-3xl" />)
          ) : (
            <>
              <Kpi label="Active clients" value={overview.activeClients ?? 0} hint={`${overview.newClientsThisMonth ?? 0} new this month`} accent={C.clients} />
              <Kpi label="Sessions this month" value={overview.completedThisMonth ?? 0} hint="completed" accent={C.completed} />
              <Kpi label="Upcoming" value={overview.upcomingSessions ?? 0} hint="confirmed sessions" accent="#FF9E4C" />
              <Kpi label="All-time sessions" value={overview.totalCompleted ?? 0} hint="completed" accent={C.noShow} />
            </>
          )}
        </div>

        {/* Trends — plan-gated */}
        {!advancedAllowed ? (
          <LockedPreview onUpgrade={() => promptUpgrade("analytics.advanced", "Unlock advanced analytics")} />
        ) : !advanced ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="skeleton h-72 rounded-3xl" />
            <div className="skeleton h-72 rounded-3xl" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Net revenue" value={formatRupees(totals.net)} hint={`last ${months} months`} accent={C.revenue} />
              <Kpi label="No-show rate" value={totals.noShowRate === null ? "–" : `${totals.noShowRate}%`} hint={`last ${months} months`} accent={C.noShow} />
              <Kpi
                label="Retention"
                value={advanced.retention.retentionRate === null ? "–" : `${advanced.retention.retentionRate}%`}
                hint={`${advanced.retention.returning} of ${advanced.retention.clients} clients returned`}
                accent={C.completed}
              />
              <Kpi label="Sessions per client" value={advanced.retention.avgSessions ?? "–"} hint="average, completed" accent="#FF9E4C" />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card title="Net revenue" subtitle="per month">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={advanced.revenue} barCategoryGap="35%">
                    <CartesianGrid stroke="#F3EBDF" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={{ stroke: "#EFE6DA" }} tickLine={false} />
                    <YAxis tick={axis} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => (v ? formatRupees(v) : "₹0")} />
                    <Tooltip
                      cursor={{ fill: "#FFF3E6" }}
                      content={
                        <TipBox
                          rows={(d) => [
                            ["Net", formatRupees(d.net)],
                            ["Collected", formatRupees(d.gross)],
                            ["Refunded", formatRupees(d.refunded)],
                            ["Payments", d.payments],
                          ]}
                        />
                      }
                    />
                    <Bar dataKey="net" fill={C.revenue} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card
                title="Sessions"
                subtitle="by outcome"
                legend={<Legend items={[["Completed", C.completed], ["No-show", C.noShow], ["Cancelled", C.cancelled]]} />}
              >
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={advanced.sessions} barCategoryGap="35%">
                    <CartesianGrid stroke="#F3EBDF" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={{ stroke: "#EFE6DA" }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
                    <Tooltip
                      cursor={{ fill: "#FBF8F3" }}
                      content={
                        <TipBox
                          rows={(d) => [
                            ["Completed", d.completed, C.completed],
                            ["No-show", d.noShow, C.noShow],
                            ["Cancelled", d.cancelled, C.cancelled],
                            ["No-show rate", d.noShowRate === null ? "–" : `${d.noShowRate}%`],
                          ]}
                        />
                      }
                    />
                    {/* 2px surface-coloured stroke separates stacked segments */}
                    <Bar dataKey="completed" stackId="s" fill={C.completed} stroke="#fff" strokeWidth={2} maxBarSize={36} />
                    <Bar dataKey="noShow" stackId="s" fill={C.noShow} stroke="#fff" strokeWidth={2} maxBarSize={36} />
                    <Bar dataKey="cancelled" stackId="s" fill={C.cancelled} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card title="Active clients" subtitle="clients seen each month">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={advanced.activeClients}>
                  <CartesianGrid stroke="#F3EBDF" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={{ stroke: "#EFE6DA" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
                  <Tooltip cursor={{ stroke: "#E5DCD3" }} content={<TipBox rows={(d) => [["Active clients", d.activeClients]]} />} />
                  <Line type="monotone" dataKey="activeClients" stroke={C.clients} strokeWidth={2} dot={{ r: 4, fill: C.clients, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Same numbers as a table, for screen readers and anyone who prefers it */}
            <div className="text-right">
              <button onClick={() => setShowTable((v) => !v)} className="text-sm font-medium text-[#D96B00] hover:underline">
                {showTable ? "Hide data table" : "View as table"}
              </button>
            </div>
            {showTable && (
              <div className="bg-white border border-[#EFE6DA] rounded-3xl overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-xs text-[#A89C8F] uppercase tracking-wide border-b border-[#F0E8DD]">
                      {["Month", "Net revenue", "Completed", "No-shows", "Cancelled", "No-show rate", "Active clients"].map((h) => (
                        <th key={h} className="px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F6F0E8]">
                    {advanced.months.map((m, i) => (
                      <tr key={m}>
                        <td className="px-4 py-2.5 text-[#2B221E]">{format(parseISO(`${m}-01`), "MMM yyyy")}</td>
                        <td className="px-4 py-2.5 tabular-nums">{formatRupees(advanced.revenue[i].net)}</td>
                        <td className="px-4 py-2.5 tabular-nums">{advanced.sessions[i].completed}</td>
                        <td className="px-4 py-2.5 tabular-nums">{advanced.sessions[i].noShow}</td>
                        <td className="px-4 py-2.5 tabular-nums">{advanced.sessions[i].cancelled}</td>
                        <td className="px-4 py-2.5 tabular-nums">{advanced.sessions[i].noShowRate === null ? "–" : `${advanced.sessions[i].noShowRate}%`}</td>
                        <td className="px-4 py-2.5 tabular-nums">{advanced.activeClients[i].activeClients}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Analytics;
