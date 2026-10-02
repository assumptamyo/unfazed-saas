import { Link } from "react-router-dom";

const AuthLayout = ({ title, children, footer }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F9F6F0] flex items-center justify-center px-6 py-12">
      <div
        className="pointer-events-none absolute -top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #FF9E4C 10%, #ffd0b0 40%, transparent 85%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/"
          className="inline-block mb-5 text-[#D96B00] text-xs font-semibold tracking-widest uppercase"
        >
          Unfazed
        </Link>

        <h1
          className="text-[#2B221E] text-3xl sm:text-4xl font-normal leading-tight mb-2 tracking-tight"
          style={{ fontFamily: "Literata, serif" }}
        >
          {title}
        </h1>


        <div className="bg-white/70 backdrop-blur-sm border border-[#EFE6DA] rounded-2xl p-8 shadow-[0_8px_30px_rgba(217,107,0,0.08)]">
          {children}
        </div>

        {footer && <div className="mt-6 text-center">{footer}</div>}
      </div>
    </div>
  );
};

export default AuthLayout;