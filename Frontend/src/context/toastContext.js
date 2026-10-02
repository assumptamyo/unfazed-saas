import { createContext, useContext } from "react";

export const ToastContext = createContext({ notify: () => {} });

// notify(message, { type: "success" | "error" | "info", action: { label, onClick } })
export const useToast = () => useContext(ToastContext);
