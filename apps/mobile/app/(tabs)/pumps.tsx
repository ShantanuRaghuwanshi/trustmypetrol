import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import { distanceMeters, formatDistance } from "@tmp/shared";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { PumpCard } from "@/components/PumpCard";
import { CityChips } from "@/components/CityChips";

export default function PumpsScreen() {
  const { pumps, scoreFor } = useStore();
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [nearMe, setNearMe] = useState(false);
  const [locating, setLocating] = useState(false);

  const locate = useCallback(async (request: boolean) => {
    setLocating(true);
    try {
      const perm = request
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setNearMe(true);
    } catch {
      // location unavailable — keep the score sort
    } finally {
      setLocating(false);
    }
  }, []);

  // if location was already granted (e.g. for report capture), sort by
  // distance right away without prompting
  useEffect(() => {
    void locate(false);
  }, [locate]);

  const distances = useMemo(() => {
    if (!coords) return null;
    return new Map(
      pumps.map((p) => [
        p.id,
        distanceMeters(coords.lat, coords.lng, p.lat, p.lng),
      ]),
    );
  }, [pumps, coords]);

  const byDistance = nearMe && distances !== null;
  const sorted = useMemo(
    () =>
      pumps
        .filter((p) => !city || p.district === city)
        .sort((a, b) =>
          byDistance
            ? distances!.get(a.id)! - distances!.get(b.id)!
            : (scoreFor(b.id).score ?? -1) - (scoreFor(a.id).score ?? -1),
        ),
    [pumps, city, scoreFor, byDistance, distances],
  );
  const nearest = byDistance ? sorted[0] : undefined;

  return (
    <FlatList
      data={sorted}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 14, gap: 10 }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 7 }}>
            <Pressable
              onPress={() => {
                if (nearMe) setNearMe(false);
                else if (coords) setNearMe(true);
                else void locate(true);
              }}
              style={{
                backgroundColor: nearMe ? colors.petrol : colors.card,
                borderColor: nearMe ? colors.petrol : "#CBD6D4",
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
              hitSlop={6}
            >
              <Text
                style={{
                  color: nearMe ? "#fff" : "#33484A",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {locating ? "Locating…" : "📍 Near me"}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <CityChips city={city} onChange={setCity} />
            </View>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {nearest && distances
              ? `Nearest: ${nearest.name} · ${formatDistance(distances.get(nearest.id)!)} away`
              : "Trust scores from geo-verified reports · last 90 days"}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <PumpCard
          pump={item}
          score={scoreFor(item.id)}
          distanceM={distances?.get(item.id)}
        />
      )}
    />
  );
}
