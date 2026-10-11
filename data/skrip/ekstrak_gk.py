"""Ekstrak Tabel 2.1 (garis kemiskinan per kabupaten/kota) dari publikasi BPS
"Data dan Informasi Kemiskinan Kabupaten/Kota Tahun 2025" (No. 04300.25011).

Pemakaian:
    python data/skrip/ekstrak_gk.py path/ke/publikasi.pdf

Keluaran: data/sumber/garis_kemiskinan_2025.csv
Butuh pdfplumber. PDF tidak disimpan di repo (27 MB); unduh dari
https://www.bps.go.id/id/publication/2025/11/28/f7534097ff9c717e794cd6e1
"""
import csv
import re
import sys
from pathlib import Path

import pdfplumber

AKAR = Path(__file__).resolve().parents[1]
KELUAR = AKAR / "sumber" / "garis_kemiskinan_2025.csv"

# Baris data: "12 Nama Daerah 21,47 13,30 1,965 0,413 525.947"
BARIS = re.compile(
    r"^(?:(\d+)\s+)?(.+?)\s+([\d.]+,\d+)\s+([\d.]+,\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s+([\d.]+)$"
)


def sambung(a: str, b: str) -> str:
    """Gabung potongan nama; "Kepu-" + "lauan" -> "Kepulauan"."""
    return a[:-1] + b if a.endswith("-") else f"{a} {b}"


def angka(s: str) -> float:
    return float(s.replace(".", "").replace(",", "."))


def main(pdf_path: str) -> None:
    pdf = pdfplumber.open(pdf_path)
    teks = []
    # Tabel 2.1 ada di halaman 25–45 (indeks 24–44). Watermark memakai Arial,
    # isi tabel memakai Segoe UI, jadi saring berdasarkan font.
    for i in range(24, 46):
        hal = pdf.pages[i].filter(
            lambda o: o.get("object_type") != "char" or "Segoe" in o.get("fontname", "")
        )
        t = hal.extract_text() or ""
        if i > 24 and "Lanjutan Tabel 2.1" not in t:
            break
        teks.append(t)
    baris = "\n".join(teks).split("\n")

    hasil, tertunda = [], []
    nomor_tunda = None
    for b in baris:
        b = b.strip()
        m = BARIS.match(b)
        if not m:
            # Nama yang terbelah dua baris: "Ogan Komering Ulu" / "8 35,49 ..." / "Selatan"
            if re.match(r"^[A-Za-z][A-Za-z .'-]*$", b) and not b.startswith(("Lanjutan", "Tabel", "Menurut", "Jumlah", "Persentase", "Penduduk", "Miskin", "Kemiskinan", "Data dan")):
                tertunda.append(b)
            continue
        no, nama = m.group(1), m.group(2)
        if re.fullmatch(r"\d+", nama):
            # baris "8 35,49 ..." tanpa nama; nama ada di baris sebelum & sesudah
            no, nama = nama, None
        rek = {
            "nomor": no,
            "nama": nama,
            "penduduk_miskin_ribu": angka(m.group(3)),
            "persen_miskin": angka(m.group(4)),
            "p1": angka(m.group(5)),
            "p2": angka(m.group(6)),
            "garis_kemiskinan": int(m.group(7).replace(".", "")),
        }
        if nama is None:
            # Dua nama terbelah berurutan: baris pertama di antrean adalah ekor
            # nama sebelumnya, sisanya awalan nama ini.
            if nomor_tunda is not None and tertunda:
                nomor_tunda["nama"] = sambung(nomor_tunda["nama"], tertunda.pop(0))
            rek["nama"] = " ".join(tertunda)
            tertunda = []
            nomor_tunda = rek
        else:
            if nomor_tunda is not None and tertunda:
                nomor_tunda["nama"] = sambung(nomor_tunda["nama"], " ".join(tertunda))
            nomor_tunda = None
            tertunda = []
        hasil.append(rek)
    if nomor_tunda is not None and tertunda:
        nomor_tunda["nama"] = sambung(nomor_tunda["nama"], " ".join(tertunda))

    # Baris tanpa nomor = subtotal provinsi; tempelkan provinsi ke daerah di atasnya.
    keluaran, antre = [], []
    for r in hasil:
        if r["nomor"] is None:
            for d in antre:
                d["provinsi"] = r["nama"]
            keluaran.extend(antre)
            antre = []
            if r["nama"] == "Indonesia":
                keluaran.append({**r, "provinsi": "Indonesia", "nomor": 0})
        else:
            antre.append(r)
    kolom = ["provinsi", "nomor", "nama", "garis_kemiskinan", "persen_miskin", "penduduk_miskin_ribu", "p1", "p2"]
    with open(KELUAR, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=kolom, extrasaction="ignore")
        w.writeheader()
        w.writerows(keluaran)
    daerah = [r for r in keluaran if r["provinsi"] != "Indonesia"]
    print(f"{len(daerah)} kabupaten/kota, {len({r['provinsi'] for r in daerah})} provinsi -> {KELUAR}")


if __name__ == "__main__":
    main(sys.argv[1])
