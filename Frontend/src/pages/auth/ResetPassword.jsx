import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";
import AuthLayout from "../../components/common/AuthLayout";
import PasswordInput from "../../components/common/PasswordInput";

const otpInputClass =
  "w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-xl px-4 py-3 text-[#2B221E] placeholder-[#A89C8F] text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C] focus:border-transparent transition";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post("/auth/reset-password", { email, otp, newPassword });
      navigate("/login", { state: { message: "Password reset. Please log in." } });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <AuthLayout title="Reset password">
        <p className="text-[#6B6059] text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
          Please start from{" "}
          <Link to="/forgot-password" className="text-[#D96B00] hover:text-[#994900] font-medium">
            forgot password
          </Link>
          .
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle={`Enter the code sent to ${email}`}>
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
          className={otpInputClass}
          placeholder="------"
        />

        <div>
          <label className="block text-sm font-medium text-[#2B221E] mb-1.5">New password</label>
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full bg-[#FF9E4C] text-[#211A16] font-medium px-8 py-3 rounded-full hover:bg-[#D96B00]/80 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;