import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { getClientById, restoreClient } from "../../api/clientApi";
import { getNotes } from "../../api/notesApi";
import { sendPortalLink } from "../../api/messagesApi";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClientContact from "../../components/clients/ClientContact";
import ClientBilling from "../../components/clients/ClientBilling";
import { ArchiveClientModal, DeleteClientModal } from "../../components/clients/ClientActionModals";
import { useToast } from "../../context/toastContext";
import { apiError } from "../../components/appointments/appointmentUtils";

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
  const [billing, setBilling] = useState({ packages: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [clientNotes, setClientNotes] = useState([]);
  const navigate = useNavigate();
  const { notify } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getClientById(id);
        setClient(res.data.client);
        setSessions(res.data.sessions);
        setBilling({ packages: res.data.packages || [], payments: res.data.payments || [] });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, reloadKey]);

  useEffect(() => {
    let alive = true;
    getNotes({ client: id })
      .then((res) => alive && setClientNotes(res.data.notes))
      .catch(() => alive && setClientNotes([]));
    return () => {
      alive = false;
    };
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
  const now = new Date();
  const upcomingCount = sessions.filter(
    (s) => s.status === "confirmed" && parseISO(`${s.date.slice(0, 10)}T${s.startTime}`) > now
  ).length;

  const handleSendLink = async () => {
    try {
      const res = await sendPortalLink(client._id);
      notify(res.data.message);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    }
  };

  const handleRestore = async () => {
    try {
      await restoreClient(client._id);
      notify(`${client.name} restored`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    }
  };

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
              <ClientContact client={client} onSaved={(c) => setClient((prev) => ({ ...prev, ...c }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {client.archivedAt ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-[#ECE7E1] text-[#6B5B52]">archived</span>
            ) : (
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${client.status === "active" ? "bg-[#EEF3F0] text-[#4F7161]" : "bg-[#F3EFEA] text-[#8A7A6D]"}`}>
                {client.status}
              </span>
            )}
            {!client.archivedAt && (
              <>
                <Link
                  to={`/therapist/messages/${client._id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#211A16] text-white hover:bg-[#3A2E27] transition"
                >
                  Message
                </Link>
                <button
                  onClick={handleSendLink}
                  title="Email the client a fresh link to their private space"
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-[#E5DCD3] text-[#6B5B52] hover:border-[#FF9E4C] hover:text-[#D96B00] transition"
                >
                  Send client link
                </button>
              </>
            )}
            {!client.archivedAt && (
              <button
                onClick={() => setArchiveOpen(true)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-[#E5DCD3] text-[#6B5B52] hover:border-[#2B221E]/30 hover:text-[#2B221E] transition"
              >
                Archive
              </button>
            )}
          </div>
        </div>

        {client.archivedAt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F3EFEA] border border-[#E5DCD3] px-5 py-3.5 mb-6">
            <p className="text-sm text-[#6B5B52]">
              Archived on {format(parseISO(client.archivedAt), "MMM d, yyyy")}. Hidden from your client list; history is kept.
            </p>
            <button onClick={handleRestore} className="text-sm font-semibold text-[#D96B00] hover:underline">
              Restore client
            </button>
          </div>
        )}

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

        {(billing.packages.length > 0 || billing.payments.length > 0) && (
          <ClientBilling packages={billing.packages} payments={billing.payments} />
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
                      {format(parseISO(s.date.slice(0, 10)), "EEE, MMM d, yyyy")}
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

        {/* Notes timeline */}
        <div className="bg-white border border-[#E5DCD3] rounded-3xl p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-[#2B221E]" style={{ fontFamily: "Literata, serif" }}>
              Session Notes
            </h2>
            <span className="text-xs text-[#A89C8F]">Private to you</span>
          </div>
          {clientNotes.length === 0 ? (
            <p className="text-sm text-[#6B5B52]">No notes yet. Open a session to write one.</p>
          ) : (
            <ol className="relative border-l border-[#EAE0D4] ml-1.5 space-y-4">
              {clientNotes.map((n) => (
                <li key={n.id} className="pl-5 relative">
                  <span
                    className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                      n.status === "signed" ? "bg-[#4F7161]" : "bg-[#FFB877]"
                    }`}
                  />
                  <Link
                    to={`/therapist/notes/session/${n.sessionId}${n.visibility === "shared" ? "?v=shared" : ""}`}
                    className="group block"
                  >
                    <p className="text-sm font-medium text-[#2B221E] group-hover:text-[#D96B00] transition">
                      {n.session ? format(parseISO(n.session.date), "EEE, MMM d, yyyy") : "Session removed"}
                      <span className="text-xs font-normal text-[#A89C8F]">
                        {" "}
                        · {n.visibility === "shared" ? "Shared with client · " : ""}
                        {n.status === "signed" ? "Signed" : "Draft"}
                      </span>
                    </p>
                    <p className="text-sm text-[#6B5B52] line-clamp-2 mt-0.5">{n.excerpt || "Empty draft"}</p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Danger zone */}
        <div className="mt-6 rounded-3xl border border-[#F5C2BE]/70 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#2B221E]">Delete client permanently</p>
            <p className="text-xs text-[#8A7A6D] mt-0.5">
              Removes this client, all {sessions.length} of their sessions and their notes. This can't be undone.
            </p>
          </div>
          <button
            onClick={() => setDeleteOpen(true)}
            className="text-sm font-semibold px-4 py-2 rounded-full border border-[#F5C2BE] text-[#9C3B2E] hover:bg-[#FDECEA] transition"
          >
            Delete…
          </button>
        </div>
      </div>

      {archiveOpen && (
        <ArchiveClientModal
          client={client}
          upcomingCount={upcomingCount}
          onClose={() => setArchiveOpen(false)}
          onDone={({ cancelledSessions }) => {
            setArchiveOpen(false);
            notify(
              `${client.name} archived${cancelledSessions ? ` · ${cancelledSessions} session${cancelledSessions > 1 ? "s" : ""} cancelled` : ""}`
            );
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {deleteOpen && (
        <DeleteClientModal
          client={client}
          sessionCount={sessions.length}
          onClose={() => setDeleteOpen(false)}
          onDone={() => {
            notify(`${client.name} was permanently deleted`, { type: "info" });
            navigate("/therapist/clients");
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default ClientDetail;