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

/* ------------------------------------------------------------------ */
/* Perbandingan dua daerah                                             */
/* ------------------------------------------------------------------ */

export type InfoBanding = {
  a: Hasil;
  b: Hasil;
  provA: string;
  provB: string;
  gajiPasA: number;
  gajiPasB: number;
  profil: Profil;
  situs: string;
};

function selisih(x: number): string {
  if (Math.round(x) === 0) return "0";
  return (x > 0 ? "+" : "−") + angka(Math.abs(x));
}

function persenUbah(dari: number, ke: number): string {
  const v = Math.round(((ke - dari) / dari) * 100);
  return `${v > 0 ? "naik" : v < 0 ? "turun" : "tetap"}${v === 0 ? "" : ` ${Math.abs(v)}%`}`;
}

export function htmlBanding(i: InfoBanding): string {
  const { a, b } = i;
  const baris = (label: string, x: number, y: number, kelas = "", balik = false) => {
    const d = y - x;
    // Untuk biaya, selisih positif itu kabar buruk; untuk pemasukan dan sisa sebaliknya.
    const arah = Math.round(d) === 0 ? "" : (d > 0) !== balik ? "baik" : "buruk";
    const n = (v: number) => (v < 0 ? "−" : "") + angka(Math.abs(v));
    return `<tr class="${kelas}"><th scope="row">${esc(label)}</th><td>${n(x)}</td><td>${n(y)}</td><td class="${arah}">${selisih(d)}</td></tr>`;
  };
  const kategori = a.biaya.map((x) => {
    const y = b.biaya.find((z) => z.id === x.id)?.nilai ?? 0;
    return baris(x.nama, x.nilai, y, "", true);
  });
  const pindah = `Pindah dari <b>${esc(a.daerah.nama)}</b> ke <b>${esc(b.daerah.nama)}</b>: pemasukan ${persenUbah(a.pendapatan.diterima, b.pendapatan.diterima)}, biaya hidup ${persenUbah(a.totalBiaya, b.totalBiaya)}.`;
  const kepala = (h: Hasil, prov: string) => `
    <div class="banding-daerah">
      <p class="banding-nama">${esc(h.daerah.nama)}</p>
      <p class="banding-prov">${esc(prov)}</p>
      <p class="banding-sisa" data-pita="${h.pita}">${h.sisa < 0 ? "−" : "+"}${rupiahRingkas(Math.abs(h.sisa))}</p>
      <p class="struk-pita"><span class="titik-pita" data-pita="${h.pita}"></span>${NAMA_PITA[h.pita]} · ${persen(h.cakupan)}</p>
    </div>`;
  return `
  <article class="struk banding">
    <header class="struk-kepala">
      <p class="struk-toko">UMR · Perbandingan</p>
      <div class="banding-dua">${kepala(a, i.provA)}<span class="banding-vs" aria-hidden="true">vs</span>${kepala(b, i.provB)}</div>
      <p class="struk-meta">${esc(profilTeks(i.profil))}</p>
    </header>
    <p class="banding-kalimat">${pindah}</p>
    <table class="banding-tabel">
      <thead><tr><th></th><th scope="col">${esc(singkat(a.daerah.nama))}</th><th scope="col">${esc(singkat(b.daerah.nama))}</th><th scope="col">Selisih</th></tr></thead>
      <tbody>
        ${baris("Diterima", a.pendapatan.diterima, b.pendapatan.diterima, "tebal")}
        ${kategori.join("")}
        ${baris("Total biaya", a.totalBiaya, b.totalBiaya, "tebal", true)}
        ${baris(a.sisa < 0 && b.sisa < 0 ? "Kurang" : "Sisa", a.sisa, b.sisa, "tebal hasil")}
        ${baris("Gaji kotor biar pas", i.gajiPasA, i.gajiPasB, "", true)}
      </tbody>
    </table>
    <footer class="struk-kaki"><p class="struk-situs">${esc(i.situs)}</p></footer>
  </article>`;
}

