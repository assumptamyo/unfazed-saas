import { useState, useCallback, useRef } from "react";
import { ToastContext } from "../../context/toastContext";

const styles = {
  success: { dot: "bg-[#6B9080]", icon: "✓" },
  error: { dot: "bg-[#C8553D]", icon: "!" },
  info: { dot: "bg-[#FF9E4C]", icon: "i" },
};

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message, { type = "success", action, duration = 4500 } = {}) => {
      if (!message) return; // e.g. errors already shown by the upgrade prompt
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, message, type, action }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        className="fixed bottom-5 right-5 left-5 sm:left-auto z-[70] flex flex-col gap-2 items-stretch sm:items-end pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const s = styles[t.type] || styles.info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto animate-pop flex items-center gap-3 bg-[#211A16] text-white text-sm pl-3 pr-2 py-2.5 rounded-2xl shadow-[0_12px_40px_rgba(33,26,22,0.35)] sm:max-w-sm"
            >
              <span className={`w-6 h-6 shrink-0 rounded-full ${s.dot} flex items-center justify-center text-xs font-bold`}>
                {s.icon}
              </span>
              <span className="flex-1 leading-snug">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                  className="text-[#FFB877] font-semibold px-2 py-1 rounded-lg hover:bg-white/10 transition"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="text-white/40 hover:text-white px-1.5 transition"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
