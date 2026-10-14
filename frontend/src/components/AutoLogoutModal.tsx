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

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auto-logout-title"
        className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
        style={{
          background: "var(--color-bg-card)",
          borderColor: "var(--color-border)",
        }}
      >
        <h2 id="auto-logout-title" className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {isExpired ? "Session timed out" : "Are you still there?"}
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {isExpired ? (
            <>
              Your session has expired for security reasons (10 hour limit). Please log in again
              to continue. Redirecting in{" "}
              <span className="font-semibold text-red-400">{seconds}s</span>.
            </>
          ) : (
            <>
              You&apos;ve been inactive for a while. For your security, you&apos;ll be logged out
              automatically in{" "}
              <span className="font-semibold text-red-400">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </span>{" "}
              unless you choose to continue.
            </>
          )}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          {!isExpired && (
            <button
              onClick={handleLogout}
              className="rounded-lg px-4 py-2 text-sm font-medium transition hover:text-red-400"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Logout
            </button>
          )}
          <button
            onClick={isExpired ? handleLogout : handleContinue}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            {isExpired ? "Log In Again" : "Continue Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
