import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Dataset,
  type Profil,
  PROFIL_AWAL,
  gajiDibutuhkan,
  hitung,
  pita,
  potongan,
  rincianBiaya,
} from "./model";

const data: Dataset = JSON.parse(readFileSync("public/data/daerah.json", "utf-8"));
const peta = new Map(data.daerah.map((d) => [d.id, d]));
const cari = (id: string) => peta.get(id);
const ambil = (id: string) => peta.get(id)!;

function sebaran(p: Profil) {
  const n = { longgar: 0, pas: 0, mepet: 0, kurang: 0 };
  for (const d of data.daerah) n[hitung(d, p, data, cari).pita]++;
  return n;
}

describe("dataset", () => {
  it("berisi 514 daerah dengan upah dan garis kemiskinan", () => {
    expect(data.daerah).toHaveLength(514);
    expect(data.provinsi).toHaveLength(38);
    for (const d of data.daerah) {
      expect(d.upah).toBeGreaterThan(2_000_000);
      expect(d.gk).toBeGreaterThan(300_000);
    }
  });

  it("memakai angka resmi untuk daerah yang dikenal", () => {
    expect(ambil("kota-bekasi").upah).toBe(5_999_443);
    expect(ambil("kota-yogyakarta").upah).toBe(2_827_593);
    expect(ambil("kota-jakarta-selatan")).toMatchObject({ upah: 5_729_876, jenisUpah: "UMP" });
    expect(ambil("kab-pangandaran").jenisUpah).toBe("UMK");
  });
});

describe("potongan gaji", () => {
  it("tidak ada PPh 21 di bawah PTKP", () => {
    const p = potongan(3_000_000, false, 0);
    expect(p.pph).toBe(0);
    expect(p.bpjs).toBe(120_000);
    expect(p.bersih).toBe(2_880_000);
  });

  it("menghitung PPh 21 tahunan dengan biaya jabatan dan iuran pensiun", () => {
    // Bruto setahun 120 jt, biaya jabatan 6 jt, JHT+JP 3,6 jt, PTKP TK/0 54 jt
    // -> PKP 56,4 jt × 5% = 2,82 jt setahun = 235 rb sebulan.
    expect(potongan(10_000_000, false, 0).pph).toBe(235_000);
    // K/2 menaikkan PTKP 13,5 jt -> PKP 42,9 jt -> 178.750 sebulan.
    expect(potongan(10_000_000, true, 2).pph).toBe(178_750);
  });

  it("membatasi dasar iuran JP dan BPJS Kesehatan", () => {
    const p = potongan(20_000_000, false, 0);
    expect(p.bpjs).toBe(400_000 + 105_474 + 120_000);
  });
});

describe("biaya hidup", () => {
  const jaksel = ambil("kota-jakarta-selatan");
  it("lebih mahal untuk keluarga dan daerah berharga tinggi", () => {
    const total = (p: Profil, id = jaksel.id) =>
      rincianBiaya(ambil(id), p, data.gkNasional).reduce((s, b) => s + b.nilai, 0);
    const lajang = total(PROFIL_AWAL);
    const keluarga = total({ ...PROFIL_AWAL, rumah: "keluarga", anak: 2 });
    expect(keluarga).toBeGreaterThan(lajang * 2);
    expect(total(PROFIL_AWAL)).toBeGreaterThan(total(PROFIL_AWAL, "kab-pacitan"));
    expect(total({ ...PROFIL_AWAL, gaya: "hemat" })).toBeLessThan(lajang);
  });

  it("tanpa tabungan tidak ada baris tabungan", () => {
    const b = rincianBiaya(jaksel, { ...PROFIL_AWAL, tabungan: false }, data.gkNasional);
    expect(b.find((x) => x.id === "tabungan")).toBeUndefined();
    expect(b.find((x) => x.id === "anak")).toBeUndefined();
  });
});

describe("pita dan hasil", () => {
  it("ambang tetap", () => {
    expect(pita(1.2)).toBe("longgar");
    expect(pita(1.19)).toBe("pas");
    expect(pita(1)).toBe("pas");
    expect(pita(0.8)).toBe("mepet");
    expect(pita(0.79)).toBe("kurang");
  });

  it("mode upah kotaku membawa upah asal ke daerah tujuan", () => {
    const p: Profil = { ...PROFIL_AWAL, mode: "kota", asal: "kota-jakarta-selatan" };
    const h = hitung(ambil("kota-yogyakarta"), p, data, cari);
    expect(h.pendapatan.utama).toBe(5_729_876);
    expect(h.sisa).toBeGreaterThan(0);
  });

  it("pasangan bekerja menambah satu upah minimum daerah", () => {
    const d = ambil("kab-sleman");
    const p: Profil = { ...PROFIL_AWAL, rumah: "keluarga", anak: 2, bersih: false };
    const tanpa = hitung(d, p, data, cari);
    const dengan = hitung(d, { ...p, pasanganKerja: true }, data, cari);
    expect(dengan.pendapatan.diterima - tanpa.pendapatan.diterima).toBe(d.upah);
  });

  it("gaji yang dibutuhkan tepat menutup biaya", () => {
    const d = ambil("kota-surabaya");
    const g = gajiDibutuhkan(d, PROFIL_AWAL, data, cari);
    const h = hitung(d, { ...PROFIL_AWAL, mode: "gaji", gaji: g }, data, cari);
    expect(h.cakupan).toBeGreaterThanOrEqual(1);
    const kurang = hitung(d, { ...PROFIL_AWAL, mode: "gaji", gaji: g - 20_000 }, data, cari);
    expect(kurang.cakupan).toBeLessThan(1);
  });

  it("sebaran pita untuk profil awal (cetak untuk catatan metode)", () => {
    const profil: [string, Profil][] = [
      ["awal", PROFIL_AWAL],
      ["kotor", { ...PROFIL_AWAL, bersih: false }],
      ["hemat tanpa tabungan", { ...PROFIL_AWAL, gaya: "hemat", tabungan: false }],
      ["kontrakan", { ...PROFIL_AWAL, hunian: "kontrakan" }],
      ["gaji 3 jt", { ...PROFIL_AWAL, mode: "gaji", gaji: 3_000_000 }],
      ["keluarga 2 anak", { ...PROFIL_AWAL, rumah: "keluarga", anak: 2 }],
      ["keluarga 2 anak, pasangan kerja", { ...PROFIL_AWAL, rumah: "keluarga", anak: 2, pasanganKerja: true }],
    ];
    for (const [nama, p] of profil) {
      const n = sebaran(p);
      console.log(nama.padEnd(32), JSON.stringify(n));
      expect(n.longgar + n.pas + n.mepet + n.kurang).toBe(514);
    }
  });
});
