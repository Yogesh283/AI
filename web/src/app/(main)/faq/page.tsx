import type { ReactNode } from "react";
import Link from "next/link";
import { MainTopNav } from "@/components/neo/MainTopNav";

export const metadata = {
  title: "FAQ & Product Guide | Neo AI",
  description:
    "Neo AI — your smart personal assistant. Product overview, features, and FAQ in English and Hindi.",
};

function BilingualBlock({
  childrenEn,
  childrenHi,
}: {
  childrenEn: ReactNode;
  childrenHi: ReactNode;
}) {
  return (
    <div className="mt-4 space-y-4 text-[15px] leading-relaxed">
      <div className="rounded-xl border border-slate-100 bg-white/80 px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">English</p>
        <div className="mt-2 space-y-2 text-slate-700">{childrenEn}</div>
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">हिंदी</p>
        <div className="mt-2 space-y-2 text-slate-800">{childrenHi}</div>
      </div>
    </div>
  );
}

function TopicSection({
  icon,
  titleEn,
  titleHi,
  childrenEn,
  childrenHi,
}: {
  icon: string;
  titleEn: string;
  titleHi: string;
  childrenEn: ReactNode;
  childrenHi: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200/80 pt-10 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        <span className="mr-2" aria-hidden>
          {icon}
        </span>
        {titleEn}
        <span className="mt-1 block text-base font-normal text-slate-600">{titleHi}</span>
      </h2>
      <BilingualBlock childrenEn={childrenEn} childrenHi={childrenHi} />
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
                Neo AI — Your Smart Personal Assistant
              </h1>
              <p className="mt-2 text-xl text-slate-700">Neo AI — आपका स्मार्ट पर्सनल असिस्टेंट</p>
              <p className="mx-auto mt-6 max-w-2xl text-sm text-slate-600 sm:mx-0">
                Welcome to Neo AI — your all-in-one intelligent platform for conversation, learning, voice assistance, and
                everyday productivity. Below you will find a clear overview in English and Hindi.
              </p>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 sm:mx-0">
                Neo AI में आपका स्वागत है — बातचीत, सीखने, वॉइस सहायता और रोज़मर्रा की उत्पादकता के लिए आपका ऑल-इन-वन
                इंटेलिजेंट प्लेटफॉर्म। नीचे अंग्रेज़ी और हिंदी में स्पष्ट जानकारी दी गई है।
              </p>
            </header>

            <article className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-10">
              <section className="rounded-xl bg-gradient-to-br from-blue-50/90 to-slate-50/80 px-5 py-6 ring-1 ring-slate-200/60">
                <BilingualBlock
                  childrenEn={
                    <>
                      <p>
                        Neo AI is more than a single-purpose app — it is designed to act as your personal assistant,
                        learning companion, and practical guide across daily tasks. Use it to get answers, organize work,
                        learn new topics, and interact by voice where the product supports it.
                      </p>
                    </>
                  }
                  childrenHi={
                    <>
                      <p>
                        Neo AI सिर्फ एक साधारण ऐप नहीं है — इसे आपका पर्सनल असिस्टेंट, लर्निंग साथी और रोज़मर्रा के कामों
                        में व्यावहारिक गाइड के रूप में बनाया गया है। इससे उत्तर पाएँ, काम व्यवस्थित करें, नए विषय सीखें और
                        जहाँ फीचर उपलब्ध हो वॉइस से बात करें।
                      </p>
                    </>
                  }
                />
              </section>

              <TopicSection
                icon="🤖"
                titleEn="Personal AI assistant"
                titleHi="पर्सनल AI असिस्टेंट"
                childrenEn={
                  <>
                    <p>
                      Manage routines and questions smarter with AI-backed support tailored to how you use Neo AI.
                    </p>
                    <p>
                      Customize your experience by granting only the permissions you need — for example microphone or
                      storage — so features work the way you want while staying in control.
                    </p>
                  </>
                }
                childrenHi={
                  <>
                    <p>एडवांस AI की मदद से अपने रोज़मर्रा के सवाल और कामों को होशियारी से संभालें।</p>
                    <p>
                      अपनी जरूरत के अनुसार परमिशन दें — जैसे माइक्रोफोन या स्टोरेज — ताकि फीचर्स आपके हिसाब से चलें और आप नियंत्रण में रहें।
                    </p>
                  </>
                }
              />

              <TopicSection
                icon="🎙️"
                titleEn="Voice command feature"
                titleHi="वॉइस कमांड फीचर"
                childrenEn={
                  <>
                    <p>
                      Where enabled, Neo AI can respond to your voice for a faster, hands-free experience. For the most
                      secure and personalized setup, follow in-app instructions to register or verify your voice profile
                      when that option is available.
                    </p>
                    <p>
                      Voice recognition is intended to prioritize the enrolled user&apos;s commands; third-party voices
                      should not trigger actions on your behalf. Complete any required voice setup before relying on voice
                      control for sensitive actions.
                    </p>
                  </>
                }
                childrenHi={
                  <>
                    <p>
                      Neo AI आपकी वॉइस से काम करता है जहाँ फीचर चालू हो — तेज और बिना हाथ लगाए अनुभव के लिए। जहाँ उपलब्ध हो,
                      सुरक्षित और पर्सनल अनुभव के लिए ऐप में दिए गए निर्देशों से वॉइस प्रोफाइल रजिस्टर/वेरिफाई करें।
                    </p>
                    <p>
                      यह डिज़ाइन किया गया है ताकि नामांकित उपयोगकर्ता की आवाज़ को प्राथमिकता मिले; संवेदनशील कामों से पहले आवश्यक वॉइस सेटअप पूरा करें।
                    </p>
                  </>
                }
              />

              <TopicSection
                icon="📚"
                titleEn="Smart learning & tutor"
                titleHi="स्मार्ट लर्निंग और ट्यूटर"
                childrenEn={
                  <>
                    <p>
                      Learn subjects with plain-language explanations and step-by-step breakdowns whenever the model and
                      content allow.
                    </p>
                    <p>
                      Get learning support when you need it — like having a tutor on call for practice questions,
                      summaries, and study planning (availability depends on your plan and region).
                    </p>
                  </>
                }
                childrenHi={
                  <>
                    <p>किसी भी विषय को आसान भाषा और चरणबद्ध समझ के साथ सीखें — जहाँ संभव हो।</p>
                    <p>
                      जरूरत पड़ने पर सीखने में मदद — जैसे ट्यूटर की तरह अभ्यास प्रश्न, सार और पढ़ाई की योजना (उपलब्धता आपकी योजना और क्षेत्र पर निर्भर)।
                    </p>
                  </>
                }
              />

              <TopicSection
                icon="🎯"
                titleEn="Guidance & counseling-style support"
                titleHi="गाइडेंस और काउंसिलिंग-शैली सहायता"
                childrenEn={
                  <>
                    <p>
                      Neo AI can help you think through career and life decisions with structured suggestions and
                      reflection prompts. It does not replace licensed counselors, therapists, or medical professionals.
                    </p>
                    <p>Use ideas from Neo AI as one input alongside your own judgment and, when needed, expert advice.</p>
                  </>
                }
                childrenHi={
                  <>
                    <p>
                      Neo AI करियर और जीवन के फैसलों पर संरचित सुझाव और विचार करने में मदद कर सकता है। यह लाइसेंस प्राप्त परामर्शदाताओं, थेरिपिस्ट या चिकित्सकों का स्थान नहीं लेता।
                    </p>
                    <p>Neo AI से मिलने वाले विचारों को अपनी समझ और जरूरत हो तो विशेषज्ञ की सलाह के साथ उपयोग करें।</p>
                  </>
                }
              />

              <TopicSection
                icon="⚙️"
                titleEn="Productivity & smart tools"
                titleHi="प्रोडक्टिविटी और स्मार्ट टूल्स"
                childrenEn={
                  <>
                    <p>
                      Improve productivity with task-focused workflows, reminders-style help, and quick access to information
                      through chat and voice depending on features enabled for your account.
                    </p>
                    <p>Save time by letting Neo AI summarize, draft, and organize ideas — always review important outputs yourself.</p>
                  </>
                }
                childrenHi={
                  <>
                    <p>
                      टास्क-केंद्रित वर्कफ़्लो, याद दिलाने जैसी मदद और चैट/वॉइस से त्वरित जानकारी से उत्पादकता बढ़ाएँ — आपके खाते में जो फीचर चालू हों।
                    </p>
                    <p>Neo AI से सार, ड्राफ़्ट और विचार व्यवस्थित करवाएँ — महत्वपूर्ण चीज़ें स्वयं जाँच लें।</p>
                  </>
                }
              />

              <TopicSection
                icon="🔐"
                titleEn="Privacy & security"
                titleHi="प्राइवेसी और सुरक्षा"
                childrenEn={
                  <>
                    <p>
                      We design Neo AI with security in mind and only use personal data as described in our privacy
                      notices and your permission settings on the device or app.
                    </p>
                    <p>You stay in charge: review permissions regularly and revoke access you no longer want to grant.</p>
                  </>
                }
                childrenHi={
                  <>
                    <p>
                      डेटा को सुरक्षित रखने का प्रयास किया जाता है और व्यक्तिगत जानकारी का उपयोग केवल गोपनीयता नोटिस और आपकी अनुमति के अनुसार होता है।
                    </p>
                    <p>नियंत्रण आपके पास है: परमिशन समय-समय पर जाँचें और जो देना नहीं चाहते हटाएँ।</p>
                  </>
                }
              />

              <TopicSection
                icon="🌟"
                titleEn="Why choose Neo AI?"
                titleHi="Neo AI क्यों चुनें?"
                childrenEn={
                  <>
                    <p>
                      One smart platform for many everyday needs — conversation, learning, productivity hints, and voice
                      interaction where supported.
                    </p>
                    <p>Built to feel easy to use, responsive, security-conscious, and dependable for daily tasks.</p>
                  </>
                }
                childrenHi={
                  <>
                    <p>एक ही स्मार्ट प्लेटफॉर्म पर कई जरूरतें — बातचीत, सीखना, उत्पादकता टिप्स और जहाँ हो वॉइस।</p>
                    <p>उपयोग में आसान, तेज़, सुरक्षा-संवेदनशील और रोज़मर्रा के लिए भरोसेमंद अनुभव का लक्ष्य।</p>
                  </>
                }
              />

              <TopicSection
                icon="🚀"
                titleEn="Start your smart journey"
                titleHi="अपनी स्मार्ट यात्रा शुरू करें"
                childrenEn={
                  <>
                    <p>
                      Open Neo AI on web or mobile, complete onboarding, set permissions and voice profile if you use
                      voice features, then explore chat and learning modes at your pace.
                    </p>
                  </>
                }
                childrenHi={
                  <>
                    <p>
                      वेब या मोबाइल पर Neo AI खोलें, ऑनबोर्डिंग पूरी करें; वॉइस फीचर के लिए परमिशन और वॉइस प्रोफाइल सेट करें फिर चैट और लर्निंग मोड खोजें।
                    </p>
                  </>
                }
              />

              <footer className="mt-12 rounded-xl bg-slate-900 px-5 py-6 text-center text-slate-100">
                <p className="text-base font-semibold">Neo AI — Think Smart, Live Smart</p>
                <p className="mt-1 text-sm text-slate-300">Neo AI — सोचिए स्मार्ट, जिएं स्मार्ट</p>
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
