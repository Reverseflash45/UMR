import "@fontsource/dotgothic16/latin-400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
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
  batasKuantil,
  gajiDibutuhkan,
  hitung,
  kelasDari,
} from "./model";
import { Peta } from "./peta";
import { type Status, dariUrl, gajiKeGeser, geserKeGaji, keUrl } from "./status";
import { bagikanGambar, bagikanHtml, htmlBanding, htmlStory, htmlStruk } from "./struk";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let data: Dataset;
let indeks: Map<string, Daerah>;
let peta: Peta;
let hasil = new Map<string, Hasil>();
let saringPita: Pita | null = null;
/** Gaji kotor yang dibutuhkan biar pas, per daerah (dihitung saat dibutuhkan). */
let butuh = new Map<string, number>();
let batas: number[] = [];
let saringSkala: number | null = null;
const status: Status = dariUrl(location.search);
const layarLebar = matchMedia("(min-width: 1024px)");

const cari = (id: string) => indeks.get(id);

async function mulai(): Promise<void> {
  const [d, topo] = await Promise.all([
    fetch(import.meta.env.BASE_URL + "data/daerah.json").then((r) => r.json() as Promise<Dataset>),
    fetch(import.meta.env.BASE_URL + "data/peta.json").then((r) => r.json() as Promise<Topology<{ daerah: GeometryCollection<{ id: string }> }>>),
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
  if (status.warna === "butuh") {
    butuh = new Map(data.daerah.map((d) => [d.id, gajiDibutuhkan(d, p, data, cari)]));
    batas = batasKuantil([...butuh.values()], 5);
  }
  warnaiPeta();
  gambarRingkasan();
  gambarJudul();
  gambarPeringkat();
  sinkronKendali();
  if (status.pilih) gambarStruk();
  history.replaceState(null, "", keUrl(status));
}

function warnaiPeta(): void {
  if (status.warna === "butuh") {
    peta.warnaiSkala(new Map([...butuh].map(([id, v]) => [id, kelasDari(v, batas)])), saringSkala);
  } else {
    peta.warnai(new Map([...hasil].map(([id, h]) => [id, h.pita])), saringPita);
  }
}

function hitungPita(): Record<Pita, number> {
  const n: Record<Pita, number> = { longgar: 0, pas: 0, mepet: 0, kurang: 0 };
  for (const h of hasil.values()) n[h.pita]++;
  return n;
}

/** Label rentang kelas ke-i dalam juta rupiah, misalnya "3,5–4". */
function labelKelas(i: number): string {
  const jt = (x: number) => (x / 1_000_000).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
  if (i === 0) return `< ${jt(batas[0])}`;
  if (i === batas.length) return `≥ ${jt(batas[batas.length - 1])}`;
  return `${jt(batas[i - 1])}–${jt(batas[i])}`;
}

function gambarRingkasan(): void {
  $("pita-ringkas").classList.toggle("butuh", status.warna === "butuh");
  if (status.warna === "butuh") return gambarLegendaSkala();
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
      warnaiPeta();
      gambarRingkasan();
    };
  });
}

