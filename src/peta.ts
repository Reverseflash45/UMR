// Peta SVG 514 kabupaten/kota dengan perbesaran (d3-zoom) dan pewarnaan per pita.
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { type ZoomBehavior, type ZoomTransform, zoom, zoomIdentity } from "d3-zoom";
import type { Feature, Geometry } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Pita } from "./model";

const NS = "http://www.w3.org/2000/svg";
const LEBAR = 1000;
const TEPI = 18;

type Fitur = Feature<Geometry, { id: string }>;

export type OpsiPeta = {
  wadah: HTMLElement;
  topo: Topology<{ daerah: GeometryCollection<{ id: string }> }>;
  provinsiDari: (id: string) => number;
  diPilih: (id: string) => void;
  diSorot: (id: string | null, x: number, y: number) => void;
};

export class Peta {
  private svg: SVGSVGElement;
  private lapis: SVGGElement;
  private jalur = new Map<string, SVGPathElement>();
  private sorot: SVGPathElement;
  private pilihan: SVGPathElement;
  private zoomer: ZoomBehavior<SVGSVGElement, unknown>;
  private tinggi: number;
  private path: ReturnType<typeof geoPath>;
  private fitur = new Map<string, Fitur>();
  private skala = 1;
  private penanda: SVGGElement;
  private titikPenanda: [number, number] | null = null;

  constructor(o: OpsiPeta) {
    const semua = feature(o.topo, o.topo.objects.daerah) as unknown as { features: Fitur[] };
    // Mercator dipusatkan ke Indonesia; tinggi mengikuti bentuk kepulauan.
    const semuaFc = { type: "FeatureCollection" as const, features: semua.features };
    const proyeksi = geoMercator().fitWidth(LEBAR - 2 * TEPI, semuaFc);
    this.path = geoPath(proyeksi);
    const [[x0, y0], [, y1]] = this.path.bounds(semuaFc);
    this.tinggi = Math.ceil(y1 - y0) + 2 * TEPI;
    const [tx, ty] = proyeksi.translate();
    proyeksi.translate([tx - x0 + TEPI, ty - y0 + TEPI]);

    this.svg = document.createElementNS(NS, "svg");
    this.svg.setAttribute("viewBox", `0 0 ${LEBAR} ${this.tinggi}`);
    this.svg.setAttribute("class", "peta-svg");
    this.lapis = document.createElementNS(NS, "g");
    this.svg.append(this.lapis);

    const grup = document.createElementNS(NS, "g");
    grup.setAttribute("class", "daerah");
    for (const f of semua.features) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", this.path(f) ?? "");
      p.dataset.id = f.properties.id;
      grup.append(p);
      this.jalur.set(f.properties.id, p);
      this.fitur.set(f.properties.id, f);
    }
    this.lapis.append(grup);

    // Batas provinsi: busur bersama antara dua daerah beda provinsi.
    const prov = document.createElementNS(NS, "path");
    prov.setAttribute("class", "batas-provinsi");
    prov.setAttribute(
      "d",
      this.path(
        mesh(o.topo, o.topo.objects.daerah, (a, b) => a !== b && o.provinsiDari((a.properties as { id: string }).id) !== o.provinsiDari((b.properties as { id: string }).id)),
      ) ?? "",
    );
    this.lapis.append(prov);

    this.sorot = document.createElementNS(NS, "path");
    this.sorot.setAttribute("class", "garis-sorot");
    this.pilihan = document.createElementNS(NS, "path");
    this.pilihan.setAttribute("class", "garis-pilih");
    this.lapis.append(this.sorot, this.pilihan);

    // Penanda daerah terpilih: titik + nama, ukurannya tetap saat diperbesar.
    this.penanda = document.createElementNS(NS, "g");
    this.penanda.setAttribute("class", "penanda");
    this.penanda.style.display = "none";
    this.penanda.innerHTML = `<g class="penanda-isi"><circle r="4"/><line x1="0" y1="-4" x2="0" y2="-22"/><text y="-28" text-anchor="middle"></text></g>`;
    this.lapis.append(this.penanda);

    o.wadah.append(this.svg);

