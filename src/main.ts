import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/newsreader/500-italic.css";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./gaya.css";

import type { GeometryCollection, Topology } from "topojson-specification";
import { angka, bacaRupiah, normalTeks, persen, rupiah, rupiahRingkas } from "./format";
import {
  type Daerah,
  type Dataset,
  type Hasil,
  NAMA_PITA,
  type Pita,
  type Profil,
  URUTAN_PITA,
  ARTI_PITA,
  gajiDibutuhkan,
  hitung,
} from "./model";
import { Peta } from "./peta";
import { type Status, dariUrl, gajiKeGeser, geserKeGaji, keUrl } from "./status";
import { bagikanStruk, htmlStruk } from "./struk";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let data: Dataset;
let indeks: Map<string, Daerah>;
let peta: Peta;
let hasil = new Map<string, Hasil>();
let saringPita: Pita | null = null;
const status: Status = dariUrl(location.search);
const layarLebar = matchMedia("(min-width: 1024px)");

const cari = (id: string) => indeks.get(id);

async function mulai(): Promise<void> {
  const [d, topo] = await Promise.all([
    fetch("/data/daerah.json").then((r) => r.json() as Promise<Dataset>),
    fetch("/data/peta.json").then((r) => r.json() as Promise<Topology<{ daerah: GeometryCollection<{ id: string }> }>>),
  ]);
  data = d;
  indeks = new Map(data.daerah.map((x) => [x.id, x]));
  if (!indeks.has(status.profil.asal)) status.profil.asal = "kota-jakarta-selatan";
  if (status.pilih && !indeks.has(status.pilih)) status.pilih = null;

  peta = new Peta({
    wadah: $("peta"),
    topo,
    provinsiDari: (id) => indeks.get(id)?.prov ?? -1,
    diPilih: (id) => bukaStruk(id, false),
    diSorot: tampilTooltip,
  });
  $("zoom-masuk").onclick = () => peta.perbesar(2);
  $("zoom-keluar").onclick = () => peta.perbesar(0.5);
  $("zoom-ulang").onclick = () => peta.ulang();

  pasangKendali();
  pasangCari();
  pasangPilihAsal();
  hitungUlang();
  if (status.pilih) bukaStruk(status.pilih, true);
}

/* ------------------------------------------------------------------ */
/* Hitung & gambar ulang                                               */
/* ------------------------------------------------------------------ */

function hitungUlang(): void {
  const p = status.profil;
  hasil = new Map(data.daerah.map((d) => [d.id, hitung(d, p, data, cari)]));
  const pita = new Map([...hasil].map(([id, h]) => [id, h.pita]));
  peta.warnai(pita, saringPita);
  gambarRingkasan();
  gambarJudul();
  gambarPeringkat();
  sinkronKendali();
  if (status.pilih) gambarStruk();
  history.replaceState(null, "", keUrl(status));
}

function hitungPita(): Record<Pita, number> {
  const n: Record<Pita, number> = { longgar: 0, pas: 0, mepet: 0, kurang: 0 };
  for (const h of hasil.values()) n[h.pita]++;
  return n;
}

function gambarRingkasan(): void {
  const n = hitungPita();
  $("pita-batang").innerHTML = URUTAN_PITA.map(
    (p) => `<span data-pita="${p}" style="flex-grow:${n[p]}" title="${NAMA_PITA[p]}: ${n[p]}"></span>`,
  ).join("");
  $("pita-angka").innerHTML = URUTAN_PITA.map(
    (p) => `<li>
      <button type="button" data-pita="${p}" aria-pressed="${saringPita === p}" class="${n[p] === 0 ? "nol" : ""}">
        <span class="pita-nama"><span class="titik-pita" data-pita="${p}"></span>${NAMA_PITA[p]}</span>
        <span class="pita-jumlah">${n[p]}</span>
        <span class="pita-arti">${ARTI_PITA[p]}</span>
      </button>
    </li>`,
  ).join("");
  $("pita-angka").querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.onclick = () => {
      const p = b.dataset.pita as Pita;
      saringPita = saringPita === p ? null : p;
      peta.warnai(new Map([...hasil].map(([id, h]) => [id, h.pita])), saringPita);
      gambarRingkasan();
    };
  });
}

