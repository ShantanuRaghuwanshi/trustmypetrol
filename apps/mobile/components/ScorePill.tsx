import { Text, View } from "react-native";
import type { PumpScore } from "@tmp/shared";
import { verdictColor } from "@/lib/theme";

export function ScorePill({ score }: { score: PumpScore }) {
  const noData = score.score === null;
  return (
    <View
      style={{
        backgroundColor: verdictColor(score.verdict),
        borderRadius: 999,
        paddingHorizontal: noData ? 10 : 12,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontWeight: "800",
          fontSize: noData ? 11 : 15,
          fontVariant: ["tabular-nums"],
        }}
      >
        {noData ? "Not enough data" : score.score}
      </Text>
    </View>
  );
}
