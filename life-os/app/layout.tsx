import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LIFE OS", template: "%s · LIFE OS" },
  description: "Tu sistema operativo personal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#101114",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Aplica el tema guardado antes de pintar, para evitar parpadeos.
const themeScript = `try{var t=localStorage.getItem('lifeos-theme');var a=localStorage.getItem('lifeos-accent');var r=document.documentElement;if(t==='light')r.classList.add('light');else r.classList.add('dark');if(a)r.dataset.accent=a;}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)" },
          }}
        />
      </body>
    </html>
  );
}
