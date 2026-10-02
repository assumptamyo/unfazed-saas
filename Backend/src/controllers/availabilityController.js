import Availability from "../models/Availability.js";
import AvailabilityOverride from "../models/AvailabilityOverride.js";

// @desc   Set/update weekly availability for a specific day
// @route  POST /api/availability
export const setAvailability = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const { dayOfWeek, startTime, endTime, sessionDuration, bufferMinutes } = req.body;

    // Upsert: if this day already has a rule, replace it; otherwise create one
    const availability = await Availability.findOneAndUpdate(
      { therapist: therapistId, dayOfWeek },
      {
        startTime,
        endTime,
        sessionDuration,
        bufferMinutes: bufferMinutes || 0,
        isActive: true,
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Availability saved successfully",
      availability,
    });
  } catch (error) {
    console.error("Set availability error:", error.message);
    return res.status(500).json({ message: "Server error while saving availability" });
  }
};

// @desc   Get the logged-in therapist's full weekly availability
// @route  GET /api/availability
export const getMyAvailability = async (req, res) => {
  try {
    const availability = await Availability.find({
      therapist: req.therapist._id,
      isActive: true,
    }).sort({ dayOfWeek: 1 });

    return res.status(200).json({ availability });
  } catch (error) {
    console.error("Get availability error:", error.message);
    return res.status(500).json({ message: "Server error while fetching availability" });
  }
};

// @desc   Deactivate availability for a specific day (not booked elsewhere, just turned off)
// @route  DELETE /api/availability/:dayOfWeek
export const deleteAvailability = async (req, res) => {
  try {
    const { dayOfWeek } = req.params;

    await Availability.findOneAndUpdate(
      { therapist: req.therapist._id, dayOfWeek: Number(dayOfWeek) },
      { isActive: false }
    );

    return res.status(200).json({ message: "Availability removed for this day" });
  } catch (error) {
    console.error("Delete availability error:", error.message);
    return res.status(500).json({ message: "Server error while removing availability" });
  }
};

// @desc   Create a one-time override (block a date, or set custom hours)
// @route  POST /api/availability/override
export const createOverride = async (req, res) => {
  try {
    const therapistId = req.therapist._id;
    const { date, type, startTime, endTime, reason } = req.body;

    const override = await AvailabilityOverride.findOneAndUpdate(
      { therapist: therapistId, date },
      { type, startTime, endTime, reason },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Override saved successfully",
      override,
    });
  } catch (error) {
    console.error("Create override error:", error.message);
    return res.status(500).json({ message: "Server error while saving override" });
  }
};

// @desc   Get all overrides for the logged-in therapist (upcoming only)
// @route  GET /api/availability/override
export const getMyOverrides = async (req, res) => {
  try {
    const overrides = await AvailabilityOverride.find({
      therapist: req.therapist._id,
      date: { $gte: new Date() },
    }).sort({ date: 1 });

    return res.status(200).json({ overrides });
  } catch (error) {
    console.error("Get overrides error:", error.message);
    return res.status(500).json({ message: "Server error while fetching overrides" });
  }
};

// @desc   Delete a specific override (un-block a date)
// @route  DELETE /api/availability/override/:id
export const deleteOverride = async (req, res) => {
  try {
    const { id } = req.params;

    const override = await AvailabilityOverride.findOne({
      _id: id,
      therapist: req.therapist._id,
    });

    if (!override) {
      return res.status(404).json({ message: "Override not found" });
    }

    await override.deleteOne();

    return res.status(200).json({ message: "Override removed" });
  } catch (error) {
    console.error("Delete override error:", error.message);
    return res.status(500).json({ message: "Server error while removing override" });
  }
};