function gambarLegendaSkala(): void {
  const n = batas.map(() => 0).concat(0);
  for (const v of butuh.values()) n[kelasDari(v, batas)]++;
  $("pita-batang").innerHTML = n.map((_, i) => `<span data-skala="${i}" style="flex-grow:1"></span>`).join("");
  const urut = [...butuh].sort((a, b) => a[1] - b[1]);
  const [idMin, min] = urut[0];
  const [idMaks, maks] = urut[urut.length - 1];
  $("pita-angka").innerHTML =
    n
      .map(
        (jumlah, i) => `<li>
      <button type="button" data-kelas="${i}" aria-pressed="${saringSkala === i}">
        <span class="pita-nama"><span class="titik-pita" data-skala="${i}"></span>${labelKelas(i)}</span>
        <span class="pita-arti">${jumlah} daerah</span>
      </button>
    </li>`,
      )
      .join("") +
    `<li class="skala-ekstrem"><span class="skala-satuan">Gaji kotor biar pas, juta rupiah/bulan</span><span>Termurah <b>${rupiahRingkas(min)}</b> · ${indeks.get(idMin)!.nama}</span><span>Termahal <b>${rupiahRingkas(maks)}</b> · ${indeks.get(idMaks)!.nama}</span></li>`;
  $("pita-angka").querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.onclick = () => {
      const k = Number(b.dataset.kelas);
      saringSkala = saringSkala === k ? null : k;
      warnaiPeta();
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
  if (status.warna === "butuh") {
    const urut = [...butuh].sort((a, b) => a[1] - b[1]);
    const [idMin, min] = urut[0];
    const [idMaks, maks] = urut[urut.length - 1];
    const tambahan = p.rumah !== "lajang" && p.pasanganKerja ? ", ditambah gaji pasangan" : "";
    $("judul-utama").innerHTML = `Biar pas untuk ${teksRumah(p)}, perlu gaji <em>${rupiahRingkas(min)}</em> di ${indeks.get(idMin)!.nama} sampai <em>${rupiahRingkas(maks)}</em> di ${indeks.get(idMaks)!.nama}${tambahan}.`;
    $("kicker").textContent = `Edisi ${data.versi} · gaji kotor yang dibutuhkan · median ${rupiahRingkas(urut[Math.floor(urut.length / 2)][1])}`;
    return;
  }
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
  const skala = status.warna === "butuh";
  $("urutan").querySelector('[data-nilai="sisa"]')!.textContent = skala ? "Paling murah" : "Sisa terbesar";
  $("urutan").querySelector('[data-nilai="kurang"]')!.textContent = skala ? "Paling mahal" : "Paling kurang";
  if (skala) {
    const urut = [...butuh].sort((a, b) => (status.urutan === "sisa" ? a[1] - b[1] : b[1] - a[1])).slice(0, 10);
    $("peringkat").innerHTML = urut
      .map(([id, v], i) => {
        const d = indeks.get(id)!;
        return `<li><button type="button" data-id="${id}">
          <span class="peringkat-no">${i + 1}</span>
          <span class="peringkat-nama">${d.nama}<small>${data.provinsi[d.prov].nama}</small></span>
          <span class="peringkat-nilai">${rupiahRingkas(v)}<small>${d.jenisUpah} ${rupiahRingkas(d.upah)}</small></span>
        </button></li>`;
      })
      .join("");
    $("peringkat").querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.onclick = () => bukaStruk(b.dataset.id!, true);
    });
    return;
  }
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
  if (status.pilih !== id) status.banding = null;
  status.pilih = id;
  peta.tandai(id, indeks.get(id)?.nama ?? "");
  if (fokus) peta.fokus(id);
  gambarStruk();
  history.replaceState(null, "", keUrl(status));
  if (!layarLebar.matches) bukaLembar($("lembar"));
}

function tutupStruk(): void {
  status.pilih = null;
  status.banding = null;
  peta.tandai(null);
  tutupLembar($("lembar"));
  gambarStruk();
  history.replaceState(null, "", keUrl(status));
}

function infoStruk(id: string) {
  const h = hasil.get(id)!;
  const p = status.profil;
  return {
    hasil: h,
    provinsi: data.provinsi[h.daerah.prov].nama,
    profil: p,
    gajiPas: gajiDibutuhkan(h.daerah, p, data, cari),
    situs: location.host || "umr",
  };
}

