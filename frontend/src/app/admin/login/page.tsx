"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { markSessionStart } from "@/lib/sessionTimeout";
import "@/styles/public-pages.css";

const ADMIN_EMAIL = "Admin@gmail.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CAPABILITIES = [
  { icon: Users, title: "User management", desc: "Review accounts, usage and activity across the platform." },
  { icon: KeyRound, title: "Subscriptions & billing", desc: "Manage plans, limits and payment status for every user." },
  { icon: Activity, title: "System analytics", desc: "Monitor call volume and platform health in one place." },
];

function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter your admin email address.";
  return EMAIL_RE.test(v) ? null : "Enter a valid email address.";
}

function validatePassword(value: string): string | null {
  return value ? null : "Enter your password.";
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
  trailing?: ReactNode;
}

function AuthField(p: AuthFieldProps) {
  const errId = `${p.id}-error`;
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
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={p.error ? true : undefined}
          aria-describedby={p.error ? errId : undefined}
        />
        {p.trailing}
      </div>
      {p.error && (
        <p id={errId} className="pp2-field-error">
          <CircleAlert size={14} aria-hidden="true" />
          <span>{p.error}</span>
        </p>
      )}
    </div>
  );
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });
  const router = useRouter();
  const supabase = createClient();

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (emailError || passwordError) {
      setTouched({ email: true, password: true });
      document.getElementById(emailError ? "admin-email" : "admin-password")?.focus();
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim();

    if (cleanEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      setError("Access denied. Admin credentials required.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      markSessionStart();
      router.push("/admin");
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <div className="pp2 pp2-auth pp2-admin">
      <div className="pp2-auth-brand">
        <div className="pp2-auth-brand-inner">
          <Link href="/" className="pp2-brand" aria-label="Nova AI home">
            <span className="pp2-logo" aria-hidden="true"><ShieldCheck size={17} strokeWidth={2.25} /></span>
            Nova AI <span style={{ fontWeight: 500, color: "var(--pp-muted)" }}>Admin</span>
          </Link>
          <h2>Admin Console</h2>
          <p className="pp2-auth-brand-lead">
            Operate the Nova AI voice platform — users, subscriptions and system analytics from one secure workspace.
          </p>
          <ul className="pp2-benefits">
            {CAPABILITIES.map((c) => (
              <li key={c.title} className="pp2-benefit">
                <span className="pp2-icon-box"><c.icon size={18} aria-hidden="true" /></span>
                <div>
                  <strong>{c.title}</strong>
                  <span>{c.desc}</span>
                </div>
              </li>
            ))}
          </ul>
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
              <span className="pp2-logo" aria-hidden="true"><ShieldCheck size={17} strokeWidth={2.25} /></span>
              Nova AI Admin
            </Link>

            <div className="pp2-auth-head">
              <span className="pp2-restricted">
                <Lock size={12} aria-hidden="true" />
                Restricted access
              </span>
              <h1>Admin sign in</h1>
              <p>Use your administrator credentials to open the console.</p>
            </div>

            <form onSubmit={handleSubmit} className="pp2-form" noValidate aria-busy={loading}>
              <AuthField
                id="admin-email"
                label="Admin email"
                type="email"
                value={email}
                onChange={setEmail}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                error={touched.email ? emailError : null}
                icon={<Mail size={16} />}
                placeholder="name@company.com"
                autoComplete="username"
              />

              <AuthField
                id="admin-password"
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                error={touched.password ? passwordError : null}
                icon={<Lock size={16} />}
                placeholder="Enter your password"
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    className="pp2-eye"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                }
              />

              {error && (
                <div className="pp2-alert pp2-alert-error" role="alert">
                  <CircleAlert size={16} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="pp2-btn pp2-btn-primary pp2-btn-lg pp2-btn-block">
                {loading ? (
                  <>
                    <LoaderCircle size={17} className="pp2-spin" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <Lock size={16} aria-hidden="true" />
                    Sign in to console
                  </>
                )}
              </button>
            </form>

            <div className="pp2-secure-note">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>This area is for authorised administrators only.</span>
            </div>

            <p className="pp2-switch">
              Not an administrator?
              <Link href="/login" className="pp2-link-btn">User sign in</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
