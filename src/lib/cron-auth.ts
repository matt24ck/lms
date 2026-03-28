import { timingSafeEqual } from "crypto";

export function verifyCronSecret(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader.length !== expected.length) return false;

  return timingSafeEqual(
    Buffer.from(authHeader),
    Buffer.from(expected)
  );
}