    this.zoomer = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 24])
      .translateExtent([
        [-40, -40],
        [LEBAR + 40, this.tinggi + 40],
      ])
      .clickDistance(6)
      // Satu jari di layar sentuh tetap menggulir halaman, kecuali peta sedang diperbesar.
      .filter((e: Event) => {
        if (e.type === "touchstart") return (e as TouchEvent).touches.length > 1 || this.skala > 1;
        return !(e as MouseEvent).button;
      })
      .on("zoom", (e: { transform: ZoomTransform }) => {
        this.skala = e.transform.k;
        this.lapis.setAttribute("transform", e.transform.toString());
        this.aturPenanda();
      });
    select(this.svg).call(this.zoomer).on("dblclick.zoom", null);

    this.svg.addEventListener("click", (e) => {
      const id = (e.target as SVGElement).dataset?.id;
      if (id) o.diPilih(id);
    });
    this.svg.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const id = (e.target as SVGElement).dataset?.id ?? null;
      this.sorotDaerah(id);
      o.diSorot(id, e.clientX, e.clientY);
    });
    this.svg.addEventListener("pointerleave", () => {
      this.sorotDaerah(null);
      o.diSorot(null, 0, 0);
    });
  }

  warnai(pita: Map<string, Pita>, saring: Pita | null): void {
    this.svg.classList.remove("mode-skala");
    for (const [id, p] of this.jalur) {
      const v = pita.get(id);
      if (v) p.dataset.pita = v;
      p.classList.toggle("redup", saring !== null && v !== saring);
    }
  }

  /** Warnai dengan kelas berurutan 0..n-1 (peta "gaji yang dibutuhkan"). */
  warnaiSkala(kelas: Map<string, number>, saring: number | null): void {
    this.svg.classList.add("mode-skala");
    for (const [id, p] of this.jalur) {
      const v = kelas.get(id);
      if (v !== undefined) p.dataset.skala = String(v);
      p.classList.toggle("redup", saring !== null && v !== saring);
    }
  }

  private sorotDaerah(id: string | null): void {
    this.sorot.setAttribute("d", id ? (this.jalur.get(id)?.getAttribute("d") ?? "") : "");
  }

  tandai(id: string | null, nama = ""): void {
    this.pilihan.setAttribute("d", id ? (this.jalur.get(id)?.getAttribute("d") ?? "") : "");
    const f = id ? this.fitur.get(id) : undefined;
    if (!f) {
      this.titikPenanda = null;
      this.penanda.style.display = "none";
      return;
    }
    this.titikPenanda = this.path.centroid(f) as [number, number];
    this.penanda.querySelector("text")!.textContent = nama;
    this.penanda.style.display = "";
    this.aturPenanda();
  }

  private aturPenanda(): void {
    if (!this.titikPenanda) return;
    const [x, y] = this.titikPenanda;
    // Skala balik supaya label tidak ikut membesar; sedikit lebih besar di layar sempit.
    const lebarLayar = this.svg.getBoundingClientRect().width || LEBAR;
    const s = Math.max(1, LEBAR / lebarLayar) * 0.9;
    this.penanda.setAttribute("transform", `translate(${x},${y}) scale(${s / this.skala})`);
  }

  /** Perbesar ke satu daerah, cukup untuk melihatnya di antara tetangganya. */
  fokus(id: string): void {
    const f = this.fitur.get(id);
    if (!f) return;
    const [[x0, y0], [x1, y1]] = this.path.bounds(f);
    const k = Math.min(7, 0.3 / Math.max((x1 - x0) / LEBAR, (y1 - y0) / this.tinggi));
    const t = zoomIdentity
      .translate(LEBAR / 2, this.tinggi / 2)
      .scale(Math.max(1, k))
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    select(this.svg).transition().duration(650).call(this.zoomer.transform, t);
  }

  perbesar(faktor: number): void {
    select(this.svg).transition().duration(250).call(this.zoomer.scaleBy, faktor);
  }

  ulang(): void {
    select(this.svg).transition().duration(400).call(this.zoomer.transform, zoomIdentity);
  }
}
