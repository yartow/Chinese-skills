import { useState } from "react";
import { useLocation } from "wouter";
import {
  Home as HomeIcon, BookMarked, FlaskConical, BookOpen, Library,
  Heart, Search as SearchIcon, GraduationCap, Layers, Bell,
  Settings, MoreHorizontal, LayoutGrid, LogOut, User,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearPersistedCache } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  role: string;
  unreadCount: number;
  showCustomize: boolean;
  user: unknown;
}

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
  match?: (loc: string) => boolean;
};

function isActive(item: NavItem, location: string) {
  return item.match ? item.match(location) : location === item.href;
}

function SidebarLink({
  item,
  location,
  setLocation,
  showLabel = true,
}: {
  item: NavItem;
  location: string;
  setLocation: (p: string) => void;
  showLabel?: boolean;
}) {
  const active = isActive(item, location);
  return (
    <button
      onClick={() => setLocation(item.href)}
      aria-label={!showLabel ? item.label : undefined}
      className={cn(
        "flex items-center rounded-lg text-sm transition-colors w-full",
        showLabel ? "gap-3 px-3 py-2" : "justify-center py-2.5",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <item.icon className={cn("shrink-0", showLabel ? "w-4 h-4" : "w-5 h-5")} />
      {showLabel && <span>{item.label}</span>}
    </button>
  );
}

function LogoBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const px = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  return (
    <img
      src="/icons/icon-192.png"
      alt="樂吃玩"
      className={cn("rounded-lg object-cover shrink-0", px)}
    />
  );
}

export default function AppShell({ children, role, unreadCount, showCustomize, user }: AppShellProps) {
  const [location, setLocation] = useLocation();
  const [modesOpen, setModesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const learnItems: NavItem[] = [
    { icon: HomeIcon, label: "Practice", href: "/" },
    { icon: BookMarked, label: "Standard Mode", href: "/standard" },
    { icon: FlaskConical, label: "Test", href: "/test" },
    { icon: BookOpen, label: "Words Mode", href: "/words" },
  ];
  const exploreItems: NavItem[] = [
    { icon: Library, label: "Browse", href: "/browse" },
    { icon: Heart, label: "Saved", href: "/saved" },
    { icon: SearchIcon, label: "Search", href: "/search" },
  ];
  const classroomItems: NavItem[] = [
    ...(role === "teacher" ? [{ icon: GraduationCap, label: "Students Roster", href: "/teacher" }] : []),
    ...(showCustomize ? [{ icon: Layers, label: "Customize", href: "/customize", match: (loc: string) => loc.startsWith("/customize") }] : []),
  ];

  const showMessages = ["teacher", "student"].includes(role);
  const modesActive = ["/standard", "/words", "/test"].includes(location);
  const moreActive = !modesActive && !["/", "/browse"].includes(location);
  const displayName = (user as any)?.firstName ?? (user as any)?.email?.split("@")[0] ?? "User";
  const avatarUrl: string | undefined = (user as any)?.profileImageUrl;

  return (
    <div className="flex min-h-screen">
      {/* ── TABLET RAIL (sm → lg) ── */}
      <aside className="hidden sm:flex lg:hidden w-16 flex-col border-r bg-background sticky top-0 h-screen shrink-0">
        <div className="h-[54px] flex items-center justify-center border-b">
          <LogoBadge />
        </div>
        <nav className="flex-1 flex flex-col gap-0.5 p-2 pt-3">
          {[...learnItems, ...exploreItems, ...classroomItems].map((item) => (
            <SidebarLink key={item.href} item={item} location={location} setLocation={setLocation} showLabel={false} />
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 p-2 pb-3 border-t">
          {showMessages && (
            <button
              aria-label="Messages"
              onClick={() => setLocation("/messages")}
              className={cn(
                "relative flex justify-center py-2.5 rounded-lg transition-colors",
                location === "/messages"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1.5 w-4 h-4 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
          <button
            className="flex justify-center py-2 w-full"
            onClick={() => setLocation("/settings")}
            aria-label="Settings"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-muted flex items-center justify-center">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                : <User className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>
        </div>
      </aside>

      {/* ── DESKTOP SIDEBAR (lg+) ── */}
      <aside className="hidden lg:flex w-[220px] flex-col border-r bg-background sticky top-0 h-screen shrink-0">
        {/* Logo */}
        <div className="px-4 h-[58px] flex items-center border-b">
          <div className="flex items-center gap-2.5">
            <LogoBadge />
            <div>
              <div className="font-semibold text-sm text-foreground leading-tight">Learn Chinese</div>
              <div className="text-[10px] text-muted-foreground">樂吃玩</div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Learn</p>
            <div className="space-y-0.5">
              {learnItems.map((item) => (
                <SidebarLink key={item.href} item={item} location={location} setLocation={setLocation} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Explore</p>
            <div className="space-y-0.5">
              {exploreItems.map((item) => (
                <SidebarLink key={item.href} item={item} location={location} setLocation={setLocation} />
              ))}
            </div>
          </div>
          {classroomItems.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Classroom</p>
              <div className="space-y-0.5">
                {classroomItems.map((item) => (
                  <SidebarLink key={item.href} item={item} location={location} setLocation={setLocation} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom: Messages + Profile */}
        <div className="p-3 border-t space-y-0.5">
          {showMessages && (
            <button
              onClick={() => setLocation("/messages")}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full",
                location === "/messages"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span className="relative">
                <Bell className="w-4 h-4 shrink-0" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground flex items-center justify-center leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span>Messages</span>
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors w-full text-left">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {avatarUrl
                    ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    : <span className="text-xs font-medium text-muted-foreground">{displayName[0]?.toUpperCase()}</span>}
                </div>
                <span className="text-sm text-foreground truncate flex-1">{displayName}</span>
                <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem onClick={() => setLocation("/settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => window.dispatchEvent(new Event("replayTutorial"))}
              >
                Replay tutorial
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  await clearPersistedCache();
                  await fetch("/api/logout", { method: "POST", credentials: "include" });
                  window.location.href = "/auth";
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── CONTENT COLUMN ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="sm:hidden fixed top-0 left-0 right-0 z-40 h-[54px] bg-background border-b flex items-center px-4 gap-2">
          <div className="flex items-center gap-2 flex-1">
            <LogoBadge size="sm" />
            <span className="font-semibold text-sm">Learn Chinese</span>
          </div>
          <button
            aria-label="Search"
            onClick={() => setLocation("/search")}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <SearchIcon className="w-5 h-5" />
          </button>
          {showMessages && (
            <button
              aria-label="Messages"
              onClick={() => setLocation("/messages")}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
        </header>

        {/* Spacer for mobile fixed header */}
        <div className="sm:hidden h-[54px] shrink-0" aria-hidden />

        {/* Page content */}
        <main className="flex-1 pb-[65px] sm:pb-0">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 h-[65px] bg-background border-t flex items-stretch">
        <button
          onClick={() => setLocation("/")}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
            location === "/" ? "text-primary" : "text-muted-foreground",
          )}
        >
          <HomeIcon className="w-5 h-5" />
          <span>Practice</span>
        </button>
        <button
          onClick={() => setModesOpen(true)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
            modesActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <LayoutGrid className="w-5 h-5" />
          <span>Modes</span>
        </button>
        <button
          onClick={() => setLocation("/browse")}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
            location === "/browse" ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Library className="w-5 h-5" />
          <span>Browse</span>
        </button>
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative",
            moreActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <span className="relative">
            <MoreHorizontal className="w-5 h-5" />
            {showMessages && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive" />
            )}
          </span>
          <span>More</span>
        </button>
      </nav>

      {/* ── MODES BOTTOM SHEET ── */}
      <Sheet open={modesOpen} onOpenChange={setModesOpen}>
        <SheetContent side="bottom" className="pb-[calc(65px+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Learning Modes</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {[
              { icon: BookMarked, label: "Standard Mode", desc: "Sequential character learning", href: "/standard" },
              { icon: FlaskConical, label: "Test", desc: "Check your knowledge", href: "/test" },
              { icon: BookOpen, label: "Words Mode", desc: "Learn vocabulary in context", href: "/words" },
            ].map(({ icon: Icon, label, desc, href }) => (
              <button
                key={href}
                onClick={() => { setLocation(href); setModesOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                  location === href
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">{label}</div>
                  <div className={cn("text-xs", location === href ? "text-primary-foreground/70" : "text-muted-foreground")}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── MORE BOTTOM SHEET ── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-[calc(65px+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {([
              { icon: Heart, label: "Saved", href: "/saved", show: true },
              { icon: Bell, label: "Messages", href: "/messages", show: showMessages },
              { icon: Layers, label: "Customize", href: "/customize", show: showCustomize },
              { icon: GraduationCap, label: "Students Roster", href: "/teacher", show: role === "teacher" },
              { icon: Settings, label: "Settings", href: "/settings", show: true },
            ] as { icon: React.ElementType; label: string; href: string; show: boolean }[])
              .filter((i) => i.show)
              .map(({ icon: Icon, label, href }) => (
                <button
                  key={href}
                  onClick={() => { setLocation(href); setMoreOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    location === href || location.startsWith(href + "/")
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="font-medium text-sm">{label}</span>
                </button>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
