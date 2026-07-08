import { FlatList, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { ScorePill } from "@/components/ScorePill";

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
      renderItem={({ item: pump }) => {
        const score = scoreFor(pump.id);
        return (
          <Link href={{ pathname: "/pump/[id]", params: { id: pump.id } }} asChild>
            <Pressable
              style={{
                backgroundColor: colors.card,
                borderColor: colors.line,
                borderWidth: 1,
                borderRadius: 14,
                padding: 14,
                gap: 6,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "700", flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {pump.name}
                </Text>
                <ScorePill score={score} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 12.5 }}>
                {pump.omc} · {pump.address}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {pump.blends.e20 && <Chip label="E20" />}
                {pump.blends.e10 && <Chip label="E10" />}
                {pump.blends.premium && <Chip label="Premium" />}
                {score.reportCount > 0 && (
                  <Chip label={`${score.reportCount} reports`} subtle />
                )}
              </View>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}

function Chip({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: subtle ? colors.paper : colors.petrol,
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderWidth: subtle ? 1 : 0,
        borderColor: colors.line,
      }}
    >
      <Text
        style={{
          color: subtle ? colors.muted : "#fff",
          fontSize: 11,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
