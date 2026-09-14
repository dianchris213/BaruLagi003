import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Bike,
  Droplets,
  Home,
  Minus,
  Plus,
  Settings,
  User,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Keuangan Dian — Mini App" },
      {
        name: "description",
        content:
          "Pencatatan keuangan pribadi: dompet, tagihan bulanan, dan ringkasan uang dalam satu mini app mobile-first.",
      },
      { property: "og:title", content: "Keuangan Dian — Mini App" },
      {
        property: "og:description",
        content:
          "Dompet, tagihan bulanan interaktif, dan ringkasan uang dalam satu tampilan mobile-first.",
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
type DailyStore = { day: string; in: number; out: number };
type ProfileErrors = Partial<Record<keyof Profile, string>>;

const BILLS: Bill[] = [
  { id: "sepeda", name: "Sepeda", amount: 390_000, daysLeft: 5, icon: Bike },
  { id: "air", name: "Air", amount: 75_000, daysLeft: 7, icon: Droplets },
  { id: "listrik", name: "Listrik", amount: 150_000, daysLeft: 10, icon: Zap },
];

const WALLETS: WalletItem[] = [
  { id: "shopee", name: "Driver Shopee", balance: 350_000, },
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

/** Local timezone of the device; resets follow this zone, never UTC. */
function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Local calendar parts (y/m/d) in the device timezone. */
function localParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: localZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y = "1970", m = "01", day = "01"] = fmt.format(d).split("-");
  return { y, m, day };
}

function dayKey(d = new Date()) {
  const { y, m, day } = localParts(d);
  return `${y}-${m}-${day}`;
}

/** Milliseconds until the next local midnight (min 1s, capped at 1h for drift safety). */
function msUntilLocalMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.min(Math.max(next.getTime() - now.getTime(), 1_000), 3_600_000);
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

/** Wallet totals are cumulative — no monthly reset. */
function loadFlows(): Record<string, Flow> {
  const raw = readJSON<unknown>(LS_FLOWS, null);
  const source =
    raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
      ? (raw as { data?: Record<string, Flow> }).data
      : (raw as Record<string, Flow> | null);
  const base = emptyFlows();
  if (!source || typeof source !== "object") return base;
  for (const w of WALLETS) {
    const f = source[w.id];
    if (f && typeof f === "object") {
      base[w.id] = { in: Number(f.in) || 0, out: Number(f.out) || 0 };
    }
  }
  return base;
}