/** Jalankan aksi bagikan dengan umpan balik di tombolnya. */
function tombolBagikan(t: HTMLButtonElement, kerja: () => Promise<"dibagikan" | "diunduh">): void {
  t.onclick = async () => {
    const asli = t.textContent;
    t.disabled = true;
    t.textContent = "Menyiapkan…";
    try {
      t.textContent = (await kerja()) === "diunduh" ? "Tersimpan ✓" : asli;
    } catch (e) {
      console.error(e);
      t.textContent = "Gagal, coba lagi";
    }
    setTimeout(() => {
      t.disabled = false;
      t.textContent = asli;
    }, 1800);
  };
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
  if (status.banding && hasil.has(status.banding) && status.banding !== id) return gambarBanding(wadah, id, status.banding);

  const info = infoStruk(id);
  const h = info.hasil;
  const p = status.profil;
  wadah.innerHTML = `
    <div class="struk-aksi-atas">
      <button type="button" class="tutup" id="struk-tutup" aria-label="Tutup struk">✕</button>
    </div>
    <div class="struk-gulir">${htmlStruk(info)}</div>
    <div class="struk-aksi">
      <div class="dua">
        <button type="button" class="tombol utama" id="struk-story">Bagikan story</button>
        <button type="button" class="tombol" id="struk-simpan">Simpan struk</button>
      </div>
      <button type="button" class="tombol" id="struk-banding">Bandingkan dengan daerah lain</button>
      <button type="button" class="tombol tipis" id="struk-asal" ${p.mode === "kota" && p.asal === id ? "disabled" : ""}>Bawa upah ${h.daerah.jenisUpah} ini ke daerah lain</button>
    </div>`;
  $("struk-tutup").onclick = tutupStruk;
  tombolBagikan($<HTMLButtonElement>("struk-story"), () =>
    bagikanHtml(htmlStory(info), `umr-${h.daerah.id}-story`, { lebar: 360, tinggi: 640, rasio: 3, latar: "#fbfcf8" }),
  );
  tombolBagikan($<HTMLButtonElement>("struk-simpan"), () =>
    bagikanGambar(wadah.querySelector(".struk")!, `struk-${h.daerah.id}`),
  );
  $("struk-banding").onclick = () =>
    bukaPemilih({
      judul: `Bandingkan ${h.daerah.nama} dengan…`,
      kecuali: id,
      urutAwal: "dekat",
      saatPilih: (b) => {
        status.banding = b;
        gambarStruk();
        history.replaceState(null, "", keUrl(status));
      },
    });
  $("struk-asal").onclick = () => {
    status.profil.mode = "kota";
    status.profil.asal = id;
    hitungUlang();
    if (!layarLebar.matches) tutupLembar($("lembar"));
    document.querySelector(".kolom-kendali")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

function gambarBanding(wadah: HTMLElement, idA: string, idB: string): void {
  const a = infoStruk(idA);
  const b = infoStruk(idB);
  wadah.innerHTML = `
    <div class="struk-aksi-atas">
      <button type="button" class="tombol tipis kecil" id="banding-kembali">← Struk ${a.hasil.daerah.nama}</button>
      <button type="button" class="tutup" id="struk-tutup" aria-label="Tutup">✕</button>
    </div>
    <div class="struk-gulir">${htmlBanding({
      a: a.hasil,
      b: b.hasil,
      provA: a.provinsi,
      provB: b.provinsi,
      gajiPasA: a.gajiPas,
      gajiPasB: b.gajiPas,
      profil: status.profil,
      situs: a.situs,
    })}</div>
    <div class="struk-aksi">
      <div class="dua">
        <button type="button" class="tombol utama" id="banding-simpan">Simpan gambar</button>
        <button type="button" class="tombol" id="banding-tukar">Tukar posisi</button>
      </div>
      <button type="button" class="tombol" id="banding-ganti">Ganti pembanding</button>
    </div>`;
  $("struk-tutup").onclick = tutupStruk;
  $("banding-kembali").onclick = () => {
    status.banding = null;
    gambarStruk();
    history.replaceState(null, "", keUrl(status));
  };
  $("banding-tukar").onclick = () => {
    status.pilih = idB;
    status.banding = idA;
    peta.tandai(idB, indeks.get(idB)!.nama);
    gambarStruk();
    history.replaceState(null, "", keUrl(status));
  };
  $("banding-ganti").onclick = () =>
    bukaPemilih({
      judul: `Bandingkan ${a.hasil.daerah.nama} dengan…`,
      kecuali: idA,
      urutAwal: "dekat",
      saatPilih: (x) => {
        status.banding = x;
        gambarStruk();
        history.replaceState(null, "", keUrl(status));
      },
    });
  tombolBagikan($<HTMLButtonElement>("banding-simpan"), () =>
    bagikanGambar(wadah.querySelector(".struk")!, `umr-${idA}-vs-${idB}`),
  );
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
  const v = butuh.get(id);
  const baris =
    status.warna === "butuh" && v !== undefined
      ? `<span class="titik-pita" data-skala="${kelasDari(v, batas)}"></span>Biar pas: gaji ${rupiahRingkas(v)}`
      : `<span class="titik-pita" data-pita="${h.pita}"></span>${NAMA_PITA[h.pita]} · ${persen(h.cakupan)} · ${h.sisa < 0 ? "kurang" : "sisa"} ${rupiahRingkas(Math.abs(h.sisa))}`;
  t.innerHTML = `<b>${h.daerah.nama}</b><span>${data.provinsi[h.daerah.prov].nama}</span><span class="tt-angka">${baris}</span>`;
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
  segmen("warna", () => status.warna, (v) => {
    status.warna = v;
    saringPita = null;
    saringSkala = null;
  });

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
  sinkronSegmen("warna", status.warna);
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

type OpsiPemilih = {
  judul: string;
  /** "upah": urut upah tertinggi; "dekat": daerah satu provinsi dulu, lalu kota besar. */
  urutAwal: "upah" | "dekat";
  kecuali?: string;
  terpilih?: string;
  saatPilih: (id: string) => void;
};

let pemilih: OpsiPemilih | null = null;

function bukaPemilih(o: OpsiPemilih): void {
  pemilih = o;
  const input = $<HTMLInputElement>("cari-asal");
  input.value = "";
  input.placeholder = "Cari kabupaten/kota…";
  $("pemilih-judul").textContent = o.judul;
  gambarPemilih();
  bukaLembar($("lembar-asal"));
  if (layarLebar.matches) input.focus();
}

function gambarPemilih(): void {
  if (!pemilih) return;
  const o = pemilih;
  const q = $<HTMLInputElement>("cari-asal").value.trim();
  let calon: Daerah[];
  let judul = "";
  if (q) calon = cocokkan(q, 40);
  else if (o.urutAwal === "upah") {
    calon = [...data.daerah].sort((a, b) => b.upah - a.upah).slice(0, 40);
    judul = "Upah tertinggi";
  } else {
    const asal = o.kecuali ? indeks.get(o.kecuali) : undefined;
    const sesama = asal ? data.daerah.filter((d) => d.prov === asal.prov) : [];
    const besar = data.daerah.filter((d) => d.kota && d.upah > 4_000_000 && !sesama.includes(d));
    calon = [...sesama, ...besar];
    judul = asal ? `Satu provinsi, lalu kota berupah tinggi` : "";
  }
  calon = calon.filter((d) => d.id !== o.kecuali);
  $("daftar-asal").innerHTML =
    (judul ? `<li class="pilih-judul label">${judul}</li>` : "") +
    calon
      .map((d) => {
        const h = hasil.get(d.id)!;
        return `<li><button type="button" data-id="${d.id}" aria-current="${d.id === o.terpilih}">
          <span><b>${d.nama}</b><small>${data.provinsi[d.prov].nama}</small></span>
          <span>${o.urutAwal === "upah" ? `${d.jenisUpah} ${rupiahRingkas(d.upah)}` : `<span class="titik-pita" data-pita="${h.pita}"></span> ${persen(h.cakupan)}`}</span>
        </button></li>`;
      })
      .join("");
}

function pasangPilihAsal(): void {
  $<HTMLInputElement>("cari-asal").oninput = gambarPemilih;
  $("daftar-asal").onclick = (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b?.dataset.id || !pemilih) return;
    const pilih = pemilih.saatPilih;
    tutupLembar($("lembar-asal"));
    pilih(b.dataset.id);
  };
  $("pilih-asal").onclick = () =>
    bukaPemilih({
      judul: "Upah dari daerah mana?",
      urutAwal: "upah",
      terpilih: status.profil.asal,
      saatPilih: (id) => {
        status.profil.asal = id;
        hitungUlang();
      },
    });
}

mulai().catch((e) => {
  console.error(e);
  $("judul-utama").textContent = "Data gagal dimuat. Coba muat ulang halaman.";
});
