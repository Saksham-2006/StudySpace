
import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";
import Navbar from "@/components/layout/Navbar";

export default function LoginPage() {
  return (
    <>
      <Navbar />

      <main className="auth-page">
        <div className="auth-page__visual">
          <p className="tracked">SEAT TO STUDY</p>
          <h2>Make room for what matters.</h2>
          <p>
            Find your focus. Discover your space. Make every study
            session count.
          </p>
        </div>

        <div className="auth-page__form">
          <Suspense fallback={<p>Loading login...</p>}>
            <AuthForm mode="login" />
          </Suspense>
        </div>
      </main>
    </>
  );
}
