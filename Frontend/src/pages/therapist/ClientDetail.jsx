import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { getClientById } from "../../api/clientApi";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

const statusStyles = {
  confirmed: "bg-[#EAF6EC] text-[#2F6B3A]",
  cancelled: "bg-[#FDECEA] text-[#9C3B2E]",
  completed: "bg-[#E8EEF9] text-[#2F4D7A]",
  "no-show": "bg-[#FFF3E6] text-[#8A4B00]",
};

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

const ClientDetail = () => {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getClientById(id);
        setClient(res.data.client);
        setSessions(res.data.sessions);
      } catch (err) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-10 flex justify-center">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#D96B00]" />
        </div>
      </DashboardLayout>
    );
  }

  if (notFound || !client) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-[#6B5B52]" style={{ fontFamily: "Inter, sans-serif" }}>
          Client not found.
        </div>
      </DashboardLayout>
    );
  }

  const initial = client.name.charAt(0).toUpperCase();

  return (
    <DashboardLayout>
      <div className="p-6 sm:p-8 max-w-4xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
        <Link
          to="/therapist/clients"
          className="inline-flex items-center gap-1.5 text-sm text-[#D96B00] hover:underline mb-6"
        >
          <BackIcon />
          Back to clients
        </Link>

        {/* Profile card */}
        <div className="bg-white border border-[#E5DCD3] rounded-3xl p-6 mb-6 flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full bg-[#FFE3C2] flex items-center justify-center text-[#D96B00] text-2xl font-semibold"
              style={{ fontFamily: "Literata, serif" }}
            >
              {initial}
            </div>
            <div>
              <h1 className="text-xl text-[#2B221E]" style={{ fontFamily: "Literata, serif" }}>
                {client.name}
              </h1>
              <p className="text-sm text-[#6B5B52]">{client.email}</p>
              {client.phone && <p className="text-sm text-[#A89C8F]">{client.phone}</p>}
            </div>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${client.status === "active" ? "bg-[#EEF3F0] text-[#4F7161]" : "bg-[#F3EFEA] text-[#8A7A6D]"}`}>
            {client.status}
          </span>
        </div>

        {/* Intake info */}
        {(client.intake?.demographics?.age || client.intake?.presentingConcern) && (
          <div className="bg-white border border-[#E5DCD3] rounded-3xl p-6 mb-6">
            <h2 className="text-lg text-[#2B221E] mb-4" style={{ fontFamily: "Literata, serif" }}>
              Intake Information
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 text-sm">
              {client.intake?.demographics?.age && (
                <div>
                  <p className="text-xs text-[#A89C8F] mb-0.5">Age</p>
                  <p className="text-[#2B221E] font-medium">{client.intake.demographics.age}</p>
                </div>
              )}
              {client.intake?.demographics?.gender && (
                <div>
                  <p className="text-xs text-[#A89C8F] mb-0.5">Gender</p>
                  <p className="text-[#2B221E] font-medium capitalize">{client.intake.demographics.gender}</p>
                </div>
              )}
              {client.intake?.demographics?.occupation && (
                <div>
                  <p className="text-xs text-[#A89C8F] mb-0.5">Occupation</p>
                  <p className="text-[#2B221E] font-medium">{client.intake.demographics.occupation}</p>
                </div>
              )}
            </div>
            {client.intake?.presentingConcern && (
              <div>
                <p className="text-xs text-[#A89C8F] mb-1">Presenting concern</p>
                <p className="text-sm text-[#4A413A] leading-relaxed">{client.intake.presentingConcern}</p>
              </div>
            )}
            {client.consent?.agreed && (
              <p className="text-xs text-[#4F7161] mt-4 flex items-center gap-1.5">
                ✓ Consent given on {format(parseISO(client.consent.agreedAt), "MMM d, yyyy")}
              </p>
            )}
          </div>
        )}

        {/* Session history */}
        <div className="bg-white border border-[#E5DCD3] rounded-3xl p-6">
          <h2 className="text-lg text-[#2B221E] mb-4" style={{ fontFamily: "Literata, serif" }}>
            Session History
          </h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-[#6B5B52]">No sessions yet.</p>
          ) : (
            <div className="divide-y divide-[#F6F0E8]">
              {sessions.map((s) => (
                <div key={s._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-[#2B221E]">
                      {format(parseISO(s.date), "EEE, MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-[#A89C8F]">{s.startTime}–{s.endTime}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[s.status]}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientDetail;