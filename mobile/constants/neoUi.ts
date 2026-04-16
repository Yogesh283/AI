import { StyleSheet } from "react-native";
import { NEO } from "./theme";

/**
 * Shared Neo “neon glass” mobile UI — use across tabs + auth + onboarding.
 */
export const neoUi = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NEO.bg,
  },
  padScreen: {
    paddingTop: 52,
    paddingHorizontal: 20,
  },
  padScreenTight: {
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  h1: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  h1Sm: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 8,
    color: NEO.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.36)",
    textTransform: "uppercase",
  },
  backLink: {
    color: NEO.cyan,
    marginBottom: 14,
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
  },
  input: {
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: NEO.border,
    backgroundColor: "rgba(0,0,0,0.38)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
  },
  glassCard: {
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    borderRadius: 22,
  },
  glassCardGlow: {
    backgroundColor: "rgba(12,18,34,0.92)",
    borderWidth: 1,
    borderColor: NEO.borderGlow,
    borderRadius: 22,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  primaryCta: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  primaryCtaText: {
    color: "#050912",
    fontWeight: "900",
    fontSize: 16,
  },
  outlineCta: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  outlineCtaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  footerDock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: NEO.glassDeep,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  hairline: {
    height: 1,
    marginVertical: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerGrad: {
    height: 1,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 1,
    backgroundColor: "rgba(0,212,255,0.25)",
    opacity: 0.9,
  },
});
