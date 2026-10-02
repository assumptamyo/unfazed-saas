import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "../../components/common/AuthLayout";
import PasswordInput from "../../components/common/PasswordInput";

const inputClass =
  "w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-xl px-4 py-3 text-[#2B221E] placeholder-[#A89C8F] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C] focus:border-transparent transition";

const labelClass = "block text-sm font-medium text-[#2B221E] mb-1.5";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.message;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/therapist/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      footer={
        <p
          className="text-sm text-[#6B6059]"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-[#D96B00] hover:text-[#994900] font-medium"
          >
            Sign up
          </Link>
        </p>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {successMessage && (
          <div className="bg-[#EAF6EC] border border-[#BFE3C6] text-[#2F6B3A] text-sm rounded-lg px-4 py-3">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={`${labelClass} mb-0`}>Password</label>
            <Link
              to="/forgot-password"
              className="text-xs text-[#D96B00] hover:text-[#994900]"
            >
              Forgot password?
            </Link> 
          </div>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#FF9E4C] text-[#211A16] font-medium px-8 py-3 rounded-full hover:bg-[#D96B00]/80 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
