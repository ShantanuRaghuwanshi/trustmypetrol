/** Metro cities covered by the pilot. `district` values on pumps match `name`. */
export const CITIES = [
  { name: "Delhi", state: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
] as const;

export type CityName = (typeof CITIES)[number]["name"];

export const CITY_NAMES = CITIES.map((c) => c.name);
