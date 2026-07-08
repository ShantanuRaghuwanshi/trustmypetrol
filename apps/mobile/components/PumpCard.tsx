import { Pressable, Text, View } from "react-native";
import { displayDealerCode } from "@tmp/shared";
import { Link } from "expo-router";
import type { Pump, PumpScore } from "@tmp/shared";
import { colors } from "@/lib/theme";
import { ScorePill } from "@/components/ScorePill";

export function Chip({
  label,
  on,
  subtle,
}: {
  label: string;
  on?: boolean;
  subtle?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: on ? colors.petrol : subtle ? colors.paper : "#EDF3F2",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderWidth: subtle ? 1 : 0,
        borderColor: colors.line,
      }}
    >
      <Text
        style={{
          color: on ? "#fff" : subtle ? colors.muted : "#33484A",
          fontSize: 11,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function PumpCard({
  pump,
  score,
  compact,
}: {
  pump: Pump;
  score: PumpScore;
  compact?: boolean;
}) {
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
          shadowColor: "#0E3A3E",
          shadowOpacity: compact ? 0.18 : 0,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: compact ? 6 : 0,
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
        <Text style={{ color: colors.muted, fontSize: 12.5 }} numberOfLines={1}>
          {pump.omc} · {pump.address}
          {displayDealerCode(pump.dealerCode) ? ` · dealer ${displayDealerCode(pump.dealerCode)}` : ""}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {pump.blends.premium && <Chip label="XP100" on />}
          {pump.blends.higherBlends && <Chip label="E25+" on />}
          {pump.blends.e100 && <Chip label="E100" on />}
          {pump.blends.cng && <Chip label="CNG" on />}
          {!compact && score.reportCount > 0 && (
            <Chip
              label={`${score.reportCount} reports · ${Math.round(score.geoVerifiedRatio * 100)}% geo-verified`}
              subtle
            />
          )}
        </View>
      </Pressable>
    </Link>
  );
}
