import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Repeat, Wallet } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { bills as seedBills, formatRupiah, monthKey, monthLabel, type Bill } from "@/lib/data";

export const Route = createFileRoute("/bills")({
  head: () => ({
    meta: [
      { title: "Detail Tagihan — Catatan Keuangan Dian" },
      {
        name: "description",
        content:
          "Daftar tagihan per bulan lengkap dengan jatuh tempo, status lunas, dan tombol bayar untuk memperbarui status.",
      },
      { property: "og:title", content: "Detail Tagihan — Catatan Keuangan Dian" },
      {
        property: "og:description",
        content: "Tagihan per bulan, jatuh tempo, dan tombol bayar dalam satu halaman.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillsPage,
});

function daysLeft(due: string) {
  const diff = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  return diff;
}

function BillsPage() {
  const [items, setItems] = useState<Bill[]>(seedBills);

  const groups = useMemo(() => {
    const map = new Map<string, Bill[]>();
    for (const b of [...items].sort((a, b) => (a.due < b.due ? 1 : -1))) {
      const k = monthKey(b.due);
      map.set(k, [...(map.get(k) ?? []), b]);
    }
    return [...map.entries()];
  }, [items]);

  const togglePaid = (id: string) =>
    setItems((prev) => prev.map((b) => (b.id === id ? { ...b, paid: !b.paid } : b)));

  const unpaidTotal = items.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="mx-auto min-h-screen w-full max-w-[480px] pb-28">
        <header className="rounded-b-2xl bg-surface px-5 py-6 shadow-card">
          <p className="text-xs text-muted-foreground">Belum dibayar</p>
          <h1 className="text-xl font-bold text-foreground">Detail Tagihan</h1>
          <p className="mt-1 text-lg font-bold text-expense">{formatRupiah(unpaidTotal)}</p>
        </header>

        <main className="space-y-4 px-4 pt-4">
          {groups.length === 0 ? (
            <section className="rounded-2xl bg-surface p-4 shadow-card">
              <EmptyState
                icon={Wallet}
                title="Belum ada tagihan"
                description="Tagihan bulanan kamu akan muncul di sini."
              />
            </section>
          ) : (
            groups.map(([key, list]) => (
              <section key={key} className="rounded-2xl bg-surface p-4 shadow-card">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-bold text-foreground">{monthLabel(key)}</h2>
                  <span className="text-[11px] text-muted-foreground">
                    {list.filter((b) => b.paid).length}/{list.length} lunas
                  </span>
                </div>
                <div className="mt-3 divide-y divide-border">
                  {list.map((b) => {
                    const d = daysLeft(b.due);
                    return (
                      <div key={b.id} className="flex items-center gap-3 py-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <b.icon className="size-4 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Jatuh tempo {formatDate(b.due)}
                            {!b.paid && (
                              <>
                                {" • "}
                                <span className="text-expense">
                                  {d >= 0 ? `${d} Hari Lagi` : `Telat ${Math.abs(d)} Hari`}
                                </span>
                              </>
                            )}
                          </p>
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Repeat className="size-3" />
                            Siklus {b.cycle}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-foreground">
                            {formatRupiah(b.amount)}
                          </p>
                          {b.paid ? (
                            <button
                              onClick={() => togglePaid(b.id)}
                              className="mt-1 flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-income"
                            >
                              <CheckCircle2 className="size-3" />
                              Lunas
                            </button>
                          ) : (
                            <button
                              onClick={() => togglePaid(b.id)}
                              className="mt-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground"
                            >
                              Bayar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
