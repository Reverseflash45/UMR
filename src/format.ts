const ribuan = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 2827593 -> "2.827.593" */
export function angka(x: number): string {
  return ribuan.format(Math.round(x));
}

/** 2827593 -> "Rp2.827.593"; negatif -> "−Rp…" */
export function rupiah(x: number): string {
  return (x < 0 ? "−" : "") + "Rp" + angka(Math.abs(x));
}

/** 2827593 -> "Rp2,83 jt"; 950000 -> "Rp950 rb" */
export function rupiahRingkas(x: number): string {
  const n = Math.abs(x);
  const tanda = x < 0 ? "−" : "";
  if (n >= 1_000_000) {
    const jt = n / 1_000_000;
    const teks = jt >= 10 ? jt.toFixed(1) : jt.toFixed(2);
    return `${tanda}Rp${teks.replace(/\.?0+$/, "").replace(".", ",")} jt`;
  }
  return `${tanda}Rp${Math.round(n / 1000)} rb`;
}

export function persen(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** "3.000.000" atau "3jt" -> 3000000 */
export function bacaRupiah(s: string): number | null {
  const t = s.toLowerCase().replace(/\s|rp/g, "");
  const jt = t.match(/^([\d.,]+)(jt|juta)$/);
  if (jt) {
    const v = parseFloat(jt[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(v) ? Math.round(v * 1_000_000) : null;
  }
  const digit = t.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digit)) return null;
  return parseInt(digit, 10);
}

export function normalTeks(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/^kab\.\s*/, "")
    .replace(/[^a-z0-9]/g, "");
}
