/**
 * Imports real jurisdiction geometry for the civic-infra resolver and writes
 * supabase/seed/0004_boundaries.sql:
 *
 *   1. ULB municipal boundaries — Nominatim (polygon_geojson=1) for each
 *      pilot metro's municipal corporation relation.
 *   2. National Highway centrelines — Overpass, ways tagged ref=NH* within
 *      each pilot metro's bbox.
 *
 * Data © OpenStreetMap contributors, ODbL — attribution required wherever
 * this data is displayed. No geometry is ever fabricated: cities whose
 * boundary cannot be fetched are skipped with a warning and the resolver
 * degrades to 'unresolved' there.
 *
 * Nominatim usage policy compliance: 1 request/second, descriptive UA.
 *
 * Run: node scripts/import-boundaries.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const CACHE_DIR = ".osm-cache";
mkdirSync(CACHE_DIR, { recursive: true });

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const USER_AGENT =
  "TrustMyPetrol/0.1 (civic-infra jurisdiction pilot; github.com/ShantanuRaghuwanshi/trustmypetrol)";

/**
 * Nominatim queries per ULB, tried in order until one returns an
 * administrative boundary polygon. agency_slug must match civic_agencies.
 * bbox (s,w,n,e) mirrors scripts/import-osm-pumps.ts and scopes the NH query.
 */
const ULBS: {
  slug: string;
  city: string;
  queries: string[];
  bbox: string;
}[] = [
  { slug: "ulb-pune", city: "Pune",
    queries: ["Pune Municipal Corporation", "Pune, Maharashtra, India"],
    bbox: "18.40,73.70,18.70,74.00" },
  { slug: "ulb-mumbai", city: "Mumbai",
    queries: ["Municipal Corporation of Greater Mumbai", "Mumbai, Maharashtra, India"],
    bbox: "18.89,72.75,19.30,73.05" },
  // MCD's own relation is patchy in OSM; the NCT boundary is the documented
  // Phase-1 approximation (covers NDMC/Cantonment areas too — see docs).
  { slug: "ulb-delhi", city: "Delhi",
    queries: ["Municipal Corporation of Delhi", "National Capital Territory of Delhi, India"],
    bbox: "28.40,76.85,28.90,77.40" },
  { slug: "ulb-bengaluru", city: "Bengaluru",
    queries: ["Bruhat Bengaluru Mahanagara Palike", "Bengaluru, Karnataka, India"],
    bbox: "12.80,77.45,13.15,77.80" },
  { slug: "ulb-hyderabad", city: "Hyderabad",
    queries: ["Greater Hyderabad Municipal Corporation", "Hyderabad, Telangana, India"],
    bbox: "17.25,78.25,17.60,78.65" },
  { slug: "ulb-chennai", city: "Chennai",
    queries: ["Greater Chennai Corporation", "Chennai, Tamil Nadu, India"],
    bbox: "12.85,80.10,13.25,80.35" },
  { slug: "ulb-kolkata", city: "Kolkata",
    queries: ["Kolkata Municipal Corporation", "Kolkata, West Bengal, India"],
    bbox: "22.45,88.25,22.70,88.50" },
  { slug: "ulb-ahmedabad", city: "Ahmedabad",
    queries: ["Ahmedabad Municipal Corporation", "Ahmedabad, Gujarat, India"],
    bbox: "22.90,72.45,23.15,72.70" },
];

interface NominatimResult {
  osm_type: string;
  osm_id: number;
  display_name: string;
  class: string;
  type: string;
  geojson?: { type: string; coordinates: unknown };
}

interface OverpassWay {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Nominatim lookup with cache; returns the first admin-boundary polygon. */
async function fetchBoundary(
  ulb: (typeof ULBS)[number],
): Promise<NominatimResult | null> {
  const cacheFile = `${CACHE_DIR}/boundary-${ulb.slug}.json`;
  if (existsSync(cacheFile)) {
    console.log(`${ulb.city}: using cached boundary`);
    return JSON.parse(readFileSync(cacheFile, "utf8")) as NominatimResult;
  }
  for (const query of ulb.queries) {
    await sleep(1100); // Nominatim policy: max 1 req/s
    const url = `${NOMINATIM}?format=jsonv2&polygon_geojson=1&limit=3&q=${encodeURIComponent(query)}`;
    let results: NominatimResult[];
    try {
      results = (await fetchJson(url)) as NominatimResult[];
    } catch (e) {
      console.warn(`${ulb.city}: nominatim failed for "${query}": ${e}`);
      continue;
    }
    const hit = results.find(
      (r) =>
        r.osm_type === "relation" &&
        (r.geojson?.type === "Polygon" || r.geojson?.type === "MultiPolygon"),
    );
    if (hit) {
      writeFileSync(cacheFile, JSON.stringify(hit));
      console.log(`${ulb.city}: boundary from "${query}" (relation ${hit.osm_id})`);
      return hit;
    }
    console.warn(`${ulb.city}: no boundary polygon for "${query}"`);
  }
  return null;
}

/** Overpass: NH-tagged ways with geometry inside a city bbox, cached. */
async function fetchNhWays(city: string, bbox: string): Promise<OverpassWay[]> {
  const cacheFile = `${CACHE_DIR}/nh-${city}.json`;
  if (existsSync(cacheFile)) {
    console.log(`${city}: using cached NH ways`);
    return JSON.parse(readFileSync(cacheFile, "utf8")) as OverpassWay[];
  }
  const query = `[out:json][timeout:90];way["highway"]["ref"~"^NH"](${bbox});out geom tags;`;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const data = (await fetchJson(endpoint, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })) as { elements: OverpassWay[] };
        writeFileSync(cacheFile, JSON.stringify(data.elements));
        console.log(`${city}: ${data.elements.length} NH ways`);
        return data.elements;
      } catch (e) {
        lastError = String(e);
        await sleep(2000);
      }
    }
  }
  throw new Error(`overpass failed for ${city}: ${lastError}`);
}

