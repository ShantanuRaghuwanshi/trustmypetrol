import { Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { Pump, PumpScore } from "@tmp/shared";
import { verdictColor } from "@/lib/theme";

export interface MapHomeProps {
  pumps: Pump[];
  scoreFor: (pumpId: string) => PumpScore;
  selectedId: string | null;
  onSelect: (pumpId: string) => void;
}

const INDIA = {
  latitude: 21.5,
  longitude: 79.0,
  latitudeDelta: 22,
  longitudeDelta: 22,
};

function regionFor(pumps: Pump[]) {
  if (pumps.length === 0) return INDIA;
  const lats = pumps.map((p) => p.lat);
  const lngs = pumps.map((p) => p.lng);
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

export default function MapHome({
  pumps: allPumps,
  scoreFor,
  selectedId,
  onSelect,
}: MapHomeProps) {
  const pumps =
    allPumps.length <= MAX_MARKERS
      ? allPumps
      : allPumps.slice(0, MAX_MARKERS);
  return (
    <MapView style={{ flex: 1 }} initialRegion={regionFor(pumps)}>
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
    </MapView>
  );
}
