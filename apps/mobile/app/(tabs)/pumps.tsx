import { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { PumpCard } from "@/components/PumpCard";
import { CityChips } from "@/components/CityChips";

export default function PumpsScreen() {
  const { pumps, scoreFor } = useStore();
  const [city, setCity] = useState("");

  const sorted = useMemo(
    () =>
      pumps
        .filter((p) => !city || p.district === city)
        .sort(
          (a, b) => (scoreFor(b.id).score ?? -1) - (scoreFor(a.id).score ?? -1),
        ),
    [pumps, city, scoreFor],
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 14, gap: 10 }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <CityChips city={city} onChange={setCity} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Trust scores from geo-verified reports · last 90 days
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <PumpCard pump={item} score={scoreFor(item.id)} />
      )}
    />
  );
}
