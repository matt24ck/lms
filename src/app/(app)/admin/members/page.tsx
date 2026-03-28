import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddMemberForm } from "@/components/admin/add-member-form";
import { RemoveMemberButton } from "@/components/admin/remove-member-button";
import Link from "next/link";

const PAGE_SIZE = 50;

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));

  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeCompetition) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">No active competition.</p>
        </CardContent>
      </Card>
    );
  }

  const [members, totalCount] = await Promise.all([
    prisma.competitionUser.findMany({
      where: { competitionId: activeCompetition.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            discordUsername: true,
            discordId: true,
          },
        },
      },
      orderBy: [{ isEliminated: "asc" }, { joinedAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.competitionUser.count({
      where: { competitionId: activeCompetition.id },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <AddMemberForm competitionId={activeCompetition.id} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading uppercase">
            Members ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Discord ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.user.image ?? undefined} />
                        <AvatarFallback className="bg-muted text-xs">
                          {m.user.name?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {m.user.discordUsername}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {m.user.discordId}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.user.email ?? "-"}
                  </TableCell>
                  <TableCell>
                    {m.isEliminated ? (
                      <Badge variant="destructive">Eliminated</Badge>
                    ) : (
                      <Badge className="bg-[#22c55e] hover:bg-[#22c55e]/80">
                        Alive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <RemoveMemberButton
                      userId={m.user.id}
                      competitionId={activeCompetition.id}
                      username={m.user.discordUsername}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/members?page=${page - 1}`}
                  className="rounded-md border border-border bg-card px-3 py-1 text-sm hover:bg-muted"
                >
                  Previous
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/admin/members?page=${page + 1}`}
                  className="rounded-md border border-border bg-card px-3 py-1 text-sm hover:bg-muted"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
