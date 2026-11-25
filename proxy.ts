

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const protectedRoutes = ["/dashboard"];
const authRoutes = ["/login", "/register"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const token = req.cookies.get("auth_token")?.value;
  const user = token ? await verifyToken(token) : null;

  if (protectedRoutes.some((route) => path.startsWith(route)) && !user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (authRoutes.includes(path) && user) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};


