// Sederhanakan batas wilayah dan simpan sebagai TopoJSON untuk aplikasi.
// Masukan: data/antara/adm2_id.geojson (hasil bangun.py)
// Keluaran: public/data/peta.json
import mapshaper from "mapshaper";
import { statSync } from "node:fs";

const keluar = "public/data/peta.json";
await mapshaper.runCommands(
  [
    "-i data/antara/adm2_id.geojson name=semua",
    // Pulau-pulau kecil < 4 km² dibuang supaya berkas ringan, kecuali Kepulauan
    // Seribu yang seluruhnya terdiri dari pulau kecil.
    `-filter "id === 'kab-kepulauan-seribu'" + name=seribu target=semua`,
    `-filter "id !== 'kab-kepulauan-seribu'" target=semua`,
    "-filter-islands min-area=4km2 remove-empty target=semua",
    "-merge-layers target=semua,seribu name=daerah",
    "-simplify 7% weighted keep-shapes",
    "-clean",
    `-o format=topojson quantization=60000 ${keluar}`,
  ].join(" "),
);
console.log(`${keluar}: ${(statSync(keluar).size / 1024).toFixed(0)} KB`);
