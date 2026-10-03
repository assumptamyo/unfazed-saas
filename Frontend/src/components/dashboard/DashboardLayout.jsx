import { useState, useEffect } from "react";
import { getMyProfile } from "../../api/profileApi";
import axiosInstance from "../../api/axiosInstance";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import VerifyBanner from "../common/VerifyBanner";
import { onProfileUpdate } from "../../utils/profileEvents";

const DashboardLayout = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, statsRes] = await Promise.all([
          getMyProfile(),
          axiosInstance.get("/therapist/dashboard-stats"),
        ]);
        setProfile(profileRes.data.therapist);
        setRecentActivity(statsRes.data.recentActivity || []);
      } catch (err) {
        console.error("Failed to load layout data:", err.message);
      }
    };
    load();
  }, []);

  // Show a new name or photo in the top bar as soon as the profile is saved
  useEffect(() => onProfileUpdate((therapist) => setProfile((prev) => ({ ...prev, ...therapist }))), []);

  return (
    <div className="flex min-h-screen bg-[#F9F6F0]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          therapist={profile}
          recentActivity={recentActivity}
          searchValue={search}
          onSearchChange={setSearch}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <VerifyBanner />

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
};

export default DashboardLayout;