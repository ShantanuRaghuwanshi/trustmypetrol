/**
 * Imports petrol pumps for the pilot metros from OpenStreetMap (Overpass
 * API, amenity=fuel) and writes supabase/seed/0003_osm_pumps.sql.
 *
 * Data © OpenStreetMap contributors, ODbL — attribution required wherever
 * this data is displayed. Dealer codes are not in OSM; imported pumps get
 * a stable "OSM-<id>" code until enriched from OMC locator datasets.
 *
 * Run: node scripts/import-osm-pumps.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const CACHE_DIR = ".osm-cache";
mkdirSync(CACHE_DIR, { recursive: true });

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const USER_AGENT =
  "TrustMyPetrol/0.1 (fuel-quality reporting pilot; github.com/ShantanuRaghuwanshi/trustmypetrol)";

const CITY_BBOXES: Record<string, { state: string; bbox: string }> = {
  Delhi: { state: "Delhi", bbox: "28.40,76.85,28.90,77.40" },
  Mumbai: { state: "Maharashtra", bbox: "18.89,72.75,19.30,73.05" },
  Bengaluru: { state: "Karnataka", bbox: "12.80,77.45,13.15,77.80" },
  Hyderabad: { state: "Telangana", bbox: "17.25,78.25,17.60,78.65" },
  Chennai: { state: "Tamil Nadu", bbox: "12.85,80.10,13.25,80.35" },
  Kolkata: { state: "West Bengal", bbox: "22.45,88.25,22.70,88.50" },
  Pune: { state: "Maharashtra", bbox: "18.40,73.70,18.70,74.00" },
  Ahmedabad: { state: "Gujarat", bbox: "22.90,72.45,23.15,72.70" },
};

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function inferOmc(tags: Record<string, string>): string {
  const hay = [tags.brand, tags.operator, tags.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/indian ?oil|iocl/.test(hay)) return "IOCL";
  if (/bharat ?petroleum|bpcl/.test(hay)) return "BPCL";
  if (/hindustan ?petroleum|hpcl|\bhp\b/.test(hay)) return "HPCL";
  if (/nayara|essar/.test(hay)) return "NAYARA";
  if (/jio|reliance/.test(hay)) return "JIO_BP";
  if (/shell/.test(hay)) return "SHELL";
  return "OTHER";
}

function buildAddress(tags: Record<string, string>, city: string): string {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"] ?? tags["addr:road"],
    tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? tags["addr:locality"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : city;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function fetchCity(city: string, bbox: string): Promise<OsmElement[]> {
  const cacheFile = `${CACHE_DIR}/${city}.json`;
  if (existsSync(cacheFile)) {
    console.log(`${city}: using cached response`);
    return JSON.parse(readFileSync(cacheFile, "utf8")) as OsmElement[];
  }
  const query = `[out:json][timeout:90];(node["amenity"="fuel"](${bbox});way["amenity"="fuel"](${bbox}););out center tags;`;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(120_000),
        });
        if (res.ok) {
          const json = (await res.json()) as { elements: OsmElement[] };
          writeFileSync(cacheFile, JSON.stringify(json.elements));
          return json.elements;
        }
        lastError = `${endpoint} → ${res.status}`;
      } catch (e) {
        lastError = `${endpoint} → ${e instanceof Error ? e.message : e}`;
      }
      console.warn(`${city}: ${lastError}, trying next…`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error(`${city}: all overpass endpoints failed (${lastError})`);
}

const rows: string[] = [];
let total = 0;

for (const [city, { state, bbox }] of Object.entries(CITY_BBOXES)) {
  const elements = await fetchCity(city, bbox);
  let count = 0;
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = el.tags ?? {};
    const omc = inferOmc(tags);
    const name =
      tags.name ??
      tags.brand ??
      tags.operator ??
      `${omc === "OTHER" ? "Petrol" : omc} pump`;
    const address = buildAddress(tags, city);
    const code = `OSM-${el.type === "way" ? "W" : "N"}${el.id}`;
    const cng = tags["fuel:cng"] === "yes";
    const blends = JSON.stringify({
      e20: true,
      higherBlends: false,
      e100: false,
      premium: false,
      cng,
    });
    rows.push(
      `  (${q(omc)}, ${q(code)}, ${q(name.slice(0, 120))}, ${q(address.slice(0, 200))}, ` +
        `${q(city)}, ${q(state)}, st_setsrid(st_makepoint(${lon}, ${lat}), 4326)::geography, '${blends}', 'active')`,
    );
    count++;
  }
  total += count;
  console.log(`${city}: ${count} pumps`);
  // be polite to the public Overpass instance
  await new Promise((r) => setTimeout(r, 3000));
}

const sql = `-- Real pump locations imported from OpenStreetMap (amenity=fuel).
-- Data © OpenStreetMap contributors, ODbL (openstreetmap.org/copyright).
-- Generated by scripts/import-osm-pumps.ts — re-run to refresh.
-- Dealer codes are OSM-<id> placeholders pending OMC locator enrichment.

insert into pumps (omc, dealer_code, name, address, district, state, location, blends, status) values
${rows.join(",\n")}
on conflict (omc, dealer_code) do update set
  name = excluded.name,
  address = excluded.address,
  location = excluded.location;

insert into pump_scores (pump_id) select id from pumps
on conflict (pump_id) do nothing;
`;

writeFileSync("supabase/seed/0003_osm_pumps.sql", sql);
console.log(`total: ${total} pumps → supabase/seed/0003_osm_pumps.sql`);
