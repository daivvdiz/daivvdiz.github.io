import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewTripButton, TripList } from "@/components/market/trips";
import { ProductTable } from "@/components/market/products";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getMarket } from "@/lib/market/queries";
import { productStats, tripTotal } from "@/lib/market/schema";
import { formatDay, formatMoney, monthRange, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Market" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "trips", label: "Markets" },
  { key: "products", label: "Products & prices" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-[11px] text-muted">{detail}</p>}
    </div>
  );
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "trips";
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const { trips, missing, error } = await getMarket(supabase);
  const products = productStats(trips);
  const href = (t: Tab) => (t === "trips" ? "/market" : `/market?tab=${t}`);

  const { start, end } = monthRange(today);
  const month = trips.filter((t) => t.trip_date >= start && t.trip_date <= end);
  const monthSpent = month.reduce((a, t) => a + tripTotal(t), 0);
  const avgTrip = trips.length ? trips.reduce((a, t) => a + tripTotal(t), 0) / trips.length : null;
  const up = products.filter((p) => p.change != null && Math.round(p.change) > 0).length;
  const compared = products.filter((p) => p.change != null).length;

  return (
    <>
      <PageHeader title="Market" description="Your grocery shopping: what you bought in each market and how product prices change over time."
        actions={!missing && <NewTripButton today={today} products={products} size="default" />} />

      {error && (
        <Card className="mb-5 flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> Couldn&apos;t load your data. Try reloading the page.
        </Card>
      )}

      {missing ? (
        <Card>
          <CardContent className="pt-5">
            <div className="rounded-md border border-warning/40 p-4 text-sm">
              <p className="font-medium">One step is missing in Supabase</p>
              <p className="mt-1 text-muted">
                To save markets, run the migration <code className="text-xs">supabase/migrations/20261120000100_market.sql</code> once in
                Supabase → SQL Editor. It only creates new tables; it doesn&apos;t change your data.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="This month" value={formatMoney(monthSpent)} detail={`${month.length} ${month.length === 1 ? "market" : "markets"}`} />
            <Stat label="Average per market" value={avgTrip != null ? formatMoney(avgTrip) : "—"} detail={`${trips.length} ${trips.length === 1 ? "market" : "markets"} logged`} />
            <Stat label="Last market" value={trips[0] ? formatMoney(tripTotal(trips[0])) : "—"} detail={trips[0] ? formatDay(trips[0].trip_date) : undefined} />
            <Stat label="Products" value={String(products.length)} detail={compared ? `${up} of ${compared} went up last time` : "Prices compare from the 2nd purchase"} />
          </div>

          <nav aria-label="Market sections" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex w-max gap-1 rounded-md border border-border p-0.5">
              {TABS.map((t) => (
                <Link key={t.key} href={href(t.key)} aria-current={tab === t.key ? "page" : undefined}
                  className={cn("whitespace-nowrap rounded px-3 py-1.5 text-xs", tab === t.key ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
                  {t.label}
                </Link>
              ))}
            </div>
          </nav>

          <Card>
            <CardContent className="pt-5">
              {tab === "trips" ? <TripList trips={trips} today={today} products={products} /> : <ProductTable products={products} />}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
