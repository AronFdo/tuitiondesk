import Image from "next/image";
import { getPublicEnv } from "@/lib/env";
import { t } from "@/lib/t";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const env = getPublicEnv();

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-brand-gradient px-4 py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image
            src="/brand/wordmark.png"
            alt="TuitionDesk"
            width={1332}
            height={328}
            priority
            unoptimized
            className="h-auto w-[300px]"
          />
          <p className="text-sm text-slate">{t("Manage, teach, grow")}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-6 py-8">
          {env.ok ? children : <p className="text-slate">{env.error}</p>}
        </div>
      </div>
    </main>
  );
}
