"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from "livekit-client";
import { PhoneCall, PhoneOff, Mic, MicOff, Wifi, WifiOff } from "lucide-react";
import { Modal, Pill } from "@/components/ai2-ui";

interface AgentTestWidgetProps {
  agentId: string;
  agentName: string;
  variableValues: Record<string, string>;
  onClose: () => void;
}

type CallState = "idle" | "connecting" | "connected" | "ended" | "error";
type MicPermission = "granted" | "denied" | "prompt" | "unknown";

const formatClock = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function AgentTestWidget({ agentId, agentName, variableValues, onClose }: AgentTestWidgetProps) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  const [reconnecting, setReconnecting] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const sync = () => {
      if (status && !cancelled) setMicPermission(status.state as MicPermission);
    };
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((s) => {
          status = s;
          sync();
          s.addEventListener("change", sync);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      status?.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (state !== "connected") return;
    const started = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  const startCall = async () => {
    setState("connecting");
    setError("");
    setMuted(false);
    setReconnecting(false);
    setAgentSpeaking(false);
    try {
      const res = await fetch(`/api/agents/${agentId}/test-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variable_values: variableValues }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to start test call");

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio && audioElRef.current) {
          track.attach(audioElRef.current);
        }
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setAgentSpeaking(speakers.some((s) => !s.isLocal));
      });
      room.on(RoomEvent.Reconnecting, () => setReconnecting(true));
      room.on(RoomEvent.Reconnected, () => setReconnecting(false));
      room.on(RoomEvent.Disconnected, () => {
        setReconnecting(false);
        setAgentSpeaking(false);
        setState((prev) => (prev === "error" ? prev : "ended"));
      });

      await room.connect(data.url, data.token);
      room.startAudio().catch(() => {});
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setMicPermission("granted");
      } catch (micErr) {
        const denied = micErr instanceof DOMException && (micErr.name === "NotAllowedError" || micErr.name === "SecurityError");
        setMicPermission(denied ? "denied" : micPermission);
        await room.disconnect();
        roomRef.current = null;
        throw new Error(
          denied
            ? "Microphone access was blocked. Allow the microphone in your browser’s site settings, then try again."
            : "No working microphone was found. Connect one and try again."
        );
      }
      setState("connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to test call");
      setState("error");
    }
  };

  const endCall = async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setState("ended");
  };

  const toggleMute = async () => {
    const next = !muted;
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch {
      setError("Couldn’t change the microphone state.");
    }
  };

  const handleClose = () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    onClose();
  };

  const statusPill =
    state === "connected" ? (
      reconnecting ? <Pill tone="amber" dot>Reconnecting…</Pill> : <Pill tone="green" dot>Live</Pill>
    ) : state === "connecting" ? (
      <Pill tone="blue" dot>Connecting</Pill>
    ) : state === "error" ? (
      <Pill tone="red" dot>Failed</Pill>
    ) : state === "ended" ? (
      <Pill tone="gray" dot>Ended</Pill>
    ) : (
      <Pill tone="gray" dot>Ready</Pill>
    );

  const canStart = state === "idle" || state === "ended" || state === "error";
  const stageMessage =
    state === "idle"
      ? "Ready to start a test call"
      : state === "connecting"
      ? "Connecting to the agent…"
      : state === "connected"
      ? reconnecting
        ? "Connection interrupted — trying to reconnect"
        : muted
        ? "You are muted — the agent can’t hear you"
        : agentSpeaking
        ? "Agent is speaking"
        : "Listening — speak now"
      : state === "ended"
      ? `Call ended${elapsed > 0 ? ` after ${formatClock(elapsed)}` : ""}`
      : error || "Something went wrong";

  return (
    <div className="ai2 ai2-contents">
      <Modal
        size="sm"
        title="Test call"
        subtitle={agentName}
        icon={<PhoneCall />}
        onClose={handleClose}
      >
        <audio ref={audioElRef} autoPlay />

        <div className="ai2-call">
          <div className="ai2-call-top">
            {statusPill}
            <span className="ai2-call-timer" aria-live="off">{state === "connected" ? formatClock(elapsed) : "--:--"}</span>
          </div>

          <div className={`ai2-call-orb is-${state}${agentSpeaking && state === "connected" ? " is-speaking" : ""}`} aria-hidden="true">
            {state === "connecting" ? <span className="ai2-spin ai2-spin-lg" /> : state === "error" ? <WifiOff /> : <PhoneCall />}
          </div>

          <p className={`ai2-call-msg${state === "error" ? " is-error" : ""}`} role="status" aria-live="polite">
            {stageMessage}
          </p>

          <div className="ai2-call-controls">
            {canStart ? (
              <button type="button" className="ai2-btn ai2-btn-primary ai2-btn-lg" onClick={startCall}>
                <PhoneCall /> {state === "idle" ? "Start test call" : "Call again"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`ai2-btn ai2-btn-lg${muted ? " is-active" : ""}`}
                  onClick={toggleMute}
                  disabled={state !== "connected"}
                  aria-pressed={muted}
                >
                  {muted ? <MicOff /> : <Mic />} {muted ? "Unmute" : "Mute"}
                </button>
                <button type="button" className="ai2-btn ai2-btn-danger ai2-btn-lg" onClick={endCall}>
                  <PhoneOff /> End call
                </button>
              </>
            )}
          </div>
        </div>

        <div className="ai2-call-meta">
          <div>
            <span className="ai2-call-meta-label">Microphone</span>
            <span className={`ai2-call-meta-value is-${micPermission}`}>
              {micPermission === "granted" && <><Mic /> Allowed</>}
              {micPermission === "denied" && <><MicOff /> Blocked in browser</>}
              {(micPermission === "prompt" || micPermission === "unknown") && <><Mic /> Browser will ask when you start</>}
            </span>
          </div>
          <div>
            <span className="ai2-call-meta-label">Connection</span>
            <span className="ai2-call-meta-value">
              {state === "connected" ? <><Wifi /> {reconnecting ? "Reconnecting" : "Connected"}</> : <><WifiOff /> Not connected</>}
            </span>
          </div>
        </div>

        {micPermission === "denied" && state !== "connected" && (
          <p className="ai2-hint ai2-hint-warn">
            Microphone access is blocked for this site. Click the lock icon in the address bar, allow the microphone, then start the call again.
          </p>
        )}
        <p className="ai2-hint">Talk to this agent in your browser. Test calls use the saved version and don’t need a phone number.</p>
      </Modal>
    </div>
  );
}
