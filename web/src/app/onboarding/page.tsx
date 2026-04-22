import Link from "next/link";
import { OnboardingMeetHeading } from "./OnboardingMeetHeading";
import { GradientButton } from "@/components/neo/GradientButton";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";

const features = [
  {
    title: "Chat & Voice",
    desc: "Bilingual assistant — Hindi & English.",
    icon: "💬",
  },
  {
    title: "Smart Memory",
    desc: "Remembers what matters to you.",
    icon: "🧠",
  },
  {
    title: "Your space",
    desc: "Profile, voice persona, and settings — under your control.",
    icon: "✨",
  },
];

export default function OnboardingPage() {
  return (
    <NeoPublicShell maxWidth="max-w-3xl">
      <div className="mb-8 text-center">
        <OnboardingMeetHeading />
        <p className="mt-3 text-sm text-white/45">
          Real-time · Personalized · Smart
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="neo-glass flex gap-4 rounded-[28px] p-5 ring-1 ring-white/[0.06]"
          >
            <span className="text-2xl">{f.icon}</span>
            <div>
              <h2 className="font-semibold text-[#00D4FF]">{f.title}</h2>
              <p className="mt-1 text-sm text-white/50">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 flex items-center justify-between gap-4">
        <GradientButton href="/dashboard" variant="outline" className="flex-1 !px-4">
          Skip
        </GradientButton>
        <GradientButton href="/customize" className="flex-1 !px-4">
          Next
        </GradientButton>
      </div>
      <p className="mt-6 text-center text-xs text-white/30">
        <Link href="/dashboard" className="underline-offset-2 hover:underline">
          Skip to dashboard
        </Link>
      </p>
    </NeoPublicShell>
  );
}
