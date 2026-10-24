"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { LogOut, User } from "lucide-react";

export function UserHeader() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  if (!session?.user) return null;

  return (
    <header className="border-b border-border bg-background">
      <div className="flex h-14 items-center justify-end gap-4 px-6">
        <Link
          href="/profile"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <User className="h-3.5 w-3.5" />
          {session.user.email}
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Esci
        </button>
      </div>
    </header>
  );
}
