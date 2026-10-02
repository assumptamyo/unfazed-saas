import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { startPortalSession } from "../../api/portalApi";

// Landing page for the private link in emails: swaps it for a login and opens the client space
const PortalEntry = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    startPortalSession(token)
      .then(() => navigate("/portal", { replace: true }))
      .catch((err) =>
        setError(err.response?.data?.message || "This link didn't work. Ask your therapist to send a new one.")
      );
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-[#F9F6F0] flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D96B00] mb-4">Unfazed</p>
        {error ? (
          <>
            <h1 className="font-serif text-2xl text-[#2B221E] mb-2">Link expired</h1>
            <p className="text-sm text-[#6B5B52]">{error}</p>
            <Link
              to="/portal/login"
              className="inline-block mt-6 px-6 py-3 rounded-full text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition"
            >
              Sign in with a code instead
            </Link>
          </>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-[#FFD9AE] border-t-[#D96B00] animate-spin" />
            <p className="text-sm text-[#6B5B52]">Opening your private space…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalEntry;
