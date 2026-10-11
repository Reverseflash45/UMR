// Model hitungan: pendapatan bersih, biaya hidup per daerah, dan pita cakupan.
// Semua angka dalam rupiah per bulan. Penjelasan tiap asumsi ada di metode.html.

export type Daerah = {
  id: string;
  nama: string;
  prov: number;
  kota: boolean;
  upah: number;
  jenisUpah: "UMK" | "UMP";
  gk: number;
  miskin: number;
};

export type Provinsi = { nama: string; ump: number; sumberUpah: string | null };

export type Dataset = {
  versi: string;
  gkNasional: number;
  provinsi: Provinsi[];
  daerah: Daerah[];
};

export type ModePendapatan = "daerah" | "gaji" | "kota";
export type Rumah = "lajang" | "pasangan" | "keluarga";
export type Hunian = "kos" | "kontrakan" | "kpr";
export type Transportasi = "motor" | "umum" | "ojol";
export type GayaHidup = "hemat" | "standar" | "longgar";

export type Profil = {
  mode: ModePendapatan;
  /** Gaji sendiri (mode "gaji"). */
  gaji: number;
  /** id daerah asal (mode "kota"): upah daerah ini dibawa ke mana pun. */
  asal: string;
  rumah: Rumah;
  anak: number;
  pasanganKerja: boolean;
  hunian: Hunian;
  transportasi: Transportasi;
  gaya: GayaHidup;
  tabungan: boolean;
  /** true = hitung dengan gaji bersih (setelah BPJS dan PPh 21). */
  bersih: boolean;
};

export const PROFIL_AWAL: Profil = {
  mode: "daerah",
  gaji: 3_000_000,
  asal: "kota-jakarta-selatan",
  rumah: "lajang",
  anak: 0,
  pasanganKerja: false,
  hunian: "kos",
  transportasi: "motor",
  gaya: "standar",
  tabungan: true,
  bersih: true,
};

/* ------------------------------------------------------------------ */
/* Biaya hidup                                                         */
/* ------------------------------------------------------------------ */

export type IdKategori =
  | "hunian"
  | "makan"
  | "transportasi"
  | "utilitas"
  | "komunikasi"
  | "kesehatan"
  | "kebutuhan"
  | "pakaian"
  | "sosial"
  | "anak"
  | "tabungan";

export type Kategori = {
  id: IdKategori;
  nama: string;
  /** Biaya acuan: lajang, gaya standar, di daerah berharga rata-rata nasional. */
  dasar: number;
  /** Kepekaan terhadap indeks harga daerah: biaya = dasar × indeks^elastisitas. */
  elastisitas: number;
  /** Pengali bila ada pasangan. */
  pasangan: number;
  /** Tambahan pengali per anak. */
  perAnak: number;
};

export const KATEGORI: Kategori[] = [
  { id: "hunian", nama: "Sewa hunian", dasar: 800_000, elastisitas: 1.5, pasangan: 1.2, perAnak: 0.1 },
  { id: "makan", nama: "Makan & minum", dasar: 1_350_000, elastisitas: 1.0, pasangan: 1.8, perAnak: 0.45 },
  { id: "transportasi", nama: "Transportasi", dasar: 400_000, elastisitas: 0.4, pasangan: 1.6, perAnak: 0.1 },
  { id: "utilitas", nama: "Listrik, air & gas", dasar: 200_000, elastisitas: 0.3, pasangan: 1.4, perAnak: 0.15 },
  { id: "komunikasi", nama: "Pulsa & internet", dasar: 110_000, elastisitas: 0, pasangan: 1.8, perAnak: 0.2 },
  { id: "kesehatan", nama: "Kesehatan & obat", dasar: 80_000, elastisitas: 0.4, pasangan: 2, perAnak: 0.6 },
  { id: "kebutuhan", nama: "Perlengkapan diri & rumah", dasar: 200_000, elastisitas: 0.8, pasangan: 1.6, perAnak: 0.4 },
  { id: "pakaian", nama: "Pakaian", dasar: 100_000, elastisitas: 0.6, pasangan: 2, perAnak: 0.6 },
  { id: "sosial", nama: "Sosial & rekreasi", dasar: 250_000, elastisitas: 0.8, pasangan: 1.5, perAnak: 0.2 },
  // Biaya per anak (sekolah negeri atau penitipan); nol tanpa anak.
  { id: "anak", nama: "Sekolah & pengasuhan anak", dasar: 400_000, elastisitas: 0.7, pasangan: 0, perAnak: 1 },
];

