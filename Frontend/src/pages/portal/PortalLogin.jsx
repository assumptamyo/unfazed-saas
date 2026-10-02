import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CodeInput from "../../components/common/CodeInput";
import { requestLoginCode, verifyLoginCode, saveClientToken, getClientToken } from "../../api/portalApi";
import { suggestEmail } from "../../utils/emailTypos";

// Clients sign in with a code emailed to them — no password to create or forget
const PortalLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState("email"); // email | code | choose
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.signedOut ? "You're signed out on this device." : "");
  const [resendIn, setResendIn] = useState(0);

  // Already signed in on this device
  useEffect(() => {
    if (getClientToken() && !location.state?.signedOut) navigate("/portal", { replace: true });
  }, [navigate, location.state]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const suggestion = suggestEmail(email);

  const sendCode = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await requestLoginCode(email.trim());
      setNotice(res.data.message);
      setStep("code");
      setCode("");
      setResendIn(30);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || "Couldn't send a code.");
    } finally {
      setBusy(false);
    }
  };

  const enter = (account) => {
    saveClientToken(account.token);
    navigate("/portal", { replace: true });
  };

  const checkCode = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await verifyLoginCode(email.trim(), value);
      if (res.data.accounts.length === 1) return enter(res.data.accounts[0]);
      setAccounts(res.data.accounts);
      setStep("choose");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't check the code.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F9F6F0] flex items-center justify-center px-6 py-12">
      <div
        className="pointer-events-none absolute -top-1/4 left-1/2 -translate-x-1/2 w-[760px] h-[760px] rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF9E4C 10%, #ffd0b0 40%, transparent 85%)" }}
      />
      <div className="relative w-full max-w-md">
        <Link to="/" className="inline-block mb-5 text-[#D96B00] text-xs font-semibold tracking-widest uppercase">
          Unfazed
        </Link>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight mb-2">Your sessions</h1>
        <p className="text-[#6B6059] text-sm mb-6">
          Sign in to join video sessions and message your therapist. No password needed.
        </p>

        <div className="bg-white/80 backdrop-blur-sm border border-[#EFE6DA] rounded-3xl p-7 shadow-[0_8px_30px_rgba(217,107,0,0.08)]">
          {notice && step === "email" && (
            <p className="text-sm bg-[#EEF3F0] text-[#4F7161] rounded-xl px-4 py-3 mb-5">{notice}</p>
          )}

          {step === "email" && (
            <form onSubmit={sendCode} className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-[#2B221E] mb-1.5">Email you booked with</span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-xl px-4 py-3 text-[#2B221E] placeholder-[#A89C8F] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C] focus:border-transparent transition"
                />
              </label>
              {suggestion && (
                <p className="text-xs text-[#B7791F] -mt-2">
                  Did you mean{" "}
                  <button type="button" onClick={() => setEmail(suggestion)} className="font-semibold underline">
                    {suggestion}
                  </button>
                  ?
                </p>
              )}
              {error && <p className="text-sm text-[#9C3B2E]">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-[#FF9E4C] text-[#211A16] font-medium py-3 rounded-full hover:bg-[#D96B00]/80 transition disabled:opacity-60"
              >
                {busy ? "Sending…" : "Email me a code"}
              </button>
            </form>
          )}

          {step === "code" && (
            <div className="text-center animate-fade-up">
              <p className="text-sm text-[#6B6059] mb-5">
                {notice}
                <br />
                <span className="text-[#2B221E] font-medium">{email}</span>
              </p>
              <CodeInput value={code} onChange={setCode} onComplete={checkCode} disabled={busy} />
              {error && <p className="text-sm text-[#9C3B2E] mt-3">{error}</p>}
              <button
                onClick={() => checkCode()}
                disabled={code.length !== 6 || busy}
                className="mt-5 w-full bg-[#FF9E4C] text-[#211A16] font-medium py-3 rounded-full hover:bg-[#D96B00]/80 transition disabled:opacity-50"
              >
                {busy ? "Checking…" : "Sign in"}
              </button>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                <button
                  onClick={() => sendCode()}
                  disabled={resendIn > 0 || busy}
                  className="font-medium text-[#D96B00] hover:underline disabled:text-[#A89C8F] disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </button>
                <span className="text-[#E5DCD3]">|</span>
                <button
                  onClick={() => {
                    setStep("email");
                    setError("");
                    setNotice("");
                  }}
                  className="font-medium text-[#6B6059] hover:text-[#2B221E]"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          {step === "choose" && (
            <div className="animate-fade-up">
              <p className="text-sm text-[#6B6059] mb-4">You have sessions with more than one therapist. Which space?</p>
              <div className="space-y-2">
                {accounts.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => enter(a)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-[#EFE6DA] hover:border-[#FF9E4C] hover:bg-[#FFF8F0] transition text-left"
                  >
                    <span className="font-medium text-[#2B221E]">{a.therapistName}</span>
                    <span className="text-[#D96B00]">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#A89C8F] mt-6">
          Are you a therapist?{" "}
          <Link to="/login" className="text-[#D96B00] font-medium hover:underline">
            Therapist sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default PortalLogin;
