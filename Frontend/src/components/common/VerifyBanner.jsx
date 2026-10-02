import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axiosInstance from "../../api/axiosInstance";

const VerifyBanner = () => {
  const { therapist } = useAuth();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!therapist || therapist.isVerified || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await axiosInstance.post("/auth/resend-otp", {
        email: therapist.email,
        purpose: "email_verification",
      });
      setSent(true);
      setTimeout(() => {
        navigate("/verify-email", { state: { email: therapist.email } });
      }, 1200);
    } catch (err) {
      console.error("Resend OTP failed:", err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="bg-[#FFF3E6] border border-[#FFD9AE] text-[#8A4B00] text-sm px-5 py-3 flex items-center justify-between gap-4"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <p>
        {sent
          ? "A new code has been sent — redirecting..."
          : "Please verify your email to unlock all features."}
      </p>

      {!sent && (
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={handleResend}
            disabled={sending}
            className="font-medium text-[#D96B00] hover:text-[#994900] disabled:opacity-60"
          >
            {sending ? "Sending..." : "Verify now"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-[#A87C4F] hover:text-[#8A4B00]"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default VerifyBanner;