function teksRumah(p: Profil): string {
  if (p.rumah === "lajang") return "hidup sendiri";
  const kerja = p.pasanganKerja ? " yang sama-sama bekerja" : "";
  if (p.rumah === "pasangan") return `pasangan${kerja}`;
  return `keluarga dengan ${p.anak} anak${p.pasanganKerja ? ", suami-istri bekerja" : ""}`;
}

function gambarJudul(): void {
  const p = status.profil;
  const n = hitungPita();
  const tidak = n.mepet + n.kurang;
  let sumber: string;
  if (p.mode === "daerah") sumber = "Dengan upah minimum masing-masing";
  else if (p.mode === "gaji") sumber = `Dengan gaji ${rupiahRingkas(p.gaji)}`;
  else {
    const a = indeks.get(p.asal)!;
    sumber = `Membawa ${a.jenisUpah} ${a.nama} ke mana pun`;
  }
  let inti: string;
  if (tidak === 514) inti = `<em>tidak satu pun</em> dari 514 daerah cukup`;
  else if (tidak === 0) inti = `<em>semua</em> 514 daerah tertutup biayanya`;
  else inti = `<em>${tidak}</em> dari 514 daerah tidak cukup`;
  $("judul-utama").innerHTML = `${sumber}, ${inti} untuk ${teksRumah(p)}.`;
  $("kicker").textContent = `Edisi ${data.versi} · ${p.bersih ? "gaji bersih" : "gaji kotor"} · ${n.longgar} longgar, ${n.pas} pas`;
}

function gambarPeringkat(): void {
  const urut = [...hasil.values()].sort((a, b) => (status.urutan === "sisa" ? b.sisa - a.sisa : a.sisa - b.sisa));
  const atas = urut.slice(0, 10);
  $("peringkat").innerHTML = atas
    .map(
      (h, i) => `<li>
        <button type="button" data-id="${h.daerah.id}">
          <span class="peringkat-no">${i + 1}</span>
          <span class="peringkat-nama">${h.daerah.nama}<small>${data.provinsi[h.daerah.prov].nama}</small></span>
          <span class="peringkat-nilai" data-pita="${h.pita}">${h.sisa < 0 ? "−" : "+"}${rupiahRingkas(Math.abs(h.sisa)).replace("Rp", "Rp")}<small>${persen(h.cakupan)}</small></span>
        </button>
      </li>`,
    )
    .join("");
  $("peringkat").querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.onclick = () => bukaStruk(b.dataset.id!, true);
  });
}

/* ------------------------------------------------------------------ */
/* Struk                                                               */
/* ------------------------------------------------------------------ */

function bukaStruk(id: string, fokus: boolean): void {
  status.pilih = id;
  peta.tandai(id, indeks.get(id)?.nama ?? "");
  if (fokus) peta.fokus(id);
  gambarStruk();
  history.replaceState(null, "", keUrl(status));
  if (!layarLebar.matches) bukaLembar($("lembar"));
}

function tutupStruk(): void {
  status.pilih = null;
  peta.tandai(null);
  tutupLembar($("lembar"));
  gambarStruk();
  history.replaceState(null, "", keUrl(status));
}

