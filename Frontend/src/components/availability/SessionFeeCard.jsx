import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBillingSummary, updateSessionFee, formatRupees } from "../../api/billingApi";
import { useToast } from "../../context/toastContext";
import { apiError } from "../appointments/appointmentUtils";
import { useEntitlement } from "../../context/entitlementContext";

// Price per session, set alongside the schedule. Same value as on the Billing page.
const SessionFeeCard = () => {
  const { notify } = useToast();
  const { can, promptUpgrade } = useEntitlement();
  const [info, setInfo] = useState(null); // { sessionFee, paymentsEnabled }
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBillingSummary()
      .then((res) => {
        setInfo({ sessionFee: res.data.sessionFee, paymentsEnabled: res.data.paymentsEnabled });
        setValue(String(res.data.sessionFee / 100));
      })
      .catch(() => setInfo({ sessionFee: 0, paymentsEnabled: false, failed: true }));
  }, []);

  if (!info) return <div className="skeleton h-[92px] rounded-3xl mb-8" />;

  // Plans without online payments: booking stays free
  if (!can("payments.online")) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-[#EFE6DA] rounded-3xl p-5 mb-8">
        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg text-[#2B221E] leading-tight">Session fee 🔒</p>
          <p className="text-sm text-[#8A7A6D] mt-0.5">Booking is free on your plan. Take payment at booking on a paid plan.</p>
        </div>
        <button
          onClick={() => promptUpgrade("payments.online", "Take payments at booking")}
          className="px-5 py-3 rounded-2xl text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition"
        >
          Unlock online payments
        </button>
      </div>
    );
  }

  const rupees = Number(value);
  const changed = String(info.sessionFee / 100) !== value && value !== "";
  const blocked = rupees > 0 && !info.paymentsEnabled;

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateSessionFee(rupees || 0);
      setInfo((i) => ({ ...i, sessionFee: res.data.sessionFee }));
      setValue(String(res.data.sessionFee / 100));
      notify(res.data.sessionFee ? `Session fee set to ${formatRupees(res.data.sessionFee)}` : "Booking is now free");
    } catch (err) {
      notify(apiError(err), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-[#EFE6DA] rounded-3xl p-5 mb-8">
      <div className="flex-1 min-w-0">
        <p className="font-serif text-lg text-[#2B221E] leading-tight">Session fee</p>
        <p className="text-sm text-[#8A7A6D] mt-0.5">
          {info.sessionFee > 0
            ? "Clients pay this online when they book."
            : "Set to 0 for free booking, or enter a price to take payment when clients book."}
        </p>
        {blocked && (
          <p className="text-xs text-[#B7791F] mt-1.5">
            Online payments aren't connected yet.{" "}
            <Link to="/therapist/billing" className="font-semibold underline">
              See Billing
            </Link>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-[#FBF8F3] border border-[#EFE6DA] rounded-2xl pl-4 focus-within:ring-2 focus-within:ring-[#FF9E4C]/40 focus-within:border-[#FF9E4C] transition">
          <span className="font-serif text-xl text-[#8A7A6D]">₹</span>
          <input
            type="number"
            min={0}
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && changed && !blocked && save()}
            aria-label="Session fee in rupees"
            className="w-28 bg-transparent font-serif text-xl text-[#2B221E] py-2.5 px-2 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-[#A89C8F] pr-4">/ session</span>
        </div>
        <button
          onClick={save}
          disabled={!changed || saving || blocked}
          className="px-5 py-3 rounded-2xl text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
};

export default SessionFeeCard;
