import { useState, useEffect } from "react";
import { setAvailability, getMyAvailability, deleteAvailability } from "../../api/availabilityApi";
import { useToast } from "../../context/toastContext";
import { apiError } from "../appointments/appointmentUtils";

const DAYS = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
  { label: "Sunday", value: 0 },
];

const DURATIONS = [30, 45, 60, 90];

const inputClass =
  "bg-[#F9F6F0] border border-[#E5DCD3] rounded-xl px-3 py-2.5 text-[#2B221E] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition-all [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:appearance-none";

const WeeklyHours = () => {
  const { notify } = useToast();
  const [availability, setAvailabilityList] = useState(null);
  const [savingDay, setSavingDay] = useState(null);
  const [formState, setFormState] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getMyAvailability()
      .then((res) => alive && setAvailabilityList(res.data.availability))
      .catch((err) => {
        if (!alive) return;
        setAvailabilityList([]);
        notify(apiError(err, "Couldn't load your weekly hours."), { type: "error" });
      });
    return () => {
      alive = false;
    };
  }, [reloadKey, notify]);

  const getExisting = (dayValue) => availability?.find((a) => a.dayOfWeek === dayValue);

  const getFormValue = (dayValue, field, fallback) => {
    if (formState[dayValue]?.[field] !== undefined) return formState[dayValue][field];
    const existing = getExisting(dayValue);
    return existing ? existing[field] : fallback;
  };

  const updateFormField = (dayValue, field, value) => {
    setFormState((prev) => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], [field]: value },
    }));
  };

  const handleSave = async (day) => {
    setSavingDay(day.value);
    try {
      await setAvailability({
        dayOfWeek: day.value,
        startTime: getFormValue(day.value, "startTime", "09:00"),
        endTime: getFormValue(day.value, "endTime", "17:00"),
        sessionDuration: Number(getFormValue(day.value, "sessionDuration", 60)),
        bufferMinutes: Number(getFormValue(day.value, "bufferMinutes", 10)),
      });
      setFormState((prev) => ({ ...prev, [day.value]: undefined }));
      notify(`${day.label} hours saved`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(apiError(err, `Couldn't save ${day.label}.`), { type: "error" });
    } finally {
      setSavingDay(null);
    }
  };

  const handleRemove = async (day) => {
    try {
      await deleteAvailability(day.value);
      notify(`${day.label} is now a day off`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    }
  };

  if (!availability) {
    return (
      <div className="space-y-4">
        {DAYS.map((d) => (
          <div key={d.value} className="skeleton h-24 rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {DAYS.map((day) => {
        const existing = getExisting(day.value);
        const isSaving = savingDay === day.value;

        return (
          <div
            key={day.value}
            className={`bg-white/90 backdrop-blur-sm border rounded-3xl p-6 transition-all duration-300 shadow-2xs hover:shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 ${
              existing ? "border-[#FF9E4C]/40 bg-gradient-to-r from-white via-white to-[#FF9E4C]/5" : "border-[#E5DCD3]"
            }`}
          >
            <div className="w-full lg:w-36 flex items-center justify-between lg:justify-start gap-3">
              <span className="font-serif font-semibold text-base text-[#2B221E]">{day.label}</span>
              {existing ? (
                <span className="text-[10px] bg-[#FF9E4C]/15 text-[#D96B00] px-2.5 py-0.5 rounded-full font-medium">Active</span>
              ) : (
                <span className="text-[10px] bg-[#E5DCD3] text-[#6B5B52] px-2.5 py-0.5 rounded-full font-medium">Off</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={getFormValue(day.value, "startTime", "09:00")}
                  onChange={(e) => updateFormField(day.value, "startTime", e.target.value)}
                  className={inputClass}
                />
                <span className="text-xs text-[#6B5B52] font-medium">to</span>
                <input
                  type="time"
                  value={getFormValue(day.value, "endTime", "17:00")}
                  onChange={(e) => updateFormField(day.value, "endTime", e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={getFormValue(day.value, "sessionDuration", 60)}
                  onChange={(e) => updateFormField(day.value, "sessionDuration", e.target.value)}
                  className={inputClass}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} mins slot
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 bg-[#F9F6F0] border border-[#E5DCD3] rounded-xl px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={getFormValue(day.value, "bufferMinutes", 10)}
                    onChange={(e) => updateFormField(day.value, "bufferMinutes", e.target.value)}
                    className="w-12 bg-transparent text-sm font-medium text-[#2B221E] focus:outline-none text-center"
                    title="Buffer minutes between sessions"
                  />
                  <span className="text-xs text-[#6B5B52]">min buffer</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-[#E5DCD3]">
              <button
                onClick={() => handleSave(day)}
                disabled={isSaving}
                className="bg-[#FF9E4C] text-white text-sm font-medium px-5 py-2.5 rounded-2xl hover:bg-[#D96B00] transition-all shadow-xs hover:shadow-md disabled:opacity-60 flex-1 lg:flex-none text-center"
              >
                {isSaving ? "Saving..." : existing ? "Update Schedule" : "Set Schedule"}
              </button>
              {existing && (
                <button
                  onClick={() => handleRemove(day)}
                  className="text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2.5 rounded-2xl transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WeeklyHours;
