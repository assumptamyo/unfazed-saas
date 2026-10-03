import { useEffect, useState } from "react";
import { getPackages, savePackage, formatRupees } from "../../api/billingApi";
import { apiError } from "../appointments/appointmentUtils";
import { useToast } from "../../context/toastContext";
import { useEntitlement } from "../../context/entitlementContext";

const inputCls =
  "w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-xl px-3 py-2 text-sm text-[#2B221E] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition [&::-webkit-inner-spin-button]:appearance-none";

// One package size (3, 6 or 12 sessions): on/off, price per session, validity
const PackageRow = ({ pkg, sessionFee, locked, onSaved }) => {
  const { notify } = useToast();
  const [price, setPrice] = useState(String(pkg.pricePerSession / 100));
  const [days, setDays] = useState(String(pkg.validityDays));
  const [saving, setSaving] = useState(false);

  const pricePaise = Math.round((Number(price) || 0) * 100);
  const total = pricePaise * pkg.sessionCount;
  const saving_ =
    sessionFee > pricePaise ? (sessionFee - pricePaise) * pkg.sessionCount : 0;
  const dirty =
    pricePaise !== pkg.pricePerSession || Number(days) !== pkg.validityDays;

  const save = async (active) => {
    setSaving(true);
    try {
      const res = await savePackage(pkg.sessionCount, {
        active,
        pricePerSession: Number(price) || 0,
        validityDays: Number(days) || 0,
      });
      notify(res.data.message);
      onSaved(res.data.package);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition ${pkg.active ? "border-[#D7E5DC] bg-[#F7FAF8]" : "border-[#EFE6DA] bg-white"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-serif text-lg text-[#2B221E] leading-tight">
            {pkg.sessionCount} sessions
          </p>
          <p className="text-xs text-[#8A7A6D] mt-0.5">
            {total ? formatRupees(total) : "—"}
            {saving_ > 0 && (
              <span className="text-[#4F7161]">
                {" "}
                · client saves {formatRupees(saving_)}
              </span>
            )}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={pkg.active}
          aria-label={`Offer the ${pkg.sessionCount}-session package`}
          disabled={saving || locked}
          onClick={() => save(!pkg.active)}
          className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-40 ${pkg.active ? "bg-[#4F7161]" : "bg-[#E5DCD3]"}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${pkg.active ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="text-[11px] font-medium text-[#8A7A6D]">
          Price per session (₹)
          <input
            type="number"
            min={1}
            value={price}
            disabled={locked}
            onChange={(e) => setPrice(e.target.value)}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="text-[11px] font-medium text-[#8A7A6D]">
          Valid for (days)
          <input
            type="number"
            min={7}
            max={730}
            value={days}
            disabled={locked}
            onChange={(e) => setDays(e.target.value)}
            className={`${inputCls} mt-1`}
          />
        </label>
      </div>

      {dirty && !locked && (
        <button
          onClick={() => save(pkg.active)}
          disabled={saving}
          className="mt-3 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      )}
    </div>
  );
};

// Session packages the therapist offers on their booking page
const PackagesCard = ({ sessionFee }) => {
  const { can, promptUpgrade } = useEntitlement();
  const allowed = can("payments.online");
  const [packages, setPackages] = useState(null);

  useEffect(() => {
    let alive = true;
    getPackages()
      .then((res) => alive && setPackages(res.data.packages))
      .catch(() => alive && setPackages([]));
    return () => {
      alive = false;
    };
  }, [sessionFee]);

  const locked = !allowed || !sessionFee;

  return (
    <div className="bg-white border border-[#EFE6DA] rounded-3xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-serif text-lg text-[#2B221E]">Session packages</h2>
        {!allowed && (
          <button
            onClick={() =>
              promptUpgrade("payments.online", "Offer session packages")
            }
            className="text-xs font-medium text-[#D96B00] hover:underline"
          >
            🔒 Unlock
          </button>
        )}
      </div>
      <p className="text-sm text-[#8A7A6D] mb-4">
        {sessionFee
          ? "Clients can buy several sessions at once at a lower rate. Their next bookings use the package automatically."
          : "Set a session fee first — packages are offered alongside paid sessions."}
      </p>

      {packages === null ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {packages.map((p) => (
            <PackageRow
              key={`${p.sessionCount}-${p.id}-${p.active}`}
              pkg={p}
              sessionFee={sessionFee}
              locked={locked}
              onSaved={(saved) =>
                setPackages((list) =>
                  list.map((x) =>
                    x.sessionCount === saved.sessionCount ? saved : x,
                  ),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PackagesCard;
