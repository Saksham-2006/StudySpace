
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, LoaderCircle } from "lucide-react";

type AuthFormProps = {
  mode: "login" | "signup";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = createClient();

  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/spaces`,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/spaces");
          router.refresh();
          return;
        }

        setSuccess(
          "Account created! Check your email and click the verification link to continue."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace("/spaces");
        router.refresh();
        return;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  const verificationError = searchParams.get("error");

  return (
    <div className="auth-card">
      <div className="auth-card__heading">
        <p className="tracked">
          {isSignup ? "JOIN THE COMMUNITY" : "WELCOME BACK"}
        </p>

        <h1 className="h2">
          {isSignup ? "Create your account." : "Good to see you."}
        </h1>

        <p>
          {isSignup
            ? "Create an account to discover and reserve your study space."
            : "Sign in to continue to your study spaces."}
        </p>
      </div>

      {verificationError && (
        <p className="auth-message auth-message--error" role="alert">
          Email verification failed or the link has expired. Please try
          registering again or request a new confirmation email.
        </p>
      )}

      {error && (
        <p className="auth-message auth-message--error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="auth-message auth-message--success" role="status">
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        {isSignup && (
          <label>
            Full name
            <input
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
            />
          </label>
        )}

        <label>
          Email address
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {isSignup && (
            <span className="auth-hint">
              Use at least 8 characters.
            </span>
          )}
        </label>

        <button
          type="submit"
          className="btn btn--sun auth-submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <LoaderCircle size={18} className="auth-spinner" />
              Please wait...
            </>
          ) : (
            <>
              {isSignup ? "Create account" : "Sign in"}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "New to Seat to Study?"}{" "}
        <Link href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
