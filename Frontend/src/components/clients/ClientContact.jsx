import { useState } from "react";
import { updateClient } from "../../api/clientApi";
import { useToast } from "../../context/toastContext";
import { apiError } from "../appointments/appointmentUtils";

// "+919820012345" -> "+91 98200 12345"
const prettyPhone = (phone) => {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone || "");
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
};

// The client's phone number and WhatsApp preference, editable in place
const ClientContact = ({ client, onSaved }) => {
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const optedIn = client.whatsappOptIn !== false;

  const save = async (changes) => {
    setSaving(true);
    try {
      const res = await updateClient(client._id, changes);
      onSaved(res.data.client);
      setEditing(false);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ phone: phone.trim() });
        }}
        className="flex items-center gap-2 mt-1"
      >
        <input
          type="tel"
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98200 12345"
          aria-label="Client mobile number"
          className="w-44 bg-[#FBF8F3] border border-[#EFE6DA] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]"
        />
        <button type="submit" disabled={saving} className="text-xs font-semibold text-[#D96B00] hover:underline disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-[#8A7A6D] hover:underline">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm">
      {client.phone ? (
        <span className="text-[#A89C8F]">{prettyPhone(client.phone)}</span>
      ) : (
        <span className="text-[#A89C8F] italic">No phone number</span>
      )}
      {!client.archivedAt && (
        <button
          onClick={() => {
            setPhone(client.phone || "");
            setEditing(true);
          }}
          className="text-xs text-[#D96B00] hover:underline"
        >
          {client.phone ? "Edit" : "Add"}
        </button>
      )}
      {client.phone && (
        <label className="flex items-center gap-1.5 text-xs text-[#6B5B52]" title="Booking updates and reminders on WhatsApp">
          <input
            type="checkbox"
            checked={optedIn}
            disabled={saving || Boolean(client.archivedAt)}
            onChange={(e) => save({ whatsappOptIn: e.target.checked })}
            className="accent-[#FF9E4C]"
          />
          WhatsApp reminders
        </label>
      )}
    </div>
  );
};

export default ClientContact;
