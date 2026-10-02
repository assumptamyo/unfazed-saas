import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";
import AuthLayout from "../../components/common/AuthLayout";

const inputClass =
  "w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-xl px-4 py-3 text-[#2B221E] placeholder-[#A89C8F] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C] focus:border-transparent transition";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post("/auth/forgot-password", { email });
      navigate("/reset-password", { state: { email } });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a code."
      footer={
        <p className="text-sm text-[#6B6059]" style={{ fontFamily: "Inter, sans-serif" }}>
          Remembered it?{" "}
          <Link to="/login" className="text-[#D96B00] hover:text-[#994900] font-medium">
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" style={{ fontFamily: "Inter, sans-serif" }}>
        {error && (
          <div className="bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#2B221E] mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#FF9E4C] text-[#211A16] font-medium px-8 py-3 rounded-full hover:bg-[#D96B00]/80 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send reset code"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;