import { useEffect, useState } from "react";
import { format, parseISO, differenceInSeconds } from "date-fns";

const CameraIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const Countdown = ({ until, onDone }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(differenceInSeconds(until, now), 0);
  useEffect(() => {
    if (secs === 0) onDone();
  }, [secs, onDone]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <span className="font-serif text-4xl tabular-nums text-white">
      {h > 0 && `${h}:`}
      {String(m).padStart(h ? 2 : 1, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
};

// The video area of a session room. `join()` asks the server for room details:
//   { provider, embeddable, url }   or throws with { message, opensAt }
const VideoStage = ({ join, displayName }) => {
  const [state, setState] = useState({ phase: "idle" });

  const start = async () => {
    setState({ phase: "loading" });
    try {
      const info = await join();
      setState({ phase: "joined", info });
    } catch (err) {
      const data = err.response?.data || {};
      setState({
        phase: data.opensAt ? "waiting" : "error",
        message: data.message || "Couldn't open the video room.",
        opensAt: data.opensAt ? parseISO(data.opensAt) : null,
      });
    }
  };

  const shell = (children) => (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-[#211A16] text-white flex items-center justify-center p-6">
      <div
        className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF9E4C 0%, #C9602E 45%, transparent 75%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #8DB3A1 0%, transparent 70%)" }}
      />
      <div className="relative text-center max-w-sm">{children}</div>
    </div>
  );

  if (state.phase === "joined" && state.info.embeddable) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-3xl bg-black">
        <iframe
          title="Video session"
          src={state.info.url}
          allow="camera; microphone; fullscreen; display-capture; autoplay; speaker-selection"
          className="w-full h-full border-0"
        />
        <button
          onClick={() => setState({ phase: "idle" })}
          className="absolute top-3 right-3 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#C8553D] text-white hover:bg-[#A9432E] transition shadow"
        >
          Leave call
        </button>
      </div>
    );
  }

  if (state.phase === "joined") {
    return shell(
      <>
        <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-4 text-[#FFB877]">
          <CameraIcon />
        </div>
        <p className="font-serif text-2xl mb-2">Your video room is ready</p>
        <p className="text-sm text-[#D8C9BC] mb-6">
          The call opens in a new tab. Keep this page open to use the chat alongside it.
        </p>
        <a
          href={state.info.url}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-6 py-3 rounded-full text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition"
        >
          Open video call ↗
        </a>
        {state.info.provider === "jitsi" && (
          <p className="text-[11px] text-white/40 mt-5">Development mode: using Jitsi Meet until a Daily.co key is added.</p>
        )}
      </>
    );
  }

  if (state.phase === "waiting") {
    return shell(
      <>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFB877] mb-3">Room opens in</p>
        <Countdown until={state.opensAt} onDone={start} />
        <p className="text-sm text-[#D8C9BC] mt-4">
          {state.message}. It opens at {format(state.opensAt, "h:mm a")} — this page will connect automatically.
        </p>
      </>
    );
  }

  return shell(
    <>
      <div className="w-20 h-20 mx-auto rounded-3xl bg-white/10 border border-white/10 flex items-center justify-center mb-5 text-[#FFB877]">
        <CameraIcon />
      </div>
      <p className="font-serif text-2xl mb-2">{displayName ? `Ready, ${displayName}?` : "Ready to join?"}</p>
      <p className="text-sm text-[#D8C9BC] mb-6">
        Find a quiet, private space. Your browser will ask to use your camera and microphone.
      </p>
      {state.phase === "error" && <p className="text-sm text-[#FFB4A6] mb-4">{state.message}</p>}
      <button
        onClick={start}
        disabled={state.phase === "loading"}
        className="px-7 py-3 rounded-full text-sm font-semibold bg-[#FF9E4C] text-[#211A16] hover:bg-[#FFB877] transition disabled:opacity-60"
      >
        {state.phase === "loading" ? "Opening room…" : "Join video session"}
      </button>
    </>
  );
};

export default VideoStage;
