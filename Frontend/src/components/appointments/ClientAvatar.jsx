import { avatarGradient, initials } from "./appointmentUtils";

const sizes = {
  sm: "w-8 h-8 text-[11px]",
  md: "w-11 h-11 text-sm",
  lg: "w-14 h-14 text-lg",
};

const ClientAvatar = ({ name, size = "md", className = "" }) => (
  <div
    className={`${sizes[size]} shrink-0 rounded-2xl flex items-center justify-center font-semibold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.08)] ${className}`}
    style={{ background: avatarGradient(name) }}
    aria-hidden="true"
  >
    {initials(name)}
  </div>
);

export default ClientAvatar;
