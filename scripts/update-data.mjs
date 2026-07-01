import { writeFile } from "node:fs/promises";

const KEY = process.env.API_FOOTBALL_KEY;
const LEAGUE = process.env.API_FOOTBALL_LEAGUE || "1";
const SEASON = process.env.API_FOOTBALL_SEASON || "2026";
const BASE = "https://v3.football.api-sports.io";

if (!KEY) throw new Error("API_FOOTBALL_KEY não configurada nos GitHub Secrets.");

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) console.warn("API warnings/errors:", json.errors);
  return json.response || [];
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

const fixtures = await api(`/fixtures?league=${LEAGUE}&season=${SEASON}`);
let scorers = [];
try {
  const top = await api(`/players/topscorers?league=${LEAGUE}&season=${SEASON}`);
  scorers = top.slice(0, 10).map(x => ({
    name: x.player?.name || "Jogador",
    team: teamName(x.statistics?.[0]?.team?.name),
    goals: x.statistics?.[0]?.goals?.total || 0
  }));
} catch (error) {
  console.warn("Top scorers indisponível:", error.message);
}

const matches = fixtures.map(fixtureToMatch).filter(m => m.utcDate).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
const data = {
  meta: { lastUpdated: new Date().toISOString(), source: "API-Football/API-SPORTS", timezone: "America/Sao_Paulo" },
  matches,
  scorers,
  favorites: [
    { team: "Espanha", chance: 25 }, { team: "França", chance: 20 }, { team: "Argentina", chance: 18 },
    { team: "Brasil", chance: 17 }, { team: "Inglaterra", chance: 8 }, { team: "Portugal", chance: 5 }
  ],
  brazilPath: buildBrazilPath(matches),
  bracket: buildBracket(matches)
};

await writeFile("data/copa2026.json", JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`Atualizado: ${matches.length} jogos, ${scorers.length} artilheiros.`);
