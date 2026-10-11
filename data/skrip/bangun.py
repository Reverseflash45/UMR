"""Gabungkan sumber mentah menjadi satu dataset 514 kabupaten/kota.

Masukan (data/sumber/):
  garis_kemiskinan_2025.csv  hasil ekstrak_gk.py dari publikasi BPS
  ump_2026.txt, umk_2026.txt upah minimum 2026
  data/mentah/adm2.geojson   batas wilayah geoBoundaries IDN ADM2 (diunduh otomatis)

Keluaran:
  public/data/daerah.json    atribut tiap daerah untuk aplikasi
  data/antara/adm2_id.geojson geometri + id, bahan peta.mjs

Hanya memakai pustaka standar Python.
"""
import csv
import json
import re
import unicodedata
import urllib.request
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
SUMBER = AKAR / "data" / "sumber"
MENTAH = AKAR / "data" / "mentah"
ANTARA = AKAR / "data" / "antara"
PUBLIK = AKAR / "public" / "data"

URL_ADM2 = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/"
    "gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson"
)

# Garis kemiskinan nasional Maret 2025 (Rp/kapita/bulan), Berita Resmi Statistik BPS.
GK_NASIONAL = 609_160

# Nama provinsi di tabel BPS yang berbeda dari daftar UMP.
PROVINSI_ALIAS = {"Bangka Belitung": "Kepulauan Bangka Belitung"}

# Ejaan nama daerah yang berbeda antar sumber -> ejaan BPS (sudah dinormalkan).
NAMA_ALIAS = {
    "kepulauansiautagulandangbiaro": "kepulauansitaro",
    "siautagulandangbiaro": "kepulauansitaro",
    "tobasamosir": "toba",
    "mamujuutara": "pasangkayu",
    "malukutenggarabarat": "kepulauantanimbar",
    "mahakamhulu": "mahakamulu",
}

# Fitur geoBoundaries yang bukan kabupaten/kota (danau, waduk, hutan).
BUKAN_DAERAH = {"Danau", "Danau Toba", "Hutan", "Waduk Cirata", "Wadung Kedungombo"}


def kunci(nama: str) -> str:
    """Normalisasi nama: huruf kecil, tanpa awalan Kabupaten, tanpa spasi/tanda baca.
    Awalan "Kota" dipertahankan karena Kota X dan Kabupaten X adalah daerah berbeda."""
    s = unicodedata.normalize("NFKD", nama).lower().strip()
    s = re.sub(r"^(kabupaten|kab\.)\s+", "", s)
    kota = s.startswith("kota ")
    if kota:
        s = s[5:]
    s = re.sub(r"[^a-z]", "", s)
    s = NAMA_ALIAS.get(s, s)
    return ("kota:" if kota else "") + s


