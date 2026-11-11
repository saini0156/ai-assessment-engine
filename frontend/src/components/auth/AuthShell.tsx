import Image from "next/image";
import Link from "next/link";

interface AuthShellProps {
  headline: string;
  text: string;
  children: React.ReactNode;
  image?: string;
}

export function AuthShell({
  headline,
  text,
  children,
  image = "/images/auth-bg.jpg",
}: AuthShellProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex h-dvh flex-col overflow-y-auto bg-white lg:flex-row lg:overflow-hidden">
      {/* Left: image + content (60%) */}
      <div className="relative min-h-[220px] shrink-0 bg-stone-300 sm:min-h-[260px] lg:h-full lg:w-[60%]">
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/10" />

        <div className="relative z-10 flex h-full flex-col justify-between gap-6 p-6 sm:p-10 lg:p-14">
                    <Link href="/" aria-label="MindMark home" className="inline-flex self-start">
            <Image
              src="/images/logowhite.png"
              alt="MindMark"
              width={320}
              height={160}
              priority
              className="h-24 w-auto object-contain sm:h-32 lg:h-28"
            />
          </Link>

          <div className="max-w-2xl space-y-3">
            <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-md sm:text-4xl xl:text-6xl">
              {headline}
            </h1>
            <p className="hidden max-w-xl text-base leading-relaxed text-white/90 drop-shadow sm:block sm:text-lg">
              {text}
            </p>
          </div>

          <p className="hidden text-sm text-white/80 lg:block">
            &copy; {new Date().getFullYear()} MindMark
          </p>
        </div>
      </div>

      {/* Right: form (40%) */}
      <div className="flex items-center justify-center bg-white px-6 py-10 sm:px-12 lg:h-full lg:w-[40%] lg:overflow-y-auto lg:px-14">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}