function gambarStruk(): void {
  const wadah = layarLebar.matches ? $("struk-wadah") : $("lembar-isi");
  const lain = layarLebar.matches ? $("lembar-isi") : $("struk-wadah");
  lain.innerHTML = "";
  if (!layarLebar.matches) $("struk-wadah").innerHTML = "";
  const id = status.pilih;
  if (!id || !hasil.has(id)) {
    $("struk-wadah").innerHTML = `<div class="struk-kosong"><p class="label">Struk bulanan</p><p>Pilih satu daerah di peta, di peringkat, atau lewat pencarian untuk melihat rincian pemasukan dan pengeluarannya.</p></div>`;
    return;
  }
  const h = hasil.get(id)!;
  const p = status.profil;
  const gajiPas = gajiDibutuhkan(h.daerah, { ...p, mode: "gaji" }, data, cari);
  wadah.innerHTML = `
    <div class="struk-aksi-atas">
      <button type="button" class="tutup" id="struk-tutup" aria-label="Tutup struk">✕</button>
    </div>
    <div class="struk-gulir">${htmlStruk({
      hasil: h,
      provinsi: data.provinsi[h.daerah.prov].nama,
      profil: p,
      gajiPas,
      situs: location.host || "umr",
    })}</div>
    <div class="struk-aksi">
      <button type="button" class="tombol utama" id="struk-bagikan">Bagikan struk</button>
      <button type="button" class="tombol" id="struk-asal" ${p.mode === "kota" && p.asal === id ? "disabled" : ""}>Bawa upah ${h.daerah.jenisUpah} ini ke daerah lain</button>
    </div>`;
  $("struk-tutup").onclick = tutupStruk;
  $("struk-bagikan").onclick = async (e) => {
    const t = e.currentTarget as HTMLButtonElement;
    t.disabled = true;
    t.textContent = "Menyiapkan…";
    try {
      const r = await bagikanStruk(wadah.querySelector(".struk")!, h.daerah.id);
      t.textContent = r === "diunduh" ? "Tersimpan ✓" : "Bagikan struk";
    } catch {
      t.textContent = "Gagal, coba lagi";
    }
    setTimeout(() => {
      t.disabled = false;
      t.textContent = "Bagikan struk";
    }, 1800);
  };
  $("struk-asal").onclick = () => {
    status.profil.mode = "kota";
    status.profil.asal = id;
    hitungUlang();
    if (!layarLebar.matches) tutupLembar($("lembar"));
    document.querySelector(".kolom-kendali")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

layarLebar.addEventListener("change", () => {
  tutupLembar($("lembar"));
  if (status.pilih) gambarStruk();
});

/* ------------------------------------------------------------------ */
/* Lembar bawah (mobile)                                               */
/* ------------------------------------------------------------------ */

let fokusSebelum: HTMLElement | null = null;

function bukaLembar(el: HTMLElement): void {
  fokusSebelum = document.activeElement as HTMLElement;
  el.hidden = false;
  document.body.classList.add("terkunci");
  requestAnimationFrame(() => el.classList.add("buka"));
  el.querySelectorAll<HTMLElement>("[data-tutup]").forEach((t) => {
    t.onclick = () => (el.id === "lembar" ? tutupStruk() : tutupLembar(el));
  });
  // Fokus ke isi lembar (bukan tombol) supaya pembaca layar mulai dari judul.
  const isi = el.querySelector<HTMLElement>(".lembar-isi")!;
  const masukan = isi.querySelector<HTMLInputElement>("input");
  if (masukan && layarLebar.matches) masukan.focus({ preventScroll: true });
  else {
    isi.tabIndex = -1;
    isi.focus({ preventScroll: true });
  }
}

function tutupLembar(el: HTMLElement): void {
  if (el.hidden) return;
  el.classList.remove("buka");
  document.body.classList.remove("terkunci");
  setTimeout(() => (el.hidden = true), 220);
  fokusSebelum?.focus({ preventScroll: true });
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("lembar-asal").hidden) tutupLembar($("lembar-asal"));
  else if (status.pilih) tutupStruk();
});

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

function tampilTooltip(id: string | null, x: number, y: number): void {
  const t = $("tooltip");
  if (!id) {
    t.hidden = true;
    return;
  }
  const h = hasil.get(id);
  if (!h) return;
  t.hidden = false;
  t.innerHTML = `<b>${h.daerah.nama}</b><span>${data.provinsi[h.daerah.prov].nama}</span>
    <span class="tt-angka"><span class="titik-pita" data-pita="${h.pita}"></span>${NAMA_PITA[h.pita]} · ${persen(h.cakupan)} · ${h.sisa < 0 ? "kurang" : "sisa"} ${rupiahRingkas(Math.abs(h.sisa))}</span>`;
  const kotak = $("peta").getBoundingClientRect();
  const lebar = t.offsetWidth;
  let kiri = x - kotak.left + 14;
  if (kiri + lebar > kotak.width) kiri = x - kotak.left - lebar - 14;
  t.style.transform = `translate(${kiri}px, ${y - kotak.top + 14}px)`;
}

/* ------------------------------------------------------------------ */
/* Kendali                                                             */
/* ------------------------------------------------------------------ */

