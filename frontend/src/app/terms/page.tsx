
import Link from "next/link";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: [
      "By accessing or using MindMark, you agree to these Terms & Conditions. If you do not agree with these terms, please do not use the platform.",
      "These terms apply to all visitors, registered users, and anyone accessing or using MindMark.",
    ],
  },
  {
    title: "2. About MindMark",
    content: [
      "MindMark is an online learning and assessment platform designed to help users create, attempt, and review quizzes.",
      "Features may include quiz creation, study material uploads, assessments, scores, and performance-related information. Features may change or be updated over time.",
    ],
  },
  {
    title: "3. User Accounts",
    content: [
      "Some features may require you to create an account and provide accurate information.",
      "You are responsible for maintaining the confidentiality of your login credentials and for activities carried out through your account.",
      "You must notify us if you suspect unauthorized access to your account.",
    ],
  },
  {
    title: "4. Acceptable Use",
    content: [
      "You agree not to use MindMark for unlawful, fraudulent, harmful, or misleading activities.",
      "You must not attempt to gain unauthorized access to the platform, interfere with its operation, distribute malicious code, or exploit security vulnerabilities.",
      "You must not misuse the platform to infringe another person's intellectual property or privacy rights.",
    ],
  },
  {
    title: "5. Uploaded Materials and User Content",
    content: [
      "You retain responsibility for the content and materials you upload or submit to MindMark.",
      "You must have the necessary rights or permissions to use uploaded documents, notes, images, and other materials.",
      "By submitting content, you grant us permission to process and use it only as reasonably necessary to provide the features you request and operate the platform.",
      "You must not upload content that is unlawful, abusive, infringing, or otherwise prohibited by applicable law.",
    ],
  },
  {
    title: "6. Intellectual Property",
    content: [
      "The MindMark platform, including its branding, design, software, interface, and original content, is owned by or licensed to the platform operator and is protected by applicable intellectual property laws.",
      "You may not copy, reproduce, distribute, modify, or commercially exploit platform materials without prior written permission, except where permitted by law.",
    ],
  },
  {
    title: "7. Availability and Changes",
    content: [
      "We aim to keep MindMark available and functioning, but we do not guarantee uninterrupted or error-free access.",
      "We may modify, suspend, or discontinue features, temporarily or permanently, where reasonably necessary for maintenance, security, or business operations.",
    ],
  },
  {
    title: "8. Third-Party Services and Links",
    content: [
      "MindMark may use or link to third-party services. We are not responsible for the content, availability, or independent practices of those services.",
      "Your use of third-party services may be subject to separate terms and privacy policies.",
    ],
  },
  {
    title: "9. Disclaimer and Limitation of Liability",
    content: [
      "MindMark is provided on an 'as available' basis. We do not guarantee that quiz content, generated results, explanations, or learning materials will always be accurate, complete, or suitable for every purpose.",
      "To the extent permitted by applicable law, MindMark and its operators will not be liable for indirect, incidental, special, or consequential losses arising from your use of the platform.",
      "Nothing in these terms excludes liability that cannot legally be excluded under applicable law.",
    ],
  },
  {
    title: "10. Suspension and Termination",
    content: [
      "We may restrict, suspend, or terminate access if we reasonably believe that a user has violated these terms, created a security risk, or used the platform unlawfully.",
      "You may stop using MindMark at any time. Account deletion requests can be submitted through our contact details.",
    ],
  },
  {
    title: "11. Governing Law",
    content: [
      "These terms are governed by the laws of India, subject to applicable legal requirements. Any disputes will be handled by courts having jurisdiction under applicable law.",
    ],
  },
  {
    title: "12. Changes to These Terms",
    content: [
      "We may revise these Terms & Conditions from time to time. Updated terms will be published on this page. Continued use of MindMark after changes take effect constitutes acceptance of the revised terms, where permitted by law.",
    ],
  },
];

export default function TermsPage() {
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
            Terms & Conditions
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
            Please read these terms carefully before accessing or using
            MindMark.
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
              13. Contact
            </h2>
            <p className="text-[15px] leading-7 text-stone-600">
              For questions about these terms, contact us at:
            </p>
            <p className="mt-3 text-sm font-medium text-stone-900">
              Email: [YOUR CONTACT EMAIL]
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-stone-200 pt-7">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-stone-500">
            <Link href="/privacy-policy" className="hover:text-black">Privacy Policy</Link>
            <Link href="/cookie-policy" className="hover:text-black">Cookie Policy</Link>
            <Link href="/" className="hover:text-black">Home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