function loadDaily(): DailyStore {
  const today = dayKey();
  const s = readJSON<DailyStore | null>(LS_DAILY, null);
  if (!s || s.day !== today) return { day: today, in: 0, out: 0 };
  return { day: today, in: Number(s.in) || 0, out: Number(s.out) || 0 };
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

/* ---------- App ---------- */

function Index() {
  const [tab, setTab] = useState<"home" | "settings">("home");
  const [paid, setPaid] = useState<Record<string, boolean>>(() =>
    readJSON<Record<string, boolean>>(LS_BILLS, {}),
  );
  const [seen, setSeen] = useState<Record<string, boolean>>(() =>
    readJSON<Record<string, boolean>>(LS_SEEN, {}),
  );
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [flows, setFlows] = useState<Record<string, Flow>>(() => emptyFlows());
  const [daily, setDaily] = useState<DailyStore>(() => ({ day: dayKey(), in: 0, out: 0 }));
  const [saved, setSaved] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const hydrated = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const errors = useMemo(() => validateProfile(profile), [profile]);
  const isValid = Object.keys(errors).length === 0;

  /* restore persisted state after hydration */
  useEffect(() => {
    setProfile(loadProfile());
    setFlows(loadFlows());
    setDaily(loadDaily());
    hydrated.current = true;
  }, []);

  /* timezone-aware daily rollover, scheduled on the next local midnight */
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setDaily((d) => (d.day === dayKey() ? d : { day: dayKey(), in: 0, out: 0 }));
        schedule();
      }, msUntilLocalMidnight());
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setDaily((d) => (d.day === dayKey() ? d : { day: dayKey(), in: 0, out: 0 }));
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_BILLS, JSON.stringify(paid));
  }, [paid]);
  useEffect(() => {
    localStorage.setItem(LS_SEEN, JSON.stringify(seen));
  }, [seen]);
  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem(LS_FLOWS, JSON.stringify(flows));
  }, [flows]);
  useEffect(() => {
    localStorage.setItem(LS_DAILY, JSON.stringify(daily));
  }, [daily]);

  /* debounced profile auto-save; invalid fields are never persisted */
  useEffect(() => {
    if (!hydrated.current || !isValid) return;
    const id = window.setTimeout(() => {
      localStorage.setItem(LS_PROFILE, JSON.stringify(profile));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    }, 500);
    return () => window.clearTimeout(id);
  }, [profile, isValid]);

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

  /* focus trap for notification dialog */
  useEffect(() => {
    if (!notifOpen) return;
    const node = dialogRef.current;
    node?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotifOpen(false);
        bellRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
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
    localStorage.setItem(LS_PROFILE, JSON.stringify(profile));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const driverNet = daily.in - daily.out;
  const totalIn = Object.values(flows).reduce((s, f) => s + (f?.in ?? 0), 0);
  const totalOut = Object.values(flows).reduce((s, f) => s + (f?.out ?? 0), 0);

  const fieldClass = (bad: boolean) =>
    `mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ${
      bad ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="relative mx-auto min-h-screen w-full max-w-[480px] pb-24">
        {tab === "home" ? (
          <>
            {/* 1. Header */}
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
                className="relative flex size-10 items-center justify-center rounded-full bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
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
              {/* 2. Notifikasi banner */}
              {!paid["listrik"] && (
                <div
                  role="alert"
                  className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600"
                >
                  Pengingat: Tagihan Listrik jatuh tempo dalam 10 hari!
                </div>
              )}

              {/* 3. Daftar Dompet */}
              <section aria-label="Daftar Dompet" className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-slate-800">Daftar Dompet</h2>
                <ul className="mt-2 divide-y divide-slate-100">
                  {WALLETS.map((w) => {
                    const f = flows[w.id] ?? { in: 0, out: 0 };
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
                              aria-label={`Total pemasukan ${w.name} ${formatRupiah(f.in)}`}
                            >
                              <Plus className="size-3" aria-hidden="true" />
                              {formatRupiah(f.in)}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600"
                              aria-label={`Total pengeluaran ${w.name} ${formatRupiah(f.out)}`}
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

              {/* 4. Tagihan Bulanan */}
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

              {/* 5. Pendapatan Bersih (harian) */}
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
                  Masuk {formatRupiah(daily.in)} • Keluar {formatRupiah(daily.out)} • reset tiap
                  hari ({localZone()})
                </p>
              </section>

              {/* 6. Ringkasan Uang */}
              <section aria-label="Ringkasan Uang" className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-slate-800">Ringkasan Uang</h2>
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
            </main>
          </>
        ) : (
          /* ---------- Halaman Pengaturan ---------- */
          <main className="px-4 pt-8">
            <h1 className="text-xl font-bold text-slate-800">Pengaturan</h1>
            <p className="mt-1 text-sm text-slate-500">Kelola profil akun kamu.</p>

            <form
              onSubmit={saveProfile}
              noValidate
              className="mt-5 space-y-4 rounded-2xl bg-white p-5 shadow-sm"
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
                  <p id="nama-error" role="alert" className="mt-1 text-[11px] font-semibold text-rose-500">
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
                  <p id="email-error" role="alert" className="mt-1 text-[11px] font-semibold text-rose-500">
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
              aria-label="Daftar notifikasi"
              className="relative w-full max-w-[480px] rounded-t-2xl bg-white p-5 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">
                  Notifikasi{unseenCount > 0 ? ` (${unseenCount} belum dibaca)` : ""}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    bellRef.current?.focus();
                  }}
                  aria-label="Tutup notifikasi"
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>

              <ul className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
                {notifications.length === 0 && (
                  <li className="py-6 text-center text-sm text-slate-500">
                    Tidak ada tagihan jatuh tempo. 🎉
                  </li>
                )}
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`flex items-center gap-3 rounded-xl p-3 ${
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
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                        Dibaca
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSeen((s) => ({ ...s, [n.id]: true }))}
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
                  className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
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
              className={`flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                tab === "home" ? "text-slate-800" : "text-slate-400"
              }`}
            >
              <Home className="size-5" aria-hidden="true" />
              Home
            </button>
            <button
              type="button"
              onClick={() => setTab("settings")}
              aria-current={tab === "settings" ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                tab === "settings" ? "text-slate-800" : "text-slate-400"
              }`}
            >
              <Settings className="size-5" aria-hidden="true" />
              Settings
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