export const PORSI_TABUNGAN = 0.1;

export const PENGALI_HUNIAN: Record<Hunian, number> = { kos: 1, kontrakan: 1.55, kpr: 2 };

/** Biaya acuan transportasi per moda (menggantikan dasar kategori). */
export const TRANSPORTASI: Record<Transportasi, { dasar: number; elastisitas: number }> = {
  motor: { dasar: 400_000, elastisitas: 0.4 },
  umum: { dasar: 330_000, elastisitas: 0.6 },
  ojol: { dasar: 950_000, elastisitas: 0.6 },
};

export const GAYA: Record<GayaHidup, Partial<Record<IdKategori, number>>> = {
  hemat: { makan: 0.8, komunikasi: 0.8, kebutuhan: 0.85, pakaian: 0.7, sosial: 0.5 },
  standar: {},
  longgar: { makan: 1.3, komunikasi: 1.3, kebutuhan: 1.2, pakaian: 1.5, sosial: 1.8 },
};

/** Indeks harga daerah relatif terhadap rata-rata nasional (1 = rata-rata). */
export function indeksHarga(d: Daerah, gkNasional: number): number {
  return d.gk / gkNasional;
}

export type BarisBiaya = { id: IdKategori; nama: string; nilai: number };

export function rincianBiaya(d: Daerah, p: Profil, gkNasional: number): BarisBiaya[] {
  const indeks = indeksHarga(d, gkNasional);
  const adaPasangan = p.rumah !== "lajang";
  const anak = p.rumah === "keluarga" ? p.anak : 0;
  const gaya = GAYA[p.gaya];
  const baris: BarisBiaya[] = [];
  for (const k of KATEGORI) {
    let dasar = k.dasar;
    let elastisitas = k.elastisitas;
    if (k.id === "transportasi") {
      ({ dasar, elastisitas } = TRANSPORTASI[p.transportasi]);
    }
    if (k.id === "hunian") dasar *= PENGALI_HUNIAN[p.hunian];
    const orang = k.id === "anak" ? anak : (adaPasangan ? k.pasangan : 1) + anak * k.perAnak;
    if (orang === 0) continue;
    const nilai = dasar * Math.pow(indeks, elastisitas) * orang * (gaya[k.id] ?? 1);
    baris.push({ id: k.id, nama: k.nama, nilai: bulat(nilai) });
  }
  if (p.tabungan) {
    const sub = baris.reduce((s, b) => s + b.nilai, 0);
    baris.push({ id: "tabungan", nama: "Tabungan & dana darurat", nilai: bulat(sub * PORSI_TABUNGAN) });
  }
  return baris;
}

/* ------------------------------------------------------------------ */
/* Pendapatan                                                          */
/* ------------------------------------------------------------------ */

// Iuran BPJS yang dipotong dari gaji pekerja.
export const JHT = 0.02; // Jaminan Hari Tua
export const JP = 0.01; // Jaminan Pensiun
export const BATAS_UPAH_JP = 10_547_400; // batas atas upah JP 2025
export const KES = 0.01; // BPJS Kesehatan
export const BATAS_UPAH_KES = 12_000_000;

