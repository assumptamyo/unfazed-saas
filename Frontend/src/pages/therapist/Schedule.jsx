import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import WeeklyHours from "../../components/availability/WeeklyHours";
import TimeOffPlanner from "../../components/availability/TimeOffPlanner";

const TABS = [
  { key: "weekly", label: "Weekly hours", hint: "Your regular working pattern" },
  { key: "timeoff", label: "Time off & special hours", hint: "Exceptions for specific dates" },
];

const Schedule = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "timeoff" ? "timeoff" : "weekly";

  return (
    <DashboardLayout>
      <div className={`p-5 sm:p-8 w-full mx-auto ${tab === "timeoff" ? "max-w-6xl" : "max-w-4xl"}`}>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">Scheduling</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Availability</h1>
          <p className="text-[#6B5B52] text-sm mt-2 max-w-xl">
            Clients can only book inside these hours. Set your usual week, then add time off or special hours for
            specific dates.
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-[#F3EBDF]/70 rounded-2xl mb-8 w-full sm:w-fit overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setParams(t.key === "weekly" ? {} : { tab: t.key }, { replace: true })}
                className={`shrink-0 flex-1 sm:flex-none text-left px-4 py-2.5 rounded-xl transition-all ${
                  active ? "bg-white shadow-sm" : "hover:bg-white/40"
                }`}
              >
                <span className={`block text-sm font-semibold ${active ? "text-[#2B221E]" : "text-[#8A7A6D]"}`}>{t.label}</span>
                <span className="hidden sm:block text-[11px] text-[#A89C8F]">{t.hint}</span>
              </button>
            );
          })}
        </div>

        {tab === "weekly" ? <WeeklyHours /> : <TimeOffPlanner />}
      </div>
    </DashboardLayout>
  );
};

export default Schedule;
