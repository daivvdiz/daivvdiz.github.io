import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">LIFE OS</p>
          <h1 className="text-2xl font-semibold">Hola de nuevo</h1>
          <p className="text-sm text-muted">Tu vida es más que tu productividad.</p>
        </div>
        <LoginForm next={next} />
        <p className="mt-6 text-xs text-muted">
          Usa el mismo correo y contraseña de Segundo Cerebro. El registro de cuentas nuevas está cerrado.
        </p>
      </div>
    </main>
  );
}
