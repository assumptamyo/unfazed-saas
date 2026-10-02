import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import VerifyEmail from "../pages/auth/VerifyEmail";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import Dashboard from "../pages/therapist/Dashboard";
import PublicProfile from "../pages/therapist/PublicProfile";
import ProtectedRoute from "./ProtectedRoute";
import Schedule from "../pages/therapist/Schedule";
import EditProfile from "../pages/therapist/EditProfile";
import Clients from "../pages/therapist/Clients";
import ClientDetail from "../pages/therapist/ClientDetail";
import Appointments from "../pages/therapist/Appointments";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/therapist/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/:slug" element={<PublicProfile />} />
      <Route
        path="/therapist/appointments"
        element={
          <ProtectedRoute>
            <Appointments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/therapist/schedule"
        element={
          <ProtectedRoute>
            <Schedule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/therapist/profile"
        element={
          <ProtectedRoute>
            <EditProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/therapist/clients"
        element={
          <ProtectedRoute>
            <Clients />
          </ProtectedRoute>
        }
      />
      <Route
        path="/therapist/clients/:id"
        element={
          <ProtectedRoute>
            <ClientDetail />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
