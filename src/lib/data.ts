import { Bike, Droplet, Zap, Wifi, type LucideIcon } from "lucide-react";

export type Txn = {
  id: string;
  name: string;
  amount: number;
  type: "income" | "expense";
  at: string;
};

export type Bill = {
  id: string;
  name: string;
  icon: LucideIcon;
  amount: number;
  cycle: string;
  due: string;
  paid: boolean;
};

export const transactions: Txn[] = [
  { id: "t1", name: "Drivers Shopee", amount: 850000, type: "income", at: "2026-09-14T09:15:00+07:00" },
  { id: "t2", name: "Keperluan Ayah", amount: 150000, type: "expense", at: "2026-09-13T19:40:00+07:00" },
  { id: "t3", name: "Keperluan Ibu", amount: 200000, type: "expense", at: "2026-09-12T08:05:00+07:00" },
  { id: "t4", name: "Bonus Driver", amount: 300000, type: "income", at: "2026-08-28T17:00:00+07:00" },
  { id: "t5", name: "Bensin", amount: 180000, type: "expense", at: "2026-08-20T07:30:00+07:00" },
  { id: "t6", name: "Drivers Shopee", amount: 920000, type: "income", at: "2026-08-10T10:00:00+07:00" },
  { id: "t7", name: "Servis Motor", amount: 250000, type: "expense", at: "2026-07-18T14:20:00+07:00" },
  { id: "t8", name: "Drivers Shopee", amount: 780000, type: "income", at: "2026-07-05T11:45:00+07:00" },
  { id: "t9", name: "Drivers Shopee", amount: 640000, type: "income", at: "2025-12-12T11:45:00+07:00" },
  { id: "t10", name: "Belanja Bulanan", amount: 420000, type: "expense", at: "2025-12-02T16:10:00+07:00" },
];

export const bills: Bill[] = [
  { id: "b1", name: "Sepeda", icon: Bike, amount: 390000, cycle: "31", due: "2026-09-24", paid: false },
  { id: "b2", name: "Air", icon: Droplet, amount: 180000, cycle: "28", due: "2026-09-24", paid: false },
  { id: "b3", name: "Listrik", icon: Zap, amount: 250000, cycle: "25", due: "2026-09-25", paid: true },
  { id: "b4", name: "Internet", icon: Wifi, amount: 300000, cycle: "20", due: "2026-10-20", paid: false },
  { id: "b5", name: "Listrik", icon: Zap, amount: 240000, cycle: "25", due: "2026-08-25", paid: true },
  { id: "b6", name: "Air", icon: Droplet, amount: 175000, cycle: "28", due: "2026-08-24", paid: true },
];

export function formatRupiah(n: number) {
  return `Rp. ${n.toLocaleString("id-ID")}`;
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}
