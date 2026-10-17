"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { clearSessionStart, isSessionExpired, markSessionStart } from "@/lib/sessionTimeout";

// How long the user can be inactive before the "are you still there" prompt appears
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
// How long the user has to respond to the idle prompt before being logged out
const COUNTDOWN_SECONDS = 120;
// How often to check whether the 10-hour absolute session limit has been reached
const SESSION_CHECK_INTERVAL_MS = 30 * 1000;
// Grace period shown on the "session expired" prompt before forcing logout
const EXPIRY_COUNTDOWN_SECONDS = 15;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

type PromptKind = "idle" | "expired" | null;

export default function AutoLogoutModal() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<PromptKind>(null);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const promptRef = useRef<PromptKind>(null);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  };
  const clearCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  };
  const clearSessionCheck = () => {
    if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
  };

  const handleLogout = useCallback(async () => {
    clearIdleTimer();
    clearCountdown();
    clearSessionCheck();
    clearSessionStart();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  const startIdleCountdown = useCallback(() => {
    setSecondsLeft(COUNTDOWN_SECONDS);
    setPrompt("idle");
    clearCountdown();
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearCountdown();
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleLogout]);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(startIdleCountdown, IDLE_TIMEOUT_MS);
  }, [startIdleCountdown]);

  const startExpiryCountdown = useCallback(() => {
    clearIdleTimer();
    clearCountdown();
    setSecondsLeft(EXPIRY_COUNTDOWN_SECONDS);
    setPrompt("expired");
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearCountdown();
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleLogout]);

  const handleContinue = () => {
    clearCountdown();
    setPrompt(null);
    resetIdleTimer();
  };

  useEffect(() => {
    // Existing sessions created before this feature shipped get a fresh 10-hour window from now
    if (!isSessionExpired()) markSessionStart();

    resetIdleTimer();

    const onActivity = () => {
      if (!promptRef.current) resetIdleTimer();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity));

    sessionCheckRef.current = setInterval(() => {
      if (promptRef.current !== "expired" && isSessionExpired()) {
        startExpiryCountdown();
      }
    }, SESSION_CHECK_INTERVAL_MS);
    if (isSessionExpired()) startExpiryCountdown();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      clearIdleTimer();
      clearCountdown();
      clearSessionCheck();
    };
  }, [resetIdleTimer, startExpiryCountdown]);

  if (!prompt) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isExpired = prompt === "expired";
  const totalSeconds = isExpired ? EXPIRY_COUNTDOWN_SECONDS : COUNTDOWN_SECONDS;
  const progressPct = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auto-logout-title"
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: "var(--color-bg-card)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="px-7 pt-7 pb-6">
          <div className="flex items-start gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{
                background: isExpired ? "rgba(248, 113, 113, 0.12)" : "rgba(251, 191, 36, 0.12)",
              }}
            >
              <svg
                className="h-5.5 w-5.5"
                style={{ color: isExpired ? "#f87171" : "#fbbf24" }}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2
                id="auto-logout-title"
                className="text-base font-semibold leading-snug"
                style={{ color: "var(--color-text-primary)" }}
              >
                {isExpired ? "Session timed out" : "Are you still there?"}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {isExpired ? (
                  <>
                    Your session has expired for security reasons (10 hour limit). Please log in
                    again to continue.
                  </>
                ) : (
                  <>
                    You&apos;ve been inactive for a while. For your security, you&apos;ll be logged
                    out automatically unless you choose to continue.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl px-4 py-3" style={{ background: "var(--color-bg-input)" }}>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--color-text-muted)" }}>
                {isExpired ? "Redirecting in" : "Time remaining"}
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: isExpired ? "#f87171" : "var(--color-text-primary)" }}>
                {isExpired ? `${seconds}s` : `${minutes}:${seconds.toString().padStart(2, "0")}`}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${progressPct}%`,
                  background: isExpired ? "#f87171" : "#fbbf24",
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 border-t px-7 py-4"
          style={{ borderColor: "var(--color-border)", background: "var(--color-bg-input)" }}
        >
          {!isExpired && (
            <button
              onClick={handleLogout}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:border-red-400 hover:text-red-400"
              style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}
            >
              Logout
            </button>
          )}
          <button
            onClick={isExpired ? handleLogout : handleContinue}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            {isExpired ? "Log In Again" : "Continue Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
