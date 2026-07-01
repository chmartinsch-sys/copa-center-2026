import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.API_FOOTBALL_KEY;
const DEFAULT_LEAGUE = process.env.API_FOOTBALL_LEAGUE || "1";
const SEASON = process.env.API_FOOTBALL_SEASON || "2026";
const BASE = "https://v3.football.api-sports.io";
const DATA_PATH = "data/copa2026.json";
const STATUS_PATH = "data/api-football-status.json";
const DATE_FROM = "2026-06-11";
const DATE_TO = "2026-07-19";
const MAX_CANDIDATES = 8;

if (!KEY) throw new Error("API_FOOTBALL_KEY não configurada nos GitHub Secrets.");

const discovery = {
  checkedAt: new Date().toISOString(),
  targetSeason: SEASON,
  defaultLeague: DEFAULT_LEAGUE,
  leagueQueries: [],
  candidates: [],
  fixtureAttempts: [],
  selected: null,
  updatedData: false,
  message: ""
};

async function readPreviousData() {
  try {
    return JSON.parse(await readFile(DATA_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function writeStatus(extra = {}) {
  await writeFile(STATUS_PATH, JSON.stringify({ ...discovery, ...extra }, null, 2) + "\n", "utf8");
}

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) console.warn("API warnings/errors:", json.errors);
  return json.response || [];
}

function hasTargetSeason(leagueResponse) {
  return (leagueResponse.seasons || []).some(s => String(s.year) === String(SEASON));
}

function isMainWorldCupCandidate(leagueResponse) {
  const name = leagueResponse.league?.name || "";
  const country = leagueResponse.country?.name || "";
  const combined = `${name} ${country}`.toLowerCase();

  if (!combined.includes("world cup") && !combined.includes("fifa")) return false;

  const exclude = ["women", "u17", "u20", "u21", "u23", "qualification", "qualifiers", "qualifying", "club", "beach", "friendly"];
  return !exclude.some(term => combined.includes(term));
}

function scoreCandidate(leagueResponse) {
  const name = (leagueResponse.league?.name || "").toLowerCase();
  let score = 0;

  if (name === "world cup") score += 100;
  if (name.includes("fifa world cup")) score += 90;
  if (name.includes("world cup")) score += 60;
  if (hasTargetSeason(leagueResponse)) score += 40;
  if (isMainWorldCupCandidate(leagueResponse)) score += 30;

  return score;
}

async function discoverLeagueCandidates() {
  const byKey = new Map();

  function addCandidate(item, origin) {
    const id = item.league?.id;
    if (!id) return;
    const key = `${id}:${SEASON}`;
    const candidate = {
      id: String(id),
      season: SEASON,
      name: item.league?.name || "",
      country: item.country?.name || "",
      type: item.league?.type || "",
      origin,
      hasTargetSeason: hasTargetSeason(item),
      score: scoreCandidate(item)
    };

    if (!byKey.has(key) || byKey.get(key).score < candidate.score) byKey.set(key, candidate);
  }

  // Always test the configured league first.
  byKey.set(`${DEFAULT_LEAGUE}:${SEASON}`, {
    id: String(DEFAULT_LEAGUE),
    season: SEASON,
    name: "Configured league",
    country: "",
    type: "Cup",
    origin: "env:API_FOOTBALL_LEAGUE",
    hasTargetSeason: true,
    score: 75
  });

  const leagueSearches = [
    "/leagues?search=World%20Cup",
    "/leagues?search=FIFA",
    `/leagues?season=${encodeURIComponent(SEASON)}`
  ];

  for (const path of leagueSearches) {
    try {
      const response = await api(path);
      discovery.leagueQueries.push({ path, count: response.length });

      for (const item of response) {
        if (!isMainWorldCupCandidate(item)) continue;
        addCandidate(item, path);
      }
    } catch (error) {
      discovery.leagueQueries.push({ path, error: error.message });
      console.warn(`Falha ao consultar ${path}:`, error.message);
    }
  }

  const candidates = [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  discovery.candidates = candidates;
  console.log("Candidatos de liga:", candidates.map(c => `${c.id}/${c.season} ${c.name} score=${c.score}`).join(" | "));
  return candidates;
}

async function tryCandidateFixtures(candidate) {
  const attempts = [
    `/fixtures?league=${candidate.id}&season=${candidate.season}`,
    `/fixtures?league=${candidate.id}&season=${candidate.season}&from=${DATE_FROM}&to=${DATE_TO}`
  ];

  for (const path of attempts) {
    const fixtures = await api(path);
    discovery.fixtureAttempts.push({ league: candidate.id, season: candidate.season, name: candidate.name, path, count: fixtures.length });
    console.log(`${path}: ${fixtures.length} jogos`);
    if (fixtures.length > 0) return fixtures;
  }

  return [];
}

async function fetchFixtures() {
  const candidates = await discoverLeagueCandidates();

  for (const candidate of candidates) {
    const fixtures = await tryCandidateFixtures(candidate);
    if (fixtures.length > 0) {
      discovery.selected = candidate;
      return fixtures;
    }
  }

  return [];
}

function stageFromRound(round = "") {
  const r = round.toLowerCase();
  if (r.includes("round of 32")) return "round32";
  if (r.includes("round of 16")) return "oitavas";
  if (r.includes("quarter")) return "quartas";
  if (r.includes("semi")) return "semifinal";
  if (r.includes("3rd") || r.includes("third")) return "terceiro";
  if (r.includes("final")) return "final";
  return "grupos";
}

function teamName(t) {
  const map = {
    "Brazil": "Brasil", "Japan": "Japão", "Germany": "Alemanha", "Paraguay": "Paraguai",
    "Netherlands": "Holanda", "Morocco": "Marrocos", "Ivory Coast": "Costa do Marfim",
    "Norway": "Noruega", "France": "França", "Sweden": "Suécia", "Mexico": "México",
    "Ecuador": "Equador", "England": "Inglaterra", "DR Congo": "RD Congo", "Belgium": "Bélgica",
    "Senegal": "Senegal", "United States": "Estados Unidos", "Bosnia and Herzegovina": "Bósnia e Herzegovina",
    "Spain": "Espanha", "Austria": "Áustria", "Portugal": "Portugal", "Croatia": "Croácia",
    "Switzerland": "Suíça", "Algeria": "Argélia", "Australia": "Austrália", "Egypt": "Egito",
    "Argentina": "Argentina", "Cape Verde": "Cabo Verde", "Colombia": "Colômbia", "Ghana": "Gana",
    "Canada": "Canadá", "South Africa": "África do Sul"
  };
  return map[t] || t || "A definir";
}

function normStatus(short) {
  if (["FT", "AET", "PEN", "CANC", "ABD"].includes(short)) return "finished";
  if (["1H", "HT", "2H", "ET", "P", "BT", "LIVE"].includes(short)) return "live";
  return "scheduled";
}

function fixtureToMatch(x) {
  const statusShort = x.fixture?.status?.short || "NS";
  return {
    id: String(x.fixture?.id || ""),
    utcDate: x.fixture?.date,
    stage: stageFromRound(x.league?.round),
    home: teamName(x.teams?.home?.name),
    away: teamName(x.teams?.away?.name),
    homeScore: x.goals?.home,
    awayScore: x.goals?.away,
    status: normStatus(statusShort),
    statusShort,
    venue: x.fixture?.venue?.name || "",
    favorite: ""
  };
}

function buildBracket(matches) {
  const upcoming = matches.filter(m => m.stage !== "grupos" && m.status !== "finished").slice(0, 12);
  return [{
    phase: "Próximos jogos do mata-mata",
    items: upcoming.map(m => ({ match: `${m.home} x ${m.away}`, status: new Date(m.utcDate).toISOString() }))
  }];
}

function buildBrazilPath(matches) {
  return matches
    .filter(m => m.home === "Brasil" || m.away === "Brasil")
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    .map(m => ({ phase: m.stage, value: `${m.home} x ${m.away}` }));
}

const previous = await readPreviousData();
const fixtures = await fetchFixtures();

if (fixtures.length === 0) {
  const previousCount = previous?.matches?.length || 0;
  const message = `API retornou zero jogos para todos os candidatos de World Cup ${SEASON}.`;

  discovery.updatedData = false;
  discovery.message = previousCount > 0 ? `${message} Mantendo arquivo atual com ${previousCount} jogos.` : `${message} Não há base anterior para preservar.`;
  await writeStatus();

  if (previousCount > 0) {
    console.warn(discovery.message);
    process.exit(0);
  }

  throw new Error(discovery.message);
}

let scorers = previous?.scorers || [];
try {
  const leagueId = discovery.selected?.id || DEFAULT_LEAGUE;
  const top = await api(`/players/topscorers?league=${leagueId}&season=${SEASON}`);
  const parsed = top.slice(0, 10).map(x => ({
    name: x.player?.name || "Jogador",
    team: teamName(x.statistics?.[0]?.team?.name),
    goals: x.statistics?.[0]?.goals?.total || 0
  })).filter(s => s.goals > 0);

  if (parsed.length > 0) scorers = parsed;
  else console.warn("API retornou artilharia vazia. Mantendo artilharia anterior.");
} catch (error) {
  console.warn("Top scorers indisponível. Mantendo artilharia anterior:", error.message);
}

const matches = fixtures.map(fixtureToMatch).filter(m => m.utcDate).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

if (matches.length === 0) {
  const previousCount = previous?.matches?.length || 0;
  discovery.updatedData = false;
  discovery.message = previousCount > 0
    ? `Fixtures recebidas, mas nenhum jogo foi convertido. Mantendo ${previousCount} jogos anteriores.`
    : "Fixtures recebidas, mas nenhum jogo foi convertido e não há base anterior.";
  await writeStatus();

  if (previousCount > 0) {
    console.warn(discovery.message);
    process.exit(0);
  }
  throw new Error(discovery.message);
}

discovery.updatedData = true;
discovery.message = `Atualizado com ${matches.length} jogos usando liga ${discovery.selected?.id || DEFAULT_LEAGUE}.`;
await writeStatus();

const data = {
  meta: {
    lastUpdated: new Date().toISOString(),
    source: "API-Football/API-SPORTS",
    timezone: "America/Sao_Paulo",
    apiFootballLeague: discovery.selected?.id || DEFAULT_LEAGUE,
    apiFootballLeagueName: discovery.selected?.name || "Configured league",
    apiFootballSeason: SEASON
  },
  matches,
  scorers,
  favorites: previous?.favorites || [
    { team: "Espanha", chance: 25 }, { team: "França", chance: 20 }, { team: "Argentina", chance: 18 },
    { team: "Brasil", chance: 17 }, { team: "Inglaterra", chance: 8 }, { team: "Portugal", chance: 5 }
  ],
  brazilPath: buildBrazilPath(matches),
  bracket: buildBracket(matches)
};

await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`Atualizado: ${matches.length} jogos, ${scorers.length} artilheiros.`);