function segmen<T extends string>(id: string, ambil: () => T, atur: (v: T) => void): void {
  const el = $(id);
  el.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.onclick = () => {
      atur(b.dataset.nilai as T);
      hitungUlang();
    };
  });
  // Panah kiri/kanan berpindah pilihan (pola radiogroup).
  el.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tombol = [...el.querySelectorAll<HTMLButtonElement>("button")];
    const i = tombol.findIndex((b) => b.dataset.nilai === ambil());
    const j = (i + (e.key === "ArrowRight" ? 1 : -1) + tombol.length) % tombol.length;
    atur(tombol[j].dataset.nilai as T);
    hitungUlang();
    tombol[j].focus();
    e.preventDefault();
  });
}

function sinkronSegmen(id: string, nilai: string): void {
  $(id)
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) => {
      const aktif = b.dataset.nilai === nilai;
      b.setAttribute("aria-checked", String(aktif));
      b.tabIndex = aktif ? 0 : -1;
    });
}

function pasangKendali(): void {
  const p = status.profil;
  segmen("mode", () => p.mode, (v) => (p.mode = v));
  segmen("rumah", () => p.rumah, (v) => {
    p.rumah = v;
    if (v === "keluarga" && p.anak < 1) p.anak = 2;
  });
  segmen("hunian", () => p.hunian, (v) => (p.hunian = v));
  segmen("transportasi", () => p.transportasi, (v) => (p.transportasi = v));
  segmen("gaya", () => p.gaya, (v) => (p.gaya = v));
  segmen("urutan", () => status.urutan, (v) => (status.urutan = v));

  $("anak-kurang").onclick = () => {
    p.anak = Math.max(1, p.anak - 1);
    hitungUlang();
  };
  $("anak-tambah").onclick = () => {
    p.anak = Math.min(5, p.anak + 1);
    hitungUlang();
  };
  const cek = (id: string, kunci: "pasanganKerja" | "tabungan" | "bersih") => {
    $<HTMLInputElement>(id).onchange = (e) => {
      p[kunci] = (e.target as HTMLInputElement).checked;
      hitungUlang();
    };
  };
  cek("pasangan-kerja", "pasanganKerja");
  cek("tabungan", "tabungan");
  cek("bersih", "bersih");

  // Gaji: kotak isian dan slider logaritmik saling mengikuti.
  const geser = $<HTMLInputElement>("gaji-geser");
  const isian = $<HTMLInputElement>("gaji");
  let jadwal = 0;
  geser.oninput = () => {
    p.gaji = geserKeGaji(Number(geser.value));
    isian.value = angka(p.gaji);
    cancelAnimationFrame(jadwal);
    jadwal = requestAnimationFrame(hitungUlang);
  };
  isian.oninput = () => {
    const v = bacaRupiah(isian.value);
    if (v === null || v < 100_000) return;
    p.gaji = Math.min(v, 500_000_000);
    geser.value = String(gajiKeGeser(p.gaji));
    hitungUlang();
  };
  isian.onblur = () => (isian.value = angka(p.gaji));
}

function sinkronKendali(): void {
  const p = status.profil;
  sinkronSegmen("mode", p.mode);
  sinkronSegmen("rumah", p.rumah);
  sinkronSegmen("hunian", p.hunian);
  sinkronSegmen("transportasi", p.transportasi);
  sinkronSegmen("gaya", p.gaya);
  sinkronSegmen("urutan", status.urutan);
  for (const m of ["daerah", "gaji", "kota"] as const) $(`isi-${m}`).hidden = p.mode !== m;
  $("baris-anak").hidden = p.rumah !== "keluarga";
  $("baris-pasangan").hidden = p.rumah === "lajang";
  $("anak").textContent = `${p.anak} anak`;
  $<HTMLInputElement>("pasangan-kerja").checked = p.pasanganKerja;
  $<HTMLInputElement>("tabungan").checked = p.tabungan;
  $<HTMLInputElement>("bersih").checked = p.bersih;
  const isian = $<HTMLInputElement>("gaji");
  if (document.activeElement !== isian) isian.value = angka(p.gaji);
  $<HTMLInputElement>("gaji-geser").value = String(gajiKeGeser(p.gaji));
  $<HTMLInputElement>("gaji-geser").style.setProperty("--isi", `${gajiKeGeser(p.gaji) / 10}%`);
  const asal = indeks.get(p.asal)!;
  $("asal-nama").textContent = asal.nama;
  $("asal-upah").textContent = `${asal.jenisUpah} ${rupiah(asal.upah)}`;

  const orang = p.rumah === "lajang" ? 1 : p.rumah === "pasangan" ? 2 : 2 + p.anak;
  $("ringkas-profil").textContent = `${orang} orang · ${p.bersih ? "gaji bersih" : "gaji kotor"}`;
}

