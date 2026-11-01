/* Jalur peta d3-geo tanpa pemotongan bola. Salinan identik ada di repo peta lain (umr, rawan, getar, bara, …). */
import type { GeoJSON, MultiPoint, Position } from "geojson";
import { type GeoPath, type GeoProjection, geoPath, geoTransform } from "d3-geo";

/**
 * geoPath(proyeksi) biasa memotong tiap poligon di permukaan bola (antimeridian) dan me-resampling tiap garis.
 * Indonesia tidak melintasi antimeridian dan titik petanya rapat, jadi langkah itu tidak mengubah gambar,
 * tetapi memakan sebagian besar waktu menggambar 514 daerah. Jalur ini langsung memproyeksikan tiap titik.
 */
export function jalurDatar(proyeksi: GeoProjection): GeoPath {
  return geoPath(
    geoTransform({
      point(x, y) {
        const [px, py] = proyeksi([x, y])!;
        this.stream.point(px, py);
      },
    }),
  );
}

/** Semua titik sebuah objek GeoJSON, untuk fitWidth/fitExtent tanpa menjalankan jalur bola atas seluruh poligon. */
export function titikSudut(objek: GeoJSON): MultiPoint {
  const hasil: Position[] = [];
  const jalan = (c: unknown): void => {
    if (typeof (c as unknown[])[0] === "number") hasil.push(c as Position);
    else for (const x of c as unknown[]) jalan(x);
  };
  const isi = (g: GeoJSON | null): void => {
    if (!g) return;
    if (g.type === "FeatureCollection") g.features.forEach(isi);
    else if (g.type === "Feature") isi(g.geometry);
    else if (g.type === "GeometryCollection") g.geometries.forEach(isi);
    else jalan(g.coordinates);
  };
  isi(objek);
  return { type: "MultiPoint", coordinates: hasil };
}
