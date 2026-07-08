import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.petrol,
        tabBarInactiveTintColor: "#8AA0A2",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        headerTitleStyle: { fontWeight: "700", color: colors.ink },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          headerTitle: "TrustMyPetrol",
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
