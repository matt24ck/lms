import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { SignInButton } from "@/components/auth-buttons";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    "That Discord account is already linked to a different player.",
  AccessDenied:
    "Discord sign-in was denied. If you didn't cancel it yourself, check that your Discord account's email address is verified (Discord Settings → My Account), then try again.",
  Configuration:
    "Discord sign-in is not configured correctly. Check AUTH_DISCORD_ID, AUTH_DISCORD_SECRET and AUTH_SECRET.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="eyebrow text-ink-faint hover:text-ink mb-6 inline-block"
        >
          ← Back to home
        </Link>

        <Card>
          <CardContent className="p-8">
            <p className="eyebrow text-crimson mb-3">Last Man Standing</p>
            <h1 className="display-3 mb-3">Sign in to play</h1>
            <p className="text-ink-muted mb-7 text-sm leading-relaxed">
              We use Discord so your league already knows who you are. You will
              need a join code from your admin to enter a competition.
            </p>

            {error ? (
              <div className="mb-6">
                <Alert tone="error" title="Could not sign you in">
                  {errorMessages[error] ??
                    "Something went wrong signing in. Please try again."}
                </Alert>
              </div>
            ) : null}

            <SignInButton className="w-full" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
