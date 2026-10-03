import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import TagInput from "../../components/profile/TagInput";
import { getMyProfile, updateProfile, uploadPhoto } from "../../api/profileApi";
import { useToast } from "../../context/toastContext";
import { announceProfileUpdate } from "../../utils/profileEvents";

const SPECIALIZATION_SUGGESTIONS = [
  "Anxiety",
  "Depression",
  "Stress & burnout",
  "Relationships",
  "Trauma & PTSD",
  "Grief & loss",
  "Self-esteem",
  "Life transitions",
  "Couples therapy",
  "Family issues",
  "ADHD",
  "OCD",
  "Sleep",
  "Anger management",
  "LGBTQ+ affirming",
];

const LANGUAGE_SUGGESTIONS = [
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Urdu",
];

const BIO_MAX = 1500;
const BIO_GOOD = 150;

const inputClass =
  "w-full bg-[#FBF8F3] border border-[#EFE6DA] rounded-2xl px-4 py-3 text-[#2B221E] placeholder-[#A89C8F] focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40 focus:border-[#FF9E4C] transition";

const pickForm = (t) => ({
  name: t.name || "",
  qualifications: t.qualifications || "",
  yearsOfExperience: t.yearsOfExperience || 0,
  bio: t.bio || "",
  specializations: t.specializations || [],
  languages: t.languages || [],
});

const Section = ({ children }) => (
  <section className="bg-white border border-[#EFE6DA] rounded-[28px] p-6 sm:p-7 animate-fade-up">{children}</section>
);

const Label = ({ children, hint }) => (
  <span className="flex items-baseline justify-between gap-3 mb-1.5">
    <span className="text-sm font-medium text-[#2B221E]">{children}</span>
    {hint && <span className="text-xs text-[#A89C8F]">{hint}</span>}
  </span>
);

