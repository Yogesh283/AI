import type { ReactNode } from "react";
import Link from "next/link";
import { MainTopNav } from "@/components/neo/MainTopNav";

export const metadata = {
  title: "Terms & Conditions | Neo AI",
  description:
    "Neo AI Terms & Conditions and disclaimer — English and Hindi.",
};

function Section({
  num,
  titleEn,
  titleHi,
  bodyEn,
  bodyHi,
}: {
  num: number;
  titleEn: string;
  titleHi: string;
  bodyEn: React.ReactNode;
  bodyHi: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200/80 pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        <span className="text-blue-600">{num}.</span> {titleEn}
        <span className="mt-1 block text-base font-normal text-slate-600">{titleHi}</span>
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-slate-700">
        <div className="rounded-xl border border-slate-100 bg-white/80 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">English</p>
          <div className="mt-2 space-y-2">{bodyEn}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">हिंदी</p>
          <div className="mt-2 space-y-2 text-slate-800">{bodyHi}</div>
        </div>
      </div>
    </section>
  );
}

export default function TermsPage() {
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
            <header className="mb-10">
              <p className="text-sm font-medium text-blue-600">Legal · Neo AI</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Terms & Conditions for Neo AI
              </h1>
              <p className="mt-2 text-xl text-slate-700">Neo AI के नियम और शर्तें</p>
              <p className="mt-4 text-sm text-slate-600">
                These terms describe how you may use Neo AI products and services (including web and mobile apps).
                Each section includes full English wording plus Hindi for clarity.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                ये शर्तें बताती हैं कि आप Neo AI उत्पादों और सेवाओं (वेब और मोबाइल ऐप सहित) का उपयोग कैसे कर सकते हैं।
                प्रत्येक खंड में पूरा अंग्रेज़ी टेक्स्ट और स्पष्टता के लिए हिंदी भी दी गई है।
              </p>
            </header>

            <article className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-10">
              <Section
                num={1}
                titleEn="Acceptance of Terms"
                titleHi="शर्तों की स्वीकृति"
                bodyEn={
                  <>
                    <p>
                      By downloading, accessing, or using Neo AI in any way, you confirm that you have read,
                      understood, and agree to be bound by these Terms & Conditions and our related policies (including
                      privacy practices where applicable). If you do not agree, you must not use the service.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      Neo AI को डाउनलोड करके, एक्सेस करके या किसी भी तरह उपयोग करके आप पुष्टि करते हैं कि आपने इन नियमों
                      और शर्तों तथा संबंधित नीतियों (जहाँ लागू हो, गोपनीयता प्रथाएँ सहित) को पढ़ लिया है, समझ लिया है और
                      उनके अधीन रहने के लिए सहमत हैं। यदि आप सहमत नहीं हैं, तो सेवा का उपयोग न करें।
                    </p>
                  </>
                }
              />

              <Section
                num={2}
                titleEn="Use of Services"
                titleHi="सेवाओं का उपयोग"
                bodyEn={
                  <>
                    <p>
                      Neo AI provides AI-assisted features such as conversational help, learning support, voice
                      interaction where enabled, and general guidance. You agree to use the services only in compliance
                      with applicable laws and these terms. You must not use Neo AI for unlawful, harmful, abusive, or
                      deceptive activity, or in any way that could overload, disrupt, or compromise the platform or
                      other users.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      Neo AI AI आधारित सुविधाएँ प्रदान करता है जैसे बातचीत में सहायता, सीखने में मदद, जहाँ उपलब्ध हो वॉइस
                      इंटरैक्शन, और सामान्य मार्गदर्शन। आप सेवाओं का उपयोग केवल लागू कानूनों और इन शर्तों के अनुरूप करने
                      के लिए सहमत हैं। आप Neo AI का उपयोग अवैध, हानिकारक, दुरुपयोग करने वाली या धोखाधड़ी वाली गतिविधि के
                      लिए नहीं करेंगे, न ही किसी ऐसे तरीके से जो प्लेटफॉर्म या अन्य उपयोगकर्ताओं को नुकसान, बाधा या जोखिम
                      में डाले।
                    </p>
                  </>
                }
              />

              <Section
                num={3}
                titleEn="User Responsibilities"
                titleHi="उपयोगकर्ता की जिम्मेदारियाँ"
                bodyEn={
                  <>
                    <p>
                      You are responsible for the accuracy of information you provide and for keeping any account
                      credentials secure. You agree not to misuse Neo AI, attempt unauthorized access, reverse engineer
                      where prohibited, or interfere with security or availability of the service.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      आपके द्वारा दी गई जानकारी की सटीकता और खाता क्रेडेंशियल्स की सुरक्षा आपकी जिम्मेदारी है। आप Neo AI
                      का दुरुपयोग नहीं करेंगे, अनधिकृत एक्सेस का प्रयास नहीं करेंगे, जहाँ प्रतिबंधित हो रिवर्स इंजीनियरिंग
                      नहीं करेंगे, और सेवा की सुरक्षा या उपलब्धता में हस्तक्षेप नहीं करेंगे।
                    </p>
                  </>
                }
              />

              <Section
                num={4}
                titleEn="Permissions & Access"
                titleHi="अनुमतियाँ और एक्सेस"
                bodyEn={
                  <>
                    <p>
                      Some features may request device permissions (for example microphone for voice input, or local
                      storage for preferences). Granting permissions is optional where the operating system allows it;
                      you may change or revoke permissions at any time in your device settings. Feature availability may
                      depend on the permissions you grant.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      कुछ फीचर्स के लिए डिवाइस अनुमतियाँ (जैसे वॉइस इनपुट के लिए माइक्रोफोन, या प्राथमिकताओं के लिए स्थानीय
                      स्टोरेज) माँगी जा सकती हैं। जहाँ ऑपरेटिंग सिस्टम अनुमति दे, अनुमति देना वैकल्पिक है; आप किसी भी समय
                      डिवाइस सेटिंग्स में अनुमतियाँ बदल या रद्द कर सकते हैं। आप जो अनुमतियाँ देते हैं, उस पर फीचर्स की
                      उपलब्धता निर्भर कर सकती है।
                    </p>
                  </>
                }
              />

              <Section
                num={5}
                titleEn="Voice Command Feature"
                titleHi="वॉइस कमांड फीचर"
                bodyEn={
                  <>
                    <p>
                      Where voice features are offered, Neo AI may use your microphone input only as described in the
                      app and privacy disclosures. If the product supports a registered voice profile, responses may be
                      tailored or gated to that setup as stated in the app. You must complete any required voice setup to
                      use those features safely and as intended.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      जहाँ वॉइस फीचर्स उपलब्ध हैं, Neo AI आपके माइक्रोफोन इनपुट का उपयोग केवल ऐप और गोपनीयता खुलासों में
                      बताए अनुसार कर सकता है। यदि उत्पाद रजिस्टर्ड वॉइस प्रोफाइल का समर्थन करता है, तो प्रतिक्रियाएँ उस सेटअप
                      के अनुसार हो सकती हैं। उन फीचर्स का सुरक्षित और उद्देश्यानुसार उपयोग करने के लिए आवश्यक वॉइस सेटअप पूरा
                      करें।
                    </p>
                  </>
                }
              />

              <Section
                num={6}
                titleEn="Intellectual Property"
                titleHi="बौद्धिक संपदा"
                bodyEn={
                  <>
                    <p>
                      Neo AI name, branding, software, content, and related materials are protected by intellectual
                      property laws. You may not copy, modify, distribute, sell, or create derivative works from Neo AI
                      materials without prior written permission, except as allowed by law or expressly permitted in the
                      app.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      Neo AI नाम, ब्रांडिंग, सॉफ़्टवेयर, कंटेंट और संबंधित सामग्री बौद्धिक संपदा कानूनों से सुरक्षित हैं। आप
                      बिना पूर्व लिखित अनुमति के Neo AI सामग्री की प्रतिलिपि, संशोधन, वितरण, बिक्री या व्युत्पन्न कार्य नहीं
                      कर सकते, सिवाय जहाँ कानून या ऐप में स्पष्ट रूप से अनुमति हो।
                    </p>
                  </>
                }
              />

              <Section
                num={7}
                titleEn="Limitation of Liability"
                titleHi="दायित्व की सीमा"
                bodyEn={
                  <>
                    <p>
                      Neo AI provides general information and assistance; outputs may be incomplete or incorrect. To the
                      maximum extent permitted by law, Neo AI and its operators are not liable for any indirect,
                      incidental, or consequential damages, or for decisions you make based on app output. Nothing in
                      these terms limits liability where it cannot be limited under applicable law.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      Neo AI सामान्य जानकारी और सहायता प्रदान करता है; आउटपुट अधूरे या गलत हो सकते हैं। लागू कानून द्वारा
                      अनुमत अधिकतम सीमा तक Neo AI और उसके संचालक किसी अप्रत्यक्ष, आकस्मिक या परिणामी नुकसान के लिए उत्तरदायी
                      नहीं हैं, न ही ऐप के आउटपुट पर आपके द्वारा लिए गए निर्णयों के लिए। जहाँ लागू कानून सीमा नहीं लगाने
                      देता, वहाँ ये शर्तें सीमा नहीं घटातीं।
                    </p>
                  </>
                }
              />

              <Section
                num={8}
                titleEn="Termination"
                titleHi="सेवा समाप्ति"
                bodyEn={
                  <>
                    <p>
                      We may suspend or terminate access to Neo AI if you violate these terms, if required by law, or to
                      protect users and the service. You may stop using Neo AI at any time by uninstalling the app or
                      discontinuing use of the web product.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      यदि आप इन शर्तों का उल्लंघन करते हैं, कानून आवश्यक करता है, या उपयोगकर्ताओं और सेवा की सुरक्षा के लिए,
                      तो हम Neo AI एक्सेस निलंबित या समाप्त कर सकते हैं। आप किसी भी समय ऐप अनइंस्टॉल करके या वेब उत्पाद का
                      उपयोग बंद करके Neo AI का उपयोग रोक सकते हैं।
                    </p>
                  </>
                }
              />

              <Section
                num={9}
                titleEn="Changes to Terms"
                titleHi="नियमों में बदलाव"
                bodyEn={
                  <>
                    <p>
                      We may update these Terms & Conditions from time to time. When we do, we will post the revised
                      version on this page or notify you through the app as appropriate. Continued use after changes
                      means you accept the updated terms.
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      हम समय-समय पर इन नियमों और शर्तों को अपडेट कर सकते हैं। जब हम ऐसा करेंगे, तो संशोधित संस्करण इस पृष्ठ
                      पर जारी करेंगे या उचित होने पर ऐप के माध्यम से सूचित करेंगे। बदलावों के बाद निरंतर उपयोग का अर्थ है कि
                      आप अपडेट की गई शर्तों को स्वीकार करते हैं।
                    </p>
                  </>
                }
              />

              <Section
                num={10}
                titleEn="Contact"
                titleHi="संपर्क करें"
                bodyEn={
                  <>
                    <p>
                      For questions about these terms, contact us at{" "}
                      <a className="font-medium text-blue-600 underline underline-offset-2" href="mailto:support@neoai.com">
                        support@neoai.com
                      </a>
                      .
                    </p>
                  </>
                }
                bodyHi={
                  <>
                    <p>
                      इन शर्तों पर प्रश्नों के लिए संपर्क करें:{" "}
                      <a className="font-medium text-blue-600 underline underline-offset-2" href="mailto:support@neoai.com">
                        support@neoai.com
                      </a>
                    </p>
                  </>
                }
              />

              <section className="mt-12 border-t border-slate-200 pt-10">
                <h2 className="text-xl font-semibold text-slate-900">Disclaimer for Neo AI</h2>
                <p className="mt-1 text-lg text-slate-700">Neo AI अस्वीकरण (डिस्क्लेमर)</p>
                <div className="mt-6 space-y-4 text-[15px] leading-relaxed">
                  <div className="rounded-xl border border-slate-100 bg-white/80 px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">English</p>
                    <p className="mt-2 text-slate-700">
                      Neo AI provides general information, educational support, and conversational assistance. It is not a
                      substitute for professional advice (including legal, medical, financial, or other regulated
                      advice). Users should verify important facts independently and consult qualified professionals
                      before relying on any suggestion for decisions that could affect health, safety, finances, or legal
                      rights.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">हिंदी</p>
                    <p className="mt-2 text-slate-800">
                      Neo AI सामान्य जानकारी, शैक्षणिक सहायता और बातचीत संबंधी सहायता प्रदान करता है। यह पेशेवर सलाह (कानूनी,
                      चिकित्सा, वित्तीय या अन्य नियामक सलाह सहित) का विकल्प नहीं है। उपयोगकर्ताओं को महत्वपूर्ण तथ्य स्वतंत्र
                      रूप से सत्यापित करने चाहिए और स्वास्थ्य, सुरक्षा, वित्त या कानूनी अधिकारों को प्रभावित करने वाले
                      निर्णयों से पहले योग्य विशेषज्ञों से परामर्श करना चाहिए।
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-10 border-t border-slate-200 pt-10">
                <h2 className="text-xl font-semibold text-slate-900">
                  Play Store permissions declaration (developer reference)
                </h2>
                <p className="mt-1 text-lg text-slate-700">प्ले स्टोर परमिशन डिक्लेरेशन (डेवलपर संदर्भ)</p>
                <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">Microphone — English</p>
                    <p className="mt-1">
                      Used only where voice features are enabled: to capture speech input for voice commands or related
                      voice interactions, in line with in-app disclosures and user controls.
                    </p>
                    <p className="mt-3 font-medium text-slate-900">माइक्रोफोन — हिंदी</p>
                    <p className="mt-1 text-slate-800">
                      जहाँ वॉइस फीचर्स चालू हों, वॉइस कमांड या संबंधित वॉइस इंटरैक्शन के लिए भाषण इनपुट लेने हेतु उपयोग —
                      ऐप में खुलासों और उपयोगकर्ता नियंत्रणों के अनुसार।
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Storage — English</p>
                    <p className="mt-1">
                      May be used to store preferences, cached content, or app data locally on your device to improve
                      performance and experience, as described in the app.
                    </p>
                    <p className="mt-3 font-medium text-slate-900">स्टोरेज — हिंदी</p>
                    <p className="mt-1 text-slate-800">
                      प्रदर्शन और अनुभव के लिए प्राथमिकताएँ, कैश्ड कंटेंट या ऐप डेटा को डिवाइस पर स्थानीय रूप से सहेजने हेतु
                      उपयोग — जैसा ऐप में बताया गया है।
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Data usage transparency — English</p>
                    <p className="mt-1">
                      Data is collected and processed in accordance with applicable privacy disclosures and user consent
                      choices. We do not sell personal data or use it for purposes inconsistent with what we disclose to
                      users.
                    </p>
                    <p className="mt-3 font-medium text-slate-900">डेटा पारदर्शिता — हिंदी</p>
                    <p className="mt-1 text-slate-800">
                      डेटा लागू गोपनीयता खुलासों और उपयोगकर्ता की सहमति के अनुसार एकत्र और प्रोसेस किया जाता है। व्यक्तिगत
                      डेटा बेचा नहीं जाता और उपयोगकर्ताओं को बताए उद्देश्यों के विपरीत उपयोग नहीं किया जाता।
                    </p>
                  </div>
                </div>
              </section>

              <footer className="mt-12 rounded-xl bg-slate-900 px-5 py-6 text-center text-slate-100">
                <p className="text-sm font-medium">Neo AI — Secure · Smart · Reliable</p>
                <p className="mt-1 text-sm text-slate-300">Neo AI — सुरक्षित · स्मार्ट · भरोसेमंद</p>
                <p className="mt-4 text-xs text-slate-400">
                  This page is prepared to align with common app-store disclosure expectations; final legal review is
                  recommended before production release.
                </p>
              </footer>
            </article>

            <p className="mt-8 text-center text-sm text-slate-600">
              <Link href="/dashboard" className="text-blue-600 underline underline-offset-2 hover:text-blue-700">
                Back to dashboard
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
