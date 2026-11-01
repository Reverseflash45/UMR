/* Daerah yang sama di proyek lain. Kesembilan situs ini memakai 514 id daerah yang sama (slug "kab-…"/"kota-…"),
   jadi tautannya cukup mengganti domain. Berkas ini disalin apa adanya ke tiap proyek. */

export type Proyek = "umr" | "napas" | "rawan" | "getar" | "bara" | "bayang" | "hilal" | "gerhana" | "lidah";

const SITUS: { kode: Proyek; sisi: string; url: (id: string) => string }[] = [
  { kode: "umr", sisi: "upah minimum dan biaya hidupnya", url: (id) => `https://umr.raffstw.my.id/?d=${id}` },
  { kode: "napas", sisi: "kualitas udaranya", url: (id) => `https://napas.raffstw.my.id/#daerah=${id}` },
  { kode: "rawan", sisi: "catatan bencananya", url: (id) => `https://rawan-omega.vercel.app/#daerah=${id}` },
  { kode: "getar", sisi: "gempa besar di sekitarnya", url: (id) => `https://getar.raffstw.my.id/#daerah=${id}` },
  { kode: "bara", sisi: "gunung api di dekatnya", url: (id) => `https://bara.raffstw.my.id/#daerah=${id}` },
  { kode: "bayang", sisi: "hari tanpa bayangannya", url: (id) => `https://bayang.raffstw.my.id/#daerah=${id}` },
  { kode: "hilal", sisi: "posisi hilal dari sana", url: (id) => `https://hilal.raffstw.my.id/#daerah=${id}` },
  { kode: "gerhana", sisi: "gerhana yang akan terlihat", url: (id) => `https://gerhana.raffstw.my.id/#daerah=${id}` },
  { kode: "lidah", sisi: "bahasa ibu di sana", url: (id) => `https://lidah.raffstw.my.id/#daerah=${id}` },
];

export function tautanTetangga(id: string, sendiri: Proyek): { href: string; teks: string }[] {
  return SITUS.filter((s) => s.kode !== sendiri).map((s) => ({ href: s.url(id), teks: s.sisi }));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function htmlTetangga(id: string, nama: string, sendiri: Proyek): string {
  const t = tautanTetangga(id, sendiri).map((x) => `<a href="${x.href}">${esc(x.teks)}</a>`);
  return `<p class="tetangga">Lihat juga ${esc(nama)} dari sisi lain: ${t.slice(0, -1).join(", ")}, dan ${t.at(-1)}.</p>`;
}
