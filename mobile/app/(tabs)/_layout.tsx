import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader, APP_HEADER_BAR_HEIGHT } from "../../components/AppHeader";
import { NEO } from "../../constants/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.shell}>
      <AppHeader />
      <View style={[styles.tabsWrap, { paddingTop: insets.top + APP_HEADER_BAR_HEIGHT }]}>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
        }}
      >
      <Tabs.Screen name="index" options={{ title: "Assistant" }} />
      <Tabs.Screen name="memory" options={{ title: "Memory", href: null }} />
      <Tabs.Screen name="voice" options={{ title: "Voice", href: null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", href: null }} />
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", href: null }} />
      </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: NEO.bg },
  tabsWrap: { flex: 1 },
});
