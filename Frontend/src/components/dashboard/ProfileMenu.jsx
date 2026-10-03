import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/toastContext";
import { useEntitlement } from "../../context/entitlementContext";

const Icon = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const icons = {
  edit: <Icon d={<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>} />,
  external: <Icon d={<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>} />,
  copy: <Icon d={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>} />,
  calendar: <Icon d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />,
  card: <Icon d={<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>} />,
  logout: <Icon d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>} />,
};

const Avatar = ({ therapist, size = "w-10 h-10" }) =>
  therapist?.photoUrl ? (
    <img src={therapist.photoUrl} alt="" className={`${size} rounded-2xl object-cover border border-[#E5DCD3]`} />
  ) : (
    <div
      className={`${size} rounded-2xl bg-[#FF9E4C]/20 flex items-center justify-center text-[#D96B00] text-sm font-bold border border-[#FF9E4C]/30 font-serif`}
    >
      {therapist?.name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );

// The profile button in the top bar and its dropdown menu
const ProfileMenu = ({ therapist }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { logout } = useAuth();
  const { notify } = useToast();
  const { tier } = useEntitlement();
  const navigate = useNavigate();

  const bookingUrl = therapist?.slug ? `${window.location.origin}/${therapist.slug}` : "";

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      notify("Booking link copied");
    } catch {
      notify("Couldn't copy the link", { type: "error" });
    }
    setOpen(false);
  };

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const item = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#2B221E] hover:bg-[#FFF3E6] transition text-left";

  return (
    <div className="relative pl-3 border-l border-[#E5DCD3] ml-1" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-2xl p-0.5 pr-1 hover:bg-[#F9F6F0] transition"
      >
        <Avatar therapist={therapist} />
        <div className="hidden lg:block text-left">
          <p className="text-sm font-semibold text-[#2B221E] leading-tight">{therapist?.name}</p>
          <p className="text-xs text-[#8A7A6D] leading-tight mt-0.5">My account</p>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`hidden lg:block text-[#A89C8F] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-72 bg-white border border-[#E5DCD3] rounded-3xl shadow-[0_20px_50px_rgba(33,26,22,0.15)] p-2 z-30 animate-pop"
        >
          <div className="flex items-center gap-3 px-3 py-3 mb-1 rounded-2xl bg-[#FBF8F3]">
            <Avatar therapist={therapist} size="w-11 h-11" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#2B221E] truncate">{therapist?.name}</p>
              <p className="text-xs text-[#8A7A6D] truncate">{therapist?.email}</p>
            </div>
          </div>
          {tier && (
            <Link
              to="/therapist/plans"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3 py-2 mb-1 rounded-xl text-xs hover:bg-[#FFF3E6] transition"
            >
              <span className="text-[#8A7A6D]">
                Plan: <strong className="text-[#2B221E]">{tier.name}</strong>
              </span>
              <span className="font-semibold text-[#D96B00]">View plans →</span>
            </Link>
          )}

          <Link to="/therapist/profile" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <span className="text-[#D96B00]">{icons.edit}</span>
            Edit profile
          </Link>
          {bookingUrl && (
            <>
              <a href={bookingUrl} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpen(false)} className={item}>
                <span className="text-[#8A7A6D]">{icons.external}</span>
                <span className="flex-1">View my booking page</span>
              </a>
              <button onClick={copyLink} role="menuitem" className={item}>
                <span className="text-[#8A7A6D]">{icons.copy}</span>
                <span className="flex-1 min-w-0">
                  Copy booking link
                  <span className="block text-[11px] text-[#A89C8F] truncate">{bookingUrl.replace(/^https?:\/\//, "")}</span>
                </span>
              </button>
            </>
          )}

          <div className="h-px bg-[#F0E8DD] my-1.5 mx-2" />

          <Link to="/therapist/schedule" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <span className="text-[#8A7A6D]">{icons.calendar}</span>
            Availability
          </Link>
          <Link to="/therapist/billing" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <span className="text-[#8A7A6D]">{icons.card}</span>
            Billing & payments
          </Link>

          <div className="h-px bg-[#F0E8DD] my-1.5 mx-2" />

          <button onClick={signOut} role="menuitem" className={`${item} text-[#9C3B2E] hover:bg-[#FDECEA]`}>
            {icons.logout}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
