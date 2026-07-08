import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { PumpScore } from "@tmp/shared";
import { colors, verdictColor } from "@/lib/theme";

const VERDICT_LABEL = { good: "GOOD", mixed: "MIXED", poor: "POOR" } as const;

export function ScoreRing({ score, size = 86 }: { score: PumpScore; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = score.score ?? 0;
  const dash = (value / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#E8EEED"
          strokeWidth={stroke}
          fill="none"
        />
        {score.score !== null && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={verdictColor(score.verdict)}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            fill="none"
          />
        )}
      </Svg>
      <View
        style={{
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {score.score === null ? (
          <Text
            style={{
              fontSize: 9.5,
              fontWeight: "700",
              color: colors.muted,
              textAlign: "center",
            }}
          >
            NOT ENOUGH{"\n"}DATA
          </Text>
        ) : (
          <>
            <Text
              style={{
                fontSize: 23,
                fontWeight: "800",
                lineHeight: 26,
                fontVariant: ["tabular-nums"],
              }}
            >
              {score.score}
            </Text>
            <Text
              style={{ fontSize: 9.5, color: colors.muted, fontWeight: "700" }}
            >
              {score.verdict ? VERDICT_LABEL[score.verdict] : ""}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
