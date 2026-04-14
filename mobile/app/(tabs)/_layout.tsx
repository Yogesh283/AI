import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { Image, StyleSheet } from "react-native";
import { NEO } from "../../constants/theme";

const LOGO = require("../../assets/neo-logo.png");

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: NEO.cyan,
        tabBarInactiveTintColor: "rgba(255,255,255,0.38)",
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: "Memory",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "library" : "library-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: "NeoXAI",
          tabBarIcon: () => (
            <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.micWrap}>
              <Image source={LOGO} style={styles.tabLogo} resizeMode="contain" />
            </LinearGradient>
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "construct" : "construct-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "rgba(6,9,16,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
  },
  label: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  micWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
    padding: 8,
    shadowColor: NEO.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  tabLogo: { width: 34, height: 34 },
});
