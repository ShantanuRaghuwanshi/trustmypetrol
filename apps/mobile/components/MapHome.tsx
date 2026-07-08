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

const PUNE = {
  latitude: 18.5204,
  longitude: 73.8567,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};

export default function MapHome({
  pumps,
  scoreFor,
  selectedId,
  onSelect,
}: MapHomeProps) {
  return (
    <MapView style={{ flex: 1 }} initialRegion={PUNE}>
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
