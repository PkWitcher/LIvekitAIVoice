"use client";

import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  FileText,
  LoaderCircle,
  Lock,
  Mail,
  Phone,
  Upload,
  User,
  Webhook,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { markSessionStart } from "@/lib/sessionTimeout";
import "@/styles/public-pages.css";

type FieldName = "fullName" | "phone" | "email" | "password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SIGNUP_PASSWORD = 8;

const BENEFITS = [
  { icon: Phone, title: "AI agents that make the calls", desc: "Write the script, pick a voice and attach your knowledge base." },
  { icon: Upload, title: "Bulk campaigns", desc: "Upload a CSV/XLSX contact list and dial the whole batch." },
  { icon: FileText, title: "Transcripts, recordings & outcomes", desc: "Every answered call is documented and classified." },
  { icon: Webhook, title: "API keys & webhooks", desc: "Trigger calls and receive signed events from your own systems." },
];

function validateField(field: FieldName, value: string, isSignUp: boolean): string | null {
  const v = value.trim();
  switch (field) {
    case "fullName":
      return v.length < 2 ? "Enter your full name." : null;
    case "phone": {
      if (!v) return "Enter your phone number.";
      const digits = v.replace(/\D/g, "");
      if (!/^\+?[0-9\s\-()]+$/.test(v) || digits.length < 10 || digits.length > 15) {
        return "Enter a valid phone number (10–15 digits, e.g. +91 98765 43210).";
      }
      return null;
    }
    case "email":
      if (!v) return "Enter your email address.";
      return EMAIL_RE.test(v) ? null : "Enter a valid email address.";
    case "password":
      if (!value) return "Enter your password.";
      if (isSignUp && value.length < MIN_SIGNUP_PASSWORD) {
        return `Password must be at least ${MIN_SIGNUP_PASSWORD} characters.`;
      }
      return null;
  }
}

function passwordStrength(pw: string): { level: number; label: string } {
  if (!pw) return { level: 0, label: "" };
  let score = 0;
  if (pw.length >= MIN_SIGNUP_PASSWORD) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < MIN_SIGNUP_PASSWORD) score = Math.min(score, 1);
  const level = Math.max(1, score);
  return { level, label: ["", "Weak", "Fair", "Good", "Strong"][level] };
}

interface AuthFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error: string | null;
  icon: ReactNode;
  placeholder: string;
  autoComplete: string;
  inputMode?: "tel" | "email" | "text";
  trailing?: ReactNode;
  describedBy?: string;
  children?: ReactNode;
}

