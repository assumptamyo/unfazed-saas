import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClientAvatar from "../../components/appointments/ClientAvatar";
import Modal from "../../components/appointments/Modal";
import {
  getBillingSummary,
  updateSessionFee,
  getPayments,
  refundPayment,
  downloadReceipt,
  formatRupees,
} from "../../api/billingApi";
import { apiError, formatShortDate, formatTime } from "../../components/appointments/appointmentUtils";
import { useToast } from "../../context/toastContext";

const BAR = "#D96B00"; // validated: ≥3:1 against the card surface

const STATUS = {
  paid: { label: "Paid", cls: "bg-[#EEF3F0] text-[#4F7161]" },
  refunded: { label: "Refunded", cls: "bg-[#F3EFEA] text-[#8A7A6D]" },
  failed: { label: "Needs attention", cls: "bg-[#FDECEA] text-[#9C3B2E]" },
  processing: { label: "Processing", cls: "bg-[#FFF8E6] text-[#B7791F]" },
};

const METHOD = { upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "refunded", label: "Refunded" },
  { key: "failed", label: "Needs attention" },
];

const FeeCard = ({ summary, onSaved }) => {
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String((summary.sessionFee || 0) / 100));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateSessionFee(Number(value) || 0);
      notify(res.data.sessionFee ? `Session fee set to ${formatRupees(res.data.sessionFee)}` : "Booking is now free");
      setEditing(false);
      onSaved(res.data.sessionFee);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#211A16] text-white p-6 sm:p-7 flex flex-col min-h-[220px]">
      <div
        className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF9E4C 0%, #C9602E 45%, transparent 75%)" }}
      />
      <div className="relative flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB877]">Session fee</p>
        {summary.paymentsEnabled ? (
          <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/10 text-white/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8DB3A1]" />
            Razorpay connected{summary.testMode ? " · test mode" : ""}
          </span>
        ) : (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/10 text-[#FFB877]">
            Payments not set up
          </span>
        )}
      </div>

      {editing ? (
        <div className="relative flex items-center gap-2">
          <div className="flex items-center bg-white/10 border border-white/15 rounded-2xl px-4 focus-within:border-[#FFB877]">
            <span className="font-serif text-3xl text-white/60">₹</span>
            <input
              type="number"
              min={0}
              step="1"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="w-36 bg-transparent font-serif text-4xl py-2 pl-1 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2.5 rounded-full text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="px-3 py-2.5 rounded-full text-sm text-white/70 hover:bg-white/10">
            Cancel
          </button>
        </div>
      ) : (
        <div className="relative flex items-end gap-4">
          <p className="font-serif text-5xl leading-none">
            {summary.sessionFee ? formatRupees(summary.sessionFee) : "Free"}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="mb-1 text-sm font-medium px-4 py-2 rounded-full border border-white/15 text-white/85 hover:bg-white/10 transition"
          >
            Change
          </button>
        </div>
      )}

      <p className="relative text-sm text-[#D8C9BC] mt-auto pt-5 max-w-sm">
        {summary.sessionFee
          ? "Clients pay this when they book. The slot is confirmed only after payment succeeds."
          : summary.paymentsEnabled
            ? "Booking is free. Set a fee to collect payment when clients book."
            : "Add your Razorpay keys to the server to start collecting payments online."}
      </p>
    </div>
  );
};

const Tile = ({ label, value, hint, accent }) => (
  <div className="relative overflow-hidden rounded-3xl bg-white border border-[#EFE6DA] p-4 flex flex-col justify-between min-h-[104px]">
    <span className="absolute top-0 left-4 right-4 h-[3px] rounded-b-full" style={{ backgroundColor: accent }} />
    <p className="text-xs text-[#8A7A6D] font-medium">{label}</p>
    <div className="mt-2">
      <p className="font-serif text-2xl sm:text-3xl text-[#2B221E] leading-none">{value}</p>
      {hint && <p className="text-[11px] text-[#A89C8F] mt-1.5">{hint}</p>}
    </div>
  </div>
);

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-[#EFE6DA] rounded-xl px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-[#2B221E] mb-1">{d.label}</p>
      <p className="text-[#2B221E]">Net {formatRupees(d.net)}</p>
      {d.refunded > 0 && (
        <p className="text-[#8A7A6D]">
          Collected {formatRupees(d.collected)} · refunded {formatRupees(d.refunded)}
        </p>
      )}
    </div>
  );
};

