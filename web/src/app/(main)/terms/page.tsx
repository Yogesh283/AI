import Link from "next/link";
import { NeoPageShell } from "@/components/neo/NeoPageShell";

export const metadata = {
  title: "Terms & Conditions | Neo AI",
  description: "Neo AI Terms & Conditions and disclaimer.",
};

function Section({
  num,
  title,
  body,
}: {
  num: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200/80 pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        <span className="text-blue-600">{num}.</span> {title}
      </h2>
      <div className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-700">{body}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <NeoPageShell>
            <header className="mb-10 text-center sm:text-left">
              <p className="text-sm font-medium text-blue-600">Legal · Neo AI</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Terms & Conditions for Neo AI
              </h1>
              <p className="mt-4 text-sm text-slate-600">
                Summary for users and app-store disclosure.
              </p>
            </header>

            <article className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-10">
              <Section
                num={1}
                title="Acceptance of Terms"
                body={<p>By using Neo AI, you agree to comply with these Terms & Conditions.</p>}
              />

              <Section
                num={2}
                title="Use of Services"
                body={
                  <>
                    <p>Neo AI provides AI-based assistance, learning, and guidance tools.</p>
                    <p>You agree to use the app only for lawful purposes.</p>
                  </>
                }
              />

              <Section
                num={3}
                title="User Responsibilities"
                body={
                  <>
                    <p>You are responsible for the accuracy of the information you provide.</p>
                    <p>Do not misuse or attempt to harm the platform.</p>
                  </>
                }
              />

              <Section
                num={4}
                title="Permissions & Access"
                body={
                  <>
                    <p>Certain features require permissions such as microphone or storage.</p>
                    <p>You can revoke permissions anytime from your device settings.</p>
                  </>
                }
              />

              <Section
                num={5}
                title="Voice Command Feature"
                body={
                  <>
                    <p>Neo AI responds only to your registered voice profile.</p>
                    <p>You must set up your voice profile to use this feature.</p>
                  </>
                }
              />

              <Section
                num={6}
                title="Intellectual Property"
                body={
                  <>
                    <p>All content, design, and technology belong to Neo AI.</p>
                    <p>You may not copy, modify, or distribute without permission.</p>
                  </>
                }
              />

              <Section
                num={7}
                title="Limitation of Liability"
                body={
                  <>
                    <p>Neo AI provides guidance but does not guarantee accuracy or results.</p>
                    <p>We are not responsible for decisions made based on app suggestions.</p>
                  </>
                }
              />

              <Section
                num={8}
                title="Termination"
                body={<p>We may suspend or terminate access if terms are violated.</p>}
              />

              <Section
                num={9}
                title="Changes to Terms"
                body={<p>We may update these terms at any time.</p>}
              />

              <Section
                num={10}
                title="Contact"
                body={
                  <p>
                    Email:{" "}
                    <a
                      className="font-medium text-blue-600 underline underline-offset-2"
                      href="mailto:support@neoai.com"
                    >
                      support@neoai.com
                    </a>
                  </p>
                }
              />

              <section className="mt-12 border-t border-slate-200 pt-10">
                <h2 className="text-xl font-semibold text-slate-900">Disclaimer for Neo AI</h2>
                <div className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-700">
                  <p>Neo AI provides general information, guidance, and educational support.</p>
                  <p>It is not a substitute for professional advice (legal, medical, financial, etc.).</p>
                  <p>Users should take independent decisions before acting on suggestions.</p>
                </div>
              </section>

              <section className="mt-10 border-t border-slate-200 pt-10">
                <h2 className="text-xl font-semibold text-slate-900">
                  Play Store Permissions Declaration (For Developer Use)
                </h2>
                <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">🎤 Microphone Permission</p>
                    <p className="mt-1">
                      Used for voice command feature to recognize user&apos;s registered voice.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">📁 Storage Permission</p>
                    <p className="mt-1">Used to store user preferences and app-related data locally.</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">🔐 Data Usage Transparency</p>
                    <p className="mt-1">All data is collected and used only with user consent.</p>
                    <p className="mt-1">No data is sold or misused.</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
                    <p className="font-medium text-emerald-900">✅ Final Note</p>
                    <p className="mt-2 text-emerald-900/90">
                      This content is designed to meet Google Play Store policies.
                    </p>
                  </div>
                </div>
              </section>

              <footer className="mt-12 rounded-xl bg-slate-900 px-5 py-6 text-center text-slate-100">
                <p className="text-sm font-medium">Neo AI – Secure • Smart • Reliable</p>
                <p className="mt-4 text-xs text-slate-400">
                  For production, have qualified counsel review this page alongside your Privacy Policy and store
                  listings.
                </p>
              </footer>
            </article>

            <p className="mt-8 text-center text-sm text-slate-600">
              <Link href="/dashboard" className="text-blue-600 underline underline-offset-2 hover:text-blue-700">
                Back to dashboard
              </Link>
            </p>
    </NeoPageShell>
  );
}
