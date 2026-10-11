// Status aplikasi disimpan di URL supaya tautan bisa dibagikan apa adanya.
import {
  type GayaHidup,
  type Hunian,
  type ModePendapatan,
  type Profil,
  PROFIL_AWAL,
  type Rumah,
  type Transportasi,
} from "./model";

export type Urutan = "sisa" | "kurang";

export type Status = {
  profil: Profil;
  /** id daerah yang struknya sedang dibuka. */
  pilih: string | null;
  urutan: Urutan;
};

const MODE: ModePendapatan[] = ["daerah", "gaji", "kota"];
const RUMAH: Rumah[] = ["lajang", "pasangan", "keluarga"];
const HUNIAN: Hunian[] = ["kos", "kontrakan", "kpr"];
const TRANSPORTASI: Transportasi[] = ["motor", "umum", "ojol"];
const GAYA: GayaHidup[] = ["hemat", "standar", "longgar"];

function pilihan<T extends string>(nilai: string | null, daftar: T[], awal: T): T {
  return nilai !== null && (daftar as string[]).includes(nilai) ? (nilai as T) : awal;
}

export const BATAS_GAJI = { min: 1_000_000, max: 25_000_000 };

export function dariUrl(cari: string): Status {
  const q = new URLSearchParams(cari);
  const a = PROFIL_AWAL;
  const gaji = Number(q.get("g"));
  const anak = Number(q.get("a"));
  const rumah = pilihan(q.get("r"), RUMAH, a.rumah);
  return {
    profil: {
      mode: pilihan(q.get("m"), MODE, a.mode),
      gaji: Number.isFinite(gaji) && gaji >= 100_000 && gaji <= 500_000_000 ? Math.round(gaji) : a.gaji,
      asal: q.get("asal") ?? a.asal,
      rumah,
      anak: Number.isInteger(anak) && anak >= 1 && anak <= 5 ? anak : rumah === "keluarga" ? 2 : a.anak,
      pasanganKerja: q.get("pk") === "1",
      hunian: pilihan(q.get("h"), HUNIAN, a.hunian),
      transportasi: pilihan(q.get("t"), TRANSPORTASI, a.transportasi),
      gaya: pilihan(q.get("gh"), GAYA, a.gaya),
      tabungan: q.get("tb") !== "0",
      bersih: q.get("b") !== "0",
    },
    pilih: q.get("d"),
    urutan: q.get("u") === "kurang" ? "kurang" : "sisa",
  };
}

export function keUrl(s: Status): string {
  const p = s.profil;
  const a = PROFIL_AWAL;
  const q = new URLSearchParams();
  if (p.mode !== a.mode) q.set("m", p.mode);
  if (p.mode === "gaji") q.set("g", String(p.gaji));
  if (p.mode === "kota") q.set("asal", p.asal);
  if (p.rumah !== a.rumah) q.set("r", p.rumah);
  if (p.rumah === "keluarga") q.set("a", String(p.anak));
  if (p.rumah !== "lajang" && p.pasanganKerja) q.set("pk", "1");
  if (p.hunian !== a.hunian) q.set("h", p.hunian);
  if (p.transportasi !== a.transportasi) q.set("t", p.transportasi);
  if (p.gaya !== a.gaya) q.set("gh", p.gaya);
  if (!p.tabungan) q.set("tb", "0");
  if (!p.bersih) q.set("b", "0");
  if (s.pilih) q.set("d", s.pilih);
  if (s.urutan !== "sisa") q.set("u", s.urutan);
  const t = q.toString();
  return t ? `?${t}` : location.pathname;
}

/** Slider gaji memakai skala logaritmik: 0..1000 -> Rp1 jt..Rp25 jt. */
export function geserKeGaji(v: number): number {
  const { min, max } = BATAS_GAJI;
  const x = min * Math.pow(max / min, v / 1000);
  const langkah = x < 5_000_000 ? 50_000 : x < 10_000_000 ? 100_000 : 250_000;
  return Math.round(x / langkah) * langkah;
}

export function gajiKeGeser(g: number): number {
  const { min, max } = BATAS_GAJI;
  const v = (Math.log(Math.min(Math.max(g, min), max) / min) / Math.log(max / min)) * 1000;
  return Math.round(v);
}
