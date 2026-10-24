import { requireAuth } from "@/lib/session";
import { ensureCategoriesSeeded } from "@/lib/finance/categories";
import { ensureAccountsSeeded } from "@/lib/finance/accounts-seed";
import { UserHeader } from "@/components/user-header";
import { SidebarNav } from "@/components/finance/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  await Promise.all([
    ensureCategoriesSeeded(session.user.id),
    ensureAccountsSeeded(session.user.id),
  ]);

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <UserHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 md:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
