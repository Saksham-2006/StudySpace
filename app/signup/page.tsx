
import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";
import Navbar from "@/components/layout/Navbar";

export default function SignupPage() {
  return (
    <>
      <Navbar />

      <main className="auth-page">
        <div className="auth-page__visual">
          <p className="tracked">FIND YOUR PLACE</p>
          <h2>Your next chapter starts here.</h2>
          <p>
            Join the community and discover better places to learn,
            collaborate, and grow.
          </p>
        </div>

        <div className="auth-page__form">
          <Suspense fallback={<p>Loading registration...</p>}>
            <AuthForm mode="signup" />
          </Suspense>
        </div>
      </main>
    </>
  );
}
