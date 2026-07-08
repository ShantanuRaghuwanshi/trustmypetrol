import { FlatList, Text } from "react-native";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { PumpCard } from "@/components/PumpCard";

export default function PumpsScreen() {
  const { pumps, scoreFor } = useStore();
  const sorted = [...pumps].sort(
    (a, b) => (scoreFor(b.id).score ?? -1) - (scoreFor(a.id).score ?? -1),
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 14, gap: 10 }}
      ListHeaderComponent={
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 4 }}>
          Trust scores from geo-verified reports · last 90 days
        </Text>
      }
      renderItem={({ item }) => (
        <PumpCard pump={item} score={scoreFor(item.id)} />
      )}
    />
  );
}
