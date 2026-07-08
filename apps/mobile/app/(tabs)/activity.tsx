import { FlatList, Text, View } from "react-native";
import { Link } from "expo-router";
import { SIGNALS } from "@tmp/shared";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";

export default function ActivityScreen() {
  const { myReports, pumps } = useStore();

  if (myReports.length === 0) {
    return (
      <View style={{ padding: 24, gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "700" }}>
          No reports yet
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>
          Open a pump from the Pumps tab and tap "Report an issue". Your filed
          reports and their complaint status will show up here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={myReports}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 14, gap: 10 }}
      renderItem={({ item: r }) => {
        const pump = pumps.find((p) => p.id === r.pumpId);
        return (
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.line,
              borderWidth: 1,
              borderRadius: 14,
              padding: 14,
              gap: 6,
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 15 }}>
              {pump?.name ?? "Unknown pump"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {new Date(r.reportedAt).toLocaleString("en-IN")} ·{" "}
              {r.verification === "geo_verified"
                ? `✓ geo-verified${r.distanceToPumpM != null ? ` (${Math.round(r.distanceToPumpM)} m)` : ""}`
                : "unverified"}
            </Text>
            <Text style={{ fontSize: 13, color: "#4A5A5C" }}>
              {r.signals.map((s) => SIGNALS[s].label).join(" · ")}
            </Text>
            {pump && (
              <Link
                href={{
                  pathname: "/complaint/[pumpId]",
                  params: { pumpId: pump.id },
                }}
                style={{
                  color: colors.petrol,
                  fontWeight: "700",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                File formal complaint →
              </Link>
            )}
          </View>
        );
      }}
    />
  );
}
