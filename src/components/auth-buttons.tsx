import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SignInButton({
  label = "Sign in with Discord",
  size = "lg",
  className,
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/dashboard" });
      }}
    >
      <Button type="submit" size={size} className={className}>
        <LogIn className="size-4" aria-hidden />
        {label}
      </Button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="size-4" aria-hidden />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </form>
  );
}
