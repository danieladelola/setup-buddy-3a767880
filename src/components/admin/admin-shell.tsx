import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Image as ImageIcon,
  LogOut,
  Sprout,
  Menu,
  X,
  Handshake,
  ClipboardList,
  SlidersHorizontal,
  Receipt,
} from "lucide-react";
import { adminLogout } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, children: [] },
  { to: "/admin/contestants", label: "Contestants", icon: Users, exact: false, children: [] },
  { to: "/admin/voting", label: "Voting settings", icon: SlidersHorizontal, exact: false, children: [] },
  { to: "/admin/payments", label: "Vote payments", icon: Receipt, exact: false, children: [] },
  { to: "/admin/applications", label: "Applications", icon: ClipboardList, exact: false, children: [] },
  
  {
    to: "/admin/events",
    label: "Events",
    icon: Calendar,
    exact: false,
    children: [
      { to: "/admin/events", label: "All events", exact: true },
      { to: "/admin/events/registrations", label: "Registrations", exact: false },
    ],
  },
  { to: "/admin/sponsors", label: "Sponsors", icon: Handshake, exact: false, children: [] },
  { to: "/admin/media", label: "Media", icon: ImageIcon, exact: false, children: [] },
] as const;

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
  email,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  email?: string;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const logoutFn = useServerFn(adminLogout);
  const [open, setOpen] = useState(false);

  async function onLogout() {
    await logoutFn();
    navigate({ to: "/admin/login" });
  }

  const navList = (
    <nav className="flex-1 px-3 py-2">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        const showChildren = item.children.length > 0 && pathname.startsWith(item.to);
        return (
          <div key={item.to}>
            <Link
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-[#1b4332] text-white"
                  : "text-[#cdd9d2] hover:bg-[#16382b] hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
            {showChildren && (
              <div className="ml-7 mt-1 mb-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                {item.children.map((child) => {
                  const childActive = child.exact
                    ? pathname === child.to
                    : pathname.startsWith(child.to);
                  return (
                    <Link
                      key={child.to}
                      to={child.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs transition",
                        childActive
                          ? "bg-[#16382b] text-white"
                          : "text-[#cdd9d2]/80 hover:bg-[#16382b] hover:text-white",
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );


  const brand = (
    <div className="flex items-center gap-3 px-6 py-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#d4af37] text-[#0f2a20]">
        <Sprout className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.18em] text-[#d4af37]">Admin</p>
        <p className="truncate text-sm font-semibold">Miss Agriculture</p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-white/10 px-4 py-4">
      {email && <p className="truncate text-xs text-[#cdd9d2]">{email}</p>}
      <button
        onClick={onLogout}
        className="mt-2 inline-flex items-center gap-2 text-sm text-[#d4af37] hover:text-white"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F4EE] text-[#1b2a22]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#1b4332]/10 bg-[#0f2a20] text-[#e6efe9] lg:flex">
        {brand}
        {navList}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-[#0f2a20] text-[#e6efe9] shadow-2xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-[#cdd9d2] hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList}
            {footer}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[#1b4332]/10 bg-[#F5F4EE]/90 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#1b4332]/15 bg-white text-[#1b2a22] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-xl tracking-tight text-[#1b2a22] sm:text-2xl md:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-[#1b2a22]/60 sm:text-sm">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={onLogout}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
