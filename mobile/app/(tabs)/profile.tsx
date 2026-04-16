import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NEO, neoGradientPrimary } from "../../constants/theme";
import { neoUi } from "../../constants/neoUi";
import { clearSession, getStoredUser, type AuthUser } from "../../lib/auth";

type Row = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };

function initials(u: AuthUser | null) {
  const n = u?.display_name?.trim() || u?.email?.trim() || "";
  if (!n) return "N";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

export default function Profile() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getStoredUser().then(setUser);
    }, [])
  );

  const rows: Row[] = [
    { key: "account", label: "Account settings", icon: "settings-outline" },
    { key: "avatar", label: "Avatar & voice", icon: "color-wand-outline" },
    { key: "notif", label: "Notifications", icon: "notifications-outline" },
    { key: "privacy", label: "Privacy & security", icon: "shield-checkmark-outline" },
    { key: "sub", label: "Subscription · Pro", icon: "diamond-outline" },
  ];

  async function onLogout() {
    await clearSession();
    router.replace("/login");
  }

  const display = user?.display_name?.trim() || user?.email?.split("@")[0] || "Neo user";

  return (
    <View style={neoUi.screen}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[
          neoUi.padScreen,
          { paddingBottom: 120, paddingTop: 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={neoUi.h1Sm}>Profile</Text>
        <Text style={neoUi.sub}>Account and preferences</Text>

        <View style={[styles.heroCard, neoUi.glassCardGlow]}>
          <LinearGradient
            colors={[...neoGradientPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarTxt}>{initials(user)}</Text>
            </View>
          </LinearGradient>
          <Text style={styles.name}>{display}</Text>
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color="#e9c2ff" />
            <Text style={styles.badgeT}> Premium</Text>
          </View>
        </View>

        <Text style={neoUi.section}>Menu</Text>
        <View style={[neoUi.glassCard, { overflow: "hidden", borderRadius: 20 }]}>
          {rows.map((r, i) => (
            <Pressable
              key={r.key}
              onPress={() => {
                if (r.key === "avatar") router.push("/voice-persona");
              }}
              style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
              android_ripple={{ color: "rgba(0,212,255,0.12)" }}
            >
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Ionicons name={r.icon} size={20} color={NEO.cyan} />
                </View>
                <Text style={styles.rowT}>{r.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.28)" />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => void onLogout()}
          style={[styles.logout, neoUi.glassCard]}
          android_ripple={{ color: "rgba(248,113,113,0.15)" }}
        >
          <Ionicons name="log-out-outline" size={20} color="rgba(248,113,113,0.95)" />
          <Text style={styles.logoutT}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: NEO.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 43,
    backgroundColor: "#0a0f1a",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  name: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  badge: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(189,0,255,0.4)",
    backgroundColor: "rgba(189,0,255,0.12)",
  },
  badgeT: { color: "#e9c2ff", fontWeight: "800", fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(0,212,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowT: { color: "rgba(255,255,255,0.92)", fontWeight: "600", fontSize: 15, flex: 1 },
  logout: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.06)",
  },
  logoutT: { color: "rgba(248,113,113,0.95)", fontWeight: "800", fontSize: 15 },
});
