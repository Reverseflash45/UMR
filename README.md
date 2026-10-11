# UMR — cukup nggak upah minimum di daerahmu?

**Demo: https://umr.raffstw.my.id**

Peta 514 kabupaten/kota yang membandingkan **upah minimum 2026** dengan **estimasi biaya hidup** setempat. Ada tiga cara menghitung pendapatan:

- **Upah daerah**: tiap daerah dihitung dengan UMK-nya sendiri, atau UMP provinsinya kalau daerah itu tidak menetapkan UMK.
- **Gajiku**: gajimu dipakai di semua daerah.
- **Upah kotaku**: upah satu daerah asal dibawa ke daerah mana pun, misalnya bergaji UMP Jakarta tapi tinggal di Jogja.

Profil rumah tangga bisa diatur: lajang, berdua, atau keluarga dengan anak; pasangan ikut bekerja atau tidak; kos, kontrakan, atau KPR; moda transportasi; gaya hidup; tabungan; dan gaji kotor atau bersih (setelah BPJS dan PPh 21).

Ketuk satu daerah untuk membuka **struk bulanannya**: rincian pemasukan dan pengeluaran, sisa atau kurangnya, dan gaji yang dibutuhkan biar pas. Dari struk itu kamu bisa:

- **membagikan kartu story 9:16** (1080×1920) atau menyimpan struknya sebagai gambar;
- **membandingkan dua daerah** berdampingan, dengan selisih tiap pos ("pindah dari Jogja ke Surabaya: pemasukan naik 86%, biaya hidup naik 6%").

Peta punya dua mode warna: **Cukup nggak?** (pita cakupan) dan **Butuh gaji berapa?**, yaitu gaji kotor minimal biar pas di tiap daerah, dibagi lima kelas kuantil.

## Cara menghitung

```
cakupan = pendapatan diterima ÷ biaya hidup bulanan
```

| Pita | Cakupan |
|---|---|
| Longgar | ≥ 120% |
| Pas | 100–119% |
| Mepet | 80–99% |
| Kurang | < 80% |

Biaya hidup adalah model. Keranjang acuan untuk satu orang lajang (sewa, makan, transportasi, utilitas, pulsa, kesehatan, kebutuhan rumah, pakaian, sosial, dan tabungan 10%) dikalikan **indeks harga daerah**, yaitu garis kemiskinan daerah itu dibagi garis kemiskinan nasional, dipangkatkan elastisitas tiap kategori. Semua asumsi, sumber per provinsi, dan uji sensitivitasnya ada di halaman [Metode](metode.html). Tabel di halaman itu dihasilkan langsung dari `src/model.ts`.

## Data

| Data | Sumber |
|---|---|
| UMP 2026 (38 provinsi) | SK gubernur, PP 49/2025 · `data/sumber/ump_2026.txt` |
| UMK 2026 | Rangkuman SK gubernur per provinsi · `data/sumber/umk_2026.txt` (URL sumber per baris) |
| Garis kemiskinan Maret 2025 (514 daerah) | BPS, *Data dan Informasi Kemiskinan Kabupaten/Kota Tahun 2025*, Tabel 2.1 · `data/sumber/garis_kemiskinan_2025.csv` |
| Batas wilayah | [geoBoundaries](https://www.geoboundaries.org) IDN ADM2 (BPS/OCHA), CC BY 3.0 IGO |

Hasilnya: 260 daerah memakai UMK, 254 memakai UMP. Upah berkisar Rp2,33 jt–Rp6 jt, dengan median Rp3,51 jt.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # uji model: potongan gaji, biaya, pita, data
npm run build    # keluaran statis di dist/
```

## Membangun ulang data

```bash
# 1. (opsional) ekstrak ulang garis kemiskinan dari PDF BPS, butuh pdfplumber
python data/skrip/ekstrak_gk.py path/ke/publikasi-kemiskinan-2025.pdf

# 2. gabungkan upah + garis kemiskinan + batas wilayah, lalu sederhanakan peta
npm run data
```

`bangun.py` hanya memakai pustaka standar Python, dan langsung berhenti kalau ada nama daerah yang tidak cocok antar sumber.

## Struktur

```
data/skrip/     ekstrak_gk.py, bangun.py, peta.mjs
data/sumber/    angka mentah yang dikurasi (upah, garis kemiskinan)
public/data/    daerah.json (atribut 514 daerah), peta.json (TopoJSON 215 KB)
src/model.ts    seluruh hitungan: gaji bersih, biaya hidup, pita
src/peta.ts     peta SVG + perbesaran (d3-geo, d3-zoom)
src/struk.ts    struk bulanan + ekspor gambar
src/main.ts     antarmuka; status tersimpan di URL supaya bisa dibagikan
```

Vite + TypeScript tanpa framework UI.

## Batasan

Angka di sini bukan hasil survei primer. Satu angka mewakili satu daerah, garis kemiskinan hanya proksi harga, dan UMK adalah upah minimum, bukan gaji rata-rata. Bukan nasihat keuangan.