/** "Kab. Bandung Barat" -> "Bandung Barat", "Kota Yogyakarta" -> "Yogyakarta" untuk kepala kolom. */
function singkat(nama: string): string {
  return nama.replace(/^(Kab\.|Kota) /, "");
}

/* ------------------------------------------------------------------ */
/* Kartu story 9:16                                                    */
/* ------------------------------------------------------------------ */

export function htmlStory(i: InfoStruk): string {
  const h = i.hasil;
  const kurang = h.sisa < 0;
  const maks = Math.max(h.pendapatan.diterima, h.totalBiaya);
  const lebar = (x: number) => `${Math.max(4, (x / maks) * 100).toFixed(1)}%`;
  const terbesar = [...h.biaya].sort((x, y) => y.nilai - x.nilai).slice(0, 4);
  return `
  <div class="story" data-pita="${h.pita}">
    <p class="story-merek">UMR</p>
    <p class="story-kicker">Struk bulanan · ${esc(profilTeks(i.profil))}</p>
    <h2 class="story-nama">${esc(h.daerah.nama)}</h2>
    <p class="story-prov">${esc(i.provinsi)}</p>
    <div class="story-hasil">
      <p class="story-label">${kurang ? "Kurang" : "Sisa"} tiap bulan</p>
      <p class="story-angka">${rupiahRingkas(Math.abs(h.sisa))}</p>
      <p class="story-pita"><span class="titik-pita" data-pita="${h.pita}"></span>${NAMA_PITA[h.pita]} · cakupan ${persen(h.cakupan)}</p>
    </div>
    <div class="story-batang">
      <p><span>Diterima</span><b>${rupiahRingkas(h.pendapatan.diterima)}</b></p>
      <div class="story-bar"><i class="masuk" style="width:${lebar(h.pendapatan.diterima)}"></i></div>
      <p><span>Biaya hidup</span><b>${rupiahRingkas(h.totalBiaya)}</b></p>
      <div class="story-bar"><i class="keluar" style="width:${lebar(h.totalBiaya)}"></i></div>
    </div>
    <ul class="story-pos">${terbesar.map((b) => `<li><span>${esc(b.nama)}</span><b>${rupiahRingkas(b.nilai)}</b></li>`).join("")}</ul>
    <p class="story-butuh">Biar pas, perlu gaji <b>${rupiahRingkas(i.gajiPas)}</b></p>
    <p class="story-ajak">Daerahmu warna apa?<br/><b>${esc(i.situs)}</b></p>
  </div>`;
}

/** Render potongan HTML di luar layar, jadikan PNG, lalu bagikan atau unduh. */
export async function bagikanHtml(
  html: string,
  nama: string,
  ukuran: { lebar: number; tinggi?: number; rasio: number; latar: string },
): Promise<"dibagikan" | "diunduh"> {
  const wadah = document.createElement("div");
  wadah.className = "panggung";
  wadah.style.width = `${ukuran.lebar}px`;
  wadah.innerHTML = html;
  document.body.append(wadah);
  try {
    await document.fonts.ready;
    const el = wadah.firstElementChild as HTMLElement;
    if (ukuran.tinggi) el.style.height = `${ukuran.tinggi}px`;
    return await bagikanGambar(el, nama, ukuran.rasio, ukuran.latar);
  } finally {
    wadah.remove();
  }
}

/** Simpan elemen sebagai PNG lalu bagikan (Web Share) atau unduh. */
export async function bagikanGambar(
  el: HTMLElement,
  nama: string,
  rasio = 2,
  latar = "#fffdf7",
): Promise<"dibagikan" | "diunduh"> {
  const blob = await toBlob(el, {
    pixelRatio: rasio,
    backgroundColor: latar,
    style: { margin: "0", transform: "none" },
  });
  if (!blob) throw new Error("gagal membuat gambar");
  const berkas = new File([blob], `${nama}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [berkas] })) {
    try {
      await navigator.share({ files: [berkas], title: nama });
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
