import Image from "next/image";
import { Brain, ShieldCheck, Target } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const features = [
  {
    icon: ShieldCheck,
    title: "Zero-Leak Security",
    text: "Answer keys and explanations stay on the server. Inspecting network calls or HTML reveals nothing.",
    image: "/images/highlight-security.jpg",
    alt: "Security and data protection",
    badge: "bg-sky-600 text-white shadow-sky-200",
    placeholder: "from-sky-100 to-sky-200",
    shadow: "hover:shadow-sky-100",
  },
  {
    icon: Target,
    title: "Distractor Engineering",
    text: "No lazy 'All of the above'. Wrong options are built around real student misconceptions.",
    image: "/images/highlight-distractors.jpg",
    alt: "Student working through a multiple-choice question",
    badge: "bg-orange-600 text-white shadow-orange-200",
    placeholder: "from-orange-100 to-orange-200",
    shadow: "hover:shadow-orange-100",
  },
  {
    icon: Brain,
    title: "AI Tutor",
    text: "\u201cExplain My Mistake\u201d gives a simple explanation, a memory tip and a real-world analogy.",
    image: "/images/highlight-tutor.jpg",
    alt: "Student getting help from an AI tutor",
    badge: "bg-violet-600 text-white shadow-violet-200",
    placeholder: "from-violet-100 to-violet-200",
    shadow: "hover:shadow-violet-100",
  },
];

export function HighlightsSection() {
  return (
    <section className="space-y-8">
      {/* Section heading */}
      <Reveal direction="up">
        <h2 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
          Platform Highlights
        </h2>
      </Reveal>

      {/* Feature cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {features.map((f, index) => (
          <Reveal
            key={f.title}
            direction="up"
            delay={index * 0.15}
            duration={0.7}
          >
            <article
              className={`group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${f.shadow}`}
            >
              {/* Image */}
              <div
                className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${f.placeholder}`}
              >
                <Image
                  src={f.image}
                  alt={f.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {/* Content */}
              <div className="relative flex flex-1 flex-col px-6 pb-8 pt-10">
                <div
                  className={`absolute -top-7 left-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 ring-white ${f.badge}`}
                >
                  <f.icon className="h-6 w-6" />
                </div>

                <h3 className="text-xl font-extrabold tracking-tight text-stone-900">
                  {f.title}
                </h3>

                <p className="mt-3 leading-relaxed text-stone-600">
                  {f.text}
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
