import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function GET() {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const competition = await prisma.competition.findFirst({
    where: { status: { in: ["ACTIVE", "PENDING"] } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ competition });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { name, seasonLabel } = await req.json();

  if (!name || !seasonLabel) {
    return NextResponse.json(
      { error: "Name and season label are required" },
      { status: 400 }
    );
  }

  const competition = await prisma.competition.create({
    data: {
      name,
      seasonLabel,
      status: "ACTIVE",
      joinCode: generateJoinCode(),
    },
  });

  return NextResponse.json({ competition });
}