def slug(nama: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", nama.lower()).strip("-")


def baca_pipa(path: Path) -> list[list[str]]:
    baris = []
    for b in path.read_text(encoding="utf-8").splitlines():
        if b.strip() and not b.startswith("#"):
            baris.append([x.strip() for x in b.split("|")])
    return baris


def main() -> None:
    ANTARA.mkdir(parents=True, exist_ok=True)
    PUBLIK.mkdir(parents=True, exist_ok=True)

    ump = {p: int(v) for p, v in baca_pipa(SUMBER / "ump_2026.txt")}
    assert len(ump) == 38, len(ump)

    gk = list(csv.DictReader(open(SUMBER / "garis_kemiskinan_2025.csv", encoding="utf-8")))
    gk = [r for r in gk if r["provinsi"] != "Indonesia"]
    assert len(gk) == 514, len(gk)

    provinsi = list(dict.fromkeys(PROVINSI_ALIAS.get(r["provinsi"], r["provinsi"]) for r in gk))
    assert set(provinsi) == set(ump), set(provinsi) ^ set(ump)

    daerah, indeks = [], {}
    for r in gk:
        prov = PROVINSI_ALIAS.get(r["provinsi"], r["provinsi"])
        kota = r["nama"].startswith("Kota ")
        nama = r["nama"]
        if not kota:
            # "Pangkajene Dan Kepulauan" -> "Pangkajene dan Kepulauan"
            nama = re.sub(r"\bDan\b", "dan", nama)
        d = {
            "id": slug(("" if kota else "kab ") + nama),
            "nama": nama if kota else f"Kab. {nama}",
            "prov": provinsi.index(prov),
            "kota": kota,
            "upah": ump[prov],
            "jenisUpah": "UMP",
            "gk": int(r["garis_kemiskinan"]),
            "miskin": float(r["persen_miskin"]),
        }
        k = kunci(r["nama"])
        assert k not in indeks, f"nama ganda: {k}"
        indeks[k] = d
        daerah.append(d)
    assert len({d["id"] for d in daerah}) == 514

    # UMK: hanya dicatat sebagai UMK bila nilainya berbeda dari UMP provinsi.
    sumber_umk = {}
    tak_cocok = []
    for prov, nama, nilai, url in baca_pipa(SUMBER / "umk_2026.txt"):
        d = indeks.get(kunci(nama))
        if d is None or provinsi[d["prov"]] != prov:
            tak_cocok.append(f"{prov} | {nama}")
            continue
        nilai = int(nilai)
        if nilai != ump[prov]:
            d["upah"] = nilai
            d["jenisUpah"] = "UMK"
        sumber_umk[prov] = url
    if tak_cocok:
        raise SystemExit("UMK tanpa pasangan:\n  " + "\n  ".join(tak_cocok))

    # Geometri: cocokkan nama geoBoundaries ke daerah BPS.
    path_geo = MENTAH / "adm2.geojson"
    if not path_geo.exists():
        MENTAH.mkdir(parents=True, exist_ok=True)
        print("mengunduh batas wilayah geoBoundaries…")
        urllib.request.urlretrieve(URL_ADM2, path_geo)
    geo = json.loads(path_geo.read_text(encoding="utf-8"))
    fitur, dipakai, gagal = [], set(), []
    for f in geo["features"]:
        n = f["properties"]["shapeName"]
        if n in BUKAN_DAERAH:
            continue
        # geoBoundaries menulis Kabupaten Kotabaru sebagai "Kota Baru".
        k = "kotabaru" if n == "Kota Baru" else kunci(n)
        d = indeks.get(k)
        if d is None:
            gagal.append(n)
            continue
        assert d["id"] not in dipakai, f"geometri ganda untuk {d['id']}"
        dipakai.add(d["id"])
        fitur.append({"type": "Feature", "properties": {"id": d["id"]}, "geometry": f["geometry"]})
    tanpa_geo = [d["nama"] for d in daerah if d["id"] not in dipakai]
    if gagal or tanpa_geo:
        raise SystemExit(f"geometri tak cocok: {gagal}\ndaerah tanpa geometri: {tanpa_geo}")
    (ANTARA / "adm2_id.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": fitur}), encoding="utf-8"
    )

    jumlah_umk = sum(d["jenisUpah"] == "UMK" for d in daerah)
    keluaran = {
        "versi": "2026.1",
        "gkNasional": GK_NASIONAL,
        "provinsi": [{"nama": p, "ump": ump[p], "sumberUpah": sumber_umk.get(p)} for p in provinsi],
        "daerah": daerah,
    }
    (PUBLIK / "daerah.json").write_text(
        json.dumps(keluaran, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    upah = sorted(d["upah"] for d in daerah)
    print(
        f"514 daerah · {jumlah_umk} memakai UMK, {514 - jumlah_umk} memakai UMP · "
        f"upah Rp{upah[0]:,}–Rp{upah[-1]:,}, median Rp{upah[257]:,}"
    )


if __name__ == "__main__":
    main()
