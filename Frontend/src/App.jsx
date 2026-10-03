import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ToastProvider from "./components/common/ToastProvider";
import EntitlementProvider from "./components/common/EntitlementProvider";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <EntitlementProvider>
            <AppRoutes />
          </EntitlementProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
