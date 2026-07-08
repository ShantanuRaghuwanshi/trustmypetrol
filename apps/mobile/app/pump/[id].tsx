import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { SIGNALS, type Signal } from "@tmp/shared";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { ScorePill } from "@/components/ScorePill";

export default function PumpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pumps, reportsFor, scoreFor } = useStore();
  const pump = pumps.find((p) => p.id === id);
  if (!pump) return <Text style={{ padding: 20 }}>Pump not found.</Text>;

  const score = scoreFor(pump.id);
  const reports = reportsFor(pump.id).slice(0, 10);
  const counts = Object.entries(score.signalCounts) as [Signal, number][];
  const maxCount = Math.max(1, ...counts.map(([, n]) => n));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 12.5 }}>
          {pump.omc} · dealer {pump.dealerCode}
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "800", flexShrink: 1 }}>
            {pump.name}
          </Text>
          <ScorePill score={score} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {pump.address}, {pump.district} · {score.reportCount} reports in 90
          days
        </Text>
      </View>

      <Link
        href={{ pathname: "/report/[pumpId]", params: { pumpId: pump.id } }}
        asChild
      >
        <Pressable
          style={{
            backgroundColor: colors.petrol,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "700",
              textAlign: "center",
              fontSize: 15,
            }}
          >
            Report an issue at this pump
          </Text>
        </Pressable>
      </Link>

      {counts.length > 0 && (
        <View style={card}>
          <Text style={label}>Signal breakdown</Text>
          {counts
            .sort(([, a], [, b]) => b - a)
            .map(([signal, n]) => (
              <View
                key={signal}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <Text style={{ width: 150, fontSize: 12.5 }}>
                  {SIGNALS[signal].label}
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: "#E8EEED",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${(n / maxCount) * 100}%`,
                      height: "100%",
                      backgroundColor:
                        SIGNALS[signal].polarity === "positive"
                          ? colors.good
                          : SIGNALS[signal].polarity === "negative"
                            ? colors.bad
                            : colors.nodata,
                    }}
                  />
                </View>
                <Text
                  style={{
                    width: 20,
                    textAlign: "right",
                    color: colors.muted,
                    fontSize: 12,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {n}
                </Text>
              </View>
            ))}
        </View>
      )}

      <Text style={label}>Recent reports</Text>
      {reports.map((r) => (
        <View key={r.id} style={card}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "650" as never, fontSize: 13 }}>
              {new Date(r.reportedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </Text>
            <View
              style={{
                backgroundColor:
                  r.verification === "geo_verified"
                    ? colors.geoBg
                    : "#F0EDE6",
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "700",
                  color:
                    r.verification === "geo_verified"
                      ? colors.geoText
                      : "#8A7A4E",
                }}
              >
                {r.verification === "geo_verified"
                  ? `✓ Geo-verified${r.distanceToPumpM != null ? ` · ${Math.round(r.distanceToPumpM)} m` : ""}`
                  : "Unverified"}
              </Text>
            </View>
          </View>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 }}
          >
            {r.signals.map((s) => (
              <View
                key={s}
                style={{
                  backgroundColor: "#EDF3F2",
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 11, color: "#33484A" }}>
                  {SIGNALS[s].label}
                </Text>
              </View>
            ))}
          </View>
          {r.freeText ? (
            <Text style={{ marginTop: 7, fontSize: 13, color: "#4A5A5C" }}>
              {r.freeText}
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const card = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 14,
  padding: 14,
} as const;

const label = {
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
  color: colors.muted,
  fontWeight: "700" as const,
  marginBottom: 8,
};
