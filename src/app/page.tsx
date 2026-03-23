import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <span className="font-heading text-xl font-bold uppercase tracking-wider">
              Last Man Standing
            </span>
          </div>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-6 py-24 text-center">
          <h1 className="font-heading text-5xl font-bold uppercase tracking-tight md:text-7xl">
            Last Man{" "}
            <span className="text-primary">Standing</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Pick a Premier League team to win each week. Get it wrong and
            you&apos;re out. Can&apos;t pick the same team twice. Last one
            standing wins.
          </p>

          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8">
                Join the Game
              </Button>
            </Link>
          </div>

          {/* Feature cards */}
          <div className="mt-20 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-8">
              <Trophy className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-bold uppercase">
                Pick to Win
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose one Premier League team each gameweek. If they win, you
                survive.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-8">
              <Shield className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-bold uppercase">
                No Repeats
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Once you&apos;ve used a team, they&apos;re locked out for the
                rest of the competition.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-8">
              <Users className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-bold uppercase">
                Last One Wins
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Draws and losses eliminate you. Be the last player standing to
                claim victory.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
