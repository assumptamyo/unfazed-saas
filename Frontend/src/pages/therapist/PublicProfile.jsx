import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";
import BookingCalendar from "../../components/scheduling/BookingCalendar";

const CheckBadge = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const PublicProfile = () => {
  const { slug } = useParams();
  const [therapist, setTherapist] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axiosInstance.get(`/therapist/${slug}`);
        setTherapist(res.data.therapist);

        document.title = `${res.data.therapist.name} | Unfazed`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute(
            "content",
            res.data.therapist.bio || `Book a session with ${res.data.therapist.name}`
          );
        }
      } catch (err) {
        setNotFound(true);
      }
    };
    fetchProfile();
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0]">
        <p className="text-[#2B221E]" style={{ fontFamily: "Inter, sans-serif" }}>
          Therapist not found.
        </p>
      </div>
    );
  }

  if (!therapist) return null;

  const initial = therapist.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-[#F9F6F0]" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="max-w-5xl mx-auto px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-8 items-start">

          {/* Left column — profile info, sticky on desktop */}
          <div className="lg:sticky lg:top-16">
            <div className="bg-white border border-[#EFE6DA] rounded-3xl p-7">
              <div className="flex items-center gap-4 mb-5">
                {therapist.photoUrl ? (
                  <img
                    src={therapist.photoUrl}
                    alt={therapist.name}
                    className="w-20 h-20 rounded-2xl object-cover border border-[#EFE6DA]"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl bg-[#FFE3C2] flex items-center justify-center text-[#D96B00] text-2xl"
                    style={{ fontFamily: "Literata, serif" }}
                  >
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-xl text-[#2B221E] leading-snug" style={{ fontFamily: "Literata, serif" }}>
                    {therapist.name}
                  </h1>
                  {therapist.qualifications && (
                    <p className="text-sm text-[#8A7A6D] mt-0.5">{therapist.qualifications}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-5">
                {therapist.yearsOfExperience > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-[#4F7161] bg-[#EEF3F0] border border-[#D7E5DC] px-3 py-1.5 rounded-full">
                    <CheckBadge />
                    {therapist.yearsOfExperience}+ years
                  </span>
                )}
                {therapist.languages?.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-[#6B6059] bg-[#FBF8F3] border border-[#EFE6DA] px-3 py-1.5 rounded-full">
                    <GlobeIcon />
                    {therapist.languages.join(", ")}
                  </span>
                )}
              </div>

              {therapist.bio && (
                <p className="text-[#4A413A] text-sm leading-relaxed mb-5">
                  {therapist.bio}
                </p>
              )}

              {therapist.specializations?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {therapist.specializations.map((spec, i) => (
                    <span
                      key={i}
                      className="bg-[#FFF3E6] border border-[#FFD9AE] text-[#8A4B00] text-xs px-3 py-1.5 rounded-full font-medium"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <a
              href={`mailto:`}
              className="hidden"
            />
          </div>

          {/* Right column — booking */}
          <div>
            <div className="mb-5">
              <h2 className="text-2xl text-[#2B221E]" style={{ fontFamily: "Literata, serif" }}>
                Book a session
              </h2>
              <p className="text-[#6B6059] text-sm mt-1">
                Pick a time that works for you — you'll get a confirmation right away.
              </p>
            </div>
            <BookingCalendar slug={slug} />
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublicProfile;