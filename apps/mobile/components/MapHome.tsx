import { Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { Pump, PumpScore } from "@tmp/shared";
import type { CivicIssue } from "@tmp/civic";
import { colors, verdictColor } from "@/lib/theme";

export interface MapHomeProps {
  pumps: Pump[];
  scoreFor: (pumpId: string) => PumpScore;
  selectedId: string | null;
  onSelect: (pumpId: string) => void;
  userLoc?: { lat: number; lng: number } | null;
  /** Civic layer: open issues rendered as amber pins alongside the pumps. */
  issues?: CivicIssue[];
  onSelectIssue?: (issueId: string) => void;
}

const INDIA = {
  latitude: 21.5,
  longitude: 79.0,
  latitudeDelta: 22,
  longitudeDelta: 22,
};

function regionFor(pts: { lat: number; lng: number }[]) {
  if (pts.length === 0) return INDIA;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.12),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.12),
  };
}

// react-native-maps chokes on thousands of custom markers; cap until
// clustering lands. The list tabs still show everything (virtualised).
const MAX_MARKERS = 250;

/**
 * Center on the user when they're inside the fitted pump region (i.e. they
 * are actually in the selected city); otherwise keep the pump fit so a city
 * chip still frames that city.
 */
function regionWithUser(
  pts: { lat: number; lng: number }[],
  userLoc: MapHomeProps["userLoc"],
) {
  const region = regionFor(pts);
  if (!userLoc) return region;
  const inLat =
    Math.abs(userLoc.lat - region.latitude) <= region.latitudeDelta / 2;
  const inLng =
    Math.abs(userLoc.lng - region.longitude) <= region.longitudeDelta / 2;
  if (!inLat || !inLng) return region;
  return {
    latitude: userLoc.lat,
    longitude: userLoc.lng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };
}

export default function MapHome({
  pumps: allPumps,
  scoreFor,
  selectedId,
  onSelect,
  userLoc,
  issues: allIssues,
  onSelectIssue,
}: MapHomeProps) {
  const pumps =
    allPumps.length <= MAX_MARKERS
      ? allPumps
      : allPumps.slice(0, MAX_MARKERS);
  // Civic pins share the marker budget; unresolved issues surface first
  // in the civic tab's list regardless.
  const issues = (allIssues ?? [])
    .filter((i) => i.status !== "resolved")
    .slice(0, Math.max(0, MAX_MARKERS - pumps.length));
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={regionWithUser([...pumps, ...issues], userLoc)}
      showsUserLocation={!!userLoc}
      showsMyLocationButton={!!userLoc}
    >
      {pumps.map((pump) => {
        const score = scoreFor(pump.id);
        const selected = pump.id === selectedId;
        return (
          <Marker
            key={pump.id}
            coordinate={{ latitude: pump.lat, longitude: pump.lng }}
            onPress={() => onSelect(pump.id)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={{
                width: selected ? 40 : 34,
                height: selected ? 40 : 34,
                borderRadius: 20,
                backgroundColor: verdictColor(score.verdict),
                borderWidth: 2.5,
                borderColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "800",
                  fontSize: score.score === null ? 15 : 12,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {score.score === null ? "·" : score.score}
              </Text>
            </View>
          </Marker>
        );
      })}
      {issues.map((issue) => (
        <Marker
          key={issue.id}
          coordinate={{ latitude: issue.lat, longitude: issue.lng }}
          onPress={() => onSelectIssue?.(issue.id)}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              transform: [{ rotate: "45deg" }],
              backgroundColor: colors.amber,
              borderWidth: 2,
              borderColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            }}
          >
            <Text
              style={{
                transform: [{ rotate: "-45deg" }],
                color: "#fff",
                fontWeight: "800",
                fontSize: 11,
                fontVariant: ["tabular-nums"],
              }}
            >
              {issue.reportCount > 9 ? "9+" : issue.reportCount}
            </Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}
