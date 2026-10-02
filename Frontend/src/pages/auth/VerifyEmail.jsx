import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";
import AuthLayout from "../../components/common/AuthLayout";

const inputClass =
  "w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-xl px-4 py-3 text-[#2B221E] placeholder-[#A89C8F] text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C] focus:border-transparent transition";

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post("/auth/verify-email", { email, otp });
      navigate("/login", {
        state: { message: "Email verified. You can now log in." },
      });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMessage("");
    try {
      await axiosInstance.post("/auth/resend-otp", {
        email,
        purpose: "email_verification",
      });
      setResendMessage("A new code has been sent.");
    } catch (err) {
      setResendMessage(err.response?.data?.message || "Could not resend code.");
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <AuthLayout title="Verify your email">
        <p className="text-[#6B6059] text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
          We couldn't find an email to verify.{" "}
          <Link to="/login" className="text-[#D96B00] hover:text-[#994900] font-medium">
            Go to login
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={`Enter the 6-digit code sent to ${email}`}
    >
      <form onSubmit={handleSubmit} className="space-y-5" style={{ fontFamily: "Inter, sans-serif" }}>
        {error && (
          <div className="bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          className={inputClass}
          placeholder="------"
        />

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full bg-[#FF9E4C] text-[#211A16] font-medium px-8 py-3 rounded-full hover:bg-[#D96B00]/80 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Verifying..." : "Verify email"}
        </button>

        <div className="text-center text-sm text-[#6B6059]">
          {resendMessage ? (
            <span>{resendMessage}</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-[#D96B00] hover:text-[#994900] font-medium disabled:opacity-60"
            >
              {resending ? "Sending..." : "Didn't get a code? Resend"}
            </button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
};

export default VerifyEmail;