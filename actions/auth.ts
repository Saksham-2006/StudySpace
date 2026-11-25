"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie, clearAuthCookie } from "@/lib/auth";

export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  if (!email || !password || password.length < 6) {
    return { error: "Valid email and password (min 6 chars) are required." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  const token = await signToken({ userId: user.id, email: user.email });
  await setAuthCookie(token);

  redirect("/dashboard");
}

export async function loginUser(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Invalid email or password." };
  }

  const token = await signToken({ userId: user.id, email: user.email });
  await setAuthCookie(token);

  redirect("/dashboard");
}

export async function logoutUser() {
  await clearAuthCookie();
  redirect("/login");
}