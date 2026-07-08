import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StoreProvider } from "@/lib/store";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.petrol,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pump/[id]" options={{ title: "Pump record" }} />
        <Stack.Screen name="report/[pumpId]" options={{ title: "Report an issue" }} />
        <Stack.Screen name="complaint/[pumpId]" options={{ title: "File a formal complaint" }} />
      </Stack>
    </StoreProvider>
  );
}
