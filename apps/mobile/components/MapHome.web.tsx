import { ScrollView, Text } from "react-native";
import { colors } from "@/lib/theme";
import { PumpCard } from "@/components/PumpCard";
import type { MapHomeProps } from "./MapHome";

/**
 * Web fallback: react-native-maps is native-only, so the browser gets the
 * filtered list instead. The full web map lives in apps/web.
 */
export default function MapHome({ pumps, scoreFor }: MapHomeProps) {
  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5 }}>
        The map view is available in the Android/iOS app. Showing the list —
        the full web map is on the TrustMyPetrol website.
      </Text>
      {pumps.map((p) => (
        <PumpCard key={p.id} pump={p} score={scoreFor(p.id)} />
      ))}
    </ScrollView>
  );
}
