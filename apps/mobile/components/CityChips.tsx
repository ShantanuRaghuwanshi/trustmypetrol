import { Pressable, ScrollView, Text } from "react-native";
import { CITY_NAMES } from "@tmp/shared";
import { colors } from "@/lib/theme";

export function CityChips({
  city,
  onChange,
}: {
  city: string; // "" = all cities
  onChange: (city: string) => void;
}) {
  const options = ["", ...CITY_NAMES];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, paddingRight: 14 }}
    >
      {options.map((c) => {
        const on = city === c;
        return (
          <Pressable
            key={c || "all"}
            onPress={() => onChange(c)}
            style={{
              backgroundColor: on ? colors.petrol : colors.card,
              borderColor: on ? colors.petrol : "#CBD6D4",
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
            hitSlop={6}
          >
            <Text
              style={{
                color: on ? "#fff" : "#33484A",
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {c || "All India"}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
