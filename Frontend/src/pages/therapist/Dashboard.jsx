import { useState, useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";
import { getMyProfile } from "../../api/profileApi";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import GreetingCard from "../../components/dashboard/GreetingCard";
import BookingsChart from "../../components/dashboard/BookingsChart";
import RecentActivity from "../../components/dashboard/RecentActivity";
import UpcomingAppointments from "../../components/dashboard/UpcomingAppointments";
import ClientQuickOverview from "../../components/dashboard/ClientQuickOverview";

const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, statsRes] = await Promise.all([
          getMyProfile(),
          axiosInstance.get("/therapist/dashboard-stats"),
        ]);
        setProfile(profileRes.data.therapist);
        setStats(statsRes.data);
      } catch (err) {
        console.error("Failed to load dashboard:", err.message);
      }
    };
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-5xl w-full mx-auto">
        <GreetingCard therapist={profile} stats={stats} />

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <BookingsChart data={stats.bookingsOverTime} />
            </div>

            <UpcomingAppointments appointments={stats.upcomingAppointments} />
            <ClientQuickOverview clients={stats.recentClients} />

            <div className="lg:col-span-2">
              <RecentActivity sessions={stats.recentActivity} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;