const Strength = ({ checks }) => {
  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="bg-white border border-[#EFE6DA] rounded-3xl p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-14 h-14 shrink-0">
          <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
            <circle cx="28" cy="28" r={r} fill="none" stroke="#F3EBDF" strokeWidth="6" />
            <circle
              cx="28"
              cy="28"
              r={r}
              fill="none"
              stroke={pct === 100 ? "#4F7161" : "#D96B00"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * c} ${c}`}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#2B221E]">{pct}%</span>
        </div>
        <div>
          <p className="font-serif text-lg text-[#2B221E] leading-tight">Profile strength</p>
          <p className="text-xs text-[#8A7A6D]">
            {pct === 100 ? "Looking great — clients get the full picture." : "Complete profiles get more bookings."}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {checks.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-sm">
            <span
              className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                item.done ? "bg-[#4F7161] text-white" : "border-2 border-[#E5DCD3]"
              }`}
            >
              {item.done ? "✓" : ""}
            </span>
            <span className={item.done ? "text-[#A89C8F] line-through" : "text-[#2B221E]"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const EditProfile = () => {
  const { notify } = useToast();
  const fileInputRef = useRef(null);

  const [therapist, setTherapist] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyProfile()
      .then((res) => {
        const t = res.data.therapist;
        setTherapist(t);
        setForm(pickForm(t));
        setSaved(pickForm(t));
        setPhotoUrl(t.photoUrl || "");
      })
      .catch(() => setError("Couldn't load your profile."));
  }, []);

  const dirty = form && saved && JSON.stringify(form) !== JSON.stringify(saved);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const checks = useMemo(
    () =>
      form
        ? [
            { label: "Add a profile photo", done: !!photoUrl },
            { label: "Add your qualifications", done: form.qualifications.trim().length > 0 },
            { label: `Write at least ${BIO_GOOD} characters about yourself`, done: form.bio.trim().length >= BIO_GOOD },
            { label: "Add 3 or more areas of focus", done: form.specializations.length >= 3 },
            { label: "Add the languages you speak", done: form.languages.length > 0 },
          ]
        : [],
    [form, photoUrl]
  );

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify("Photo must be 5MB or smaller", { type: "error" });
      return;
    }
    setUploading(true);
    try {
      const res = await uploadPhoto(file);
      setPhotoUrl(res.data.therapist.photoUrl);
      announceProfileUpdate({ photoUrl: res.data.therapist.photoUrl });
      notify("Photo updated");
    } catch (err) {
      notify(err.response?.data?.message || "Couldn't upload the photo", { type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    try {
      await updateProfile({ photoUrl: "" });
      setPhotoUrl("");
      announceProfileUpdate({ photoUrl: "" });
      notify("Photo removed", { type: "info" });
    } catch {
      notify("Couldn't remove the photo", { type: "error" });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, name: form.name.trim(), yearsOfExperience: Number(form.yearsOfExperience) || 0 };
      const res = await updateProfile(payload);
      const fresh = pickForm(res.data.therapist);
      setForm(fresh);
      setSaved(fresh);
      announceProfileUpdate({ name: res.data.therapist.name });
      notify("Profile saved");
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || "Couldn't save your profile.";
      setError(msg);
      notify(msg, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const bookingUrl = therapist ? `${window.location.origin}/${therapist.slug}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      notify("Booking link copied");
    } catch {
      notify("Couldn't copy the link", { type: "error" });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-5 sm:p-8 max-w-6xl w-full mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">Your practice</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Edit profile</h1>
            <p className="text-sm text-[#6B5B52] mt-2">Shown on your booking page.</p>
          </div>
          {therapist && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium px-4 py-2.5 rounded-full border border-[#E5DCD3] bg-white text-[#6B5B52] hover:border-[#FF9E4C] hover:text-[#D96B00] transition"
            >
              View booking page ↗
            </a>
          )}
        </div>

        {!form ? (
          error ? (
            <p className="rounded-2xl bg-[#FDECEA] text-[#9C3B2E] text-sm px-4 py-3">{error}</p>
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
              <div className="space-y-6">
                <div className="skeleton h-64 rounded-[28px]" />
                <div className="skeleton h-56 rounded-[28px]" />
              </div>
              <div className="skeleton h-96 rounded-3xl" />
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
            {/* Form */}
            <div className="space-y-6 min-w-0">
              <Section>
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="shrink-0 flex sm:flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="group relative w-28 h-28 rounded-3xl overflow-hidden border-2 border-[#FFE3C2] bg-[#FFE3C2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9E4C]"
                      aria-label={photoUrl ? "Change photo" : "Upload photo"}
                    >
                      {photoUrl ? (
                        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center font-serif text-4xl text-[#D96B00]">
                          {form.name.charAt(0).toUpperCase() || "?"}
                        </span>
                      )}
                      <span
                        className={`absolute inset-0 bg-[#211A16]/55 text-white text-xs font-semibold flex flex-col items-center justify-center gap-1 transition ${
                          uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                        }`}
                      >
                        {uploading ? "Uploading…" : <>📷<span>{photoUrl ? "Change" : "Upload"}</span></>}
                      </span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <div className="text-center">
                      {photoUrl && (
                        <button type="button" onClick={removePhoto} className="text-xs text-[#9C3B2E]/80 hover:text-[#9C3B2E]">
                          Remove photo
                        </button>
                      )}
                      <p className="text-[11px] text-[#A89C8F]">JPG, PNG, WEBP · 5MB</p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-4">
                    <label className="block">
                      <Label>Display name</Label>
                      <input value={form.name} onChange={(e) => set("name")(e.target.value)} maxLength={80} className={inputClass} placeholder="Dr. Jane Doe" />
                    </label>
                    <label className="block">
                      <Label>Qualifications</Label>
                      <input
                        value={form.qualifications}
                        onChange={(e) => set("qualifications")(e.target.value)}
                        maxLength={300}
                        className={inputClass}
                        placeholder="M.Phil Clinical Psychology, RCI Licensed"
                      />
                    </label>
                    <div>
                      <Label>Years of experience</Label>
                      <div className="inline-flex items-center bg-[#FBF8F3] border border-[#EFE6DA] rounded-2xl">
                        <button
                          type="button"
                          onClick={() => set("yearsOfExperience")(Math.max(0, Number(form.yearsOfExperience) - 1))}
                          className="w-11 h-11 text-lg text-[#6B5B52] hover:text-[#D96B00]"
                          aria-label="Fewer years"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={70}
                          value={form.yearsOfExperience}
                          onChange={(e) => set("yearsOfExperience")(Math.min(70, Math.max(0, Number(e.target.value) || 0)))}
                          className="w-14 bg-transparent text-center font-serif text-xl text-[#2B221E] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
                          aria-label="Years of experience"
                        />
                        <button
                          type="button"
                          onClick={() => set("yearsOfExperience")(Math.min(70, Number(form.yearsOfExperience) + 1))}
                          className="w-11 h-11 text-lg text-[#6B5B52] hover:text-[#D96B00]"
                          aria-label="More years"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section>
                <Label>About you</Label>
                <textarea
                  rows={7}
                  value={form.bio}
                  maxLength={BIO_MAX}
                  onChange={(e) => set("bio")(e.target.value)}
                  placeholder="Hello, I'm… I work with people who… In our sessions, we…"
                  className={`${inputClass} resize-y leading-relaxed`}
                />
                <div className="flex items-center justify-between gap-3 mt-2 text-xs">
                  <span className={form.bio.trim().length >= BIO_GOOD ? "text-[#4F7161]" : "text-[#A89C8F]"}>
                    {form.bio.trim().length >= BIO_GOOD
                      ? "✓ Good length"
                      : `${BIO_GOOD - form.bio.trim().length} more characters recommended`}
                  </span>
                  <span className="text-[#A89C8F] tabular-nums">
                    {form.bio.length}/{BIO_MAX}
                  </span>
                </div>
              </Section>

              <Section>
                <Label>Areas of focus</Label>
                <TagInput
                  value={form.specializations}
                  onChange={set("specializations")}
                  suggestions={SPECIALIZATION_SUGGESTIONS}
                  placeholder="e.g. Anxiety"
                  max={15}
                  maxLength={50}
                />
              </Section>

              <Section>
                <Label>Languages</Label>
                <TagInput
                  value={form.languages}
                  onChange={set("languages")}
                  suggestions={LANGUAGE_SUGGESTIONS}
                  placeholder="e.g. English"
                  max={12}
                  maxLength={30}
                  tone="sage"
                />
              </Section>
            </div>

            {/* Profile strength & booking link */}
            <aside className="space-y-4 lg:sticky lg:top-24">
              <Strength checks={checks} />
              <div className="rounded-3xl bg-[#211A16] text-white p-5 relative overflow-hidden">
                <div
                  className="pointer-events-none absolute -top-12 -right-10 w-36 h-36 rounded-full opacity-50 blur-2xl"
                  style={{ background: "radial-gradient(circle, #FF9E4C 0%, transparent 70%)" }}
                />
                <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB877] mb-1">Your booking link</p>
                <p className="relative text-sm text-white/80 truncate mb-3">{bookingUrl.replace(/^https?:\/\//, "")}</p>
                <button
                  onClick={copyLink}
                  className="relative text-xs font-semibold px-4 py-2 rounded-full bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition"
                >
                  Copy link
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Save bar: appears only when something changed */}
        {dirty && (
          <div className="sticky bottom-4 z-20 mt-6 flex justify-center pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 bg-[#211A16] text-white pl-5 pr-2 py-2 rounded-full shadow-[0_16px_40px_rgba(33,26,22,0.35)] animate-pop">
              <span className="w-2 h-2 rounded-full bg-[#FFB877] animate-pulse" />
              <span className="text-sm">Unsaved changes</span>
              <button
                onClick={() => setForm(saved)}
                disabled={saving}
                className="text-sm text-white/70 hover:text-white px-3 py-1.5 rounded-full transition"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving || form.name.trim().length < 2}
                className="text-sm font-semibold px-5 py-2 rounded-full bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EditProfile;
