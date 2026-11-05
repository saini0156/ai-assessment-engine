
import Link from "next/link";

const sections = [
  {
    title: "1. Information We Collect",
    content: [
      "Account information: If you create an account, we may collect information such as your name, email address, and other details you provide.",
      "Quiz information: We may collect quiz answers, scores, quiz history, uploaded study materials, and other content you submit while using QuizPro.",
      "Technical information: We may collect information such as browser type, device information, IP address, and basic usage data to help operate and improve the platform.",
    ],
  },
  {
    title: "2. How We Use Your Information",
    content: [
      "To provide and maintain QuizPro services.",
      "To create quizzes, evaluate answers, and display results.",
      "To manage accounts and provide customer support.",
      "To improve platform performance, features, and user experience.",
      "To protect the platform against fraud, misuse, and security threats.",
      "To communicate important service updates where necessary.",
    ],
  },
  {
    title: "3. Uploaded Content",
    content: [
      "You may be able to upload documents, notes, or other learning materials to generate or use quizzes. You are responsible for ensuring that you have the right to upload and use this content.",
      "We use uploaded content only as necessary to provide the relevant platform features and operate the service, subject to our applicable service providers and processing arrangements.",
    ],
  },
  {
    title: "4. Data Sharing",
    content: [
      "We do not sell your personal information.",
      "We may share information with service providers that help us host, maintain, secure, or operate QuizPro. These providers should process information only for the services they provide to us.",
      "We may disclose information where required by applicable law or where necessary to protect our rights, users, and platform.",
    ],
  },
  {
    title: "5. Data Security and Retention",
    content: [
      "We take reasonable measures designed to protect information against unauthorized access, alteration, disclosure, or destruction.",
      "No online service can guarantee absolute security. You should use a strong password and keep your account credentials confidential.",
      "We retain information for as long as reasonably necessary to provide the service, meet legal obligations, resolve disputes, and enforce our agreements.",
    ],
  },
  {
    title: "6. Your Rights and Choices",
    content: [
      "Subject to applicable law, you may request access to, correction of, or deletion of your personal information.",
      "You may also request information about how your personal data is processed or withdraw consent where processing is based on consent.",
      "To submit a privacy request, contact us using the details provided below. We may need to verify your identity before responding.",
    ],
  },
  {
    title: "7. Third-Party Services",
    content: [
      "QuizPro may rely on third-party services for hosting, analytics, authentication, email delivery, or other technical operations. Their handling of information is governed by their own privacy policies and applicable agreements.",
      "We encourage you to review the privacy policies of third-party services you interact with.",
    ],
  },
  {
    title: "8. Children's Privacy",
    content: [
      "QuizPro is not intended to knowingly collect personal information from children in violation of applicable law. Where required, parental or guardian consent must be obtained before processing a child's personal data.",
    ],
  },
  {
    title: "9. Changes to This Policy",
    content: [
      "We may update this Privacy Policy from time to time. Any updated version will be published on this page with a revised effective date.",
    ],
  },
];

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
            This Privacy Policy explains how QuizPro collects, uses, stores,
            and protects information when you use our platform.
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
              10. Contact Us
            </h2>
            <p className="text-[15px] leading-7 text-stone-600">
              If you have questions, concerns, or requests regarding this
              Privacy Policy or your personal information, contact us at:
            </p>
            <p className="mt-3 text-sm font-medium text-stone-900">
              Email: [YOUR PRIVACY CONTACT EMAIL]
            </p>
            <p className="mt-2 text-sm text-stone-500">
              Platform: QuizPro
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-stone-200 pt-7">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-stone-500">
            <Link href="/terms" className="hover:text-black">Terms & Conditions</Link>
            <Link href="/cookie-policy" className="hover:text-black">Cookie Policy</Link>
            <Link href="/" className="hover:text-black">Home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
