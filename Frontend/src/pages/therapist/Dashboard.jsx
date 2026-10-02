import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import VerifyBanner from "../../components/common/VerifyBanner";

const Dashboard = () => {
  const { therapist, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div>
      <VerifyBanner />

      <div className="p-8">
        <h1 className="text-2xl font-bold">Welcome, {therapist?.name}</h1>
        <p className="text-gray-600">Slug: {therapist?.slug}</p>
        <button
          onClick={handleLogout}
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Dashboard;