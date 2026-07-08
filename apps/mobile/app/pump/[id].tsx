import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { SIGNALS, type Signal } from "@tmp/shared";
import { SEED_DEALER_RESPONSES } from "@tmp/shared/seed";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { ScoreRing } from "@/components/ScoreRing";
import { Chip } from "@/components/PumpCard";

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
        <Text style={{ fontSize: 20, fontWeight: "800" }}>{pump.name}</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {pump.address}, {pump.district}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {pump.blends.e20 && <Chip label="E20" on />}
          {pump.blends.e10 ? <Chip label="E10" on /> : <Chip label="E10 ✕" subtle />}
          {pump.blends.premium ? (
            <Chip label="Premium" on />
          ) : (
            <Chip label="Premium ✕" subtle />
          )}
          {pump.blends.cng && <Chip label="CNG" on />}
        </View>
      </View>

      {/* score dial + signal breakdown, side by side like the mockup */}
      <View style={[card, { flexDirection: "row", gap: 14, alignItems: "center" }]}>
        <ScoreRing score={score} />
        <View style={{ flex: 1 }}>
          <Text style={[label, { marginBottom: 6 }]}>
            Last 90 days · {score.reportCount} reports
          </Text>
          {counts.length === 0 && (
            <Text style={{ color: colors.muted, fontSize: 12.5 }}>
              No signals recorded yet.
            </Text>
          )}
          {counts
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([signal, n]) => (
              <View
                key={signal}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 5,
                }}
              >
                <Text style={{ width: 118, fontSize: 12 }} numberOfLines={1}>
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

      <Text style={label}>Recent reports</Text>
      {reports.map((r) => {
        const dealerResponse = SEED_DEALER_RESPONSES[r.id];
        return (
          <View key={r.id} style={{ gap: 8 }}>
            <View style={card}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "600", fontSize: 13 }}>
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
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 5,
                  marginTop: 7,
                }}
              >
                {r.signals.map((s) => (
                  <Chip key={s} label={SIGNALS[s].label} />
                ))}
              </View>
              {r.freeText ? (
                <Text style={{ marginTop: 7, fontSize: 13, color: "#4A5A5C" }}>
                  {r.freeText}
                </Text>
              ) : null}
            </View>
            {dealerResponse && (
              <View
                style={[
                  card,
                  { backgroundColor: "#F4F7F6", marginLeft: 18 },
                ]}
              >
                <Text
                  style={[label, { color: colors.petrol, marginBottom: 4 }]}
                >
                  Dealer response · verified owner
                </Text>
                <Text style={{ fontSize: 12.5, color: "#4A5A5C", lineHeight: 18 }}>
                  {dealerResponse}
                </Text>
              </View>
            )}
          </View>
        );
      })}
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
};
