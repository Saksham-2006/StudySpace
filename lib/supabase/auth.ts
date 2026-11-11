import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: "student" | "admin";
  created_at?: string;
  updated_at?: string;
};

export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      user,
      profile: {
        id: user.id,
        full_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User",
        email: user.email || "",
        role: "student" as const,
      },
    };
  }

  return { user, profile: profile as UserProfile };
}

export async function requireStudent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (user.profile.role !== "admin") {
    redirect("/");
  }

  return user;
}
