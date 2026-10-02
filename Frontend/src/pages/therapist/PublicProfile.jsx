import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";

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

  return (
    <div className="min-h-screen bg-[#F9F6F0] px-6 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <h1
          className="text-[#2B221E] text-4xl mb-4"
          style={{ fontFamily: "Literata, serif" }}
        >
          {therapist.name}
        </h1>

        {therapist.bio && (
          <p
            className="text-[#6B6059] text-lg mb-8 leading-relaxed"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {therapist.bio}
          </p>
        )}

        {therapist.specializations?.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {therapist.specializations.map((spec, i) => (
              <span
                key={i}
                className="bg-white border border-[#EFE6DA] text-[#2B221E] text-sm px-4 py-1.5 rounded-full"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {spec}
              </span>
            ))}
          </div>
        )}

        <button
          className="bg-[#FF9E4C] text-[#211A16] font-medium px-8 py-3 rounded-full hover:bg-[#D96B00]/80 transition-colors"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Book a session
        </button>
      </div>
    </div>
  );
};

export default PublicProfile;