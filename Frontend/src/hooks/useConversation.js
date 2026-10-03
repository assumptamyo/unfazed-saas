import { useCallback, useEffect, useRef, useState } from "react";
import { useSocketEvents, emitSocket } from "./useSocket";

// Loads one therapist↔client conversation and keeps it live.
//   token     - the socket login token (therapist or client)
//   clientId  - which conversation this is
//   me        - "therapist" or "client"
//   fetchPage(before) -> { messages, hasMore }
//   send(text)        -> the saved message
//   markRead()        -> tells the server I've seen the other side's messages
export const useConversation = ({ token, clientId, me, fetchPage, send, markRead }) => {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (!clientId) return undefined;
    let alive = true;
    fetchPage()
      .then(({ messages: page, hasMore: more }) => {
        if (!alive) return;
        setMessages(page);
        setHasMore(more);
        setError("");
      })
      .catch(() => alive && setError("Couldn't load messages."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // fetchPage is recreated by callers each render; the conversation key is clientId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const addMessage = useCallback((m) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  useSocketEvents(token, {
    "message:new": (m) => {
      if (String(m.clientId) !== String(clientId)) return;
      if (m.sender !== me) setOtherTyping(false);
      addMessage(m);
      if (m.sender !== me) markRead()?.catch?.(() => {});
    },
    // The other person is typing: show it for a few seconds after each signal
    typing: ({ clientId: cid, from }) => {
      if (String(cid) !== String(clientId) || from === me) return;
      setOtherTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setOtherTyping(false), 3500);
    },
    "messages:read": ({ clientId: cid, reader }) => {
      if (String(cid) !== String(clientId) || reader === me) return;
      const now = new Date().toISOString();
      setMessages((prev) => prev.map((m) => (m.sender === me && !m.readAt ? { ...m, readAt: now } : m)));
    },
  });

  const loadMore = async () => {
    if (!messages.length) return;
    const { messages: older, hasMore: more } = await fetchPage(messages[0].createdAt);
    setMessages((prev) => [...older, ...prev]);
    setHasMore(more);
  };

  const sendText = async (text) => {
    const saved = await send(text);
    addMessage(saved);
  };

  // Tell the other side we're typing (at most every 2.5 seconds)
  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    emitSocket(token, "typing", { clientId });
  };

  return { messages, hasMore, loading, error, loadMore, sendText, otherTyping, notifyTyping };
};
