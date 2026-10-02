import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMyProfile, updateProfile, uploadPhoto } from "../../api/profileApi";

const inputClass =
  "w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-xl px-4 py-3 text-[#2B221E] placeholder-[#A89C8F] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C] focus:border-transparent transition";

const labelClass = "block text-sm font-medium text-[#2B221E] mb-1.5";

const EditProfile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  const [form, setForm] = useState({
    bio: "",
    specializations: "",
    languages: "",
    qualifications: "",
    yearsOfExperience: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getMyProfile();
        const t = res.data.therapist;
        setForm({
          bio: t.bio || "",
          specializations: (t.specializations || []).join(", "),
          languages: (t.languages || []).join(", "),
          qualifications: t.qualifications || "",
          yearsOfExperience: t.yearsOfExperience || "",
        });
        setPhotoUrl(t.photoUrl || "");
      } catch (err) {
        console.error("Failed to load profile:", err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await uploadPhoto(file);
      setPhotoUrl(res.data.therapist.photoUrl);
    } catch (err) {
      console.error("Failed to upload photo:", err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await updateProfile({
        bio: form.bio,
        specializations: form.specializations.split(",").map((s) => s.trim()).filter(Boolean),
        languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
        qualifications: form.qualifications,
        yearsOfExperience: Number(form.yearsOfExperience) || 0,
      });
      setSuccess(true);
    } catch (err) {
      console.error("Failed to update profile:", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F9F6F0] p-8" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => navigate("/therapist/dashboard")}
          className="text-[#D96B00] text-sm mb-6 hover:underline"
        >
          ← Back to dashboard
        </button>

        <h1 className="text-2xl text-[#2B221E] mb-2" style={{ fontFamily: "Literata, serif" }}>
          Edit your profile
        </h1>
        <p className="text-[#6B6059] text-sm mb-8">
          This information appears on your public booking page.
        </p>

        {success && (
          <div className="bg-[#EAF6EC] border border-[#BFE3C6] text-[#2F6B3A] text-sm rounded-lg px-4 py-3 mb-6">
            Profile updated successfully.
          </div>
        )}

        {/* Photo upload */}
        <div className="flex items-center gap-5 mb-8">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover border-2 border-[#FFE3C2]"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#FFE3C2] flex items-center justify-center text-[#D96B00] text-2xl" style={{ fontFamily: "Literata, serif" }}>
              ?
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-white border border-[#EFE6DA] text-[#2B221E] text-sm font-medium px-4 py-2 rounded-full hover:border-[#FF9E4C] transition disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <p className="text-xs text-[#A89C8F] mt-1.5">JPG, PNG or WEBP. Max 5MB.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Qualifications</label>
            <input
              type="text"
              value={form.qualifications}
              onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
              className={inputClass}
              placeholder="M.Phil Clinical Psychology, RCI Licensed"
            />
          </div>

          <div>
            <label className={labelClass}>Years of experience</label>
            <input
              type="number"
              min={0}
              value={form.yearsOfExperience}
              onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })}
              className={inputClass}
              placeholder="8"
            />
          </div>

          <div>
            <label className={labelClass}>Bio</label>
            <textarea
              rows={4}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className={inputClass}
              placeholder="Tell clients a bit about your approach..."
            />
          </div>

          <div>
            <label className={labelClass}>Specializations</label>
            <input
              type="text"
              value={form.specializations}
              onChange={(e) => setForm({ ...form, specializations: e.target.value })}
              className={inputClass}
              placeholder="Anxiety, Relationships, Life Transitions"
            />
            <p className="text-xs text-[#A89C8F] mt-1">Separate with commas.</p>
          </div>

          <div>
            <label className={labelClass}>Languages</label>
            <input
              type="text"
              value={form.languages}
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
              className={inputClass}
              placeholder="English, Hindi"
            />
            <p className="text-xs text-[#A89C8F] mt-1">Separate with commas.</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#FF9E4C] text-[#211A16] font-medium px-8 py-3 rounded-full hover:bg-[#D96B00]/80 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditProfile;