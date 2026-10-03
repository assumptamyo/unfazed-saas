import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../appointments/Modal";
import { EntitlementContext, UPGRADE_EVENT } from "../../context/entitlementContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/toastContext";
import { getEntitlements, changePlan } from "../../api/subscriptionApi";
import { formatRupees } from "../../api/billingApi";

const LockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// One upgrade prompt for the whole app, opened by promptUpgrade() or by any
// API call that the server blocked with UPGRADE_REQUIRED
const UpgradeModal = ({ info, onClose, onUpgraded }) => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const next = info.upgradeTo;

  const upgrade = async () => {
    setBusy(true);
    try {
      const res = await changePlan(next.key);
      notify(res.data.message);
      onUpgraded(res.data);
    } catch (err) {
      notify(err.response?.data?.message || "Couldn't change plan", { type: "error" });
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={info.title || "Upgrade to unlock this"}
      footer={
        <>
          <button onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition">
            Not now
          </button>
          <button
            onClick={() => {
              onClose();
              navigate("/therapist/plans");
            }}
            className="px-5 py-2.5 rounded-full text-sm font-medium border border-[#E5DCD3] text-[#2B221E] hover:border-[#FF9E4C] transition"
          >
            Compare plans
          </button>
          {next && (
            <button
              onClick={upgrade}
              disabled={busy}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-50"
            >
              {busy ? "Upgrading…" : `Upgrade to ${next.name}`}
            </button>
          )}
        </>
      }
    >
      <div className="flex items-start gap-4">
        <span className="w-12 h-12 shrink-0 rounded-2xl bg-[#FFF3E6] text-[#D96B00] flex items-center justify-center">
          <LockIcon />
        </span>
        <div>
          <p className="text-sm text-[#4A413A] leading-relaxed">{info.message}</p>
          {info.tier && <p className="text-xs text-[#A89C8F] mt-2">You're on the {info.tier.name} plan.</p>}
          {next && (
            <p className="text-sm text-[#2B221E] mt-3">
              <strong>{next.name}</strong> — {next.monthlyPrice ? `${formatRupees(next.monthlyPrice)}/month` : "free"}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

const EntitlementProvider = ({ children }) => {
  const { therapist, token } = useAuth();
  const [state, setState] = useState({ tier: null, features: {} });
  const [prompt, setPrompt] = useState(null);

  const refresh = useCallback(() => {
    if (!token) return Promise.resolve();
    return getEntitlements()
      .then((res) => setState(res.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (therapist) refresh();
  }, [therapist, refresh]);

  // Server-side blocks from anywhere in the app
  useEffect(() => {
    const onBlocked = (e) => setPrompt(e.detail);
    window.addEventListener(UPGRADE_EVENT, onBlocked);
    return () => window.removeEventListener(UPGRADE_EVENT, onBlocked);
  }, []);

  // Until entitlements load, don't hide features; the server still enforces every gate
  const can = useCallback((key) => state.features[key]?.allowed ?? true, [state.features]);
  const feature = useCallback((key) => state.features[key] || null, [state.features]);
  const promptUpgrade = useCallback(
    (key, title) => {
      const f = state.features[key];
      if (f) setPrompt({ ...f, title });
    },
    [state.features]
  );

  return (
    <EntitlementContext.Provider value={{ tier: state.tier, features: state.features, can, feature, refresh, promptUpgrade }}>
      {children}
      {prompt && (
        <UpgradeModal
          info={prompt}
          onClose={() => setPrompt(null)}
          onUpgraded={(data) => {
            setState({ tier: data.tier, features: data.features });
            setPrompt(null);
          }}
        />
      )}
    </EntitlementContext.Provider>
  );
};

export default EntitlementProvider;
