import { ScrollView, Text, View } from "react-native";
import { colors } from "@/lib/theme";

const RIGHTS = [
  {
    title: "5-litre measure check",
    body: "Every pump must keep a stamped 5-litre measure. You can ask for a check anytime, free of charge. Short delivery beyond 25 ml per 5 litres is a violation.",
  },
  {
    title: "Filter-paper density test",
    body: "Pumps must keep filter paper and the day's density chart. A drop of petrol should evaporate without leaving a dark stain, and measured density must match the chart within tolerance.",
  },
  {
    title: "Blend labelling",
    body: "Dispensers selling E20 must display blend labelling. Missing or unclear labelling is reportable — it's one of the signal chips on your report.",
  },
  {
    title: "Price display",
    body: "The board price must match what you're charged. Every pump must also display the complaint book and the supply company's contact details.",
  },
  {
    title: "If the pump refuses",
    body: "Refusing a density or measure check is itself a violation of the Marketing Discipline Guidelines. Note the time, take a live photo from the app, and file — refusal is a signal chip too.",
  },
];

export default function RightsScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 20 }}>
        These checks are your right at any petrol pump in India. Most drivers
        don't know them — pumps count on that.
      </Text>
      {RIGHTS.map((r) => (
        <View
          key={r.title}
          style={{
            backgroundColor: colors.card,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: 14,
            padding: 14,
            gap: 4,
          }}
        >
          <Text style={{ fontWeight: "750" as never, fontSize: 15 }}>
            {r.title}
          </Text>
          <Text style={{ color: "#4A5A5C", fontSize: 13.5, lineHeight: 20 }}>
            {r.body}
          </Text>
        </View>
      ))}
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 17 }}>
        Sources: Motor Spirit & High Speed Diesel (Regulation of Supply,
        Distribution and Prevention of Malpractices) Order, 2005; OMC Marketing
        Discipline Guidelines. This is general information, not legal advice.
      </Text>
    </ScrollView>
  );
}
