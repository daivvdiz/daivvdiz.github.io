import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewTxButton, type TxRefs } from "@/components/finance/tx-dialog";
import { TxList } from "@/components/finance/tx-list";
import { CategoryBars, MonthlyTrend } from "@/components/finance/summary";
import { BudgetEditor, CategoryManager } from "@/components/finance/budget";
import { AssetsList, LiabilitiesList, SavingsList } from "@/components/finance/wealth";
import { getUser } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/profile/get";
import { getFinanceData } from "@/lib/finance/queries";
import { addMonths } from "@/lib/dates";
import { formatDay, formatMoney, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Finances" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "summary", label: "Overview" },
  { key: "transactions", label: "Transactions" },
  { key: "budget", label: "Budget" },
  { key: "savings", label: "Savings" },
  { key: "networth", label: "Net worth & debts" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type SP = Promise<{ tab?: string; month?: string }>;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </Card>
  );
}

export default async function FinancesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  const prefs = await getPrefs(supabase, user!.id);
  const today = todayISO(prefs.timeZone);
  const thisMonth = today.slice(0, 7) + "-01";
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") && sp.month! >= "1990-01" && sp.month! <= "2100-12" ? `${sp.month}-01` : thisMonth;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "summary";
  const data = await getFinanceData(supabase, month);

  const href = (p: { tab?: Tab; month?: string }) => {
    const q = new URLSearchParams();
    const t = p.tab ?? tab;
    const m = p.month ?? month;
    if (t !== "summary") q.set("tab", t);
    if (m !== thisMonth) q.set("month", m.slice(0, 7));
    const s = q.toString();
    return s ? `/finances?${s}` : "/finances";
  };

  const refs: TxRefs = {
    categories: data.categories,
    savings: data.savings.map((s) => ({ id: s.id, name: s.name })),
    liabilities: data.liabilities.map((l) => ({ id: l.id, name: l.name })),
  };
  const sum = (type: string) => data.txs.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  const count = (type: string) => data.txs.filter((t) => t.type === type).length;
  const income = sum("income");
  const expense = sum("expense");
  const saved = sum("transfer");

  const catName = new Map(data.categories.map((c) => [c.id, c.name]));
  const spentBy = new Map<string, { amount: number; n: number }>();
  for (const t of data.txs.filter((t) => t.type === "expense")) {
    const k = t.category_id ?? "none";
    const s = spentBy.get(k) ?? { amount: 0, n: 0 };
    spentBy.set(k, { amount: s.amount + t.amount, n: s.n + 1 });
  }
  const categoryRows = [...spentBy.entries()]
    .map(([k, v]) => ({ name: k === "none" ? "Uncategorized" : catName.get(k) ?? "Deleted category", ...v }))
    .sort((a, b) => b.amount - a.amount);

  const assetsTotal = data.assets.reduce((a, x) => a + x.value, 0);
  const debtTotal = data.liabilities.reduce((a, l) => a + Math.max(0, l.original_amount - l.paid), 0);
  const monthLabel = formatDay(month, "MMMM yyyy");
  const showMonth = tab === "summary" || tab === "transactions" || tab === "budget";

  return (
    <>
      <PageHeader
        title="Finances"
        description="Income, expenses, budget, savings and net worth in Colombian pesos."
        actions={<NewTxButton today={today} refs={refs} />}
      />

      <nav aria-label="Finance sections" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-md border border-border p-0.5">
          {TABS.map((t) => (
            <Link key={t.key} href={href({ tab: t.key })} aria-current={tab === t.key ? "page" : undefined}
              className={cn("whitespace-nowrap rounded px-3 py-1.5 text-xs", tab === t.key ? "bg-accent-soft text-foreground" : "text-muted hover:text-foreground")}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {showMonth && (
        <div className="mb-4 flex items-center gap-2">
          <Button asChild size="icon" variant="ghost" aria-label="Previous month"><Link href={href({ month: addMonths(month, -1) })}><ChevronLeft /></Link></Button>
          <h2 className="min-w-36 text-center text-sm font-medium capitalize">{monthLabel}</h2>
          <Button asChild size="icon" variant="ghost" aria-label="Next month"><Link href={href({ month: addMonths(month, 1) })}><ChevronRight /></Link></Button>
          {month !== thisMonth && <Button asChild size="sm" variant="secondary"><Link href={href({ month: thisMonth })}>This month</Link></Button>}
        </div>
      )}

      {data.error && (
        <Card className="mb-5 flex items-center gap-2 border-danger/40 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden /> Couldn't load your data. Try reloading the page.
        </Card>
      )}

      {tab === "summary" && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Income" value={formatMoney(income)} hint={plural(count("income"), "transaction", "transactions")} />
            <Tile label="Expenses" value={formatMoney(expense)} hint={plural(count("expense"), "transaction", "transactions")} />
            <Tile label="Income − expenses" value={formatMoney(income - expense)} hint={data.txs.length ? undefined : "No transactions this month"} />
            <Tile label="Savings contributions" value={formatMoney(saved)} hint={plural(count("transfer"), "contribution", "contributions")} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><div><CardTitle>Expenses by category</CardTitle><CardDescription className="capitalize">{monthLabel}</CardDescription></div></CardHeader>
              <CardContent><CategoryBars rows={categoryRows} /></CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Last 6 months</CardTitle><CardDescription>Income and expenses per month.</CardDescription></div></CardHeader>
              <CardContent><MonthlyTrend data={data.trend} /></CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <div><CardTitle>Net worth</CardTitle><CardDescription>Assets minus your debt balances, using the values you logged.</CardDescription></div>
                <Button asChild size="sm" variant="ghost"><Link href={href({ tab: "networth" })}>View details</Link></Button>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted">Assets ({data.assets.length})</p><p className="text-lg font-semibold tabular-nums">{formatMoney(assetsTotal)}</p></div>
                <div><p className="text-xs text-muted">Debts ({data.liabilities.length})</p><p className="text-lg font-semibold tabular-nums">{formatMoney(debtTotal)}</p></div>
                <div><p className="text-xs text-muted">Net worth</p><p className="text-lg font-semibold tabular-nums">{data.assets.length || data.liabilities.length ? formatMoney(assetsTotal - debtTotal) : "—"}</p></div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {tab === "transactions" && (
        <Card>
          <CardHeader><div><CardTitle>Transactions</CardTitle><CardDescription>Tap one to edit or delete it.</CardDescription></div></CardHeader>
          <CardContent><TxList txs={data.txs} refs={refs} today={today} /></CardContent>
        </Card>
      )}

      {tab === "budget" && (
        <div className="space-y-5">
          <Card>
            <CardHeader><div><CardTitle>This month's budget</CardTitle><CardDescription>Leave a category empty to skip budgeting it.</CardDescription></div></CardHeader>
            <CardContent>
              <BudgetEditor
                key={month}
                month={month}
                prevMonth={addMonths(month, -1)}
                categories={data.categories}
                budgets={Object.fromEntries(data.budgets)}
                spent={Object.fromEntries(spentBy)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Categories</CardTitle><CardDescription>Shared across all months.</CardDescription></div></CardHeader>
            <CardContent><CategoryManager categories={data.categories} /></CardContent>
          </Card>
        </div>
      )}

      {tab === "savings" && (
        <Card>
          <CardHeader><div><CardTitle>Savings goals</CardTitle><CardDescription>The amount saved is the sum of logged contributions.</CardDescription></div></CardHeader>
          <CardContent><SavingsList goals={data.savings} today={today} refs={refs} /></CardContent>
        </Card>
      )}

      {tab === "networth" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Assets" value={formatMoney(assetsTotal)} hint={plural(data.assets.length, "logged", "logged")} />
            <Tile label="Debt balance" value={formatMoney(debtTotal)} hint={plural(data.liabilities.length, "logged", "logged")} />
            <Tile label="Net worth" value={data.assets.length || data.liabilities.length ? formatMoney(assetsTotal - debtTotal) : "—"} hint="Using the values you logged" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><div><CardTitle>Assets</CardTitle><CardDescription>What you own and its latest value.</CardDescription></div></CardHeader>
              <CardContent><AssetsList assets={data.assets} today={today} /></CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Debts</CardTitle><CardDescription>Includes the apartment imported from Segundo Cerebro.</CardDescription></div></CardHeader>
              <CardContent><LiabilitiesList liabilities={data.liabilities} today={today} refs={refs} /></CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