const RefundModal = ({ payment, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const upcoming = payment.sessionStatus === "confirmed";

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await refundPayment(payment.id, reason);
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
      title={`Refund ${formatRupees(payment.amount)}?`}
      subtitle={`To ${payment.client.name} · original payment method`}
      footer={
        <>
          <button onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition">
            Keep payment
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#C8553D] text-white hover:bg-[#A9432E] transition disabled:opacity-50"
          >
            {saving ? "Refunding…" : "Issue full refund"}
          </button>
        </>
      }
    >
      {upcoming && (
        <p className="text-sm rounded-2xl bg-[#FFF8E6] border border-[#F6DFA8] text-[#7A5414] px-4 py-3 mb-4">
          The session on {formatShortDate(payment.date)} hasn't happened yet, so it will also be cancelled and the client
          emailed.
        </p>
      )}
      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Reason (optional, included in the client's email)"
        className="w-full bg-white border border-[#EFE6DA] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8553D]/30 transition resize-none"
      />
      <p className="text-xs text-[#A89C8F] mt-2">Refunds usually reach the client in 5–7 working days.</p>
      {error && <p className="mt-3 text-sm text-[#9C3B2E] bg-[#FDECEA] rounded-xl px-4 py-3">{error}</p>}
    </Modal>
  );
};

const Billing = () => {
  const { notify } = useToast();
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState(null);
  const [filter, setFilter] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refundTarget, setRefundTarget] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getBillingSummary()
      .then((res) => alive && setSummary(res.data))
      .catch((err) => alive && setError(apiError(err, "Couldn't load billing.")));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    getPayments(filter ? { status: filter } : {})
      .then((res) => alive && setPayments(res.data.payments))
      .catch(() => alive && setPayments([]));
    return () => {
      alive = false;
    };
  }, [filter, reloadKey]);

  const chartData = useMemo(
    () =>
      (summary?.monthly || []).map((m) => ({
        ...m,
        net: m.collected - m.refunded,
        label: format(parseISO(`${m.month}-01`), "MMM yyyy"),
        short: format(parseISO(`${m.month}-01`), "MMM"),
      })),
    [summary]
  );

  const handleReceipt = async (p) => {
    try {
      await downloadReceipt(p.id, p.receiptNumber);
    } catch {
      notify("Couldn't download the receipt.", { type: "error" });
    }
  };

  const s = summary?.stats;

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-6xl w-full mx-auto">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">Practice finances</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Billing</h1>
        </div>

        {error && <p className="rounded-2xl bg-[#FDECEA] text-[#9C3B2E] text-sm px-4 py-3 mb-6">{error}</p>}

        {!summary && !error ? (
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4 mb-8">
            <div className="skeleton h-[220px] rounded-[28px]" />
            <div className="grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[104px] rounded-3xl" />
              ))}
            </div>
          </div>
        ) : summary ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 mb-6">
              <FeeCard
                key={summary.sessionFee}
                summary={summary}
                onSaved={() => setReloadKey((k) => k + 1)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Tile label="This month" value={formatRupees(s.thisMonth)} hint="net of refunds" accent="#D96B00" />
                <Tile label="Last month" value={formatRupees(s.lastMonth)} hint="net of refunds" accent="#FF9E4C" />
                <Tile label="Total collected" value={formatRupees(s.totalCollected)} hint={`${s.paidCount} payments`} accent="#4F7161" />
                <Tile label="Refunded" value={formatRupees(s.totalRefunded)} hint="all time" accent="#8A5C77" />
              </div>
            </div>

            <div className="bg-white border border-[#EFE6DA] rounded-3xl p-5 sm:p-6 mb-8">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-serif text-lg text-[#2B221E]">
                  Net revenue <span className="text-sm text-[#A89C8F] font-sans">last 6 months</span>
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="35%">
                  <CartesianGrid stroke="#F3EBDF" vertical={false} />
                  <XAxis dataKey="short" tick={{ fontSize: 12, fill: "#8A7A6D" }} axisLine={{ stroke: "#EFE6DA" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#8A7A6D" }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v) => (v ? formatRupees(v) : "₹0")}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#FFF3E6" }} />
                  <Bar dataKey="net" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : null}

        {/* Payments */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-serif text-xl text-[#2B221E]">Payments</h2>
          <div className="flex gap-1 p-1 bg-[#F3EBDF]/70 rounded-2xl overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${
                  filter === f.key ? "bg-white text-[#2B221E] shadow-sm" : "text-[#8A7A6D] hover:text-[#2B221E]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#EFE6DA] rounded-3xl overflow-hidden">
          {payments === null ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-14 px-6">
              <p className="font-serif text-lg text-[#2B221E]">No payments yet</p>
              <p className="text-sm text-[#8A7A6D] mt-1">
                {summary?.sessionFee
                  ? "Payments appear here as soon as clients book and pay."
                  : "Set a session fee above to start taking payments at booking."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-[#F0E8DD] text-left text-xs text-[#A89C8F] uppercase tracking-wide">
                    <th className="px-5 py-3.5 font-medium">Client</th>
                    <th className="px-5 py-3.5 font-medium">Session</th>
                    <th className="px-5 py-3.5 font-medium">Paid</th>
                    <th className="px-5 py-3.5 font-medium text-right">Amount</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6F0E8]">
                  {payments.map((p) => {
                    const st = STATUS[p.status] || STATUS.processing;
                    return (
                      <tr key={p.id} className="hover:bg-[#FBF8F3] transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <ClientAvatar name={p.client.name} size="sm" />
                            <div className="min-w-0">
                              <p className="font-medium text-[#2B221E] truncate">{p.client.name}</p>
                              <p className="text-xs text-[#A89C8F] truncate">{p.receiptNumber || p.client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[#6B5B52] whitespace-nowrap">
                          {formatShortDate(p.date)} · {formatTime(p.startTime)}
                        </td>
                        <td className="px-5 py-3.5 text-[#6B5B52] whitespace-nowrap">
                          {p.paidAt ? format(parseISO(p.paidAt), "MMM d, h:mm a") : "—"}
                          {p.method && <span className="block text-xs text-[#A89C8F]">{METHOD[p.method] || p.method}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-[#2B221E] tabular-nums whitespace-nowrap">
                          {formatRupees(p.amount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${st.cls}`} title={p.failureReason || p.refund?.reason || ""}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {(p.status === "paid" || p.status === "refunded") && (
                            <button
                              onClick={() => handleReceipt(p)}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-[#6B5B52] hover:bg-[#FFF3E6] hover:text-[#D96B00] transition"
                            >
                              Receipt
                            </button>
                          )}
                          {p.status === "paid" && (
                            <button
                              onClick={() => setRefundTarget(p)}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-[#9C3B2E]/70 hover:bg-[#FDECEA] hover:text-[#9C3B2E] transition"
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {refundTarget && (
        <RefundModal
          key={refundTarget.id}
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onDone={({ amount, cancelledSession }) => {
            setRefundTarget(null);
            notify(`Refunded ${formatRupees(amount)}${cancelledSession ? " · session cancelled" : ""}`);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default Billing;
