import { CalendarCheck, Crown, ShieldX, Ticket } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SignInButton } from "@/components/auth-buttons";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    icon: Ticket,
    title: "Join with a code",
    body: "Your admin creates the league and shares a six-character code. Sign in with Discord, enter the code, you're in.",
  },
  {
    icon: CalendarCheck,
    title: "Pick one team a week",
    body: "Every gameweek you back a single Premier League side to win. Once you've used a team, it's greyed out — you can't go back to it.",
  },
  {
    icon: ShieldX,
    title: "Win or you're out",
    body: "Your team wins and you go through. A draw or a defeat and your run ends there, with the table updating for everyone to see.",
  },
  {
    icon: Crown,
    title: "Last one standing",
    body: "Survivors keep picking until a single player is left. Run out of teams and the pool resets, so the game always finds a winner.",
  },
];

const rules: [string, string][] = [
  [
    "No repeat teams",
    "Until your pool resets, every pick must be a team you have not used.",
  ],
  [
    "Miss the deadline, miss out",
    "No pick by kick-off counts as a loss, so get in early.",
  ],
  [
    "Everyone sees the table",
    "Survivors, casualties and every past pick stay on show all season.",
  ],
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main>
      {/* Hero */}
      <section className="border-line relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,#751819_0%,transparent_55%)] opacity-70"
        />
        <div className="shell relative py-20 sm:py-28">
          <p className="eyebrow text-crimson mb-4">
            Premier League · Last Man Standing
          </p>
          <h1 className="display-1 max-w-4xl">
            One team. One week.
            <br />
            <span className="text-crimson">No second chances.</span>
          </h1>
          <p className="text-ink-muted mt-6 max-w-xl text-base leading-relaxed sm:text-lg">
            Back a different Premier League winner every gameweek. Survive the
            week and you go again. Lose once and you are watching from the
            sidelines while everyone else plays on.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            {user ? (
              <ButtonLink href="/dashboard" size="lg">
                Go to your dashboard
              </ButtonLink>
            ) : (
              <SignInButton />
            )}
            <p className="text-ink-faint text-xs">
              {user
                ? `Signed in as ${user.name ?? "player"}`
                : "Discord sign-in — no password to remember."}
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="shell py-16 sm:py-20">
        <h2 className="display-2 rule-crimson mb-10">How it works</h2>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <Card key={title} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-4 flex items-center gap-3">
                  <span className="bg-crimson-night text-crimson border-crimson-deep flex size-10 items-center justify-center rounded-[8px] border">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-ink-faint text-2xl font-black">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display mb-2 text-base font-extrabold tracking-[0.02em] uppercase">
                  {title}
                </h3>
                <p className="text-ink-muted text-sm leading-relaxed">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Rules strip */}
      <section className="border-line bg-surface-sunken border-y">
        <div className="shell grid gap-8 py-12 sm:grid-cols-3">
          {rules.map(([title, body]) => (
            <div key={title}>
              <p className="eyebrow text-gold mb-2">{title}</p>
              <p className="text-ink-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="shell text-ink-faint py-10 text-xs">
        <p>
          Fixtures from football-data.org. Results are confirmed by your league
          admin each gameweek.
        </p>
      </footer>
    </main>
  );
}
