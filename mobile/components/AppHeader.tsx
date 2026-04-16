import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, usePathname } from "expo-router";
import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStoredUser, type AuthUser } from "../lib/auth";

/** Bar row: minHeight 44 + paddingBottom 12 — use with `useSafeAreaInsets().top` for content padding. */
export const APP_HEADER_BAR_HEIGHT = 56;

type MenuItem = {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Opens assistant tab and clears thread (via ?new=1). */
  newChat?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "New chat", href: "/(tabs)", icon: "add-circle-outline", newChat: true },
  { label: "Assistant", href: "/(tabs)", icon: "chatbubble-ellipses-outline" },
  { label: "Dashboard", href: "/(tabs)/dashboard", icon: "grid-outline" },
  { label: "Memory", href: "/(tabs)/memory", icon: "library-outline" },
  { label: "Profile", href: "/(tabs)/profile", icon: "person-outline" },
  { label: "Avatars", href: "/avatars", icon: "color-palette-outline" },
  { label: "Customize", href: "/customize", icon: "options-outline" },
];

function initialsFromUser(u: AuthUser | null): string {
  const n = u?.display_name?.trim() || u?.email?.trim() || "";
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getStoredUser().then(setUser);
    }, []),
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const onMenuItemPress = useCallback(
    (item: MenuItem) => {
      setMenuOpen(false);
      if (item.newChat) {
        router.push("/(tabs)?new=1" as never);
        return;
      }
      router.push(item.href as never);
    },
    [],
  );

  const isActive = (item: MenuItem) => {
    if (item.newChat) return false;
    const href = item.href;
    const p = pathname ?? "";
    if (href === "/(tabs)") {
      return (
        p === "/" ||
        p === "/(tabs)" ||
        (p.includes("tabs") &&
          !p.includes("dashboard") &&
          !p.includes("memory") &&
          !p.includes("profile"))
      );
    }
    if (href === "/(tabs)/dashboard") return p.includes("dashboard");
    if (href === "/(tabs)/memory") return p.includes("memory");
    if (href === "/(tabs)/profile") return p.includes("profile");
    if (href === "/avatars") return p.includes("avatars");
    if (href === "/customize") return p.includes("customize");
    return false;
  };

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <View style={styles.row}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
            accessibilityLabel="Open menu"
            accessibilityRole="button"
          >
            <View style={hamburgerStyles.wrap}>
              <View style={hamburgerStyles.lineLong} />
              <View style={hamburgerStyles.lineShort} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            accessibilityLabel="Profile"
            accessibilityRole="button"
          >
            <Text style={styles.avatarTxt}>{initialsFromUser(user)}</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} accessibilityLabel="Close menu" />
          <View
            style={[
              styles.menuPanel,
              {
                top: insets.top + 56,
                left: Math.max(12, insets.left),
              },
            ]}
          >
            <Text style={styles.menuTitle}>Menu</Text>
            <ScrollView
              style={styles.menuScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {MENU_ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <Pressable
                    key={item.newChat ? "menu-new-chat" : item.href}
                    onPress={() => onMenuItemPress(item)}
                    style={({ pressed }) => [
                      styles.menuRow,
                      active && styles.menuRowActive,
                      pressed && styles.menuRowPressed,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={active ? "#00D4FF" : "rgba(255,255,255,0.85)"}
                    />
                    <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                      {item.label}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="rgba(255,255,255,0.25)"
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const hamburgerStyles = StyleSheet.create({
  wrap: { width: 18, height: 11, justifyContent: "space-between" },
  lineLong: {
    height: 2,
    width: 17,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 1,
  },
  lineShort: {
    height: 2,
    width: 11,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 1,
    alignSelf: "flex-start",
  },
});

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#0c1018",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 44,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ea580c",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  avatarTxt: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  pressed: {
    opacity: 0.85,
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  menuPanel: {
    position: "absolute",
    width: "86%",
    maxWidth: 300,
    maxHeight: 420,
    borderRadius: 16,
    backgroundColor: "#121820",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  menuTitle: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
  },
  menuScroll: {
    maxHeight: 360,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  menuRowActive: {
    backgroundColor: "rgba(0,212,255,0.08)",
    borderLeftColor: "#00D4FF",
  },
  menuRowPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
  },
  menuLabelActive: {
    color: "#ffffff",
  },
});
