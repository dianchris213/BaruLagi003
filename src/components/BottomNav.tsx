import { Link } from "@tanstack/react-router";
import { BarChart3, Home, Receipt, Settings } from "lucide-react";

const items = [
  { to: "/", label: "Beranda", icon: Home, exact: true },
  { to: "/bills", label: "Tagihan", icon: Receipt, exact: false },
  { to: "/finance", label: "Keuangan", icon: BarChart3, exact: false },
  { to: "/settings", label: "Pengaturan", icon: Settings, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 flex w-full max-w-[480px] -translate-x-1/2 justify-between rounded-t-2xl bg-surface px-8 py-3 shadow-nav">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-label={item.label}
          activeOptions={{ exact: item.exact }}
          activeProps={{ className: "text-primary" }}
          inactiveProps={{ className: "text-muted-foreground" }}
          className="flex flex-1 flex-col items-center gap-1"
        >
          <item.icon className="size-5" />
          <span className="text-[10px] font-medium">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
