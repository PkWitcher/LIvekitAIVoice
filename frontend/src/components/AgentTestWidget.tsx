"use client";

import { useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { PhoneCall, PhoneOff, Mic, MicOff, X } from "lucide-react";

interface AgentTestWidgetProps {
  agentId: string;
  agentName: string;
  variableValues: Record<string, string>;
  onClose: () => void;
}

type CallState = "idle" | "connecting" | "connected" | "ended" | "error";

export default function AgentTestWidget({ agentId, agentName, variableValues, onClose }: AgentTestWidgetProps) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const startCall = async () => {
    setState("connecting");
    setError("");
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
      room.on(RoomEvent.Disconnected, () => setState("ended"));

      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
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
    await roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };

  const handleClose = () => {
    roomRef.current?.disconnect();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-sm space-y-5 relative">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h2 className="text-base font-semibold text-white">Test Call — {agentName}</h2>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Talk to this agent right in your browser. No phone number needed.
          </p>
        </div>

        {/* Hidden audio sink for the agent's voice */}
        <audio ref={audioElRef} autoPlay />

        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              state === "connected"
                ? "bg-green-500/15 text-green-400"
                : state === "connecting"
                ? "bg-blue-500/15 text-blue-400"
                : "bg-white/[0.06] text-[var(--color-text-muted)]"
            }`}
          >
            {state === "connecting" ? (
              <span className="spinner" style={{ width: 20, height: 20 }} />
            ) : (
              <PhoneCall className="w-6 h-6" />
            )}
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            {state === "idle" && "Ready to start a test call"}
            {state === "connecting" && "Connecting..."}
            {state === "connected" && "Connected — speak now"}
            {state === "ended" && "Call ended"}
            {state === "error" && (error || "Something went wrong")}
          </p>

          <div className="flex items-center gap-3">
            {state === "idle" || state === "ended" || state === "error" ? (
              <button
                onClick={startCall}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all duration-150 flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Start Test Call
              </button>
            ) : (
              <>
                <button
                  onClick={toggleMute}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/[0.06] text-white hover:bg-white/[0.1] transition-all duration-150 flex items-center gap-1.5"
                >
                  {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {muted ? "Unmute" : "Mute"}
                </button>
                <button
                  onClick={endCall}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-all duration-150 flex items-center gap-1.5"
                >
                  <PhoneOff className="w-3.5 h-3.5" /> End Call
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
