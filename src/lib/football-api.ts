const BASE_URL = "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

async function fetchFromApi(
  endpoint: string,
  params?: Record<string, string>
) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { "X-Auth-Token": API_KEY },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`football-data.org API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface ApiMatch {
  id: number;
  matchday: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
  };
}

export interface ApiCompetition {
  id: number;
  name: string;
  currentSeason: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
}

export async function getCompetitionInfo(): Promise<ApiCompetition> {
  return fetchFromApi("/competitions/PL");
}

export async function getMatchday(matchday: number): Promise<{ matches: ApiMatch[] }> {
  return fetchFromApi("/competitions/PL/matches", {
    matchday: String(matchday),
  });
}

export async function getFinishedMatches(
  matchday: number
): Promise<{ matches: ApiMatch[] }> {
  return fetchFromApi("/competitions/PL/matches", {
    matchday: String(matchday),
    status: "FINISHED",
  });
}

export async function getTeams(): Promise<{ teams: ApiTeam[] }> {
  return fetchFromApi("/competitions/PL/teams");
}
