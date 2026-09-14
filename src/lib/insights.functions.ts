import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const WalletInput = z.object({
  name: z.string().trim().min(1).max(60),
  balance: z.number().finite().min(0).max(1_000_000_000),
  in: z.number().finite().min(0).max(1_000_000_000),
  out: z.number().finite().min(0).max(1_000_000_000),
});

const InsightInput = z.object({
  period: z.string().trim().min(4).max(10),
  wallets: z.array(WalletInput).min(1).max(10),
  bills: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        amount: z.number().finite().min(0).max(1_000_000_000),
        paid: z.boolean(),
      }),
    )
    .max(10),
  driverNet: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
});

export const generateInsight = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InsightInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Layanan AI belum dikonfigurasi.");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const totalIn = data.wallets.reduce((s, w) => s + w.in, 0);
    const totalOut = data.wallets.reduce((s, w) => s + w.out, 0);

    const result = streamText({
      model: gateway("google/gemini-3.5-flash"),
      system:
        "Kamu asisten keuangan pribadi berbahasa Indonesia. Jawab ringkas, maksimal 4 kalimat pendek, nada profesional, tanpa markdown, tanpa emoji. Gunakan format rupiah Indonesia.",
      prompt: [
        `Periode: ${data.period}`,
        `Total pemasukan: Rp ${totalIn.toLocaleString("id-ID")}`,
        `Total pengeluaran: Rp ${totalOut.toLocaleString("id-ID")}`,
        `Pendapatan bersih driver hari ini: Rp ${data.driverNet.toLocaleString("id-ID")}`,
        "Dompet:",
        ...data.wallets.map(
          (w) =>
            `- ${w.name}: saldo Rp ${(w.balance + w.in - w.out).toLocaleString("id-ID")}, masuk Rp ${w.in.toLocaleString("id-ID")}, keluar Rp ${w.out.toLocaleString("id-ID")}`,
        ),
        "Tagihan:",
        ...data.bills.map(
          (b) =>
            `- ${b.name}: Rp ${b.amount.toLocaleString("id-ID")} (${b.paid ? "lunas" : "belum lunas"})`,
        ),
        "Berikan ringkasan wawasan pemasukan & pengeluaran serta satu saran konkret.",
      ].join("\n"),
    });

    const text = await result.text;
    return { text: text.trim() };
  });
