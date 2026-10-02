import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SessionRoom from "../../components/video/SessionRoom";
import { useConversation } from "../../hooks/useConversation";
import {
  getClientToken,
  getPortal,
  getPortalMessages,
  sendPortalMessage,
  markPortalRead,
  joinPortalVideo,
} from "../../api/portalApi";

const Room = ({ portal, session }) => {
  const conversation = useConversation({
    token: getClientToken(),
    clientId: portal.client.id,
    me: "client",
    fetchPage: async (before) => (await getPortalMessages(before)).data,
    send: async (text) => (await sendPortalMessage(text, session.id)).data.message,
    markRead: () => markPortalRead(),
  });

  return (
    <SessionRoom
      session={session}
      other={portal.therapist}
      me="client"
      backTo="/portal"
      backLabel="My space"
      displayName={portal.client.name}
      join={async () => (await joinPortalVideo(session.id)).data}
      conversation={conversation}
    />
  );
};

const PortalRoom = () => {
  const { id } = useParams();
  const [portal, setPortal] = useState(null);
  const [error, setError] = useState(() => (getClientToken() ? "" : "Please open the link from your email."));

  useEffect(() => {
    if (!getClientToken()) return;
    getPortal()
      .then((res) => setPortal(res.data))
      .catch((err) => setError(err.response?.data?.message || "Couldn't load this session."));
  }, []);

  const session = portal && [...portal.upcoming, ...portal.past].find((s) => String(s.id) === id);

  if (error || (portal && !session)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F9F6F0] p-6 text-center">
        <p className="text-[#6B5B52]">{error || "This session isn't available."}</p>
        <Link to={getClientToken() ? "/portal" : "/portal/login"} className="text-sm font-semibold text-[#D96B00] hover:underline">
          {getClientToken() ? "← Back to my space" : "Sign in"}
        </Link>
      </div>
    );
  }

  if (!portal) return <div className="min-h-screen bg-[#F3EDE4]" />;

  return <Room portal={portal} session={session} />;
};

export default PortalRoom;
