
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { claims },
    error,
  } = await supabase.auth.getClaims();

  if (error || !claims?.sub) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", claims.sub)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return { claims, profile };
}

export async function requireStudent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.profile.role !== "student") {
    redirect("/");
  }

  return user;
}
