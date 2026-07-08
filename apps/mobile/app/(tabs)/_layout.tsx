import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/lib/theme";

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.petrol,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { fontWeight: "700", color: colors.ink },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pumps",
          headerTitle: "TrustMyPetrol · Pune",
          tabBarIcon: ({ focused }) => <TabIcon glyph="⛽" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "My reports",
          tabBarIcon: ({ focused }) => <TabIcon glyph="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rights"
        options={{
          title: "Your rights",
          tabBarIcon: ({ focused }) => <TabIcon glyph="⚖️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
