import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { therapist, loading } = useAuth();

  if (loading) return null;

  if (!therapist) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;