import { useState, useEffect } from "react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { getTherapistSlots, bookSession } from "../../api/bookingApi";

const labelFont = { fontFamily: "Inter, sans-serif" };

const formatDayLabel = (dateStr) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
};

const BookingCalendar = ({ slug }) => {
  const [daySlots, setDaySlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    age: "",
    gender: "",
    occupation: "",
    presentingConcern: "",
    consentAgreed: false,
  });
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const loadSlots = async () => {
    setLoading(true);
    try {
      const res = await getTherapistSlots(slug);
      const daysWithSlots = res.data.slots.filter((d) => d.slots.length > 0);
      setDaySlots(daysWithSlots);
      if (daysWithSlots.length > 0) setSelectedDate(daysWithSlots[0].date);
    } catch (err) {
      console.error("Failed to load slots:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, [slug]);

  const currentDaySlots = daySlots.find((d) => d.date === selectedDate)?.slots || [];

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setShowForm(true);
    setBookingError("");
    setBookingSuccess(false);
  };

  const resetForm = () => {
    setForm({
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      age: "",
      gender: "",
      occupation: "",
      presentingConcern: "",
      consentAgreed: false,
    });
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBooking(true);
    setBookingError("");
    try {
      await bookSession(slug, {
        ...form,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });
      setBookingSuccess(true);
      setShowForm(false);
      resetForm();
      await loadSlots();
    } catch (err) {
      setBookingError(
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setBooking(false);
    }
  };

  if (loading) return null;

  if (daySlots.length === 0) {
    return (
      <p className="text-[#6B6059] text-sm" style={labelFont}>
        No available slots in the next two weeks. Please check back later.
      </p>
    );
  }

  return (
    <div className="bg-white border border-[#EFE6DA] rounded-2xl p-6" style={labelFont}>
      {bookingSuccess && (
        <div className="bg-[#EAF6EC] border border-[#BFE3C6] text-[#2F6B3A] text-sm rounded-lg px-4 py-3 mb-5">
          Session booked successfully! You'll receive a confirmation shortly.
        </div>
      )}

      {/* Date picker - horizontal scrollable chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
        {daySlots.map((day) => (
          <button
            key={day.date}
            onClick={() => {
              setSelectedDate(day.date);
              setShowForm(false);
            }}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition ${
              selectedDate === day.date
                ? "bg-[#FF9E4C] border-[#FF9E4C] text-[#211A16]"
                : "bg-[#FBF8F3] border-[#EFE6DA] text-[#6B6059] hover:border-[#FF9E4C]"
            }`}
          >
            {formatDayLabel(day.date)}
          </button>
        ))}
      </div>

      {/* Slot list for selected date */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        {currentDaySlots.map((slot) => (
          <button
            key={slot.startTime}
            onClick={() => handleSlotClick(slot)}
            className={`px-3 py-2.5 rounded-lg text-sm border transition ${
              selectedSlot?.startTime === slot.startTime && showForm
                ? "bg-[#FF9E4C] border-[#FF9E4C] text-[#211A16]"
                : "bg-[#FBF8F3] border-[#EFE6DA] text-[#2B221E] hover:border-[#FF9E4C]"
            }`}
          >
            {slot.startTime}
          </button>
        ))}
      </div>

      {/* Booking form - appears once a slot is picked */}
      {showForm && selectedSlot && (
        <form
          onSubmit={handleBookingSubmit}
          className="mt-5 pt-5 border-t border-[#EFE6DA] space-y-3"
        >
          <p className="text-sm text-[#6B6059] mb-2">
            Booking {formatDayLabel(selectedDate)}, {selectedSlot.startTime}–{selectedSlot.endTime}
          </p>

          {bookingError && (
            <div className="bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-lg px-4 py-3">
              {bookingError}
            </div>
          )}

          <input
            type="text"
            required
            placeholder="Your name"
            value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            className="w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]"
          />
          <input
            type="email"
            required
            placeholder="Your email"
            value={form.clientEmail}
            onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
            className="w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={form.clientPhone}
            onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
            className="w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={1}
              placeholder="Age (optional)"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              className="w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]"
            />
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]"
            >
              <option value="">Gender (optional)</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Occupation (optional)"
            value={form.occupation}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })}
            className="w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]"
          />

          <textarea
            rows={3}
            placeholder="What brings you to therapy? (optional)"
            value={form.presentingConcern}
            onChange={(e) => setForm({ ...form, presentingConcern: e.target.value })}
            className="w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]"
          />

          <label className="flex items-start gap-2.5 text-xs text-[#6B6059] pt-1">
            <input
              type="checkbox"
              required
              checked={form.consentAgreed}
              onChange={(e) => setForm({ ...form, consentAgreed: e.target.checked })}
              className="mt-0.5 accent-[#FF9E4C]"
            />
            <span>
              I consent to sharing this information with my therapist for the purpose of
              receiving care, and understand it will be kept confidential.
            </span>
          </label>

          <button
            type="submit"
            disabled={booking}
            className="w-full bg-[#FF9E4C] text-[#211A16] font-medium px-6 py-2.5 rounded-full hover:bg-[#D96B00]/80 transition disabled:opacity-60"
          >
            {booking ? "Booking..." : "Confirm booking"}
          </button>
        </form>
      )}
    </div>
  );
};

export default BookingCalendar;