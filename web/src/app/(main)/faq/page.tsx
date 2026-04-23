import type { ReactNode } from "react";
import Link from "next/link";
import { MainTopNav } from "@/components/neo/MainTopNav";

export const metadata = {
  title: "FAQ & Product Guide | Neo AI",
  description:
    "Neo AI — your smart personal assistant. Product overview and features.",
};

function TopicSection({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200/80 pt-10 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        <span className="mr-2" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default function FaqPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F5F7FA]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:10px_10px]"
        aria-hidden
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        <MainTopNav />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-16 pt-6 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <header className="mb-10 text-center sm:text-left">
              <p className="text-sm font-medium text-blue-600">FAQ · Neo AI</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Neo AI – Your Smart Personal Assistant
              </h1>
            </header>

            <article className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-10">
              <section className="rounded-xl bg-gradient-to-br from-blue-50/90 to-slate-50/80 px-5 py-6 ring-1 ring-slate-200/60">
                <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
                  <p>Welcome to Neo AI, your all-in-one intelligent platform.</p>
                  <p>
                    Neo AI is not just an app, it is your personal assistant, tutor, and life guide.
                  </p>
                </div>
              </section>

              <TopicSection icon="🤖" title="Personal AI Assistant">
                <p>Manage your daily tasks smartly with advanced AI support.</p>
                <p>Customize your experience by giving permissions as per your needs.</p>
              </TopicSection>

              <TopicSection icon="🎙️" title="Voice Command Feature">
                <p>
                  Neo AI works on your personal voice commands for a secure and personalized experience.
                </p>
                <p>
                  It responds only to your registered voice and does not accept commands from others.
                </p>
                <p>You need to set up your voice profile before using this feature.</p>
              </TopicSection>

              <TopicSection icon="📚" title="Smart Learning & Tutor">
                <p>Learn any subject with easy explanations and step-by-step guidance.</p>
                <p>Get 24/7 support like a personal teacher.</p>
              </TopicSection>

              <TopicSection icon="🎯" title="Guidance & Counseling">
                <p>Get help in making better decisions in career and life.</p>
                <p>Solve your problems with smart suggestions and planning.</p>
              </TopicSection>

              <TopicSection icon="⚙️" title="Productivity & Smart Tools">
                <p>Boost your productivity with task management and automation.</p>
                <p>Save time with smart tools and instant information.</p>
              </TopicSection>

              <TopicSection icon="🔐" title="Privacy & Security">
                <p>Your data is fully secure and protected.</p>
                <p>We only use your information with your permission.</p>
              </TopicSection>

              <TopicSection icon="🌟" title="Why Choose Neo AI?">
                <p>All-in-one smart solution for your daily needs.</p>
                <p>Easy to use, fast, secure, and reliable.</p>
              </TopicSection>

              <TopicSection icon="🚀" title="Start Your Smart Journey Today">
                <p>Make your life smarter, faster, and better with Neo AI.</p>
              </TopicSection>

              <footer className="mt-12 rounded-xl bg-slate-900 px-5 py-6 text-center text-slate-100">
                <p className="text-base font-semibold">Neo AI – Think Smart, Live Smart</p>
              </footer>
            </article>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
              <Link href="/dashboard" className="text-blue-600 underline underline-offset-2 hover:text-blue-700">
                Back to dashboard
              </Link>
              <span aria-hidden className="text-slate-300">
                ·
              </span>
              <Link href="/terms" className="text-blue-600 underline underline-offset-2 hover:text-blue-700">
                Terms & Conditions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
