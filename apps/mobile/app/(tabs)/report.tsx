import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { CityChips } from "@/components/CityChips";

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
                backgroundColor: "#EDF3F2",
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
