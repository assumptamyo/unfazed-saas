import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SessionRoom from "../../components/video/SessionRoom";
import LiveNotesPanel from "../../components/notes/LiveNotesPanel";
import { useAuth } from "../../context/AuthContext";
import { useConversation } from "../../hooks/useConversation";
import { getAppointmentById } from "../../api/appointmentApi";
import { getConversation, sendMessage, markConversationRead, joinTherapistVideo } from "../../api/messagesApi";

const Room = ({ appointment, token, therapistName }) => {
  const clientId = appointment.client.id;
  const conversation = useConversation({
    token,
    clientId,
    me: "therapist",
    fetchPage: async (before) => (await getConversation(clientId, before)).data,
    send: async (text) => (await sendMessage(clientId, text, appointment.id)).data.message,
    markRead: () => markConversationRead(clientId),
  });

  return (
    <SessionRoom
      session={appointment}
      other={appointment.client}
      me="therapist"
      backTo="/therapist/appointments"
      backLabel="Appointments"
      displayName={therapistName}
      join={async () => (await joinTherapistVideo(appointment.id)).data}
      conversation={conversation}
      notesPanel={<LiveNotesPanel sessionId={appointment.id} />}
    />
  );
};

const TherapistSessionRoom = () => {
  const { id } = useParams();
  const { token, therapist } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAppointmentById(id)
      .then((res) => setAppointment(res.data.appointment))
      .catch(() => setError("Session not found."));
  }, [id]);

  if (error || (appointment && !appointment.client)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F9F6F0]">
        <p className="text-[#6B5B52]">{error || "This session has no client attached."}</p>
        <Link to="/therapist/appointments" className="text-sm font-semibold text-[#D96B00] hover:underline">
          ← Back to appointments
        </Link>
      </div>
    );
  }

  if (!appointment) return <div className="min-h-screen bg-[#F3EDE4]" />;

  return <Room appointment={appointment} token={token} therapistName={therapist?.name} />;
};

export default TherapistSessionRoom;
