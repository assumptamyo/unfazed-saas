import Client from "../models/Client.js";
import Session from "../models/Session.js";
import Therapist from "../models/Therapist.js";
import { findAvailableSlot } from "../services/slotService.js";
import { dateFromKey } from "../utils/dateUtils.js";
import {
  sendBookingConfirmationToClient,
  sendNewBookingNotificationToTherapist,
} from "../services/emailService.js";

// @desc   Book a session slot (public - client books via the branded link)
// @route  POST /api/therapist/:slug/book
export const bookSession = async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      clientName,
      clientEmail,
      clientPhone,
      date,
      startTime,
      notes,
      age,
      gender,
      occupation,
      presentingConcern,
      consentAgreed,
    } = req.body;

    if (consentAgreed !== true) {
      return res.status(400).json({ message: "Consent is required to book a session" });
    }

    const therapist = await Therapist.findOne({ slug });
    if (!therapist) {
      return res.status(404).json({ message: "Therapist not found" });
    }

    // Only accept times that are genuinely open on the therapist's calendar
    const dateKey = date.slice(0, 10);
    const slot = await findAvailableSlot(therapist._id, dateKey, startTime);
    if (!slot) {
      return res.status(409).json({
        message: "That time is no longer available. Please choose another slot.",
      });
    }

    let client = await Client.findOne({
      therapist: therapist._id,
      email: clientEmail.toLowerCase(),
    });

    if (!client) {
      client = await Client.create({
        therapist: therapist._id,
        name: clientName,
        email: clientEmail,
        phone: clientPhone || "",
        intake: {
          demographics: {
            age: age || undefined,
            gender: gender || "",
            occupation: occupation || "",
          },
          presentingConcern: presentingConcern || "",
        },
        consent: { agreed: true, agreedAt: new Date() },
      });
    } else {
      if (!client.consent?.agreed) client.consent = { agreed: true, agreedAt: new Date() };
      client.archivedAt = null; // booking again brings an archived client back
      await client.save();
    }

    const session = await Session.create({
      therapist: therapist._id,
      client: client._id,
      date: dateFromKey(dateKey),
      startTime: slot.startTime,
      endTime: slot.endTime,
      notes: notes || "",
    });

    // Fire confirmation emails - don't block the booking response if these fail
    try {
      await sendBookingConfirmationToClient(
        client.email,
        client.name,
        therapist.name,
        dateKey,
        slot.startTime,
        slot.endTime
      );
      await sendNewBookingNotificationToTherapist(
        therapist.email,
        therapist.name,
        client.name,
        client.email,
        dateKey,
        slot.startTime,
        slot.endTime
      );
    } catch (emailError) {
      console.error("Booking email failed:", emailError.message);
    }

    return res.status(201).json({
      message: "Session booked successfully",
      session: {
        id: session._id,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This slot was just booked by someone else. Please choose another time.",
      });
    }
    console.error("Book session error:", error.message);
    return res.status(500).json({ message: "Server error while booking session" });
  }
};
