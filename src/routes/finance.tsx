import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { transactions, formatRupiah, monthKey, monthLabel } from "@/lib/data";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Keuangan — Perbandingan Pemasukan & Pengeluaran" },
      {
        name: "description",
        content:
          "Bandingkan pemasukan dan pengeluaran per bulan maupun per tahun berdasarkan transaksi yang sudah tercatat.",
      },
      { property: "og:title", content: "Keuangan — Perbandingan Pemasukan & Pengeluaran" },
      {
        property: "og:description",
        content: "Ringkasan bulanan dan tahunan dari transaksi kamu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancePage,
});

type Row = { key: string; label: string; income: number; expense: number };

function aggregate(mode: "month" | "year"): Row[] {
  const map = new Map<string, Row>();
  for (const t of transactions) {
    const key = mode === "month" ? monthKey(t.at) : t.at.slice(0, 4);
    const row =
      map.get(key) ??
      { key, label: mode === "month" ? monthLabel(key) : key, income: 0, expense: 0 };
    if (t.type === "income") row.income += t.amount;
    else row.expense += t.amount;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

function FinancePage() {
  const [mode, setMode] = useState<"month" | "year">("month");
  const rows = useMemo(() => aggregate(mode), [mode]);
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="mx-auto min-h-screen w-full max-w-[480px] pb-28">
        <header className="rounded-b-2xl bg-surface px-5 py-6 shadow-card">
          <p className="text-xs text-muted-foreground">Ringkasan</p>
          <h1 className="text-xl font-bold text-foreground">Keuangan</h1>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted px-3 py-2">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ArrowUpRight className="size-3 text-income" /> Pemasukan
              </p>
              <p className="text-sm font-bold text-income">{formatRupiah(totalIncome)}</p>
            </div>
            <div className="rounded-xl bg-muted px-3 py-2">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ArrowDownRight className="size-3 text-expense" /> Pengeluaran
              </p>
              <p className="text-sm font-bold text-expense">{formatRupiah(totalExpense)}</p>
            </div>
          </div>
        </header>

        <main className="space-y-4 px-4 pt-4">
          <div className="flex rounded-full bg-surface p-1 shadow-card">
            {(["month", "year"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full py-2 text-xs font-semibold ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "month" ? "Bulanan" : "Tahunan"}
              </button>
            ))}
          </div>

          <section className="space-y-3 rounded-2xl bg-surface p-4 shadow-card">
            {rows.map((r) => {
              const net = r.income - r.expense;
              return (
                <div key={r.key} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-foreground">{r.label}</p>
                    <p
                      className={`text-xs font-bold ${net >= 0 ? "text-income" : "text-expense"}`}
                    >
                      {net >= 0 ? "+" : "-"}
                      {formatRupiah(Math.abs(net))}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-income"
                          style={{ width: `${(r.income / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-[11px] text-income">
                        {formatRupiah(r.income)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-expense"
                          style={{ width: `${(r.expense / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-[11px] text-expense">
                        {formatRupiah(r.expense)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
