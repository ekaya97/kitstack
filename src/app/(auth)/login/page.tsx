"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth-client";

type Step = "email" | "signin" | "signup";

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const pendingAction = searchParams.get("action");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const { exists } = await res.json();
      setStep(exists ? "signin" : "signup");
    } catch {
      setError("Could not check email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (step === "signup") {
      const { error: authError } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      setLoading(false);
      if (authError) {
        setError(authError.message || "Could not create account.");
        return;
      }
    } else {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });
      setLoading(false);
      if (authError) {
        setError(authError.message || "Invalid email or password.");
        return;
      }
    }

    const dest = pendingAction
      ? `${redirectTo}?action=${pendingAction}`
      : redirectTo;
    router.push(dest);
  };

  const handleOAuth = async (provider: "google" | "github") => {
    const dest = pendingAction
      ? `${redirectTo}?action=${pendingAction}`
      : redirectTo;
    await authClient.signIn.social({
      provider,
      callbackURL: dest,
    });
  };

  const goBack = () => {
    setStep("email");
    setPassword("");
    setName("");
    setError("");
  };

  const heading =
    step === "email"
      ? "Get started"
      : step === "signin"
        ? "Welcome back"
        : "Create your account";

  const subtitle =
    step === "email"
      ? "Sign in or create an account to continue."
      : step === "signin"
        ? `Signing in as ${email}`
        : `Creating account for ${email}`;

  return (
    <>
      {/* Heading */}
      <AnimatePresence mode="wait">
        <motion.div key={step + "-heading"} className="text-center mb-8" {...fade}>
          <h1 className="font-serif text-[40px] tracking-tight leading-tight">
            {heading}
          </h1>
          <p className="font-sans text-[15px] text-ks-muted mt-2">{subtitle}</p>
        </motion.div>
      </AnimatePresence>

      {/* Body */}
      <AnimatePresence mode="wait">
        {step === "email" && (
          <motion.div key="email-step" {...fade}>
            {/* OAuth */}
            <div className="flex flex-col gap-2.5 mb-6">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                className="ks-btn w-full justify-center !py-3 !text-[14px] gap-3"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("github")}
                className="ks-btn w-full justify-center !py-3 !text-[14px] gap-3"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Continue with GitHub
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-ks-hair" />
              <span className="font-sans text-[12px] text-ks-muted">or use email</span>
              <div className="flex-1 h-px bg-ks-hair" />
            </div>

            {/* Email form */}
            <form onSubmit={checkEmail} className="flex flex-col gap-3.5">
              <div>
                <label className="block font-sans text-[13px] font-medium text-ks-ink mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full font-sans text-[15px] bg-white border border-ks-hair rounded-lg px-4 py-3 outline-none focus:border-ks-accent transition-colors"
                />
              </div>

              {error && (
                <div className="font-sans text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="ks-btn ks-btn-primary w-full justify-center !py-3.5 !text-[15px] disabled:opacity-60"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
            </form>
          </motion.div>
        )}

        {step === "signin" && (
          <motion.div key="signin-step" {...fade}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <EmailPill email={email} onBack={goBack} />

              <div>
                <label className="block font-sans text-[13px] font-medium text-ks-ink mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full font-sans text-[15px] bg-white border border-ks-hair rounded-lg px-4 py-3 outline-none focus:border-ks-accent transition-colors"
                />
              </div>

              {error && (
                <div className="font-sans text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="ks-btn ks-btn-primary w-full justify-center !py-3.5 !text-[15px] mt-1 disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </motion.div>
        )}

        {step === "signup" && (
          <motion.div key="signup-step" {...fade}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <EmailPill email={email} onBack={goBack} />

              <div>
                <label className="block font-sans text-[13px] font-medium text-ks-ink mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full font-sans text-[15px] bg-white border border-ks-hair rounded-lg px-4 py-3 outline-none focus:border-ks-accent transition-colors"
                />
              </div>

              <div>
                <label className="block font-sans text-[13px] font-medium text-ks-ink mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full font-sans text-[15px] bg-white border border-ks-hair rounded-lg px-4 py-3 outline-none focus:border-ks-accent transition-colors"
                />
              </div>

              {error && (
                <div className="font-sans text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="ks-btn ks-btn-accent w-full justify-center !py-3.5 !text-[15px] mt-1 disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-ks-hair">
              <div className="flex flex-col gap-1.5 font-sans text-[12px] text-ks-muted">
                <div className="flex items-center gap-2">
                  <span className="text-green-700">&#10003;</span>
                  All skills free, no card required
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-700">&#10003;</span>
                  1 free kit trial per day
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-700">&#10003;</span>
                  Your data stays yours &mdash; exportable anytime
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function EmailPill({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-ks-paper-warm border border-ks-hair rounded-lg px-4 py-2.5">
      <span className="font-sans text-[14px] text-ks-ink flex-1 truncate">
        {email}
      </span>
      <button
        type="button"
        onClick={onBack}
        className="font-sans text-[12px] text-ks-accent font-medium hover:underline shrink-0"
      >
        Change
      </button>
    </div>
  );
}
