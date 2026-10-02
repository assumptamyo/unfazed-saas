import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Home = () => {
  const { therapist, loading } = useAuth();

  if (loading) return null;

  if (therapist) {
    return <Navigate to="/therapist/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F9F6F0] flex items-center justify-center px-6">
      <div
        className="pointer-events-none absolute -top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #FF9E4C 10%, #ffd0b0 40%, transparent 85%)",
        }}
      />

      <div className="relative z-10 max-w-2xl w-full text-center animate-[fadeUp_0.8s_ease-out]">
        
       <div className="inline-block mb-6 text-[#D96B00] text-xs font-semibold tracking-widest uppercase">
          Unfazed
        </div>

        <h1
          className="text-[#2B221E] text-4xl sm:text-6xl font-normal leading-[1.15] mb-6 tracking-tight capitalize"
          style={{ fontFamily: "Literata, serif" }}
        >
          A calmer way to <br />
          <span className="italic font-light text-[#D96B00]">care for your clients</span>
        </h1>

        <p
          className="text-[#211A16] text-lg sm:text-xl leading-relaxed mb-10 max-w-lg mx-auto font-light"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Scheduling, secure payments, and clinical notes — streamlined into one elegant branded link you share with clients.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-5">
          <Link
            to="/register"
            className="bg-[#FF9E4C] text-[#211A16] font-medium px-8 py-3 rounded-full hover:bg-[#D96B00]/80 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FF9E4C] focus:ring-offset-2 focus:ring-offset-[#211A16]"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Get started
          </Link>

          <Link
            to="/login"
            className="text-[#D96B00] text-sm hover:text-[#994900] transition-colors duration-200"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;