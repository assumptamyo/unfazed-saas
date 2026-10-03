import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getPlans, changePlan } from "../../api/subscriptionApi";
import { formatRupees } from "../../api/billingApi";
import { useEntitlement } from "../../context/entitlementContext";
import { useToast } from "../../context/toastContext";

const Check = ({ on }) =>
  on ? (
    <span className="w-5 h-5 rounded-full bg-[#4F7161] text-white text-[10px] font-bold flex items-center justify-center">✓</span>
  ) : (
    <span className="w-5 h-5 rounded-full border-2 border-[#E5DCD3]" />
  );

const Plans = () => {
  const { refresh } = useEntitlement();
  const { notify } = useToast();
  const [data, setData] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getPlans()
      .then((res) => setData(res.data))
      .catch(() => notify("Couldn't load plans", { type: "error" }));
  }, [reloadKey, notify]);

  const choose = async (tier) => {
    setBusyKey(tier.key);
    try {
      const res = await changePlan(tier.key);
      notify(res.data.feeReset ? `${res.data.message}. Your session fee was set to ₹0.` : res.data.message);
      await refresh();
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(err.response?.data?.message || "Couldn't change plan", { type: "error" });
    } finally {
      setBusyKey(null);
    }
  };

  const used = data?.usage.activeClients ?? 0;

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-6xl w-full mx-auto">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">Your subscription</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Plans</h1>
        </div>

        {!data ? (
          <div className="grid md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-96 rounded-[28px]" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              {data.tiers.map((tier) => {
                const current = tier.key === data.currentTier;
                const cap = tier.limits?.activeClients ?? null;
                const pct = cap ? Math.min((used / cap) * 100, 100) : 0;
                return (
                  <div
                    key={tier.key}
                    className={`relative flex flex-col rounded-[28px] p-6 border transition ${
                      current
                        ? "bg-[#211A16] text-white border-[#211A16] shadow-[0_20px_50px_rgba(33,26,22,0.25)]"
                        : "bg-white border-[#EFE6DA] hover:border-[#FFD9AE]"
                    }`}
                  >
                    {current && (
                      <span className="absolute top-5 right-5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FF9E4C] text-[#211A16]">
                        Current plan
                      </span>
                    )}
                    <p className={`font-serif text-2xl ${current ? "text-white" : "text-[#2B221E]"}`}>{tier.name}</p>
                    <p className={`text-sm mt-1 ${current ? "text-[#D8C9BC]" : "text-[#8A7A6D]"}`}>{tier.description}</p>
                    <p className="mt-5">
                      <span className="font-serif text-4xl">{tier.monthlyPrice ? formatRupees(tier.monthlyPrice) : "Free"}</span>
                      {tier.monthlyPrice > 0 && (
                        <span className={`text-sm ${current ? "text-white/60" : "text-[#A89C8F]"}`}> / month</span>
                      )}
                    </p>

                    <ul className="mt-6 space-y-3 flex-1">
                      {data.features.map((f) => (
                        <li key={f.key} className="flex items-center gap-2.5 text-sm">
                          {f.type === "limit" ? (
                            <>
                              <Check on />
                              <span>
                                {tier.limits?.[f.field] === null ? "Unlimited" : `Up to ${tier.limits?.[f.field]}`} active clients
                              </span>
                            </>
                          ) : (
                            <>
                              <Check on={tier.features?.[f.field]} />
                              <span className={tier.features?.[f.field] ? "" : current ? "text-white/40" : "text-[#C4B8AC]"}>{f.label}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>

                    {current && cap !== null && (
                      <div className="mt-6">
                        <div className="flex justify-between text-xs text-white/70 mb-1.5">
                          <span>Active clients</span>
                          <span>
                            {used} / {cap}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? "bg-[#E8775F]" : "bg-[#FF9E4C]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {!current && (
                      <button
                        onClick={() => choose(tier)}
                        disabled={!!busyKey}
                        className="mt-6 w-full py-3 rounded-full text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition disabled:opacity-50"
                      >
                        {busyKey === tier.key ? "Switching…" : `Switch to ${tier.name}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[#A89C8F] mt-6 text-center">
              Demo: switching plans is instant and free. Subscription billing for therapists isn't connected.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Plans;
