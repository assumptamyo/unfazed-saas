import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import {
  getTherapistSlots,
  startBooking,
  verifyBooking,
  resendBookingCode,
  cancelBookingRequest,
  verifyPayment,
  getPaymentStatus,
  releaseHold,
  loadRazorpay,
  receiptUrl,
} from "../../api/bookingApi";
import { formatRupees } from "../../api/billingApi";
import { getClientToken, saveClientToken } from "../../api/portalApi";
import { suggestEmail } from "../../utils/emailTypos";
import CodeInput from "../common/CodeInput";

const labelFont = { fontFamily: "Inter, sans-serif" };

const inputClass =
  "w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]";

const EMPTY_FORM = {
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  age: "",
  gender: "",
  occupation: "",
  presentingConcern: "",
  consentAgreed: false,
};

const formatDayLabel = (dateStr) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Shown after a successful booking
const Confirmation = ({ booking, onDone }) => (
  <div className="relative overflow-hidden bg-white border border-[#D7E5DC] rounded-2xl p-6 sm:p-8 text-center animate-fade-up" style={labelFont}>
    <div
      className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-40 blur-3xl"
      style={{ background: "radial-gradient(circle, #8DB3A1 0%, transparent 70%)" }}
    />
    <div className="relative">
      <div className="w-14 h-14 mx-auto rounded-full bg-[#4F7161] text-white text-2xl flex items-center justify-center mb-4">✓</div>
      <h3 className="text-2xl text-[#2B221E] mb-1" style={{ fontFamily: "Literata, serif" }}>
        You're booked!
      </h3>
      <p className="text-sm text-[#6B6059] mb-5">A confirmation email is on its way to you.</p>

      <div className="inline-flex flex-col items-center rounded-2xl bg-[#FBF8F3] border border-[#EFE6DA] px-6 py-4 mb-5">
        <span className="text-[#2B221E] font-medium">{format(parseISO(booking.date), "EEEE, MMMM d")}</span>
        <span className="text-sm text-[#6B6059]">
          {booking.startTime} – {booking.endTime}
        </span>
        {booking.amount > 0 && (
          <span className="mt-2 text-xs font-semibold text-[#4F7161] bg-[#EEF3F0] px-2.5 py-1 rounded-full">
            Paid {formatRupees(booking.amount)}
          </span>
        )}
      </div>

      <p className="text-xs text-[#8A7A6D] mb-4">Your session is by video — join it from your client space.</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link
          to="/portal"
          className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition"
        >
          Open your client space
        </Link>
        {booking.receiptToken && (
          <a
            href={receiptUrl(booking.receiptToken)}
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition"
          >
            Download receipt
          </a>
        )}
        <button
          onClick={onDone}
          className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B6059] border border-[#EFE6DA] hover:border-[#FF9E4C] transition"
        >
          Book another session
        </button>
      </div>
    </div>
  </div>
);

