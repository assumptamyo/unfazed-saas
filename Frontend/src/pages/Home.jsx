import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const serif = { fontFamily: "Literata, serif" };
const sans = { fontFamily: "Inter, sans-serif" };

// Sample day shown in the preview (illustration only)
const PREVIEW_SESSIONS = [
  { time: "10:00", name: "Ananya R.", tag: "Video", live: true },
  { time: "12:30", name: "Rohan M.", tag: "Video" },
  { time: "16:00", name: "Priya S.", tag: "First session" },
];

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ProductPreview = () => (
  <div className="relative w-full max-w-md mx-auto lg:mx-0" aria-hidden="true">
    {/* Main card: today's sessions */}
    <div className="animate-float bg-white/90 backdrop-blur border border-[#EFE6DA] rounded-[28px] p-6 shadow-[0_30px_60px_-30px_rgba(43,34,30,0.35)]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A89C8F]" style={sans}>Today</p>
          <p className="text-lg text-[#2B221E] mt-0.5" style={serif}>Good morning, Dr. Meera</p>
        </div>
        <span className="text-[11px] font-medium text-[#4F7161] bg-[#EAF1EC] px-2.5 py-1 rounded-full" style={sans}>
          3 sessions
        </span>
      </div>

      <ul className="space-y-2.5" style={sans}>
        {PREVIEW_SESSIONS.map((s) => (
          <li
            key={s.time}
            className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${s.live ? "bg-[#FFF3E6]" : "bg-[#FBF8F3]"}`}
          >
            <span className="w-12 text-sm font-semibold text-[#2B221E]">{s.time}</span>
            <span className="w-8 h-8 rounded-full bg-[#FFE3C2] text-[#D96B00] text-xs font-semibold flex items-center justify-center">
              {s.name[0]}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-[#2B221E] truncate">{s.name}</span>
              <span className="block text-[11px] text-[#8A7A6D]">{s.tag}</span>
            </span>
            {s.live && (
              <span className="text-[11px] font-semibold text-white bg-[#D96B00] px-3 py-1.5 rounded-full">Join</span>
            )}
          </li>
        ))}
      </ul>
    </div>

    <div
      className="absolute -top-12 -right-3 sm:-right-8 bg-white border border-[#EFE6DA] rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3 animate-float"
      style={{ ...sans, animationDelay: "-2s" }}
    >
      <span className="w-8 h-8 rounded-full bg-[#E7F2EC] text-[#2F855A] flex items-center justify-center">
        <Check />
      </span>
      <span>
        <span className="block text-[11px] text-[#8A7A6D]">Payment received</span>
        <span className="block text-sm font-semibold text-[#2B221E]">₹1,500</span>
      </span>
    </div>

    {/* Floating: new booking */}
    <div
      className="absolute -bottom-6 -left-3 sm:-left-10 bg-[#211A16] text-white rounded-2xl px-4 py-3 shadow-xl animate-float"
      style={{ ...sans, animationDelay: "-4s" }}
    >
      <span className="block text-[11px] text-[#FFB877]">New booking</span>
      <span className="block text-sm font-medium">Sat · 11:00 AM</span>
    </div>
  </div>
);

const Home = () => {
  const { therapist, loading } = useAuth();

  if (loading) return null;

  if (therapist) {
    return <Navigate to="/therapist/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F9F6F0] flex items-center px-6 py-16">
      <div
        className="pointer-events-none absolute -top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF9E4C 10%, #ffd0b0 40%, transparent 85%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #9FC3B0 10%, #DCEAE2 45%, transparent 85%)" }}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-16 lg:gap-12 items-center">
        {/* Left: words */}
        <div className="text-center lg:text-left animate-fade-up">
          <p className="text-[#D96B00] text-xs font-semibold tracking-widest uppercase" style={sans}>Unfazed</p>
          <p className="mt-4 text-xl sm:text-2xl text-[#6B5B52] italic font-light" style={serif}>
            Welcome, therapists!
          </p>

          <h1
            className="mt-4 text-[#2B221E] text-4xl sm:text-5xl xl:text-6xl font-normal leading-[1.12] tracking-tight"
            style={serif}
          >
            A calmer way to <br className="hidden sm:block" />
            <span className="italic font-light text-[#D96B00]">care for your clients</span>
          </h1>

          <p className="mt-6 text-[#4A3F38] text-lg leading-relaxed max-w-md mx-auto lg:mx-0 font-light" style={sans}>
            Bookings, payments and notes — all in one link you share with clients.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-center lg:justify-start" style={sans}>
            <Link
              to="/register"
              className="bg-[#FF9E4C] text-[#211A16] font-medium px-8 py-3 rounded-full hover:bg-[#D96B00]/80 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FF9E4C] focus:ring-offset-2"
            >
              Get started
            </Link>
            <Link to="/login" className="text-[#D96B00] text-sm hover:text-[#994900] transition-colors duration-200">
              Already have a therapist account? Log in
            </Link>
          </div>

          <Link
            to="/portal/login"
            className="mt-10 inline-flex items-center gap-1.5 text-xs text-[#6B5B52] border border-[#E5DCD3] bg-white/60 px-4 py-2 rounded-full hover:border-[#4F7161]/50 hover:text-[#4F7161] transition"
            style={sans}
          >
            Are you a client? <span className="font-medium text-[#4F7161]">Open my sessions →</span>
          </Link>
        </div>

        {/* Right: a glimpse of the product */}
        <div className="px-4 sm:px-8 lg:px-0">
          <p
            className="mb-5 flex items-center justify-center lg:justify-start gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#4F7161] max-w-md mx-auto lg:mx-0"
            style={sans}
          >
            Dashboard preview
          </p>
          <ProductPreview />
        </div>
      </div>
    </div>
  );
};

export default Home;
