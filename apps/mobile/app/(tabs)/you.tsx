import { ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { SIGNALS } from "@tmp/shared";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";

const RIGHTS = [
  {
    title: "5-litre measure check",
    body: "Every pump must keep a stamped 5-litre measure. Ask for a check anytime, free of charge. Short delivery beyond 25 ml per 5 litres is a violation.",
  },
  {
    title: "Filter-paper density test",
    body: "Pumps must keep filter paper and the day's density chart. A drop of petrol should evaporate without a dark stain; density must match the chart.",
  },
  {
    title: "If the pump refuses",
    body: "Refusing a density or measure check is itself a violation. Take a live photo from the app and file — refusal is a signal chip too.",
  },
];

export default function YouScreen() {
  const { myReports, pumps } = useStore();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={label}>My reports</Text>
      {myReports.length === 0 ? (
        <View style={card}>
          <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 20 }}>
            No reports yet. Use the Report tab at a pump — filed reports and
            their complaint status appear here.
          </Text>
        </View>
      ) : (
        myReports.map((r) => {
          const pump = pumps.find((p) => p.id === r.pumpId);
          return (
            <View key={r.id} style={[card, { gap: 5 }]}>
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
        })
      )}

      <Text style={[label, { marginTop: 8 }]}>Know your rights</Text>
      {RIGHTS.map((r) => (
        <View key={r.title} style={[card, { gap: 4 }]}>
          <Text style={{ fontWeight: "700", fontSize: 14.5 }}>{r.title}</Text>
          <Text style={{ color: "#4A5A5C", fontSize: 13, lineHeight: 19 }}>
            {r.body}
          </Text>
        </View>
      ))}
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 17 }}>
        Sources: MS & HSD (Regulation of Supply, Distribution and Prevention of
        Malpractices) Order, 2005; OMC Marketing Discipline Guidelines. General
        information, not legal advice.
      </Text>
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
