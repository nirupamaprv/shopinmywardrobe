import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/today", label: "Today" },
  { to: "/closet", label: "Closet" },
  { to: "/calendar", label: "Calendar" },
  { to: "/decide", label: "Decide" },
  { to: "/unloved", label: "Unloved" },
  { to: "/insights", label: "Insights" },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/today" className="font-display text-xl tracking-[0.2em] uppercase">
            Wardrobe
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="eyebrow hover:text-foreground"
          >
            Sign out
          </button>
        </div>
        <nav className="mx-auto max-w-5xl overflow-x-auto px-5">
          <ul className="flex gap-6 pb-3">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className="eyebrow whitespace-nowrap pb-1 transition-colors hover:text-foreground"
                  activeProps={{
                    className: cn("eyebrow whitespace-nowrap pb-1 border-b border-foreground text-foreground"),
                  }}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl leading-none">{title}</h1>
            {subtitle && <p className="mt-2 max-w-lg text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </main>
    </div>
  );
}
