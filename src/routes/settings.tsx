import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan Akun — Catatan Keuangan Dian" },
      {
        name: "description",
        content: "Ubah nama, alamat email, dan kata sandi akun catatan keuangan kamu.",
      },
      { property: "og:title", content: "Pengaturan Akun — Catatan Keuangan Dian" },
      {
        property: "og:description",
        content: "Ubah nama, email, dan kata sandi akun kamu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [name, setName] = useState("Dian");
  const [email, setEmail] = useState("dian@email.com");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const inputClass =
    "mt-1 w-full rounded-xl bg-muted px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40";

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="mx-auto min-h-screen w-full max-w-[480px] pb-28">
        <header className="rounded-b-2xl bg-surface px-5 py-6 shadow-card">
          <p className="text-xs text-muted-foreground">Akun</p>
          <h1 className="text-xl font-bold text-foreground">Pengaturan</h1>
        </header>

        <main className="space-y-4 px-4 pt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Profil berhasil diperbarui");
            }}
            className="rounded-2xl bg-surface p-4 shadow-card"
          >
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <User className="size-4" /> Profil
            </h2>
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Nama
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Nama kamu"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="nama@email.com"
              />
            </label>
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Simpan Perubahan
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!current || !next) {
                toast.error("Lengkapi kata sandi lama dan baru");
                return;
              }
              if (next !== confirm) {
                toast.error("Konfirmasi kata sandi tidak cocok");
                return;
              }
              setCurrent("");
              setNext("");
              setConfirm("");
              toast.success("Kata sandi berhasil diubah");
            }}
            className="mb-8 rounded-2xl bg-surface p-4 shadow-card"
          >
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Lock className="size-4" /> Kata Sandi
            </h2>
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Kata sandi saat ini
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Kata sandi baru
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Konfirmasi kata sandi baru
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </label>
            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Mail className="size-4" />
              Perbarui Kata Sandi
            </button>
          </form>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
