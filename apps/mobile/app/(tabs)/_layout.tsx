import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { m3, type } from "@/lib/theme";

/** M3 navigation bar + top app bar (m3.material.io/components). */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: m3.primary,
        tabBarInactiveTintColor: m3.onSurfaceVariant,
        tabBarLabelStyle: { ...type.labelSmall },
        tabBarStyle: {
          backgroundColor: m3.surfaceContainerLow,
          borderTopColor: m3.outlineVariant,
          height: 62,
          paddingTop: 4,
          paddingBottom: 8,
        },
        headerStyle: { backgroundColor: m3.surface },
        headerShadowVisible: false,
        headerTitleStyle: { ...type.titleLarge, color: m3.onSurface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          headerTitle: "JanSetu",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "location" : "location-outline"}
              size={21}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pumps"
        options={{
          title: "Pumps",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "list" : "list-outline"}
              size={21}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="civic"
        options={{
          title: "Civic",
          headerTitle: "Civic issues",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "construct" : "construct-outline"}
              size={21}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          headerTitle: "Report an issue",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "add-circle" : "add-circle-outline"}
              size={23}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "You",
          headerTitle: "Your activity",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={21}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
