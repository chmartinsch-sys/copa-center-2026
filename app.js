const TZ = "America/Sao_Paulo";
let DATA = null;
let filter = "proximos";
let query = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const norm = (value) => (value || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const esc = (value) => (value ?? "").toString().replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
const isBrazil = (match) => norm(match.home) === "brasil" || norm(match.away) === "brasil";
const dt = (match) => new Date(match.utcDate || match.date);
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateKey = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const fmtDate = (date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" }).format(date).replace(".", "");
const fmtTime = (date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(date);
const finished = (match) => ["FT", "AET", "PEN", "CANC", "ABD"].includes(match.statusShort) || match.status === "finished";
const live = (match) => ["1H", "HT", "2H", "ET", "P", "BT", "LIVE"].includes(match.statusShort) || match.status === "live";
const upcoming = (match) => !finished(match) && !live(match);
const stageLabel = (stage) => ({ grupos: "Fase de grupos", round32: "16 avos", oitavas: "Oitavas", quartas: "Quartas", semifinal: "Semifinal", terceiro: "3º lugar", final: "Final" }[stage] || stage || "Jogo");
const statusLabel = (match) => live(match) ? "Ao vivo" : finished(match) ? "Encerrado" : dateKey(dt(match)) === todayKey() ? "Hoje" : "Agendado";

function goalItems(match) {
  const raw = Array.isArray(match.goals) ? match.goals : Array.isArray(match.goalScorers) ? match.goalScorers : Array.isArray(match.scoringEvents) ? match.scoringEvents : [];
  return raw.map((goal) => typeof goal === "string" ? { text: goal } : goal).filter(Boolean);
}

function goalText(goal) {
  if (goal.text) return esc(goal.text);
  const name = goal.player || goal.name || goal.scorer || goal.author || "Gol";
  const minute = goal.minute || goal.time || goal.elapsed || "";
  const detail = goal.detail || goal.type || "";
  const flags = [];
  if (minute) flags.push(`${minute}'`);
  if (goal.penalty || norm(detail).includes("pen")) flags.push("pên.");
  else if (goal.ownGoal || norm(detail).includes("contra")) flags.push("contra");
  return `${esc(name)}${flags.length ? ` (${esc(flags.join(", "))})` : ""}`;
}

function goalsHtml(match) {
  const goals = goalItems(match);
  if (!goals.length) return "";
  const byTeam = (team) => goals.filter((goal) => norm(goal.team || goal.selection || goal.country) === norm(team)).map(goalText);
  const home = byTeam(match.home);
  const away = byTeam(match.away);
  const lines = [];
  if (home.length) lines.push(`<div class="goal-line"><strong>${esc(match.home)}:</strong> ${home.join(", ")}</div>`);
  if (away.length) lines.push(`<div class="goal-line"><strong>${esc(match.away)}:</strong> ${away.join(", ")}</div>`);
  if (!lines.length) lines.push(`<div class="goal-line">${goals.map(goalText).join(", ")}</div>`);
  return `<div class="goal-summary"><span>Gols</span>${lines.join("")}</div>`;
}

function scoreHtml(match) {
  if (!finished(match) && !live(match)) return "";
  const penalties = match.penaltyHomeScore != null && match.penaltyAwayScore != null
    ? `<span class="penalties">pên. ${match.penaltyHomeScore}–${match.penaltyAwayScore}</span>`
    : "";
  return `<div class="scoreline"><strong>${match.homeScore ?? ""} × ${match.awayScore ?? ""}</strong>${penalties}</div>`;
}

function matchCard(match) {
  const date = dt(match);
  const classes = ["match-card", isBrazil(match) ? "brazil" : "", finished(match) ? "finished" : "", live(match) ? "live-match" : ""].filter(Boolean).join(" ");
  const tags = [];
  if (finished(match)) tags.push(`<span class="tag official">Resultado oficial</span>`);
  if (match.projection && !finished(match)) tags.push(`<span class="tag projection">${esc(match.projection)}</span>`);
  if (match.favorite && !finished(match)) tags.push(`<span class="tag">Favorito: ${esc(match.favorite)}</span>`);
  return `<article class="${classes}">
    <div class="match-top">
      <div class="match-date">${fmtDate(date)} · ${fmtTime(date)} · Brasília</div>
      <div class="status ${live(match) ? "live" : finished(match) ? "done" : ""}">${statusLabel(match)}</div>
    </div>
    <div class="match-teams">
      <div class="team"><span>${esc(match.home)}</span></div>
      ${scoreHtml(match)}
      <div class="team away"><span>${esc(match.away)}</span></div>
    </div>
    ${goalsHtml(match)}
    <div class="stage">${stageLabel(match.stage)}${match.venue ? ` · ${esc(match.venue)}` : ""}</div>
    ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
  </article>`;
}

function filteredMatches() {
  let list = [...(DATA.matches || [])].sort((a, b) => dt(a) - dt(b));
  if (query) {
    const normalizedQuery = norm(query);
    list = list.filter((match) => norm(`${match.home} ${match.away}`).includes(normalizedQuery));
  }
  if (filter === "hoje") list = list.filter((match) => dateKey(dt(match)) === todayKey());
  else if (filter === "proximos") list = list.filter(upcoming).slice(0, 12);
  else if (filter === "resultados") list = list.filter(finished).reverse().slice(0, 16);
  else if (filter === "brasil") list = list.filter(isBrazil);
  return list;
}

function renderMatches() {
  const list = filteredMatches();
  $("#matchesList").innerHTML = list.length ? list.map(matchCard).join("") : `<div class="empty">Nenhum jogo encontrado neste filtro.</div>`;
  $$(".filter-chip").forEach((button) => button.classList.toggle("active", button.dataset.filter === filter));
}

function renderSummary() {
  const matches = [...(DATA.matches || [])].sort((a, b) => dt(a) - dt(b));
  const liveNow = matches.filter(live);
  const next = matches.find(upcoming);
  const last = [...matches].filter(finished).sort((a, b) => dt(b) - dt(a))[0];
  const topGoals = Math.max(0, ...(DATA.scorers || []).map((item) => Number(item.goals) || 0));
  const leaders = (DATA.scorers || []).filter((item) => Number(item.goals) === topGoals);
  const champion = (DATA.bracket || []).find((group) => norm(group.phase).includes("podio"))?.items?.find((item) => norm(item.match) === "campea")?.status;
  const cards = [
    liveNow.length ? ["Agora", `${liveNow.length} jogo(s) ao vivo`, "Placar informado na última atualização."] : next ? ["Próximo jogo", `${next.home} × ${next.away}`, `${fmtDate(dt(next))} · ${fmtTime(dt(next))}`] : champion ? ["Campeã mundial", champion, "Copa do Mundo 2026 encerrada."] : ["Agenda", "Sem jogos futuros", "Torneio encerrado."],
    last ? ["Último resultado", `${last.home} ${last.homeScore} × ${last.awayScore} ${last.away}`, stageLabel(last.stage)] : ["Resultados", "Ainda não disponíveis", ""],
    leaders.length ? [leaders.length > 1 ? "Líderes da artilharia" : "Artilheiro", leaders.map((item) => item.name).join(" · "), `${topGoals} gol${topGoals === 1 ? "" : "s"}`] : ["Artilharia", "Aguardando dados", ""],
    ["Atualização", "Manual e validada", "Resultados finais confirmados."]
  ];
  $("#quickSummary").innerHTML = cards.map((card) => `<div class="summary-card"><span>${esc(card[0])}</span><strong>${esc(card[1])}</strong><span>${esc(card[2])}</span></div>`).join("");
}

function renderBrazil() {
  const matches = (DATA.matches || []).filter(isBrazil).sort((a, b) => dt(a) - dt(b));
  const next = matches.find(upcoming);
  const last = [...matches].filter(finished).sort((a, b) => dt(b) - dt(a))[0];
  const path = (DATA.brazilPath || []).map((item) => `<div class="bracket-line"><span>${esc(item.phase)}</span><strong>${esc(item.value)}</strong></div>`).join("");
  $("#brazilPanel").innerHTML = `
    <div class="info-card"><span>Situação</span><strong>${next ? "Em disputa" : "Campanha encerrada"}</strong><span>${next ? `${fmtDate(dt(next))} · ${fmtTime(dt(next))}` : "Veja o último resultado e o caminho na competição."}</span></div>
    <div class="info-card"><span>Último jogo</span><strong>${last ? `${esc(last.home)} ${last.homeScore} × ${last.awayScore} ${esc(last.away)}` : "Sem resultado"}</strong><span>${last ? stageLabel(last.stage) : ""}</span></div>
    <div class="info-card path-card"><span>Resumo da campanha</span>${path || "<strong>Aguardando atualização.</strong>"}</div>`;
}

function renderBracket() {
  const groups = DATA.bracket || [];
  $("#bracketPanel").innerHTML = groups.length ? groups.map((group) => `<div class="bracket-row"><h3>${esc(group.phase)}</h3>${group.items.map((item) => `<div class="bracket-line"><span>${esc(item.match)}</span><strong>${esc(item.status || item.pick || "A definir")}</strong></div>`).join("")}</div>`).join("") : `<div class="empty">Chaveamento ainda não disponível.</div>`;
}

function renderScorers() {
  const scorers = [...(DATA.scorers || [])].sort((a, b) => Number(b.goals) - Number(a.goals) || a.name.localeCompare(b.name, "pt-BR"));
  let previousGoals = null;
  let currentRank = 0;
  const rows = scorers.map((scorer, index) => {
    const goals = Number(scorer.goals) || 0;
    if (goals !== previousGoals) currentRank = index + 1;
    previousGoals = goals;
    return `<div class="scorer-row"><div class="rank">${currentRank}º</div><div class="scorer-name"><strong>${esc(scorer.name)}</strong><div class="muted">${esc(scorer.team)}</div></div><div class="goals"><strong>${goals}</strong><span>gol${goals === 1 ? "" : "s"}</span></div></div>`;
  }).join("");
  $("#scorersPanel").innerHTML = rows || `<div class="empty">Artilharia ainda não disponível.</div>`;
}

function renderStatus() {
  const updated = DATA.meta?.lastUpdated ? new Date(DATA.meta.lastUpdated) : null;
  $("#updatePill").textContent = updated ? `Atualizado ${fmtDate(updated)} · ${fmtTime(updated)}` : "Dados carregados";
  $("#dataStatus").innerHTML = `<strong>Atualização manual.</strong> ${updated ? `Dados revisados em ${fmtDate(updated)}, às ${fmtTime(updated)}.` : "Data da revisão não informada."}<br>Resultados, autores dos gols, artilharia e chaveamento são publicados somente após validação.`;
}

function renderAll() {
  renderSummary();
  renderMatches();
  renderBracket();
  renderScorers();
  renderBrazil();
  renderStatus();
}

function applyDataUpdate(base, update) {
  if (!update) return base;
  const matchesById = new Map((base.matches || []).map((match) => [String(match.id), match]));
  for (const match of update.matches || []) {
    const id = String(match.id);
    matchesById.set(id, { ...(matchesById.get(id) || {}), ...match });
  }
  return {
    ...base,
    ...update,
    meta: { ...(base.meta || {}), ...(update.meta || {}) },
    matches: [...matchesById.values()].sort((a, b) => dt(a) - dt(b)),
    scorers: update.scorers || base.scorers || [],
    favorites: update.favorites ?? base.favorites ?? [],
    brazilPath: update.brazilPath || base.brazilPath || [],
    bracket: update.bracket || base.bracket || []
  };
}

async function load() {
  try {
    const version = Date.now();
    const [baseResponse, updateResponse] = await Promise.all([
      fetch(`data/copa2026.json?v=${version}`, { cache: "no-store" }),
      fetch(`data/final-update.json?v=${version}`, { cache: "no-store" }).catch(() => null)
    ]);
    if (!baseResponse.ok) throw new Error("Falha ao carregar dados");
    const baseData = await baseResponse.json();
    const updateData = updateResponse?.ok ? await updateResponse.json() : null;
    DATA = applyDataUpdate(baseData, updateData);
    renderAll();
  } catch (error) {
    $("#quickSummary").innerHTML = `<div class="empty">Não foi possível carregar os dados.</div>`;
    $("#dataStatus").textContent = "Erro ao carregar os dados da Copa.";
  }
}

$$(".filter-chip").forEach((button) => button.addEventListener("click", () => {
  filter = button.dataset.filter;
  renderMatches();
}));
$("#teamSearch").addEventListener("input", (event) => {
  query = event.target.value;
  renderMatches();
});
$("#refreshBtn").addEventListener("click", load);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}

load();
