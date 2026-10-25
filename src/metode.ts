import "@fontsource/dotgothic16/latin-400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./gaya.css";
import "./metode.css";

import { angka, rupiah } from "./format";
import { type Dataset, KATEGORI, NAMA_PITA, PROFIL_AWAL, type Profil, URUTAN_PITA, hitung } from "./model";

const isi = (kunci: string, nilai: string) =>
  document.querySelectorAll<HTMLElement>(`[data-isi="${kunci}"]`).forEach((el) => (el.textContent = nilai));

function koma(x: number, d = 2): string {
  return x.toFixed(d).replace(".", ",");
}

async function mulai(): Promise<void> {
  const data: Dataset = await fetch(import.meta.env.BASE_URL + "data/daerah.json").then((r) => r.json());
  const indeks = new Map(data.daerah.map((d) => [d.id, d]));
  const cari = (id: string) => indeks.get(id);

  const umk = data.daerah.filter((d) => d.jenisUpah === "UMK").length;
  const upah = data.daerah.map((d) => d.upah).sort((a, b) => a - b);
  const idx = data.daerah.map((d) => d.gk / data.gkNasional).sort((a, b) => a - b);
  isi("versi", data.versi);
  isi("umk", String(umk));
  isi("ump", String(514 - umk));
  isi("min", rupiah(upah[0]));
  isi("maks", rupiah(upah[upah.length - 1]));
  isi("median", rupiah(upah[Math.floor(upah.length / 2)]));
  isi("gkn", angka(data.gkNasional));
  isi("imin", `${koma(idx[0])}×`);
  isi("imaks", `${koma(idx[idx.length - 1])}×`);

  // Sumber upah per provinsi.
  const baris = data.provinsi
    .map((p, i) => {
      const n = data.daerah.filter((d) => d.prov === i);
      const k = n.filter((d) => d.jenisUpah === "UMK").length;
      const sumber = p.sumberUpah
        ? `<a href="${p.sumberUpah}" rel="noopener">${new URL(p.sumberUpah).hostname.replace(/^www\./, "")}</a>`
        : "UMP berlaku untuk semua daerah";
      return `<tr><td>${p.nama}</td><td class="angka">${rupiah(p.ump)}</td><td class="angka">${k}/${n.length}</td><td>${sumber}</td></tr>`;
    })
    .join("");
  document.getElementById("tabel-provinsi")!.innerHTML =
    `<thead><tr><th>Provinsi</th><th>UMP 2026</th><th>Ber-UMK</th><th>Sumber UMK</th></tr></thead><tbody>${baris}</tbody>`;

  // Keranjang acuan.
  const kat = KATEGORI.map(
    (k) =>
      `<tr><td>${k.nama}</td><td class="angka">${k.id === "anak" ? `${angka(k.dasar)} / anak` : angka(k.dasar)}</td><td class="angka">${koma(k.elastisitas, 1)}</td><td class="angka">${k.id === "anak" ? "—" : `×${koma(k.pasangan, 2).replace(/,?0+$/, "")}`}</td><td class="angka">${k.id === "anak" ? "—" : `+${koma(k.perAnak, 2).replace(/,?0+$/, "")}`}</td></tr>`,
  ).join("");
  const sub = KATEGORI.filter((k) => k.id !== "anak").reduce((s, k) => s + k.dasar, 0);
  document.getElementById("tabel-kategori")!.innerHTML = `
    <thead><tr><th>Kategori</th><th>Acuan (Rp/bln)</th><th>Elastisitas</th><th>Pasangan</th><th>Per anak</th></tr></thead>
    <tbody>${kat}
      <tr><td>Tabungan & dana darurat</td><td class="angka">10% dari total</td><td class="angka">—</td><td class="angka">—</td><td class="angka">—</td></tr>
    </tbody>
    <tfoot><tr><td>Total acuan lajang</td><td class="angka">${angka(sub * 1.1)}</td><td colspan="3"></td></tr></tfoot>`;

  // Uji sensitivitas.
  const profil: [string, Profil][] = [
    ["Bawaan: lajang, kos, standar, tabungan, gaji bersih", PROFIL_AWAL],
    ["Gaji kotor", { ...PROFIL_AWAL, bersih: false }],
    ["Hemat, tanpa tabungan", { ...PROFIL_AWAL, gaya: "hemat", tabungan: false }],
    ["Kontrakan", { ...PROFIL_AWAL, hunian: "kontrakan" }],
    ["Berdua, pasangan bekerja", { ...PROFIL_AWAL, rumah: "pasangan", pasanganKerja: true }],
    ["Keluarga 2 anak, satu pencari nafkah", { ...PROFIL_AWAL, rumah: "keluarga", anak: 2 }],
    ["Keluarga 2 anak, suami-istri bekerja", { ...PROFIL_AWAL, rumah: "keluarga", anak: 2, pasanganKerja: true }],
  ];
  const sens = profil
    .map(([nama, p]) => {
      const n = { longgar: 0, pas: 0, mepet: 0, kurang: 0 };
      const cak: number[] = [];
      for (const d of data.daerah) {
        const h = hitung(d, p, data, cari);
        n[h.pita]++;
        cak.push(h.cakupan);
      }
      cak.sort((a, b) => a - b);
      return `<tr><td>${nama}</td>${URUTAN_PITA.map((x) => `<td class="angka">${n[x]}</td>`).join("")}<td class="angka">${Math.round(cak[257] * 100)}%</td></tr>`;
    })
    .join("");
  document.getElementById("tabel-sensitivitas")!.innerHTML = `
    <thead><tr><th>Profil</th>${URUTAN_PITA.map((x) => `<th><span class="titik-pita" data-pita="${x}"></span> ${NAMA_PITA[x]}</th>`).join("")}<th>Median cakupan</th></tr></thead>
    <tbody>${sens}</tbody>`;
}

mulai().catch((e) => console.error(e));
