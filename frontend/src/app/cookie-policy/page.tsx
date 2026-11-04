
import Link from "next/link";

const sections = [
  {
    title: "1. What Are Cookies?",
    content: [
      "Cookies are small text files that websites store on your device when you visit them. They help websites remember information about your visit and support certain features.",
      "Similar technologies, such as local storage and pixels, may also be used for related purposes.",
    ],
  },
  {
    title: "2. How QuizPro Uses Cookies",
    content: [
      "QuizPro may use cookies and similar technologies to keep the platform working, remember user preferences, support account sessions, and understand how users interact with the platform.",
    ],
  },
  {
    title: "3. Types of Cookies",
    content: [
      "Essential cookies: These may be required for core functions such as account authentication, security, and navigation.",
      "Preference cookies: These may remember settings or preferences to improve your experience.",
      "Analytics cookies: If enabled, these help us understand website traffic, usage patterns, and platform performance.",
      "Third-party cookies: Some integrated services may set their own cookies according to their policies and settings.",
    ],
  },
  {
    title: "4. Managing Cookies",
    content: [
      "Most browsers allow you to view, block, or delete cookies through their settings.",
      "Blocking certain cookies may affect the availability or functionality of some QuizPro features, including account-related features.",
      "Where required by applicable law, we will provide appropriate choices or consent mechanisms before using non-essential cookies.",
    ],
  },
  {
    title: "5. Third-Party Technologies",
    content: [
      "If QuizPro uses third-party analytics, embedded content, or other integrations, those providers may use cookies or similar technologies under their own privacy policies.",
      "You should review the relevant third-party policies to understand how those technologies operate.",
    ],
  },
  {
    title: "6. Updates to This Policy",
    content: [
      "We may update this Cookie Policy to reflect changes in our technology, services, or legal requirements. The latest version will be published on this page.",
    ],
  },
];

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-white text-stone-900">
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-12">
        <Link
          href="/"
          className="mb-10 inline-flex text-sm font-medium text-stone-500 transition hover:text-black"
        >
          ← Back to home
        </Link>

        <div className="mb-12 border-b border-stone-200 pb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            Legal
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Cookie Policy
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
            This policy explains how QuizPro uses cookies and similar
            technologies when you visit our platform.
          </p>
          <p className="mt-5 text-sm text-stone-500">
            Effective date: November 4, 2026
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-4 text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.content.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-[15px] leading-7 text-stone-600"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="mb-4 text-xl font-semibold tracking-tight">
              7. Contact Us
            </h2>
            <p className="text-[15px] leading-7 text-stone-600">
              If you have questions about our use of cookies, contact us at:
            </p>
            <p className="mt-3 text-sm font-medium text-stone-900">
              Email: [YOUR CONTACT EMAIL]
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-stone-200 pt-7">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-stone-500">
            <Link href="/privacy-policy" className="hover:text-black">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-black">Terms & Conditions</Link>
            <Link href="/" className="hover:text-black">Home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
