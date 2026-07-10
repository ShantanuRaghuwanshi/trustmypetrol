import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "@/lib/store";
import { colors, elevation, shape, type } from "@/lib/theme";
import { CityChips } from "@/components/CityChips";

/**
 * Universal report entry — one habit: see something → Report. Branches to
 * the civic flow, the project-board flow, or (below) a fuel report at a
 * pump. Every branch is the same camera-first, GPS-verified capture.
 */
export default function ReportChooserScreen() {
  const { pumps } = useStore();
  const [city, setCity] = useState("");
  const sorted = useMemo(
    () =>
      pumps
        .filter((p) => !city || p.district === city)
        .sort(
          (a, b) =>
            a.district.localeCompare(b.district) ||
            a.name.localeCompare(b.name),
        ),
    [pumps, city],
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 14, gap: 10 }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <Pressable
            style={bigAction}
            onPress={() => router.push("/civic/report")}
          >
            <View style={[bigIcon, { backgroundColor: "#FDF3E3" }]}>
              <Ionicons name="construct" size={20} color={colors.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={bigTitle}>Civic issue</Text>
              <Text style={bigHint}>
                Pothole, choked drain, open manhole, streetlight — routed to
                the responsible agency
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>

          <Pressable
            style={bigAction}
            onPress={() => router.push("/civic/board")}
          >
            <View style={[bigIcon, { backgroundColor: "#E9EFF8" }]}>
              <Ionicons name="clipboard" size={19} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={bigTitle}>Project board</Text>
              <Text style={bigHint}>
                Snap a work-site board — logs the contractor and defect
                liability period
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>

          <Text style={sectionLabel}>Fuel issue — pick your pump</Text>
          <CityChips city={city} onChange={setCity} />
          <Text
            style={{
              color: colors.muted,
              fontSize: 13.5,
              lineHeight: 20,
            }}
          >
            Which pump are you at? Your photo is taken live and GPS-matched to
            the pump, so report from the forecourt.
          </Text>
        </View>
      }
      renderItem={({ item: pump }) => (
        <Link
          href={{ pathname: "/report/[pumpId]", params: { pumpId: pump.id } }}
          asChild
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderColor: colors.line,
              borderWidth: 1,
              borderRadius: 14,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "#E9EFF8",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="camera" size={18} color={colors.petrol} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 15 }}>
                {pump.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {pump.omc} · {pump.address}, {pump.district}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
        </Link>
      )}
    />
  );
}

const bigAction = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: shape.lg,
  padding: 16,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  ...elevation[1],
};

const bigIcon = {
  width: 42,
  height: 42,
  borderRadius: 21,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const bigTitle = {
  ...type.titleMedium,
  color: colors.ink,
};

const bigHint = {
  color: colors.muted,
  fontSize: 12,
  lineHeight: 16,
  marginTop: 2,
};

const sectionLabel = {
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
  color: colors.muted,
  fontWeight: "700" as const,
  marginTop: 10,
};
