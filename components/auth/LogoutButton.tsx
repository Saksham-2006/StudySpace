
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        className="btn"
        onClick={handleLogout}
        disabled={loading}
      >
        <LogOut size={17} />
        {loading ? "Signing out..." : "Sign out"}
      </button>

      {error && (
        <p role="alert" className="auth-message auth-message--error">
          {error}
        </p>
      )}
    </div>
  );
}
