import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCivicStore } from "@/lib/civicStore";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { PumpCard } from "@/components/PumpCard";
import { CityChips } from "@/components/CityChips";
import MapHome from "@/components/MapHome";

type Filter = "all" | "premium" | "higherBlends" | "e100" | "cng";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "premium", label: "XP100" },
  { id: "higherBlends", label: "E25+ blends" },
  { id: "e100", label: "E100" },
  { id: "cng", label: "CNG" },
];

/** One map, layered: pumps and civic issues are toggles, not silos. */
type Layer = "all" | "pumps" | "civic";

const LAYERS: { id: Layer; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "pumps", label: "⛽ Pumps" },
  { id: "civic", label: "🚧 Civic issues" },
];

export default function MapScreen() {
  const { pumps, scoreFor } = useStore();
  const { issues } = useCivicStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [layer, setLayer] = useState<Layer>("all");
  const [city, setCity] = useState("Pune");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  // if location is already granted, show the user on the map and center
  // there — never prompts; the report flow / pumps tab handle requesting
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled)
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // location unavailable — map keeps the city fit
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pumps.filter((p) => {
      if (city && p.district !== city) return false;
      if (filter !== "all" && !p.blends[filter]) return false;
      if (q && !`${p.name} ${p.address}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [pumps, query, filter, city]);

  const selected =
    filtered.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 14, paddingBottom: 10, gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: colors.card,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={15} color={colors.muted} />
          <TextInput
            placeholder={`Search pumps${city ? ` in ${city}` : ""}…`}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1, paddingVertical: 10, fontSize: 14 }}
          />
        </View>
        <CityChips
          city={city}
          onChange={(c) => {
            setCity(c);
            setSelectedId(null);
          }}
        />
        <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
          {LAYERS.map((l) => {
            const on = layer === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => setLayer(l.id)}
                style={{
                  backgroundColor: on ? colors.ink : colors.card,
                  borderColor: on ? colors.ink : "#CBD6D4",
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
                hitSlop={6}
              >
                <Text
                  style={{
                    color: on ? "#fff" : "#33484A",
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {l.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {layer !== "civic" && (
        <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{
                  backgroundColor: on ? colors.petrol : colors.card,
                  borderColor: on ? colors.petrol : "#CBD6D4",
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
                hitSlop={6}
              >
                <Text
                  style={{
                    color: on ? "#fff" : "#33484A",
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <MapHome
          key={`${city || "all"}-${layer}${userLoc ? "-located" : ""}`}
          pumps={layer === "civic" ? [] : filtered}
          scoreFor={scoreFor}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          userLoc={userLoc}
          issues={layer === "pumps" ? [] : issues}
          onSelectIssue={(issueId) =>
            router.push({
              pathname: "/civic/issue/[id]",
              params: { id: issueId },
            })
          }
        />
        {Platform.OS !== "web" && layer !== "civic" && selected && (
          <View
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 14,
            }}
          >
            <PumpCard pump={selected} score={scoreFor(selected.id)} compact />
          </View>
        )}
      </View>
    </View>
  );
}
