"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, ArrowLeftRight, Table2, Landmark, House } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/transactions", label: "Transazioni", icon: ArrowLeftRight },
  { href: "/dashboard/budget", label: "Budget", icon: Table2 },
  { href: "/dashboard/casa", label: "Casa", icon: House },
  { href: "/dashboard/accounts", label: "Conti", icon: Landmark },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6">
      <div className="flex items-center gap-3 px-2 pb-8">
        <Image
          src="/logo.png"
          alt=""
          width={44}
          height={44}
          className="shrink-0"
        />
        <div className="leading-tight">
          <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Arianna Zampieron
          </span>
          <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Finance Tracker
          </span>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
