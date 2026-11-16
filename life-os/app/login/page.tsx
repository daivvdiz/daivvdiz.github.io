import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">LIFE OS</p>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-muted">Your life is more than your productivity.</p>
        </div>
        <LoginForm next={next} />
        <p className="mt-6 text-xs text-muted">
          Use the same email and password as Segundo Cerebro. New sign-ups are closed.
        </p>
      </div>
    </main>
  );
}
