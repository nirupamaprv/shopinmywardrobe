import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wardrobe — Mix, match and wear what you love" },
      {
        name: "description",
        content:
          "Photograph your tops and bottoms, get daily outfit pairings, rate them, and learn which pieces you actually wear.",
      },
      { property: "og:title", content: "Wardrobe — Mix, match and wear what you love" },
      {
        property: "og:description",
        content: "Daily outfit pairings from your own closet, tuned to the styles you actually wear.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/today" });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
        <p className="eyebrow">Your closet, styled daily</p>
        <h1 className="mt-5 font-display text-6xl leading-[0.95] sm:text-7xl">
          Wear what you
          <br />
          actually love.
        </h1>
        <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Photograph your tops and your bottoms. Every morning, five fresh pairings that skip the
          colors you just wore. Like, dislike, log what you wore — and let your closet learn your
          taste. Pieces you never reach for surface in Decide, so you can sell, store, or save them
          for occasions.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center bg-primary px-8 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open my closet
          </Link>
        </div>
        <div className="mt-16 grid gap-8 border-t border-border pt-8 sm:grid-cols-3">
          {[
            ["Daily edit", "4–5 pairings a day, never repeating recent colors."],
            ["Decide", "Anything unworn 45 days: sell, seasonal or special."],
            ["Insights", "See what you wear, and what to stop buying."],
          ].map(([t, d]) => (
            <div key={t}>
              <h2 className="font-display text-xl">{t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
