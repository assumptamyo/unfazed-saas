import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClientAvatar from "../../components/appointments/ClientAvatar";
import ChatThread from "../../components/chat/ChatThread";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/toastContext";
import { useSocketEvents } from "../../hooks/useSocket";
import { useConversation } from "../../hooks/useConversation";
import {
  getConversations,
  getConversation,
  sendMessage,
  markConversationRead,
  sendPortalLink,
} from "../../api/messagesApi";
import { getClients } from "../../api/clientApi";
import { apiError } from "../../components/appointments/appointmentUtils";

const ThreadPanel = ({ clientId, token, onBack }) => {
  const { notify } = useToast();
  const [client, setClient] = useState(null);

  const convo = useConversation({
    token,
    clientId,
    me: "therapist",
    fetchPage: async (before) => {
      const res = await getConversation(clientId, before);
      if (!before) setClient(res.data.client);
      return res.data;
    },
    send: async (text) => (await sendMessage(clientId, text)).data.message,
    markRead: () => markConversationRead(clientId),
  });

  const resendLink = async () => {
    try {
      const res = await sendPortalLink(clientId);
      notify(res.data.message);
    } catch (err) {
      notify(apiError(err), { type: "error" });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-[#F0E8DD] bg-white/80">
        <button onClick={onBack} className="md:hidden text-[#6B5B52] text-lg px-1" aria-label="Back to conversations">
          ←
        </button>
        {client ? (
          <>
            <ClientAvatar name={client.name} size="sm" />
            <div className="min-w-0 flex-1">
              <Link to={`/therapist/clients/${client.id}`} className="font-medium text-[#2B221E] hover:text-[#D96B00] truncate block">
                {client.name}
              </Link>
              <p className="text-xs text-[#A89C8F] truncate">{client.email}</p>
            </div>
            <button
              onClick={resendLink}
              title="Email the client a fresh link to their private space"
              className="hidden sm:block text-xs font-medium px-3 py-1.5 rounded-full border border-[#EFE6DA] text-[#6B5B52] hover:border-[#FF9E4C] hover:text-[#D96B00] transition"
            >
              Send client link
            </button>
          </>
        ) : (
          <div className="skeleton h-8 w-48 rounded-xl" />
        )}
      </div>
      <ChatThread
        messages={convo.messages}
        hasMore={convo.hasMore}
        onLoadMore={convo.loadMore}
        loading={convo.loading}
        me="therapist"
        otherName={client?.name || "client"}
        onSend={convo.sendText}
        otherTyping={convo.otherTyping}
        onTyping={convo.notifyTyping}
        disabledReason={client?.archived ? "This client is archived. Restore them to send messages." : ""}
        emptyHint={client ? `No messages yet. ${client.name} will be emailed when you write.` : ""}
      />
    </div>
  );
};

const NewConversationPicker = ({ existingIds, onPick, onClose }) => {
  const [clients, setClients] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    getClients()
      .then((res) => setClients(res.data.clients))
      .catch(() => setClients([]));
  }, []);
  const list = (clients || []).filter(
    (c) => !existingIds.has(String(c.id)) && (!q || c.name.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div className="absolute inset-0 z-10 bg-[#FFFDF9] flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 p-3 border-b border-[#F0E8DD]">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a client…"
          className="flex-1 bg-white border border-[#EFE6DA] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40"
        />
        <button onClick={onClose} className="text-sm text-[#8A7A6D] px-2">
          Cancel
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {clients === null ? (
          <div className="p-3 space-y-2">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-[#A89C8F] text-center p-6">No other clients to message.</p>
        ) : (
          list.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FBF8F3] text-left transition"
            >
              <ClientAvatar name={c.name} size="sm" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#2B221E] truncate">{c.name}</span>
                <span className="block text-xs text-[#A89C8F] truncate">{c.email}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const Messages = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [conversations, setConversations] = useState(null);
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const knownIds = useRef(new Set());
  useEffect(() => {
    knownIds.current = new Set((conversations || []).map((c) => String(c.client.id)));
  }, [conversations]);

  useEffect(() => {
    let alive = true;
    getConversations()
      .then((res) => alive && setConversations(res.data.conversations))
      .catch(() => alive && setConversations([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Keep the list live: move the conversation to the top and update its preview
  useSocketEvents(token, {
    "message:new": (m) => {
      // A brand-new conversation: reload the list to get the client's details
      if (!knownIds.current.has(String(m.clientId))) {
        setReloadKey((k) => k + 1);
        return;
      }
      setConversations((prev) => {
        const existing = prev?.find((c) => String(c.client.id) === String(m.clientId));
        if (!existing) return prev;
        const isOpen = String(m.clientId) === String(clientId);
        const updated = {
          ...existing,
          lastMessage: { text: m.text, sender: m.sender, createdAt: m.createdAt },
          unread: m.sender === "client" && !isOpen ? existing.unread + 1 : existing.unread,
        };
        return [updated, ...prev.filter((c) => c !== existing)];
      });
    },
    "messages:read": ({ clientId: cid, reader }) => {
      if (reader !== "therapist") return;
      setConversations((prev) => prev?.map((c) => (String(c.client.id) === String(cid) ? { ...c, unread: 0 } : c)));
    },
  });

  const visible = useMemo(
    () =>
      (conversations || []).filter(
        (c) => !search || c.client.name.toLowerCase().includes(search.toLowerCase())
      ),
    [conversations, search]
  );

  const existingIds = useMemo(() => new Set((conversations || []).map((c) => String(c.client.id))), [conversations]);

  return (
    <DashboardLayout>
      <div className="p-0 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
        <div className="hidden sm:block mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D96B00] mb-2">Secure messaging</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2B221E] tracking-tight">Messages</h1>
        </div>

        <div className="bg-white sm:border border-[#EFE6DA] sm:rounded-3xl overflow-hidden grid md:grid-cols-[300px_1fr] h-[calc(100vh-73px)] sm:h-[calc(100vh-220px)] min-h-[480px]">
          {/* Conversation list */}
          <aside className={`relative border-r border-[#F0E8DD] flex-col min-h-0 bg-[#FFFDF9] ${clientId ? "hidden md:flex" : "flex"}`}>
            <div className="flex items-center gap-2 p-3 border-b border-[#F0E8DD]">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="flex-1 min-w-0 bg-white border border-[#EFE6DA] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/40"
              />
              <button
                onClick={() => setPicking(true)}
                title="New message"
                aria-label="New message"
                className="w-9 h-9 shrink-0 rounded-xl bg-[#211A16] text-white text-lg hover:bg-[#3A2E27] transition"
              >
                +
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin">
              {conversations === null ? (
                <div className="p-3 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-14 rounded-xl" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <div className="text-center px-6 py-12">
                  <p className="text-sm text-[#6B5B52]">{search ? "No matches." : "No conversations yet."}</p>
                  {!search && (
                    <button onClick={() => setPicking(true)} className="text-sm font-semibold text-[#D96B00] mt-2 hover:underline">
                      Message a client
                    </button>
                  )}
                </div>
              ) : (
                visible.map((c) => {
                  const active = String(c.client.id) === String(clientId);
                  return (
                    <Link
                      key={c.client.id}
                      to={`/therapist/messages/${c.client.id}`}
                      className={`flex items-center gap-3 px-3 py-3 border-l-[3px] transition ${
                        active ? "bg-[#FFF3E6] border-[#D96B00]" : "border-transparent hover:bg-[#FBF8F3]"
                      }`}
                    >
                      <ClientAvatar name={c.client.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${c.unread ? "font-semibold text-[#2B221E]" : "font-medium text-[#2B221E]"}`}>
                            {c.client.name}
                          </p>
                          <span className="text-[10px] text-[#A89C8F] shrink-0">
                            {formatDistanceToNowStrict(parseISO(c.lastMessage.createdAt), { addSuffix: false })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs truncate ${c.unread ? "text-[#2B221E]" : "text-[#A89C8F]"}`}>
                            {c.lastMessage.sender === "therapist" && "You: "}
                            {c.lastMessage.text}
                          </p>
                          {c.unread > 0 && (
                            <span className="text-[10px] font-bold min-w-5 h-5 px-1.5 rounded-full bg-[#FF9E4C] text-[#211A16] flex items-center justify-center shrink-0">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
            {picking && (
              <NewConversationPicker
                existingIds={existingIds}
                onClose={() => setPicking(false)}
                onPick={(id) => {
                  setPicking(false);
                  navigate(`/therapist/messages/${id}`);
                }}
              />
            )}
          </aside>

          {/* Thread */}
          <section className={`min-h-0 flex-col bg-[#FBF8F3]/40 ${clientId ? "flex" : "hidden md:flex"}`}>
            {clientId ? (
              <ThreadPanel
                key={clientId}
                clientId={clientId}
                token={token}
                onBack={() => navigate("/therapist/messages")}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-3xl bg-[#211A16] text-[#FFB877] flex items-center justify-center text-2xl mb-4">✉</div>
                <p className="font-serif text-xl text-[#2B221E]">Your conversations</p>
                <p className="text-sm text-[#8A7A6D] mt-1 max-w-xs">
                  Only you and your client can see these messages.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
