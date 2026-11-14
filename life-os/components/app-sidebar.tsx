"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  email: string;
}

export function AppSidebar({ name, email }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("lifeos-sidebar") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("lifeos-sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  };

  const initials = (name || email).slice(0, 2).toUpperCase();

  const nav = (isMobile: boolean) => (
    <nav aria-label="Secciones" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {MODULES.map((m) => {
        const active = pathname === m.href || pathname.startsWith(m.href + "/");
        const Icon = m.icon;
        const compact = collapsed && !isMobile;
        return (
          <Link
            key={m.href}
            href={m.href}
            aria-current={active ? "page" : undefined}
            title={compact ? m.label : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
              active ? "bg-accent-soft text-foreground" : "text-muted hover:bg-card hover:text-foreground",
              compact && "justify-center px-0",
            )}
          >
            {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" aria-hidden />}
            <Icon className={cn("size-4 shrink-0", active && "text-accent")} aria-hidden />
            {!compact && <span className="truncate">{m.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const profile = (isMobile: boolean) => {
    const compact = collapsed && !isMobile;
    return (
      <div className={cn("flex items-center gap-2 border-t border-border p-3", compact && "flex-col")}>
        <Link href="/settings" className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 hover:bg-card" title="Ajustes de perfil">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {initials}
          </span>
          {!compact && (
            <span className="min-w-0">
              <span className="block truncate text-sm">{name || "Tu perfil"}</span>
              <span className="block truncate text-xs text-muted">{email}</span>
            </span>
          )}
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="rounded-md p-2 text-muted hover:bg-card hover:text-foreground" aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    );
  };

  return (
    <>
      {/* Barra superior en móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-muted hover:text-foreground" aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
        <span className="text-sm font-semibold tracking-wide">LIFE OS</span>
      </header>

      {/* Panel móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-surface">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-sm font-semibold tracking-wide">LIFE OS</span>
              <button onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 text-muted hover:text-foreground" aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            {nav(true)}
            {profile(true)}
          </aside>
        </div>
      )}

      {/* Barra lateral en escritorio */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center px-4", collapsed ? "justify-center px-0" : "justify-between")}>
          {!collapsed && <span className="text-sm font-semibold tracking-wide">LIFE OS</span>}
          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-muted hover:bg-card hover:text-foreground"
            aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>
        {nav(false)}
        {profile(false)}
      </aside>
    </>
  );
}
