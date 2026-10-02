import Therapist from "../models/Therapist.js";
import { generateAvailableSlots } from "../services/slotService.js";

// @desc   Get logged-in therapist's own profile
// @route  GET /api/therapist/me
export const getMyProfile = async (req, res) => {
  return res.status(200).json({ therapist: req.therapist });
};

// @desc   Get public therapist profile by slug
// @route  GET /api/therapist/:slug
export const getPublicProfile = async (req, res) => {
  try {
    const therapist = await Therapist.findOne({ slug: req.params.slug }).select(
      "name slug bio specializations languages photoUrl qualifications yearsOfExperience",
    );

    if (!therapist) {
      return res.status(404).json({ message: "Therapist not found" });
    }

    return res.status(200).json({ therapist });
  } catch (error) {
    console.error("Get public profile error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc   Get bookable slots for a therapist (public, used by client booking calendar)
// @route  GET /api/therapist/:slug/slots
export const getTherapistSlots = async (req, res) => {
  try {
    const therapist = await Therapist.findOne({ slug: req.params.slug });

    if (!therapist) {
      return res.status(404).json({ message: "Therapist not found" });
    }

    const slots = await generateAvailableSlots(therapist._id, { days: req.query.days });

    return res.status(200).json({ slots });
  } catch (error) {
    console.error("Get slots error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching slots" });
  }
};

// @desc   Update the logged-in therapist's own profile
// @route  PUT /api/therapist/me
export const updateMyProfile = async (req, res) => {
  try {
    const allowedFields = [
      "bio",
      "specializations",
      "languages",
      "photoUrl",
      "qualifications",
      "yearsOfExperience",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const therapist = await Therapist.findByIdAndUpdate(
      req.therapist._id,
      updates,
      { new: true, runValidators: true },
    ).select("-password_hash");

    return res.status(200).json({
      message: "Profile updated successfully",
      therapist,
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while updating profile" });
  }
};

// @desc   Upload/update profile photo
// @route  POST /api/therapist/upload-photo
export const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const photoUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    const therapist = await Therapist.findByIdAndUpdate(
      req.therapist._id,
      { photoUrl },
      { new: true }
    ).select("-password_hash");

    return res.status(200).json({
      message: "Photo uploaded successfully",
      therapist,
    });
  } catch (error) {
    console.error("Upload photo error:", error.message);
    return res.status(500).json({ message: "Server error while uploading photo" });
  }
};
