import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CivicStoreProvider } from "@/lib/civicStore";
import { StoreProvider } from "@/lib/store";
import { m3, type } from "@/lib/theme";

export default function RootLayout() {
  return (
    <StoreProvider>
      <CivicStoreProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: m3.primary,
            headerStyle: { backgroundColor: m3.surface },
            headerShadowVisible: false,
            headerTitleStyle: { ...type.titleLarge, color: m3.onSurface },
            contentStyle: { backgroundColor: m3.surface },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="pump/[id]" options={{ title: "Pump record" }} />
          <Stack.Screen name="report/[pumpId]" options={{ title: "Report an issue" }} />
          <Stack.Screen name="complaint/[pumpId]" options={{ title: "File a formal complaint" }} />
          <Stack.Screen name="civic/report" options={{ title: "Report a civic issue" }} />
          <Stack.Screen name="civic/board" options={{ title: "Snap a project board" }} />
          <Stack.Screen name="civic/issue/[id]" options={{ title: "Civic issue" }} />
          <Stack.Screen
            name="auth"
            options={{ title: "Sign in", presentation: "modal" }}
          />
        </Stack>
      </CivicStoreProvider>
    </StoreProvider>
  );
}
