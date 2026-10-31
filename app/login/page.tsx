"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

function getSafeNext() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data }) => {
      if (data.user) router.replace(getSafeNext());
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const result = isSignUp
      ? await getSupabaseClient().auth.signUp({ email, password })
      : await getSupabaseClient().auth.signInWithPassword({ email, password });

    if (result.error) {
      setError(result.error.message);
    } else if (isSignUp && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
    } else {
      router.replace(getSafeNext());
    }

    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    setMessage("");

    const redirectUrl = new URL("/login", window.location.origin);
    const next = getSafeNext();
    if (next !== "/") redirectUrl.searchParams.set("next", next);

    const { error: signInError } = await getSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl.toString() },
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link className="auth-brand" href="/"><span className="brand-mark" aria-hidden="true">字</span><span>TrueKana</span></Link>
        <p className="eyebrow">Your study desk</p>
        <h1>{isSignUp ? "Create your account." : "Welcome back."}</h1>
        <p className="auth-copy">Save your study progress and keep your review pile with you.</p>

        <button className="auth-google" type="button" onClick={() => void handleGoogleSignIn()} disabled={loading}>
          <span className="google-mark" aria-hidden="true">G</span>
          Continue with Google
        </button>
        <div className="auth-divider"><span>or use email</span></div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={isSignUp ? "new-password" : "current-password"} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Working..." : isSignUp ? "Create account" : "Sign in"}</button>
        </form>

        <button className="auth-switch" onClick={() => { setIsSignUp((current) => !current); setError(""); setMessage(""); }}>
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Create one"}
        </button>
      </section>
    </main>
  );
}