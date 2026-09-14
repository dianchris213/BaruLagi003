import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Bike,
  Droplets,
  Globe2,
  Home,
  Loader2,
  Minus,
  Plus,
  Settings,
  Sparkles,
  User,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { generateInsight } from "@/lib/insights.functions";
import {
  DEFAULT_TIMEZONE,
  LS_TIMEZONE,
  TIMEZONES,
  dayKey,
  detectTimezone,
  isTimezoneId,
  monthKey,
  monthLabel,
  msUntilZonedMidnight,
  timezoneLabel,
  type TimezoneId,
} from "@/lib/timezone";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ringkasan Keuangan — Mini App Dian" },
      {
        name: "description",
        content:
          "Ringkasan dompet, tagihan bulanan, dan wawasan AI pemasukan & pengeluaran dalam satu mini app mobile-first.",
      },
      { property: "og:title", content: "Ringkasan Keuangan — Mini App Dian" },
      {
        property: "og:description",
        content:
          "Dompet, tagihan bulanan interaktif, wawasan AI, dan reset harian sesuai zona waktu pilihanmu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/* ---------- Types & constants ---------- */

type Bill = { id: string; name: string; amount: number; daysLeft: number; icon: LucideIcon };
type WalletItem = { id: string; name: string; balance: number };
type Profile = { name: string; email: string; password: string };
type Flow = { in: number; out: number };
type FlowStore = { month: string; data: Record<string, Flow> };
type DailyStore = { day: string; in: number; out: number };
type ProfileErrors = Partial<Record<keyof Profile, string>>;

const BILLS: Bill[] = [
  { id: "sepeda", name: "Sepeda", amount: 390_000, daysLeft: 5, icon: Bike },
  { id: "air", name: "Air", amount: 75_000, daysLeft: 7, icon: Droplets },
  { id: "listrik", name: "Listrik", amount: 150_000, daysLeft: 10, icon: Zap },
];

const WALLETS: WalletItem[] = [
  { id: "shopee", name: "Driver Shopee", balance: 350_000 },
  { id: "ayah", name: "Keperluan Ayah", balance: 200_000 },
  { id: "ibu", name: "Keperluan Ibu", balance: 150_000 },
];

const LS_BILLS = "miniapp.paidBills";
const LS_PROFILE = "miniapp.profile";
const LS_SEEN = "miniapp.seenNotifications";
const LS_FLOWS = "miniapp.walletFlows";
const LS_DAILY = "miniapp.driverDaily";

const EMPTY_PROFILE: Profile = { name: "Dian", email: "user@email.com", password: "" };

/* ---------- Helpers ---------- */

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadTimezone(): TimezoneId {
  if (typeof window === "undefined") return DEFAULT_TIMEZONE;
  const raw = window.localStorage.getItem(LS_TIMEZONE);
  return isTimezoneId(raw) ? raw : detectTimezone();
}

function loadProfile(): Profile {
  const p = readJSON<Partial<Profile> | null>(LS_PROFILE, null);
  if (!p || typeof p.name !== "string") return EMPTY_PROFILE;
  return {
    name: p.name,
    email: typeof p.email === "string" ? p.email : EMPTY_PROFILE.email,
    password: typeof p.password === "string" ? p.password : "",
  };
}

function emptyFlows(): Record<string, Flow> {
  return Object.fromEntries(WALLETS.map((w) => [w.id, { in: 0, out: 0 }]));
}

/** Wallet flows reset per calendar month of the chosen timezone. */
function loadFlows(month: string): FlowStore {
  const raw = readJSON<Partial<FlowStore> | null>(LS_FLOWS, null);
  const base: FlowStore = { month, data: emptyFlows() };
  if (!raw || raw.month !== month || !raw.data || typeof raw.data !== "object") return base;
  for (const w of WALLETS) {
    const f = raw.data[w.id];
    if (f && typeof f === "object") {
      base.data[w.id] = { in: Number(f.in) || 0, out: Number(f.out) || 0 };
    }
  }
  return base;
}

/** Driver net resets per calendar day of the chosen timezone. */
function loadDaily(day: string): DailyStore {
  const s = readJSON<DailyStore | null>(LS_DAILY, null);
  if (!s || s.day !== day) return { day, in: 0, out: 0 };
  return { day, in: Number(s.in) || 0, out: Number(s.out) || 0 };
}

function validateProfile(p: Profile): ProfileErrors {
  const e: ProfileErrors = {};
  const name = p.name.trim();
  if (!name) e.name = "Nama tidak boleh kosong.";
  else if (name.length > 100) e.name = "Nama maksimal 100 karakter.";

  const email = p.email.trim();
  if (!email) e.email = "Email tidak boleh kosong.";
  else if (email.length > 255) e.email = "Email maksimal 255 karakter.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "Format email tidak valid.";

  if (p.password && p.password.length < 8) e.password = "Kata sandi minimal 8 karakter.";
  else if (p.password.length > 64) e.password = "Kata sandi maksimal 64 karakter.";

  return e;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/* ---------- App ---------- */

function Index() {
  const [tab, setTab] = useState<"home" | "settings">("home");

  /**
   * Nothing reads localStorage during render or state initialisation: the
   * server render and the first client render are identical, and persisted
   * data is applied once `ready` flips inside an effect. This removes the
   * hydration mismatch warning the previous eager reads produced.
   */
  const [ready, setReady] = useState(false);
  const [timezone, setTimezone] = useState<TimezoneId>(DEFAULT_TIMEZONE);
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [flows, setFlows] = useState<FlowStore>({ month: "", data: emptyFlows() });
  const [daily, setDaily] = useState<DailyStore>({ day: "", in: 0, out: 0 });
  const [saved, setSaved] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [insight, setInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const errors = useMemo(() => validateProfile(profile), [profile]);
  const isValid = Object.keys(errors).length === 0;

  /* 1. Restore persisted state after mount, then unlock writes. */
  useEffect(() => {
    const zone = loadTimezone();
    setTimezone(zone);
    setPaid(readJSON<Record<string, boolean>>(LS_BILLS, {}));
    setSeen(readJSON<Record<string, boolean>>(LS_SEEN, {}));
    setProfile(loadProfile());
    setFlows(loadFlows(monthKey(zone)));
    setDaily(loadDaily(dayKey(zone)));
    setReady(true);
  }, []);

  /* 2. Timezone-aware rollover: on zone change, at zoned midnight, on refocus. */
  const syncPeriods = useCallback(
    (zone: TimezoneId) => {
      const day = dayKey(zone);
      const month = monthKey(zone);
      setDaily((d) => (d.day === day ? d : { day, in: 0, out: 0 }));
      setFlows((f) => (f.month === month ? f : { month, data: emptyFlows() }));
    },
    [],
  );

  useEffect(() => {
    if (!ready) return;
    syncPeriods(timezone);

    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        syncPeriods(timezone);
        schedule();
      }, msUntilZonedMidnight(timezone));
    };
    schedule();

    const onVisible = () => {
      if (document.visibilityState === "visible") syncPeriods(timezone);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, timezone, syncPeriods]);

  /* 3. Persistence — gated on `ready` so defaults never overwrite saved data. */
  useEffect(() => {
    if (ready) window.localStorage.setItem(LS_TIMEZONE, timezone);
  }, [ready, timezone]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(LS_BILLS, JSON.stringify(paid));
  }, [ready, paid]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(LS_SEEN, JSON.stringify(seen));
  }, [ready, seen]);
  useEffect(() => {
    if (ready && flows.month) window.localStorage.setItem(LS_FLOWS, JSON.stringify(flows));
  }, [ready, flows]);
  useEffect(() => {
    if (ready && daily.day) window.localStorage.setItem(LS_DAILY, JSON.stringify(daily));
  }, [ready, daily]);

  /* Debounced profile auto-save; invalid fields are never persisted. */
  useEffect(() => {
    if (!ready || !isValid) return;
    const id = window.setTimeout(() => {
      window.localStorage.setItem(LS_PROFILE, JSON.stringify(profile));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    }, 500);
    return () => window.clearTimeout(id);
  }, [ready, profile, isValid]);

  const notifications = useMemo(
    () =>
      BILLS.filter((b) => !paid[b.id]).map((b) => ({
        id: b.id,
        title: `Tagihan ${b.name} jatuh tempo`,
        body: `${formatRupiah(b.amount)} • ${b.daysLeft} hari lagi`,
        icon: b.icon,
        seen: !!seen[b.id],
      })),
    [paid, seen],
  );
  const unseenCount = notifications.filter((n) => !n.seen).length;

  const closeNotif = useCallback(() => {
    setNotifOpen(false);
    bellRef.current?.focus();
  }, []);

  /* Focus trap + roving arrow-key navigation inside the notification dialog. */
  useEffect(() => {
    if (!notifOpen) return;
    const node = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.querySelector<HTMLElement>("[data-notif-first]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setNotifOpen(false);
        previous?.focus();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
        const rows = Array.from(
          listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
        );
        if (rows.length === 0) return;
        e.preventDefault();
        const current = rows.findIndex((r) => r.contains(document.activeElement));
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? rows.length - 1
              : e.key === "ArrowDown"
                ? (current + 1 + rows.length) % rows.length
                : (current - 1 + rows.length) % rows.length;
        rows[next]?.focus();
        return;
      }

      if (e.key !== "Tab" || !node) return;
      const items = node.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notifOpen]);

  const markPaid = (id: string) => setPaid((s) => ({ ...s, [id]: true }));
  const markAllSeen = () =>
    setSeen((s) => ({ ...s, ...Object.fromEntries(notifications.map((n) => [n.id, true])) }));

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    window.localStorage.setItem(LS_PROFILE, JSON.stringify(profile));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const driverNet = daily.in - daily.out;
  const totalIn = Object.values(flows.data).reduce((s, f) => s + (f?.in ?? 0), 0);
  const totalOut = Object.values(flows.data).reduce((s, f) => s + (f?.out ?? 0), 0);
  const periodKey = flows.month || monthKey(timezone);

  /* AI insight from locally stored data only. */
  const requestInsight = useServerFn(generateInsight);
  const runInsight = async () => {
    setInsightLoading(true);
    setInsightError("");
    try {
      const res = await requestInsight({
        data: {
          period: periodKey,
          wallets: WALLETS.map((w) => {
            const f = flows.data[w.id] ?? { in: 0, out: 0 };
            return { name: w.name, balance: w.balance, in: f.in, out: f.out };
          }),
          bills: BILLS.map((b) => ({ name: b.name, amount: b.amount, paid: !!paid[b.id] })),
          driverNet,
        },
      });
      setInsight(res.text);
    } catch {
      setInsightError("Wawasan AI belum bisa dibuat. Coba lagi sebentar lagi.");
    } finally {
      setInsightLoading(false);
    }
  };

  const fieldClass = (bad: boolean) =>
    `mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ${
      bad ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="relative mx-auto min-h-screen w-full max-w-[480px] pb-24">
        {tab === "home" ? (
          <>
            <header className="flex items-center gap-3 px-5 pt-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-800">
                <User className="size-5 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500">Selamat Datang Kembali</p>
                <p className="text-lg font-bold text-slate-800">{profile.name}</p>
              </div>
              <button
                ref={bellRef}
                type="button"
                onClick={() => setNotifOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={notifOpen}
                aria-label={`Notifikasi tagihan, ${unseenCount} belum dibaca`}
                className="relative flex size-11 items-center justify-center rounded-full bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
              >
                <Bell className="size-5 text-slate-800" aria-hidden="true" />
                {unseenCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white"
                  >
                    {unseenCount > 9 ? "9+" : unseenCount}
                  </span>
                )}
              </button>
            </header>

            <main className="space-y-4 px-4 pt-4">
              {!paid["listrik"] && (
                <div
                  role="alert"
                  className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600"
                >
                  Pengingat: Tagihan Listrik jatuh tempo dalam 10 hari!
                </div>
              )}

              <section aria-label="Daftar Dompet" className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-slate-800">Daftar Dompet</h2>
                <ul className="mt-2 divide-y divide-slate-100">
                  {WALLETS.map((w) => {
                    const f = flows.data[w.id] ?? { in: 0, out: 0 };
                    return (
                      <li key={w.id} className="flex items-center gap-3 py-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                          <Wallet className="size-4 text-slate-800" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{w.name}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"
                              aria-label={`Pemasukan ${w.name} bulan ini ${formatRupiah(f.in)}`}
                            >
                              <Plus className="size-3" aria-hidden="true" />
                              {formatRupiah(f.in)}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600"
                              aria-label={`Pengeluaran ${w.name} bulan ini ${formatRupiah(f.out)}`}
                            >
                              <Minus className="size-3" aria-hidden="true" />
                              {formatRupiah(f.out)}
                            </span>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-slate-800">
                          {formatRupiah(w.balance + f.in - f.out)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section aria-label="Tagihan Bulanan" className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-slate-800">Tagihan Bulanan</h2>
                <ul className="mt-2 divide-y divide-slate-100">
                  {BILLS.map((b) => {
                    const isPaid = !!paid[b.id];
                    return (
                      <li key={b.id} className="flex items-center gap-3 py-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                          <b.icon className="size-4 text-slate-800" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                          <p className="text-xs text-slate-500">{formatRupiah(b.amount)}</p>
                          {!isPaid && (
                            <p className="text-[11px] font-semibold text-rose-500">
                              {b.daysLeft} Hari Lagi
                            </p>
                          )}
                        </div>
                        {isPaid ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-500">
                            Lunas
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => markPaid(b.id)}
                            className="shrink-0 rounded-full bg-slate-800 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
                          >
                            Bayar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section
                aria-label="Pendapatan Bersih"
                className="rounded-2xl bg-white p-5 text-center shadow-sm"
              >
                <p className="text-sm text-slate-500">Pendapatan Bersih Driver (Hari Ini)</p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    driverNet < 0 ? "text-rose-500" : "text-emerald-500"
                  }`}
                >
                  {formatRupiah(driverNet)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Masuk {formatRupiah(daily.in)} • Keluar {formatRupiah(daily.out)} • reset harian{" "}
                  {timezoneLabel(timezone)}
                </p>
              </section>

              <section aria-label="Ringkasan Uang" className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-800">Ringkasan Uang</h2>
                  <p className="text-[11px] font-semibold text-slate-400">
                    {monthLabel(periodKey)}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">Total Pemasukan</p>
                    <p className="mt-0.5 text-sm font-bold text-emerald-600">
                      {formatRupiah(totalIn)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">Total Pengeluaran</p>
                    <p className="mt-0.5 text-sm font-bold text-rose-600">
                      {formatRupiah(totalOut)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Wawasan AI */}
              <section aria-label="Wawasan AI" className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900">
                    <Sparkles className="size-4 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-slate-800">Wawasan AI</h2>
                    <p className="text-xs text-slate-500">
                      Ringkasan pemasukan & pengeluaran {monthLabel(periodKey)} dari data yang
                      tersimpan di perangkat ini.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={runInsight}
                  disabled={!ready || insightLoading}
                  aria-busy={insightLoading}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {insightLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Menyusun wawasan…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" aria-hidden="true" />
                      {insight ? "Buat ulang wawasan" : "Buat wawasan bulan ini"}
                    </>
                  )}
                </button>

                <div aria-live="polite" className="mt-3">
                  {insightLoading && (
                    <p className="text-xs text-slate-500">
                      Menganalisis pemasukan dan pengeluaranmu…
                    </p>
                  )}
                  {!insightLoading && insightError && (
                    <p role="alert" className="text-xs font-semibold text-rose-500">
                      {insightError}
                    </p>
                  )}
                  {!insightLoading && !insightError && insight && (
                    <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                      {insight}
                    </p>
                  )}
                </div>
              </section>
            </main>
          </>
        ) : (
          /* ---------- Halaman Pengaturan ---------- */
          <main className="px-4 pt-8">
            <h1 className="text-xl font-bold text-slate-800">Pengaturan</h1>
            <p className="mt-1 text-sm text-slate-500">Kelola profil dan zona waktu kamu.</p>

            <section
              aria-label="Zona Waktu"
              className="mt-5 rounded-2xl bg-white p-5 shadow-sm"
            >
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
                <Globe2 className="size-4" aria-hidden="true" /> Zona Waktu
              </h2>
              <label htmlFor="timezone" className="mt-3 block text-xs font-semibold text-slate-800">
                Zona waktu perhitungan
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isTimezoneId(value)) setTimezone(value);
                }}
                aria-describedby="timezone-help"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-800"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p id="timezone-help" className="mt-2 text-[11px] text-slate-500">
                Reset pendapatan harian dan ringkasan bulanan mengikuti zona ini, bukan jam
                perangkat, jadi datamu tidak rollover dua kali di perangkat berbeda.
              </p>
              <p role="status" className="mt-2 text-[11px] font-semibold text-slate-600">
                Hari aktif: {dayKey(timezone)} • Bulan aktif: {monthLabel(periodKey)}
              </p>
            </section>

            <form
              onSubmit={saveProfile}
              noValidate
              className="mt-4 space-y-4 rounded-2xl bg-white p-5 shadow-sm"
            >
              <div>
                <label htmlFor="nama" className="text-xs font-semibold text-slate-800">
                  Nama Lengkap
                </label>
                <input
                  id="nama"
                  type="text"
                  maxLength={100}
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "nama-error" : undefined}
                  className={fieldClass(!!errors.name)}
                />
                {errors.name && (
                  <p
                    id="nama-error"
                    role="alert"
                    className="mt-1 text-[11px] font-semibold text-rose-500"
                  >
                    {errors.name}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="email" className="text-xs font-semibold text-slate-800">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  maxLength={255}
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={fieldClass(!!errors.email)}
                />
                {errors.email && (
                  <p
                    id="email-error"
                    role="alert"
                    className="mt-1 text-[11px] font-semibold text-rose-500"
                  >
                    {errors.email}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="password" className="text-xs font-semibold text-slate-800">
                  Kata Sandi
                </label>
                <input
                  id="password"
                  type="password"
                  maxLength={64}
                  value={profile.password}
                  onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={fieldClass(!!errors.password)}
                />
                {errors.password && (
                  <p
                    id="password-error"
                    role="alert"
                    className="mt-1 text-[11px] font-semibold text-rose-500"
                  >
                    {errors.password}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={!isValid}
                className="w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Simpan Perubahan
              </button>
              <p role="status" className="text-center text-xs font-semibold text-emerald-500">
                {saved ? "Perubahan tersimpan otomatis." : "\u00A0"}
              </p>
            </form>
          </main>
        )}

        {/* Notifikasi */}
        {notifOpen && (
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/40">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => setNotifOpen(false)}
              className="absolute inset-0 cursor-default"
            />
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="notif-title"
              aria-describedby="notif-help"
              className="relative w-full max-w-[480px] rounded-t-2xl bg-white p-5 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <h2 id="notif-title" className="text-base font-bold text-slate-800">
                  Notifikasi{unseenCount > 0 ? ` (${unseenCount} belum dibaca)` : ""}
                </h2>
                <button
                  data-notif-first
                  type="button"
                  onClick={closeNotif}
                  aria-label="Tutup notifikasi"
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>

              <p id="notif-help" className="mt-1 text-[11px] text-slate-500">
                Gunakan tombol panah atas/bawah untuk menelusuri notifikasi, Enter untuk menandai
                dibaca, Esc untuk menutup.
              </p>

              {/* Screen-reader announcement for the list state */}
              <p aria-live="polite" className="sr-only">
                {notifications.length === 0
                  ? "Tidak ada notifikasi tagihan."
                  : `${notifications.length} notifikasi tagihan, ${unseenCount} belum dibaca.`}
              </p>

              <ul
                ref={listRef}
                role="listbox"
                aria-label="Daftar notifikasi tagihan"
                className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto"
              >
                {notifications.length === 0 && (
                  <li className="py-6 text-center text-sm text-slate-500">
                    Tidak ada tagihan jatuh tempo.
                  </li>
                )}
                {notifications.map((n, i) => (
                  <li
                    key={n.id}
                    role="option"
                    tabIndex={i === 0 ? 0 : -1}
                    aria-selected={!n.seen}
                    aria-label={`${n.title}. ${n.body}. ${n.seen ? "Sudah dibaca" : "Belum dibaca"}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSeen((s) => ({ ...s, [n.id]: true }));
                      }
                    }}
                    className={`flex items-center gap-3 rounded-xl p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 ${
                      n.seen ? "bg-slate-50" : "bg-rose-50"
                    }`}
                  >
                    <n.icon
                      className={`size-4 shrink-0 ${n.seen ? "text-slate-500" : "text-rose-500"}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500">{n.body}</p>
                    </div>
                    {n.seen ? (
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-[10px] font-semibold text-slate-400"
                      >
                        Dibaca
                      </span>
                    ) : (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setSeen((s) => ({ ...s, [n.id]: true }))}
                        aria-label={`Tandai ${n.title} sudah dibaca`}
                        className="shrink-0 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-700"
                      >
                        Tandai dibaca
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {unseenCount > 0 && (
                <button
                  type="button"
                  onClick={markAllSeen}
                  className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
                >
                  Tandai semua sudah dibaca
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <nav
          aria-label="Navigasi utama"
          className="fixed bottom-0 left-1/2 z-10 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-white shadow-lg"
        >
          <div className="grid grid-cols-2">
            <button
              type="button"
              onClick={() => setTab("home")}
              aria-current={tab === "home" ? "page" : undefined}
              className={`flex min-h-11 flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                tab === "home" ? "text-slate-800" : "text-slate-400"
              }`}
            >
              <Home className="size-5" aria-hidden="true" />
              Ringkasan
            </button>
            <button
              type="button"
              onClick={() => setTab("settings")}
              aria-current={tab === "settings" ? "page" : undefined}
              className={`flex min-h-11 flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                tab === "settings" ? "text-slate-800" : "text-slate-400"
              }`}
            >
              <Settings className="size-5" aria-hidden="true" />
              Pengaturan
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