/* ------------------------------------------------------------------ */
/* Pencarian                                                           */
/* ------------------------------------------------------------------ */

function cocokkan(q: string, batas = 8): Daerah[] {
  const n = normalTeks(q);
  if (!n) return [];
  const awal: Daerah[] = [];
  const isi: Daerah[] = [];
  for (const d of data.daerah) {
    const nama = normalTeks(d.nama.replace(/^Kota /, ""));
    const lengkap = normalTeks(d.nama);
    if (nama.startsWith(n) || lengkap.startsWith(n)) awal.push(d);
    else if (lengkap.includes(n) || normalTeks(data.provinsi[d.prov].nama).startsWith(n)) isi.push(d);
  }
  return [...awal, ...isi].slice(0, batas);
}

function pasangCari(): void {
  const input = $<HTMLInputElement>("cari");
  const daftar = $("cari-hasil");
  let aktif = -1;
  let calon: Daerah[] = [];
  const gambar = () => {
    calon = cocokkan(input.value);
    daftar.hidden = calon.length === 0;
    input.setAttribute("aria-expanded", String(calon.length > 0));
    daftar.innerHTML = calon
      .map((d, i) => {
        const h = hasil.get(d.id)!;
        return `<li role="option" id="cari-${i}" aria-selected="${i === aktif}" data-id="${d.id}">
          <span><b>${d.nama}</b><small>${data.provinsi[d.prov].nama}</small></span>
          <span class="cari-pita"><span class="titik-pita" data-pita="${h.pita}"></span>${persen(h.cakupan)}</span>
        </li>`;
      })
      .join("");
    input.setAttribute("aria-activedescendant", aktif >= 0 ? `cari-${aktif}` : "");
  };
  const pilih = (id: string) => {
    input.value = "";
    calon = [];
    aktif = -1;
    gambar();
    input.blur();
    bukaStruk(id, true);
    if (layarLebar.matches) $("struk-wadah").scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  input.oninput = () => {
    aktif = 0;
    gambar();
  };
  input.onkeydown = (e) => {
    if (e.key === "ArrowDown") aktif = Math.min(calon.length - 1, aktif + 1);
    else if (e.key === "ArrowUp") aktif = Math.max(0, aktif - 1);
    else if (e.key === "Enter" && calon[aktif]) return pilih(calon[aktif].id);
    else if (e.key === "Escape") input.value = "";
    else return;
    e.preventDefault();
    gambar();
  };
  daftar.onpointerdown = (e) => {
    const li = (e.target as HTMLElement).closest("li");
    if (li?.dataset.id) {
      e.preventDefault();
      pilih(li.dataset.id);
    }
  };
  input.onblur = () => setTimeout(() => (daftar.hidden = true), 120);
}

function pasangPilihAsal(): void {
  const lembar = $("lembar-asal");
  const input = $<HTMLInputElement>("cari-asal");
  const daftar = $("daftar-asal");
  const gambar = () => {
    const q = input.value.trim();
    const calon = q
      ? cocokkan(q, 40)
      : [...data.daerah].sort((a, b) => b.upah - a.upah).slice(0, 40);
    daftar.innerHTML =
      (q ? "" : `<li class="pilih-judul label">Upah tertinggi</li>`) +
      calon
        .map(
          (d) => `<li><button type="button" data-id="${d.id}" aria-current="${d.id === status.profil.asal}">
            <span><b>${d.nama}</b><small>${data.provinsi[d.prov].nama}</small></span>
            <span>${d.jenisUpah} ${rupiahRingkas(d.upah)}</span>
          </button></li>`,
        )
        .join("");
  };
  $("pilih-asal").onclick = () => {
    input.value = "";
    gambar();
    bukaLembar(lembar);
  };
  input.oninput = gambar;
  daftar.onclick = (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b?.dataset.id) return;
    status.profil.asal = b.dataset.id;
    tutupLembar(lembar);
    hitungUlang();
  };
}

mulai().catch((e) => {
  console.error(e);
  $("judul-utama").textContent = "Data gagal dimuat. Coba muat ulang halaman.";
});
