import { useEffect } from "react";

// Centered dialog on desktop, bottom sheet on mobile
const Modal = ({ open, onClose, title, subtitle, children, footer, maxWidth = "max-w-lg" }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-[#211A16]/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} max-h-[92vh] flex flex-col bg-[#FFFDF9] rounded-t-3xl sm:rounded-3xl shadow-[0_24px_80px_rgba(33,26,22,0.25)] animate-pop`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <h2 className="font-serif text-xl text-[#2B221E]">{title}</h2>
            {subtitle && <p className="text-sm text-[#8A7A6D] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full text-[#8A7A6D] hover:bg-[#F3EBDF] hover:text-[#2B221E] transition flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-6 pb-4 overflow-y-auto scroll-thin">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[#F0E8DD] flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
