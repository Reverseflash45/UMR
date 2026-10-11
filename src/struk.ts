// Struk bulanan satu daerah: pemasukan, pengeluaran, dan sisanya.
import { toBlob } from "html-to-image";
import { angka, persen, rupiah, rupiahRingkas } from "./format";
import { ARTI_PITA, type Hasil, NAMA_PITA, type Profil } from "./model";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function baris(label: string, nilai: string, kelas = ""): string {
  return `<div class="sb ${kelas}"><span>${esc(label)}</span><span class="titik" aria-hidden="true"></span><span class="nilai">${nilai}</span></div>`;
}

export function profilTeks(p: Profil): string {
  const rumah =
    p.rumah === "lajang" ? "Lajang" : p.rumah === "pasangan" ? "Berdua" : `Keluarga, ${p.anak} anak`;
  const kerja = p.rumah !== "lajang" && p.pasanganKerja ? ", pasangan bekerja" : "";
  const hunian = { kos: "kos", kontrakan: "kontrakan", kpr: "cicilan KPR" }[p.hunian];
  return `${rumah}${kerja} · ${hunian} · ${p.gaya}`;
}

export type InfoStruk = {
  hasil: Hasil;
  provinsi: string;
  profil: Profil;
  gajiPas: number;
  situs: string;
};

export function htmlStruk(i: InfoStruk): string {
  const h = i.hasil;
  const d = h.daerah;
  const pend = h.pendapatan;
  const kurang = h.sisa < 0;
  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const potong = pend.bpjs + pend.pph > 0;
  const lebihMahal = h.indeks >= 1;

  return `
  <article class="struk" data-pita="${h.pita}">
    <header class="struk-kepala">
      <p class="struk-toko">UMR · Struk Bulanan</p>
      <h2 class="struk-nama" id="struk-judul">${esc(d.nama)}</h2>
      <p class="struk-prov">${esc(i.provinsi)}</p>
      <p class="struk-meta">${esc(profilTeks(i.profil))}<br/>${tanggal}</p>
    </header>

    <section class="struk-bagian">
      <p class="struk-sub">Pemasukan</p>
      ${baris(pend.sumberUtama.startsWith("Gajimu") ? "Gajimu" : pend.sumberUtama.replace(/^(UMK|UMP) /, "$1 2026 "), angka(pend.utama))}
      ${pend.pasangan > 0 ? baris(`Pasangan (${d.jenisUpah})`, angka(pend.pasangan)) : ""}
      ${potong ? baris("Iuran BPJS (JHT, JP, Kes.)", "−" + angka(pend.bpjs), "minus") : ""}
      ${potong && pend.pph > 0 ? baris("PPh 21", "−" + angka(pend.pph), "minus") : ""}
      ${baris(i.profil.bersih ? "Diterima bersih" : "Diterima (kotor)", angka(pend.diterima), "tebal")}
    </section>

    <section class="struk-bagian">
      <p class="struk-sub">Pengeluaran <span>(estimasi)</span></p>
      ${h.biaya.map((b) => baris(b.nama, angka(b.nilai))).join("")}
      ${baris("Total", angka(h.totalBiaya), "tebal")}
    </section>

    <section class="struk-hasil">
      <p class="struk-hasil-label">${kurang ? "Kurang" : "Sisa"}</p>
      <p class="struk-hasil-angka">${rupiah(Math.abs(h.sisa))}</p>
      <p class="struk-pita"><span class="titik-pita" data-pita="${h.pita}"></span><b>${NAMA_PITA[h.pita]}</b> · cakupan ${persen(h.cakupan)} · ${ARTI_PITA[h.pita]}</p>
      <p class="struk-butuh">${
        kurang ? "Biar pas, perlu gaji kotor" : "Batas pas: gaji kotor"
      } <b>${rupiahRingkas(i.gajiPas)}</b>${i.profil.rumah !== "lajang" && i.profil.pasanganKerja ? " (ditambah gaji pasangan)" : ""}</p>
    </section>

    <footer class="struk-kaki">
      <p>Harga di sini ${lebihMahal ? "" : "hanya "}<b>${h.indeks.toFixed(2).replace(".", ",")}×</b> rata-rata nasional (garis kemiskinan BPS, Mar 2025: ${rupiah(d.gk)}/kapita).</p>
      <p>${d.jenisUpah === "UMK" ? "Daerah ini menetapkan UMK 2026." : "Daerah ini tidak menetapkan UMK; memakai UMP provinsi."}</p>
      <p class="struk-situs">${esc(i.situs)}</p>
    </footer>
  </article>`;
}

/** Simpan struk sebagai PNG lalu bagikan (Web Share) atau unduh. */
export async function bagikanStruk(el: HTMLElement, nama: string): Promise<"dibagikan" | "diunduh"> {
  const blob = await toBlob(el, {
    pixelRatio: 2,
    backgroundColor: "#fffdf7",
    style: { margin: "0", transform: "none" },
  });
  if (!blob) throw new Error("gagal membuat gambar");
  const berkas = new File([blob], `struk-${nama}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [berkas] })) {
    try {
      await navigator.share({ files: [berkas], title: `Struk bulanan ${nama}` });
      return "dibagikan";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "dibagikan";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = berkas.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "diunduh";
}