// PPh 21 tahunan (UU HPP): PTKP dan tarif Pasal 17.
export const PTKP_DIRI = 54_000_000;
export const PTKP_KAWIN = 4_500_000;
export const PTKP_TANGGUNGAN = 4_500_000;
const LAPIS_PAJAK: [number, number][] = [
  [60_000_000, 0.05],
  [250_000_000, 0.15],
  [500_000_000, 0.25],
  [5_000_000_000, 0.3],
  [Infinity, 0.35],
];

export type Potongan = { bpjs: number; pph: number; bersih: number };

/** Potongan bulanan untuk gaji kotor bulanan tetap sepanjang tahun. */
export function potongan(kotor: number, kawin: boolean, tanggungan: number): Potongan {
  const jht = kotor * JHT;
  const jp = Math.min(kotor, BATAS_UPAH_JP) * JP;
  const kes = Math.min(kotor, BATAS_UPAH_KES) * KES;
  const bpjs = jht + jp + kes;

  const brutoSetahun = kotor * 12;
  const biayaJabatan = Math.min(brutoSetahun * 0.05, 6_000_000);
  const netoSetahun = brutoSetahun - biayaJabatan - (jht + jp) * 12;
  const ptkp = PTKP_DIRI + (kawin ? PTKP_KAWIN : 0) + Math.min(tanggungan, 3) * PTKP_TANGGUNGAN;
  const pkp = Math.max(0, Math.floor((netoSetahun - ptkp) / 1000) * 1000);
  let pajak = 0;
  let bawah = 0;
  for (const [atas, tarif] of LAPIS_PAJAK) {
    if (pkp <= bawah) break;
    pajak += (Math.min(pkp, atas) - bawah) * tarif;
    bawah = atas;
  }
  const pph = pajak / 12;
  return { bpjs: bulat(bpjs), pph: bulat(pph), bersih: bulat(kotor - bpjs - pph) };
}

export type Pendapatan = {
  utama: number;
  sumberUtama: string;
  pasangan: number;
  bpjs: number;
  pph: number;
  diterima: number;
};

export function upahDaerah(d: Daerah): number {
  return d.upah;
}

export function pendapatan(d: Daerah, p: Profil, cari: (id: string) => Daerah | undefined): Pendapatan {
  let utama: number;
  let sumberUtama: string;
  if (p.mode === "gaji") {
    utama = p.gaji;
    sumberUtama = "Gajimu";
  } else if (p.mode === "kota") {
    const asal = cari(p.asal) ?? d;
    utama = asal.upah;
    sumberUtama = `${asal.jenisUpah} ${asal.nama}`;
  } else {
    utama = d.upah;
    sumberUtama = `${d.jenisUpah} ${d.nama}`;
  }
  const adaPasangan = p.rumah !== "lajang";
  const anak = p.rumah === "keluarga" ? p.anak : 0;
  // Pasangan yang bekerja diasumsikan bergaji upah minimum daerah tempat tinggal.
  const pasangan = adaPasangan && p.pasanganKerja ? d.upah : 0;
  let bpjs = 0;
  let pph = 0;
  if (p.bersih) {
    // Tanggungan anak dicatat pada pencari nafkah utama.
    const a = potongan(utama, adaPasangan && !p.pasanganKerja, anak);
    bpjs += a.bpjs;
    pph += a.pph;
    if (pasangan > 0) {
      const b = potongan(pasangan, false, 0);
      bpjs += b.bpjs;
      pph += b.pph;
    }
  }
  return { utama, sumberUtama, pasangan, bpjs, pph, diterima: utama + pasangan - bpjs - pph };
}

/* ------------------------------------------------------------------ */
/* Pita cakupan                                                        */
/* ------------------------------------------------------------------ */

export type Pita = "longgar" | "pas" | "mepet" | "kurang";
export const URUTAN_PITA: Pita[] = ["longgar", "pas", "mepet", "kurang"];

/** Ambang tetap, tidak disetel agar peta tampak lebih hijau atau merah. */
export const AMBANG = { longgar: 1.2, pas: 1.0, mepet: 0.8 } as const;

