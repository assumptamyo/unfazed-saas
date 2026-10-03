import { format, parseISO } from "date-fns";
import { formatRupees } from "../../api/billingApi";

const PACKAGE_STATE = {
  active: { label: "Active", cls: "bg-[#EEF3F0] text-[#4F7161]" },
  used: { label: "All used", cls: "bg-[#F3EFEA] text-[#8A7A6D]" },
  expired: { label: "Expired", cls: "bg-[#FFF8E6] text-[#B7791F]" },
  refunded: { label: "Refunded", cls: "bg-[#F3EFEA] text-[#8A7A6D]" },
};

// A client's packages and payment history, on their profile
const ClientBilling = ({ packages, payments }) => (
  <div className="bg-white border border-[#E5DCD3] rounded-3xl p-6 mb-6">
    <h2
      className="text-lg text-[#2B221E] mb-4"
      style={{ fontFamily: "Literata, serif" }}
    >
      Packages & payments
    </h2>

    {packages.length > 0 && (
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        {packages.map((p) => {
          const st = PACKAGE_STATE[p.state] || PACKAGE_STATE.active;
          return (
            <div
              key={p.id}
              className="rounded-2xl border border-[#EFE6DA] bg-[#FBF8F3] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#2B221E]">
                  {p.sessionsTotal}-session package
                </p>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}
                >
                  {st.label}
                </span>
              </div>
              {/* Progress: sessions used out of the total */}
              <div
                className="h-1.5 rounded-full bg-[#EFE6DA] mt-2.5 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-[#4F7161]"
                  style={{
                    width: `${(p.sessionsUsed / p.sessionsTotal) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-[#8A7A6D] mt-2">
                {p.sessionsUsed} used · {p.remaining} left · until{" "}
                {format(parseISO(p.expiresAt), "MMM d, yyyy")}
              </p>
            </div>
          );
        })}
      </div>
    )}

    {payments.length > 0 && (
      <div className="divide-y divide-[#F6F0E8]">
        {payments.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="text-[#2B221E]">
                {p.kind === "package"
                  ? `${p.packageSessions}-session package`
                  : "Session"}
              </p>
              <p className="text-xs text-[#A89C8F]">
                {p.paidAt ? format(parseISO(p.paidAt), "MMM d, yyyy") : "—"}
                {p.receiptNumber && ` · ${p.receiptNumber}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold text-[#2B221E] tabular-nums">
                {formatRupees(p.amount)}
              </p>
              {p.status === "refunded" && (
                <p className="text-[11px] text-[#9C3B2E]">
                  refunded {formatRupees(p.refundAmount || p.amount)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ClientBilling;
