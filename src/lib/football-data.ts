/**
 * Minimal football-data.org v4 client.
 *
 * Only fixtures and team reference data are pulled — results are entered by
 * the admin when they end a gameweek, so no score endpoints are used.
 *
 * The free tier allows 10 requests/minute, which is ample: fixtures are
 * fetched once per gameweek and cached in Postgres.
 */

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "PL";

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
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
}

export class FootballDataError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FootballDataError";
  }
}

async function request<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    throw new FootballDataError(
      "FOOTBALL_DATA_API_KEY is not set. Add it to your environment to fetch fixtures.",
    );
  }

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    if (response.status === 400) {
      throw new FootballDataError(
        "football-data.org rejected the request — that matchday may not exist for the current season.",
        400,
      );
    }
    if (response.status === 403) {
      throw new FootballDataError(
        "football-data.org rejected the API key. Check FOOTBALL_DATA_API_KEY, and that your plan covers the Premier League.",
        403,
      );
    }
    if (response.status === 429) {
      throw new FootballDataError(
        "Hit the football-data.org rate limit (10 requests/minute on the free tier). Wait a minute and try again.",
        429,
      );
    }

    throw new FootballDataError(
      `football-data.org error ${response.status}: ${detail.slice(0, 200) || response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/** All 20 Premier League teams for the current season. */
export async function fetchTeams(): Promise<ApiTeam[]> {
  const data = await request<{ teams: ApiTeam[] }>(
    `/competitions/${COMPETITION}/teams`,
  );
  return data.teams;
}

/** Fixtures for a single matchday. */
export async function fetchMatchday(matchday: number): Promise<ApiMatch[]> {
  const data = await request<{ matches: ApiMatch[] }>(
    `/competitions/${COMPETITION}/matches`,
    { matchday: String(matchday) },
  );
  return data.matches;
}

/**
 * The matchday the real competition is currently on — used to pre-fill the
 * admin's "launch gameweek" form.
 */
export async function fetchCurrentMatchday(): Promise<{
  matchday: number;
  season: string;
}> {
  const data = await request<{
    currentSeason: {
      currentMatchday: number | null;
      startDate: string;
      endDate: string;
    };
  }>(`/competitions/${COMPETITION}`);

  const startYear = new Date(data.currentSeason.startDate).getUTCFullYear();
  const endYear = new Date(data.currentSeason.endDate).getUTCFullYear();

  return {
    matchday: data.currentSeason.currentMatchday ?? 1,
    season: `${startYear}/${String(endYear).slice(-2)}`,
  };
}
