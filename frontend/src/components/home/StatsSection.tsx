import { Brain, Clock, ShieldCheck, Trophy } from "lucide-react";

const stats = [
  {
    icon: Trophy,
    value: "3",
    label: "Difficulty levels",
    icon_box: "bg-gradient-to-br from-violet-50 to-violet-200 text-violet-700 ring-violet-200",
    accent: "bg-violet-500",
    shadow: "hover:shadow-violet-100",
  },
  {
    icon: ShieldCheck,
    value: "0",
    label: "Answer leaks",
    icon_box: "bg-gradient-to-br from-emerald-50 to-emerald-200 text-emerald-700 ring-emerald-200",
    accent: "bg-emerald-500",
    shadow: "hover:shadow-emerald-100",
  },
  {
    icon: Clock,
    value: "5 min",
    label: "Timed quiz player",
    icon_box: "bg-gradient-to-br from-orange-50 to-orange-200 text-orange-700 ring-orange-200",
    accent: "bg-orange-500",
    shadow: "hover:shadow-orange-100",
  },
  {
    icon: Brain,
    value: "AI",
    label: "Tutor on every miss",
    icon_box: "bg-gradient-to-br from-violet-50 to-violet-200 text-violet-700 ring-violet-200",
    accent: "bg-violet-500",
    shadow: "hover:shadow-violet-100",
  },
];

export function StatsSection() {
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`group relative flex items-center gap-4 overflow-hidden rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-stone-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${s.shadow}`}
        >
          <span
            className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-50 transition-transform duration-300 group-hover:scale-x-100 ${s.accent}`}
          />

          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-4 ring-offset-0 transition-transform duration-300 group-hover:scale-110 ${s.icon_box}`}
          >
            <s.icon className="h-6 w-6" />
          </div>

          <div>
            <div className="text-3xl font-extrabold leading-none tracking-tight text-stone-900">
              {s.value}
            </div>
            <div className="mt-1.5 text-sm font-medium text-stone-500">{s.label}</div>
          </div>
        </div>
      ))}
    </section>
  );
}