function AuthField(p: AuthFieldProps) {
  const errId = `${p.id}-error`;
  const describedBy = [p.error ? errId : null, p.describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="pp2-field">
      <label htmlFor={p.id}>{p.label}</label>
      <div className="pp2-input-wrap">
        <span className="pp2-input-icon" aria-hidden="true">{p.icon}</span>
        <input
          id={p.id}
          name={p.id}
          type={p.type}
          className={`pp2-input${p.trailing ? " has-toggle" : ""}`}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={p.onBlur}
          placeholder={p.placeholder}
          autoComplete={p.autoComplete}
          inputMode={p.inputMode}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={p.error ? true : undefined}
          aria-describedby={describedBy}
        />
        {p.trailing}
      </div>
      {p.error && (
        <p id={errId} className="pp2-field-error">
          <CircleAlert size={14} aria-hidden="true" />
          <span>{p.error}</span>
        </p>
      )}
      {p.children}
    </div>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const router = useRouter();
  const supabase = createClient();

  const values: Record<FieldName, string> = { fullName, phone, email, password };
  const activeFields: FieldName[] = isSignUp ? ["fullName", "phone", "email", "password"] : ["email", "password"];
  const errors: Partial<Record<FieldName, string | null>> = {};
  for (const f of activeFields) errors[f] = validateField(f, values[f], isSignUp);
  const shown = (f: FieldName) => (touched[f] ? errors[f] ?? null : null);
  const touch = (f: FieldName) => setTouched((t) => ({ ...t, [f]: true }));
  const strength = passwordStrength(password);

  const switchMode = (signUp: boolean) => {
    if (signUp === isSignUp) return;
    setIsSignUp(signUp);
    setError(null);
    setMessage(null);
    setTouched({});
    setShowPassword(false);
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "ArrowLeft" || e.key === "Home" ? false : true;
    switchMode(next);
    document.getElementById(next ? "auth-tab-signup" : "auth-tab-signin")?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setMessage(null);

    const firstInvalid = activeFields.find((f) => errors[f]);
    if (firstInvalid) {
      setTouched(Object.fromEntries(activeFields.map((f) => [f, true])));
      document.getElementById(`login-${firstInvalid}`)?.focus();
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim();

    if (isSignUp) {
      const cleanName = fullName.trim();
      const cleanPhone = phone.trim();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: cleanName, phone: cleanPhone },
        },
      });
      if (error) {
        setError(error.message);
      } else if (data.user) {
        // Save profile to user_profiles table
        await supabase.from("user_profiles").upsert({
          id: data.user.id,
          email: cleanEmail,
          full_name: cleanName,
          phone: cleanPhone,
        });
        setMessage("Check your email to confirm your account, then log in.");
        setPassword("");
        setTouched({});
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        markSessionStart();
        router.push("/dashboard");
        router.refresh();
      }
    }

    setLoading(false);
  };

  const eyeButton = (
    <button
      type="button"
      className="pp2-eye"
      onClick={() => setShowPassword((s) => !s)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      aria-pressed={showPassword}
    >
      {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
    </button>
  );

  return (
    <div className="pp2 pp2-auth">
      <div className="pp2-auth-brand">
        <div className="pp2-auth-brand-inner">
          <Link href="/" className="pp2-brand" aria-label="Nova AI home">
            <span className="pp2-logo" aria-hidden="true"><Phone size={16} strokeWidth={2.25} /></span>
            Nova AI
          </Link>
          <h2>Run AI phone calls from one dashboard</h2>
          <p className="pp2-auth-brand-lead">
            Build voice agents, dial contact lists and review every conversation — without managing telephony yourself.
          </p>
          <ul className="pp2-benefits">
            {BENEFITS.map((b) => (
              <li key={b.title} className="pp2-benefit">
                <span className="pp2-icon-box"><b.icon size={18} aria-hidden="true" /></span>
                <div>
                  <strong>{b.title}</strong>
                  <span>{b.desc}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="pp2-auth-foot">Powered by LiveKit, Deepgram and OpenAI</p>
        </div>
      </div>

      <main className="pp2-auth-main">
        <div className="pp2-auth-top">
          <Link href="/" className="pp2-back">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to home
          </Link>
          <ThemeToggle />
        </div>

        <div className="pp2-auth-center">
          <div className="pp2-auth-card">
            <Link href="/" className="pp2-brand pp2-auth-mobile-brand" aria-label="Nova AI home">
              <span className="pp2-logo" aria-hidden="true"><Phone size={16} strokeWidth={2.25} /></span>
              Nova AI
            </Link>

            <div className="pp2-tabs" role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                id="auth-tab-signin"
                className="pp2-tab"
                aria-selected={!isSignUp}
                aria-controls="auth-panel"
                tabIndex={isSignUp ? -1 : 0}
                onClick={() => switchMode(false)}
                onKeyDown={onTabKeyDown}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                id="auth-tab-signup"
                className="pp2-tab"
                aria-selected={isSignUp}
                aria-controls="auth-panel"
                tabIndex={isSignUp ? 0 : -1}
                onClick={() => switchMode(true)}
                onKeyDown={onTabKeyDown}
              >
                Create account
              </button>
            </div>

            <div id="auth-panel" role="tabpanel" aria-labelledby={isSignUp ? "auth-tab-signup" : "auth-tab-signin"}>
              <div className="pp2-auth-head">
                <h1>{isSignUp ? "Create your account" : "Welcome back"}</h1>
                <p>{isSignUp ? "Start automating calls in a few minutes." : "Sign in to access your dashboard."}</p>
              </div>

              <form onSubmit={handleSubmit} className="pp2-form" noValidate aria-busy={loading}>
                {isSignUp && (
                  <>
                    <AuthField
                      id="login-fullName"
                      label="Full name"
                      type="text"
                      value={fullName}
                      onChange={setFullName}
                      onBlur={() => touch("fullName")}
                      error={shown("fullName")}
                      icon={<User size={16} />}
                      placeholder="Jane Doe"
                      autoComplete="name"
                    />
                    <AuthField
                      id="login-phone"
                      label="Phone number"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={setPhone}
                      onBlur={() => touch("phone")}
                      error={shown("phone")}
                      icon={<Phone size={16} />}
                      placeholder="+91 98765 43210"
                      autoComplete="tel"
                    />
                  </>
                )}

                <AuthField
                  id="login-email"
                  label="Email address"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={setEmail}
                  onBlur={() => touch("email")}
                  error={shown("email")}
                  icon={<Mail size={16} />}
                  placeholder="you@company.com"
                  autoComplete={isSignUp ? "email" : "username"}
                />

                <AuthField
                  id="login-password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  onBlur={() => touch("password")}
                  error={shown("password")}
                  icon={<Lock size={16} />}
                  placeholder={isSignUp ? `At least ${MIN_SIGNUP_PASSWORD} characters` : "Enter your password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  trailing={eyeButton}
                  describedBy={isSignUp ? "login-password-hint" : undefined}
                >
                  {isSignUp && (
                    <div id="login-password-hint">
                      <div className="pp2-strength" data-level={strength.level} aria-hidden="true">
                        <i /><i /><i /><i />
                      </div>
                      <p className="pp2-strength-label" aria-live="polite">
                        {password ? (
                          <>Password strength: <b>{strength.label}</b></>
                        ) : (
                          <>Use {MIN_SIGNUP_PASSWORD}+ characters. Mix upper/lower case, numbers and symbols for a stronger password.</>
                        )}
                      </p>
                    </div>
                  )}
                </AuthField>

                {error && (
                  <div className="pp2-alert pp2-alert-error" role="alert">
                    <CircleAlert size={16} aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {message && (
                  <div className="pp2-alert pp2-alert-success" role="status" aria-live="polite">
                    <CircleCheck size={16} aria-hidden="true" />
                    <span>{message}</span>
                  </div>
                )}

                <button type="submit" disabled={loading} className="pp2-btn pp2-btn-primary pp2-btn-lg pp2-btn-block">
                  {loading ? (
                    <>
                      <LoaderCircle size={17} className="pp2-spin" aria-hidden="true" />
                      {isSignUp ? "Creating account…" : "Signing in…"}
                    </>
                  ) : (
                    <>
                      {isSignUp ? "Create account" : "Sign in"}
                      <ArrowRight size={17} className="pp2-submit-icon" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <p className="pp2-switch">
                {isSignUp ? "Already have an account?" : "New to Nova AI?"}
                <button type="button" className="pp2-link-btn" onClick={() => switchMode(!isSignUp)}>
                  {isSignUp ? "Sign in" : "Create an account"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
