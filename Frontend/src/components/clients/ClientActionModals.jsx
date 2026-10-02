import { useState } from "react";
import Modal from "../appointments/Modal";
import ClientAvatar from "../appointments/ClientAvatar";
import { archiveClient, deleteClient } from "../../api/clientApi";
import { apiError } from "../appointments/appointmentUtils";

const ClientSummary = ({ client }) => (
  <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#FBF8F3] border border-[#EFE6DA] mb-5">
    <ClientAvatar name={client.name} />
    <div className="min-w-0">
      <p className="font-medium text-[#2B221E] truncate">{client.name}</p>
      <p className="text-sm text-[#8A7A6D] truncate">{client.email}</p>
    </div>
  </div>
);

const ErrorBox = ({ message }) =>
  message ? (
    <div className="mt-4 bg-[#FDECEA] border border-[#F5C2BE] text-[#9C3B2E] text-sm rounded-xl px-4 py-3">
      {message}
    </div>
  ) : null;

export const ArchiveClientModal = ({ client, upcomingCount, onClose, onDone }) => {
  const [notifyClient, setNotifyClient] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstName = client.name.split(" ")[0];

  const handleArchive = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await archiveClient(client._id, { notifyClient: upcomingCount > 0 && notifyClient });
      onDone(res.data);
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Archive this client?"
      subtitle="They'll be hidden from your client list. Their history is kept and you can restore them anytime."
      footer={
        <>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition"
          >
            Keep active
          </button>
          <button
            onClick={handleArchive}
            disabled={saving}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#211A16] text-white hover:bg-[#3A2E27] transition disabled:opacity-50"
          >
            {saving ? "Archiving…" : "Archive client"}
          </button>
        </>
      }
    >
      <ClientSummary client={client} />

      {upcomingCount > 0 ? (
        <div className="rounded-2xl bg-[#FFF8E6] border border-[#F6DFA8] px-4 py-3">
          <p className="text-sm text-[#7A5414]">
            <strong className="font-semibold">
              {upcomingCount} upcoming session{upcomingCount > 1 ? "s" : ""}
            </strong>{" "}
            will be cancelled and the slot{upcomingCount > 1 ? "s" : ""} opened up for new bookings.
          </p>
          <label className="flex items-center gap-2.5 text-sm text-[#7A5414] mt-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notifyClient}
              onChange={(e) => setNotifyClient(e.target.checked)}
              className="w-4 h-4 accent-[#B7791F]"
            />
            Email {firstName} about the cancellation
          </label>
        </div>
      ) : (
        <p className="text-sm text-[#8A7A6D]">{firstName} has no upcoming sessions, so nothing will be cancelled.</p>
      )}

      <ErrorBox message={error} />
    </Modal>
  );
};

export const DeleteClientModal = ({ client, sessionCount, onClose, onDone }) => {
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const matches = typed.trim().toLowerCase() === client.name.trim().toLowerCase();

  const handleDelete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await deleteClient(client._id);
      onDone(res.data);
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete permanently?"
      subtitle="This can't be undone."
      footer={
        <>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5B52] hover:bg-[#F3EBDF] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!matches || saving}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#C8553D] text-white hover:bg-[#A9432E] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Deleting…" : "Delete forever"}
          </button>
        </>
      }
    >
      <ClientSummary client={client} />

      <div className="rounded-2xl bg-[#FDECEA] border border-[#F5C2BE] px-4 py-3 mb-4">
        <p className="text-sm text-[#9C3B2E]">
          This removes the client, their intake answers, consent record and{" "}
          <strong className="font-semibold">
            all {sessionCount} session{sessionCount === 1 ? "" : "s"}
          </strong>{" "}
          from your records. If you only want to stop seeing them, archive instead.
        </p>
      </div>

      <label className="block text-xs font-medium text-[#8A7A6D] mb-2">
        Type <span className="font-semibold text-[#2B221E]">{client.name}</span> to confirm
      </label>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className="w-full bg-white border border-[#EFE6DA] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8553D]/30 focus:border-[#C8553D]/50 transition"
      />

      <ErrorBox message={error} />
    </Modal>
  );
};