export const NAMA_PITA: Record<Pita, string> = {
  longgar: "Longgar",
  pas: "Pas",
  mepet: "Mepet",
  kurang: "Kurang",
};

export const ARTI_PITA: Record<Pita, string> = {
  longgar: "sisa ≥ 20% dari biaya",
  pas: "tertutup, sisa tipis",
  mepet: "kurang hingga 20%",
  kurang: "kurang lebih dari 20%",
};

export function pita(cakupan: number): Pita {
  if (cakupan >= AMBANG.longgar) return "longgar";
  if (cakupan >= AMBANG.pas) return "pas";
  if (cakupan >= AMBANG.mepet) return "mepet";
  return "kurang";
}

export type Hasil = {
  daerah: Daerah;
  pendapatan: Pendapatan;
  biaya: BarisBiaya[];
  totalBiaya: number;
  sisa: number;
  cakupan: number;
  pita: Pita;
  indeks: number;
};

export function hitung(d: Daerah, p: Profil, data: Dataset, cari: (id: string) => Daerah | undefined): Hasil {
  const biaya = rincianBiaya(d, p, data.gkNasional);
  const totalBiaya = biaya.reduce((s, b) => s + b.nilai, 0);
  const pend = pendapatan(d, p, cari);
  const cakupan = pend.diterima / totalBiaya;
  return {
    daerah: d,
    pendapatan: pend,
    biaya,
    totalBiaya,
    sisa: pend.diterima - totalBiaya,
    cakupan,
    pita: pita(cakupan),
    indeks: indeksHarga(d, data.gkNasional),
  };
}

/**
 * Gaji kotor (pencari nafkah utama) yang dibutuhkan supaya biaya tertutup
 * dengan cakupan tertentu, dengan profil dan pasangan yang sama.
 */
export function gajiDibutuhkan(
  d: Daerah,
  p: Profil,
  data: Dataset,
  cari: (id: string) => Daerah | undefined,
  target = 1,
): number {
  const total = rincianBiaya(d, p, data.gkNasional).reduce((s, b) => s + b.nilai, 0) * target;
  const coba = { ...p, mode: "gaji" as const };
  let bawah = 0;
  let atas = 200_000_000;
  for (let i = 0; i < 50; i++) {
    const tengah = (bawah + atas) / 2;
    coba.gaji = tengah;
    if (pendapatan(d, coba, cari).diterima >= total) atas = tengah;
    else bawah = tengah;
  }
  return Math.ceil(atas / 10_000) * 10_000;
}

function bulat(x: number): number {
  return Math.round(x);
}

/* ------------------------------------------------------------------ */
/* Kelas untuk peta "gaji yang dibutuhkan"                             */
/* ------------------------------------------------------------------ */

/** Pembulatan "enak dibaca": kelipatan 100 rb di bawah 5 jt, 250 rb di atasnya. */
export function bulatRapi(x: number): number {
  const langkah = x < 5_000_000 ? 100_000 : x < 10_000_000 ? 250_000 : 500_000;
  return Math.round(x / langkah) * langkah;
}

/**
 * Batas kelas kuantil (n kelas -> n-1 batas), dibulatkan rapi dan dijamin naik.
 * Nilai v masuk kelas i bila batas[i-1] <= v < batas[i].
 */
export function batasKuantil(nilai: number[], n = 5): number[] {
  const urut = [...nilai].sort((a, b) => a - b);
  const batas: number[] = [];
  for (let i = 1; i < n; i++) {
    let b = bulatRapi(urut[Math.floor((i * urut.length) / n)]);
    if (batas.length && b <= batas[batas.length - 1]) b = batas[batas.length - 1] + 100_000;
    batas.push(b);
  }
  return batas;
}

export function kelasDari(v: number, batas: number[]): number {
  let i = 0;
  while (i < batas.length && v >= batas[i]) i++;
  return i;
}
