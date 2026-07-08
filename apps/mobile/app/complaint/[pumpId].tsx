import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { COMPLAINT_CHANNELS, draftGrievance } from "@tmp/shared";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";

/**
 * Prepare, don't submit: drafts a properly-formatted grievance with the
 * dealer code and evidence details, then hands the user to CPGRAMS or the
 * OMC portal. The citizen files; we do everything up to the button.
 */
export default function ComplaintScreen() {
  const { pumpId } = useLocalSearchParams<{ pumpId: string }>();
  const { pumps, reportsFor, myReports } = useStore();
  const pump = pumps.find((p) => p.id === pumpId);
  const [refNo, setRefNo] = useState("");

  const draft = useMemo(() => {
    if (!pump) return "";
    const mine = myReports.find((r) => r.pumpId === pump.id);
    const latest = mine ?? reportsFor(pump.id)[0];
    return latest ? draftGrievance(pump, latest) : "";
  }, [pump, myReports, reportsFor]);

  if (!pump) return <Text style={{ padding: 20 }}>Pump not found.</Text>;

  const cpgrams = COMPLAINT_CHANNELS[0]!;
  const omcPortal = COMPLAINT_CHANNELS[1]!;
  const omcUrl = omcPortal.urlByOmc?.[pump.omc];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={card}>
        <Text style={label}>Drafted grievance · ready to paste</Text>
        <Text style={{ fontSize: 13, lineHeight: 20, color: "#4A5A5C" }}>
          {draft || "File a report at this pump first — the draft is built from your report's evidence."}
        </Text>
        {draft ? (
          <Pressable
            style={[btn, { marginTop: 12 }]}
            onPress={() => Share.share({ message: draft })}
          >
            <Text style={btnText}>Copy / share draft</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={label}>Where to file</Text>
      <Pressable
        style={[card, { borderColor: colors.petrol, borderWidth: 1.5 }]}
        onPress={() => Linking.openURL(cpgrams.url!)}
      >
        <Text style={{ fontWeight: "700", fontSize: 15 }}>{cpgrams.label}</Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
          {cpgrams.note}
        </Text>
      </Pressable>
      {omcUrl && (
        <Pressable style={card} onPress={() => Linking.openURL(omcUrl)}>
          <Text style={{ fontWeight: "700", fontSize: 15 }}>
            {pump.omc} customer portal
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
            {omcPortal.note}
          </Text>
        </Pressable>
      )}

      <View style={card}>
        <Text style={label}>After you file</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            placeholder="Paste CPGRAMS registration no."
            value={refNo}
            onChangeText={setRefNo}
            autoCapitalize="characters"
            style={{
              flex: 1,
              borderColor: colors.line,
              borderWidth: 1,
              borderStyle: "dashed",
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
              fontSize: 13,
            }}
          />
          <Pressable
            style={[btn, { paddingHorizontal: 16 }]}
            onPress={() => {
              if (refNo.trim().length < 4) return;
              Alert.alert(
                "Tracking",
                `We'll remind you if ${refNo.trim()} has no response in 30 days — CPGRAMS' own resolution target — along with the DPG escalation path.`,
              );
              setRefNo("");
            }}
          >
            <Text style={btnText}>Track</Text>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          card,
          { backgroundColor: "#FCF6EA", borderColor: "#EAD9B4" },
        ]}
      >
        <Text style={{ fontSize: 12.5, lineHeight: 19, color: "#6B5B34" }}>
          <Text style={{ fontWeight: "800" }}>Know your rights: </Text>
          every customer can ask for the 5-litre measure check and the
          filter-paper density test at the pump, free of charge. If refused,
          that itself is reportable.
        </Text>
      </View>
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

const btn = {
  backgroundColor: colors.petrol,
  borderRadius: 10,
  paddingVertical: 10,
  paddingHorizontal: 12,
} as const;

const btnText = {
  color: "#fff",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  fontSize: 13,
};