const BookingCalendar = ({ slug, fee = 0, therapistName = "" }) => {
  const [daySlots, setDaySlots] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [confirmed, setConfirmed] = useState(null);

  // Email verification step
  const [verify, setVerify] = useState(null); // { requestId, email }
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const emailSuggestion = suggestEmail(form.clientEmail);

  useEffect(() => {
    let alive = true;
    getTherapistSlots(slug)
      .then((res) => {
        if (!alive) return;
        const daysWithSlots = res.data.slots.filter((d) => d.slots.length > 0);
        setDaySlots(daysWithSlots);
        setSelectedDate((current) =>
          daysWithSlots.some((d) => d.date === current) ? current : daysWithSlots[0]?.date ?? null
        );
      })
      .catch((err) => {
        console.error("Failed to load slots:", err.message);
        if (alive) setDaySlots([]);
      });
    return () => {
      alive = false;
    };
  }, [slug, reloadKey]);

  const refreshSlots = () => setReloadKey((k) => k + 1);
  const currentDaySlots = daySlots?.find((d) => d.date === selectedDate)?.slots || [];

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setShowForm(true);
    setBookingError("");
  };

  const finishBooking = (details) => {
    setConfirmed(details);
    setVerify(null);
    setShowForm(false);
    setForm(EMPTY_FORM);
    refreshSlots();
  };

  // After Razorpay reports success: verify on the server, which confirms the booking
  const confirmPayment = async (response, orderId) => {
    setBooking(true);
    try {
      const res = await verifyPayment(response);
      finishBooking(res.data.payment);
    } catch (err) {
      if (err.response?.status === 409) {
        setBookingError(err.response.data.message);
        setShowForm(false);
        refreshSlots();
        return;
      }
      // Payment went through but confirmation is slow: check a few more times
      for (let i = 0; i < 5; i++) {
        await wait(2000);
        try {
          const status = (await getPaymentStatus(orderId)).data.payment;
          if (status.status === "paid") return finishBooking(status);
        } catch {
          /* keep trying */
        }
      }
      setBookingError(
        "Your payment was received. We're still confirming your booking — you'll get an email shortly."
      );
    } finally {
      setBooking(false);
    }
  };

  const openCheckout = async (checkout) => {
    const loaded = await loadRazorpay();
    if (!loaded) {
      await releaseHold(checkout.order.id).catch(() => {});
      setBookingError("Couldn't load the payment window. Check your connection and try again.");
      return;
    }

    const rzp = new window.Razorpay({
      key: checkout.keyId,
      order_id: checkout.order.id,
      amount: checkout.order.amount,
      currency: checkout.order.currency,
      name: "Unfazed",
      description: `Therapy session with ${checkout.therapistName}`,
      prefill: checkout.prefill,
      theme: { color: "#FF9E4C" },
      handler: (response) => confirmPayment(response, checkout.order.id),
      modal: {
        ondismiss: () => {
          releaseHold(checkout.order.id).catch(() => {});
          setBookingError("Payment cancelled — your slot has been released. You can try again.");
          setBooking(false);
        },
      },
    });
    rzp.on("payment.failed", (resp) => {
      setBookingError(resp.error?.description || "Payment failed. Please try another method.");
    });
    rzp.open();
  };

  // The email is confirmed and the booking exists (or payment is next)
  const handleBooked = async (data) => {
    if (data.clientToken) saveClientToken(data.clientToken); // remembered on this device
    if (data.requiresPayment) {
      await openCheckout(data.checkout);
      return; // booking state is cleared by the checkout callbacks
    }
    finishBooking({ ...data.session, amount: 0 });
    setBooking(false);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBooking(true);
    setBookingError("");
    try {
      const res = await startBooking(slug, {
        ...form,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        clientToken: getClientToken() || undefined,
      });

      if (res.data.needsVerification) {
        setVerify({ requestId: res.data.requestId, email: res.data.email });
        setCode("");
        setCodeError("");
        setResendIn(30);
        setBooking(false);
        return;
      }
      await handleBooked(res.data);
    } catch (err) {
      setBookingError(err.response?.data?.message || "Something went wrong. Please try again.");
      if (err.response?.status === 409) refreshSlots();
      setBooking(false);
    }
  };

  const submitCode = async (value = code) => {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setCodeError("");
    try {
      const res = await verifyBooking(slug, verify.requestId, value);
      setBooking(true);
      await handleBooked(res.data);
    } catch (err) {
      if (err.response?.status === 409) {
        setVerify(null);
        setShowForm(false);
        setBookingError(err.response.data.message);
        refreshSlots();
      } else {
        setCodeError(err.response?.data?.message || "Couldn't check the code. Please try again.");
        setCode("");
      }
      setBooking(false);
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    setCodeError("");
    try {
      await resendBookingCode(slug, verify.requestId);
      setResendIn(30);
    } catch (err) {
      setCodeError(err.response?.data?.message || "Couldn't send a new code.");
    }
  };

  // Wrong email: release the held slot and go back to the form
  const changeEmail = () => {
    cancelBookingRequest(slug, verify.requestId).catch(() => {});
    setVerify(null);
    setCode("");
    setCodeError("");
  };

  if (daySlots === null) {
    return <div className="skeleton h-64 rounded-2xl" />;
  }

  if (confirmed) {
    return <Confirmation booking={confirmed} onDone={() => setConfirmed(null)} />;
  }

  if (daySlots.length === 0) {
    return (
      <p className="text-[#6B6059] text-sm" style={labelFont}>
        No available slots in the next two weeks. Please check back later.
      </p>
    );
  }

  return (
    <div className="bg-white border border-[#EFE6DA] rounded-2xl p-6" style={labelFont}>
      {fee > 0 && (
        <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-[#F3EBDF]">
          <span className="text-sm text-[#6B6059]">Session fee</span>
          <span className="text-lg font-semibold text-[#2B221E]">{formatRupees(fee)}</span>
        </div>
      )}

      {bookingError && !showForm && (
        <div className="bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-lg px-4 py-3 mb-5">
          {bookingError}
        </div>
      )}

      {/* Date picker - horizontal scrollable chips */}
      <div className="flex gap-2 overflow-x-auto scroll-thin pb-3 mb-4 -mx-1 px-1">
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

      {/* Email code step */}
      {verify && (
        <div className="mt-5 pt-6 border-t border-[#EFE6DA] text-center animate-fade-up">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FFF3E6] text-[#D96B00] text-xl flex items-center justify-center mb-3">
            ✉
          </div>
          <h3 className="text-lg text-[#2B221E]" style={{ fontFamily: "Literata, serif" }}>
            Check your email
          </h3>
          <p className="text-sm text-[#6B6059] mt-1 mb-5">
            We sent a 6-digit code to <strong className="text-[#2B221E]">{verify.email}</strong>.
            <br />
            Your time is held for 10 minutes.
          </p>
          <CodeInput value={code} onChange={setCode} onComplete={submitCode} disabled={verifying} />
          {codeError && <p className="text-sm text-[#9C3B2E] mt-3">{codeError}</p>}
          <button
            onClick={() => submitCode()}
            disabled={code.length !== 6 || verifying || booking}
            className="mt-5 w-full bg-[#FF9E4C] text-[#211A16] font-medium px-6 py-2.5 rounded-full hover:bg-[#D96B00]/80 transition disabled:opacity-50"
          >
            {verifying || booking ? "Confirming…" : fee > 0 ? "Confirm & continue to payment" : "Confirm booking"}
          </button>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <button
              onClick={resendCode}
              disabled={resendIn > 0}
              className="font-medium text-[#D96B00] hover:underline disabled:text-[#A89C8F] disabled:no-underline"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
            <span className="text-[#E5DCD3]">|</span>
            <button onClick={changeEmail} className="font-medium text-[#6B6059] hover:text-[#2B221E]">
              Wrong email? Change it
            </button>
          </div>
          <p className="text-[11px] text-[#A89C8F] mt-4">Can't find it? Check your spam or promotions folder.</p>
        </div>
      )}

      {/* Booking form - appears once a slot is picked */}
      {showForm && selectedSlot && !verify && (
        <form onSubmit={handleBookingSubmit} className="mt-5 pt-5 border-t border-[#EFE6DA] space-y-3">
          <p className="text-sm text-[#6B6059] mb-2">
            Booking {formatDayLabel(selectedDate)}, {selectedSlot.startTime}–{selectedSlot.endTime}
            {therapistName && ` with ${therapistName}`}
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
            className={inputClass}
          />
          <input
            type="email"
            required
            placeholder="Your email"
            value={form.clientEmail}
            onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
            className={inputClass}
          />
          {emailSuggestion && (
            <p className="text-xs text-[#B7791F] -mt-1 px-1">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => setForm({ ...form, clientEmail: emailSuggestion })}
                className="font-semibold underline underline-offset-2 hover:text-[#8A5A12]"
              >
                {emailSuggestion}
              </button>
              ?
            </p>
          )}
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={form.clientPhone}
            onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
            className={inputClass}
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={1}
              placeholder="Age (optional)"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              className={inputClass}
            />
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className={inputClass}
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
            className={inputClass}
          />

          <textarea
            rows={3}
            placeholder="What brings you to therapy? (optional)"
            value={form.presentingConcern}
            onChange={(e) => setForm({ ...form, presentingConcern: e.target.value })}
            className={inputClass}
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
              I consent to sharing this information with my therapist for the purpose of receiving care, and
              understand it will be kept confidential.
            </span>
          </label>

          <button
            type="submit"
            disabled={booking}
            className="w-full bg-[#FF9E4C] text-[#211A16] font-medium px-6 py-2.5 rounded-full hover:bg-[#D96B00]/80 transition disabled:opacity-60"
          >
            {booking ? "Please wait…" : fee > 0 ? `Continue — ${formatRupees(fee)}` : "Continue"}
          </button>
          <p className="text-[11px] text-center text-[#A89C8F]">
            We'll email you a code to confirm it's you. Nothing is booked until you enter it.
          </p>
          {fee > 0 && (
            <p className="text-[11px] text-center text-[#A89C8F]">
              🔒 Secure payment by Razorpay · UPI, cards, net banking. Your slot is held for 15 minutes.
            </p>
          )}
        </form>
      )}
    </div>
  );
};

export default BookingCalendar;
