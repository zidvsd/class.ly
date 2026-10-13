import Link from "next/link";
import Image from "next/image";

export function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-lg font-semibold">
      <Image src="/Classly_Logo.svg" alt="" width={32} height={32} priority />
      Class.ly
    </Link>
  );
}

// Top bar for the student and login pages. Anything passed in is shown on the right.
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="app-header justify-between">
      <Brand href="/join" />
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