/** "NH48;NH 4" → "NH 48" (first ref, normalised spacing). */
function normaliseNhRef(raw: string): string | null {
  const first = raw.split(";")[0]?.trim() ?? "";
  const m = first.match(/^NH[\s-]*(\d+[A-Z]*)$/i);
  return m ? `NH ${m[1]!.toUpperCase()}` : null;
}

function boundarySql(
  ulb: (typeof ULBS)[number],
  hit: NominatimResult,
  fetchedAt: string,
): string {
  // Promote Polygon → MultiPolygon so every row matches the column type.
  const geojson = JSON.stringify(hit.geojson);
  return `insert into admin_boundaries (agency_slug, name, boundary, source, source_ref, source_url, fetched_at)
values (${q(ulb.slug)}, ${q(hit.display_name)},
  st_multi(st_geomfromgeojson(${q(geojson)}))::geography,
  'osm', ${q(`relation/${hit.osm_id}`)},
  ${q(`https://www.openstreetmap.org/relation/${hit.osm_id}`)},
  ${q(fetchedAt)})
on conflict (agency_slug) do update
  set boundary = excluded.boundary, name = excluded.name,
      source_ref = excluded.source_ref, source_url = excluded.source_url,
      fetched_at = excluded.fetched_at;`;
}

function nhSql(way: OverpassWay, ref: string, fetchedAt: string): string | null {
  const pts = way.geometry ?? [];
  if (pts.length < 2) return null;
  const coords = pts.map((p) => [p.lon, p.lat]);
  const geojson = JSON.stringify({ type: "LineString", coordinates: coords });
  return `insert into nh_routes (ref, geom, source, source_ref, fetched_at)
values (${q(ref)}, st_geomfromgeojson(${q(geojson)})::geography,
  'osm', ${q(`way/${way.id}`)}, ${q(fetchedAt)});`;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const statements: string[] = [];
  let boundaries = 0;
  let nhWays = 0;

  for (const ulb of ULBS) {
    const hit = await fetchBoundary(ulb);
    if (!hit) {
      console.warn(`⚠ ${ulb.city}: SKIPPED — no boundary found, resolver will return 'unresolved' here`);
      continue;
    }
    statements.push(boundarySql(ulb, hit, fetchedAt));
    boundaries++;
  }

  for (const ulb of ULBS) {
    const ways = await fetchNhWays(ulb.city, ulb.bbox);
    for (const way of ways) {
      const ref = way.tags?.ref ? normaliseNhRef(way.tags.ref) : null;
      if (!ref) continue;
      const sql = nhSql(way, ref, fetchedAt);
      if (sql) {
        statements.push(sql);
        nhWays++;
      }
    }
  }

  const header = `-- Jurisdiction geometry for the civic-infra resolver.
-- GENERATED by scripts/import-boundaries.ts on ${fetchedAt} — do not edit by hand.
-- Data © OpenStreetMap contributors, ODbL (openstreetmap.org/copyright).
-- ${boundaries}/${ULBS.length} ULB boundaries, ${nhWays} NH way segments.

-- Re-runnable: boundaries upsert on agency_slug; NH ways are replaced wholesale.
delete from nh_routes where source = 'osm';
`;
  writeFileSync(
    "supabase/seed/0004_boundaries.sql",
    `${header}\n${statements.join("\n\n")}\n`,
  );
  console.log(
    `\nWrote supabase/seed/0004_boundaries.sql (${boundaries} boundaries, ${nhWays} NH ways)`,
  );
  if (boundaries < ULBS.length) {
    process.exitCode = 1; // partial data is loud, not silent
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
