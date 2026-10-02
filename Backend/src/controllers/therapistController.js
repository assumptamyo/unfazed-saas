import Therapist from "../models/Therapist.js";

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
      "name slug bio specializations languages"
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