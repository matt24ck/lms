import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const isAccessDenied = error === "AccessDenied";

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 font-heading text-2xl font-bold uppercase">
          {isAccessDenied ? "Access Denied" : "Authentication Error"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isAccessDenied
            ? "You must be a member of the Discord server to sign in. Join the server and try again."
            : "Something went wrong during sign in. Please try again."}
        </p>
        <Link href="/login">
          <Button className="mt-6">Try Again</Button>
        </Link>
      </div>
    </div>
  );
}
