import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { BarChart3, Columns3, History, LayoutDashboard, Users, LogOut, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Screener", icon: Users, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const items = [
    ...navItems,
    ...(isAdmin ? [{ to: "/users", label: "Users", icon: ShieldCheck, end: false as const }] : []),
    { to: "/audit-log", label: "Audit Log", icon: History, end: false as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="font-bold tracking-tight">
              AI <span className="text-primary">Screener</span>
            </div>
          </div>
          <nav className="flex items-center gap-1 ml-4">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-sm text-right hidden sm:block">
              <div className="font-medium leading-tight flex items-center gap-2 justify-end">
                {user?.name}
                {user?.role && <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px] uppercase">{user.role}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
