const params = new URLSearchParams(window.location.search);
const eventId = params.get("eventId");
const organizerContent = document.querySelector("#organizer-content");
const organizerDenied = document.querySelector("#organizer-denied");
const organizerName = document.querySelector("#organizer-name");
const organizerPhone = document.querySelector("#organizer-phone");
const organizerEventTitle = document.querySelector("#organizer-event-title");
const organizerEventCard = document.querySelector("#organizer-event-card");
const organizerRefreshButton = document.querySelector("#organizer-refresh-button");
const organizerLogoutButton = document.querySelector("#organizer-logout-button");
const proofModal = document.querySelector("#organizer-proof-modal");
const proofBody = document.querySelector("#organizer-proof-body");
const closeProofButton = document.querySelector("#organizer-close-proof");
const playerModal = document.querySelector("#organizer-player-modal");
const playerForm = document.querySelector("#organizer-player-form");
const playerMessage = document.querySelector("#organizer-player-message");
const closePlayerButton = document.querySelector("#organizer-close-player");
const cancelPlayerButton = document.querySelector("#organizer-cancel-player");
const eventModal = document.querySelector("#organizer-event-modal");
const eventForm = document.querySelector("#organizer-event-form");
const eventMessage = document.querySelector("#organizer-event-message");
const closeEventButton = document.querySelector("#organizer-close-event");
const cancelEventButton = document.querySelector("#organizer-cancel-event");
const addPlayerModal = document.querySelector("#organizer-add-player-modal");
const addPlayerForm = document.querySelector("#organizer-add-player-form");
const addPlayerMessage = document.querySelector("#organizer-add-player-message");
const closeAddPlayerButton = document.querySelector("#organizer-close-add-player");
const cancelAddPlayerButton = document.querySelector("#organizer-cancel-add-player");
const drawSizeModal = document.querySelector("#organizer-draw-size-modal");
const drawSizeValue = document.querySelector("#organizer-draw-size-value");
const drawSizeHint = document.querySelector("#organizer-draw-size-hint");
const closeDrawSizeButton = document.querySelector("#organizer-close-draw-size");
const cancelDrawSizeButton = document.querySelector("#organizer-cancel-draw-size");
const confirmDrawSizeButton = document.querySelector("#organizer-confirm-draw-size");
const decreaseDrawSizeButton = document.querySelector("#organizer-decrease-draw-size");
const increaseDrawSizeButton = document.querySelector("#organizer-increase-draw-size");

let panelEvent = null;
let panelPlayers = [];
let editingPlayerId = "";
let activeEventPriceField = "price";
let selectedTeamSize = 5;
let drawTriggerButton = null;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const positionsBySport = {
  futebol: ["Goleiro", "Zagueiro", "Lateral", "Meia", "Atacante", "Coringa"],
  volei: ["Levantador", "Ponteiro", "Oposto", "Central", "Libero"]
};
const positionCodes = {
  Goleiro: "GOL",
  Zagueiro: "ZAG",
  Lateral: "LAT",
  Meia: "MEI",
  Atacante: "ATA",
  Coringa: "COR",
  Levantador: "LEV",
  Ponteiro: "PON",
  Oposto: "OPO",
  Central: "CEN",
  Libero: "LIB"
};
const teamColorClasses = ["mint", "gold", "violet", "cyan", "lime", "amber"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0]?.[0] || ""}${parts.length > 1 ? parts.at(-1)?.[0] || "" : parts[0]?.[1] || ""}`.toUpperCase();
}

function playerLevel(player) {
  const level = Number(player?.level);
  return Number.isInteger(level) && level >= 1 && level <= 5 ? level : 3;
}

function moneyNumber(value) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function syncEventMoney(source = activeEventPriceField) {
  const capacity = Math.max(Number(eventForm.elements.capacity.value) || 1, 1);
  if (source === "total") {
    eventForm.elements.price.value = (moneyNumber(eventForm.elements.totalPrice.value) / capacity).toFixed(2);
    activeEventPriceField = "total";
    return;
  }
  eventForm.elements.totalPrice.value = (moneyNumber(eventForm.elements.price.value) * capacity).toFixed(2);
  activeEventPriceField = "price";
}

function renderStars(level) {
  const safeLevel = playerLevel({ level });
  return `<span class="star-display">${Array.from({ length: 5 }, (_, index) => `<span class="${index < safeLevel ? "filled" : ""}">★</span>`).join("")}</span>`;
}

function teamTotalLevel(team) {
  return team.reduce((sum, player) => sum + playerLevel(player), 0);
}

function teamAverageLevel(team) {
  return team.length ? teamTotalLevel(team) / team.length : 0;
}

function samePositionCount(team, player) {
  return team.filter((teamPlayer) => positionGroup(teamPlayer) === positionGroup(player)).length;
}

function shufflePlayers(players) {
  const shuffled = [...players];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function positionGroup(player) {
  const normalized = String(player?.position || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (normalized.includes("GOL")) return "GOL";
  if (normalized.includes("ZAG") || normalized.includes("DEF")) return "DEF";
  if (normalized.includes("LAT")) return "LAT";
  if (normalized.includes("VOL") || normalized.includes("MEI")) return "MEI";
  if (normalized.includes("ATA") || normalized.includes("PON") || normalized.includes("COR")) return "ATA";
  return "OUT";
}

function teamScore(team, player) {
  return teamTotalLevel(team) + samePositionCount(team, player) * 3 + team.length;
}

function equivalentTeamScore(team, player) {
  return {
    score: teamScore(team, player),
    total: teamTotalLevel(team),
    average: teamAverageLevel(team),
    samePosition: samePositionCount(team, player),
    size: team.length
  };
}

function compareTeamScore(a, b, player) {
  const scoreA = equivalentTeamScore(a, player);
  const scoreB = equivalentTeamScore(b, player);
  return scoreA.score - scoreB.score
    || scoreA.total - scoreB.total
    || scoreA.average - scoreB.average
    || scoreA.samePosition - scoreB.samePosition
    || scoreA.size - scoreB.size;
}

function drawTeams(players, teamSize) {
  const confirmedPlayers = players.filter((player) => player.status === "confirmado");
  if (confirmedPlayers.length <= teamSize) {
    return [[...confirmedPlayers].sort((a, b) => playerLevel(b) - playerLevel(a) || positionGroup(a).localeCompare(positionGroup(b)) || a.name.localeCompare(b.name))];
  }

  const teamCount = Math.ceil(confirmedPlayers.length / teamSize);
  const teams = Array.from({ length: teamCount }, () => []);
  const sortedPlayers = shufflePlayers(confirmedPlayers).sort((a, b) =>
    playerLevel(b) - playerLevel(a)
    || positionGroup(a).localeCompare(positionGroup(b))
    || a.name.localeCompare(b.name)
  );

  sortedPlayers.forEach((player) => {
    const rankedTeams = shufflePlayers(teams.filter((team) => team.length < teamSize)).sort((a, b) => compareTeamScore(a, b, player));
    rankedTeams[0].push(player);
  });

  return teams;
}

function confirmedPanelPlayers() {
  return panelPlayers.filter((player) => player.status === "confirmado");
}

function smartTeamSize() {
  const confirmedCount = confirmedPanelPlayers().length;
  const baseSize = panelEvent?.sport === "volei" ? 6 : 5;
  if (confirmedCount <= 1) return 1;
  if (confirmedCount <= baseSize * 2) return Math.max(1, Math.ceil(confirmedCount / 2));
  return baseSize;
}

function clampDrawSize(value) {
  const confirmedCount = confirmedPanelPlayers().length || 1;
  return Math.max(1, Math.min(Number(value) || 1, confirmedCount));
}

function updateDrawSizeView() {
  const confirmedCount = confirmedPanelPlayers().length;
  if (drawSizeValue) drawSizeValue.textContent = selectedTeamSize;
  if (drawSizeHint) {
    const teamCount = selectedTeamSize ? Math.ceil(confirmedCount / selectedTeamSize) : 0;
    drawSizeHint.textContent = `${confirmedCount} confirmados · sugestao inteligente: ${teamCount} ${teamCount === 1 ? "time" : "times"}`;
  }
}

function openDrawSizeModal(button) {
  const confirmedCount = confirmedPanelPlayers().length;
  if (!confirmedCount) {
    window.alert("Nenhum jogador confirmado para sortear.");
    return;
  }
  drawTriggerButton = button;
  selectedTeamSize = clampDrawSize(smartTeamSize());
  updateDrawSizeView();
  drawSizeModal.classList.remove("hidden");
}

function closeDrawSizeModal() {
  drawTriggerButton = null;
  drawSizeModal.classList.add("hidden");
}

function renderTeamList(teams) {
  return `
    <div class="team-rosters-grid extra-teams">
      ${teams.map((team, index) => `
        <div class="team-roster">
          <h4>Time ${index + 1}</h4>
          <ul>
            ${team.map((player) => `
              <li>
                <span class="mini-player-bubble">${escapeHtml(initials(player.name))}</span>
                <strong>${escapeHtml(player.name)}</strong>
                <em>${escapeHtml(positionCodes[player.position] || player.position)}</em>
                ${renderStars(playerLevel(player))}
              </li>
            `).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
  `;
}

const formationSlotsBySize = {
  1: [{ x: 10, y: 50, line: "def" }],
  2: [{ x: 10, y: 50, line: "def" }, { x: 44, y: 50, line: "att" }],
  3: [{ x: 10, y: 50, line: "def" }, { x: 30, y: 50, line: "mid" }, { x: 44, y: 50, line: "att" }],
  4: [{ x: 10, y: 50, line: "def" }, { x: 30, y: 32, line: "mid" }, { x: 30, y: 68, line: "mid" }, { x: 44, y: 50, line: "att" }],
  5: [{ x: 10, y: 50, line: "def" }, { x: 22, y: 30, line: "def" }, { x: 30, y: 50, line: "mid" }, { x: 44, y: 32, line: "att" }, { x: 44, y: 68, line: "att" }],
  6: [{ x: 10, y: 50, line: "def" }, { x: 22, y: 28, line: "def" }, { x: 22, y: 72, line: "def" }, { x: 34, y: 34, line: "mid" }, { x: 34, y: 66, line: "mid" }, { x: 44, y: 50, line: "att" }],
  7: [{ x: 10, y: 50, line: "def" }, { x: 22, y: 28, line: "def" }, { x: 22, y: 72, line: "def" }, { x: 34, y: 24, line: "mid" }, { x: 34, y: 50, line: "mid" }, { x: 34, y: 76, line: "mid" }, { x: 44, y: 50, line: "att" }],
  8: [{ x: 10, y: 50, line: "def" }, { x: 22, y: 24, line: "def" }, { x: 22, y: 50, line: "def" }, { x: 22, y: 76, line: "def" }, { x: 34, y: 34, line: "mid" }, { x: 34, y: 66, line: "mid" }, { x: 44, y: 36, line: "att" }, { x: 44, y: 64, line: "att" }],
  9: [{ x: 10, y: 50, line: "def" }, { x: 22, y: 24, line: "def" }, { x: 22, y: 50, line: "def" }, { x: 22, y: 76, line: "def" }, { x: 34, y: 24, line: "mid" }, { x: 34, y: 50, line: "mid" }, { x: 34, y: 76, line: "mid" }, { x: 44, y: 36, line: "att" }, { x: 44, y: 64, line: "att" }],
  10: [{ x: 10, y: 50, line: "def" }, { x: 22, y: 24, line: "def" }, { x: 22, y: 50, line: "def" }, { x: 22, y: 76, line: "def" }, { x: 34, y: 24, line: "mid" }, { x: 34, y: 50, line: "mid" }, { x: 34, y: 76, line: "mid" }, { x: 44, y: 24, line: "att" }, { x: 44, y: 50, line: "att" }, { x: 44, y: 76, line: "att" }]
};

function formationSlots(teamSize, side) {
  const size = Math.max(1, Math.min(Number(teamSize) || 1, 10));
  const base = formationSlotsBySize[size] || formationSlotsBySize[10];
  return base.map((slot) => ({ ...slot, x: side === "right" ? 100 - slot.x : slot.x }));
}

function tacticalRole(player) {
  const code = String(positionCodes[player?.position] || player?.position || "").toUpperCase();
  if (code.includes("GOL")) return "gol";
  if (code.includes("ZAG") || code.includes("DEF")) return "def";
  if (code.includes("LAT")) return "lat";
  if (code.includes("VOL")) return "vol";
  if (code.includes("MEI")) return "mei";
  if (code.includes("COR") || code.includes("PON") || code.includes("ATA")) return "att";
  return "mid";
}

function preferredLines(player) {
  const role = tacticalRole(player);
  if (role === "gol" || role === "def") return ["def", "mid", "att"];
  if (role === "lat" || role === "vol" || role === "mei") return ["mid", "def", "att"];
  if (role === "att") return ["att", "mid"];
  return ["mid", "def", "att"];
}

function rolePriority(player) {
  return { gol: 1, def: 2, lat: 3, vol: 4, mei: 5, att: 6, mid: 7 }[tacticalRole(player)] || 8;
}

function pickSlot(slots, used, player) {
  const lines = preferredLines(player);
  for (const line of lines) {
    const slot = slots.find((candidate, index) => !used.has(index) && candidate.line === line);
    if (slot) return slots.indexOf(slot);
  }
  return slots.findIndex((_, index) => !used.has(index));
}

function assignFormationSlots(players, side) {
  const slots = formationSlots(players.length, side);
  const used = new Set();
  return players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => rolePriority(a.player) - rolePriority(b.player) || a.index - b.index)
    .map(({ player }) => {
      const slotIndex = pickSlot(slots, used, player);
      used.add(slotIndex);
      return { player, slot: slots[slotIndex] || slots[slots.length - 1] };
    });
}
function teamPlayerNode(player, slot, colorClass) {
  if (!player) return "";
  const code = positionCodes[player.position] || player.position.slice(0, 3).toUpperCase();
  return `
    <span class="team-field-player team-${colorClass}" style="left:${slot.x}%; top:${slot.y}%;" data-player-name="${escapeHtml(player.name)}">
      <span class="team-dot">${escapeHtml(initials(player.name))}</span>
      <small>${escapeHtml(code)}</small>
      <span class="team-tooltip">${escapeHtml(player.name)}</span>
    </span>
  `;
}

function renderRoster(team, index) {
  const colorClass = teamColorClasses[index % teamColorClasses.length];
  return `
    <div class="team-roster team-${colorClass}">
      <h4>Time ${index + 1}</h4>
      <ul>
        ${team.map((player) => `
          <li>
            <span class="mini-player-bubble">${escapeHtml(initials(player.name))}</span>
            <strong>${escapeHtml(player.name)}</strong>
            <em>${escapeHtml(positionCodes[player.position] || player.position)}</em>
            ${renderStars(playerLevel(player))}
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function matchupPairs(teams) {
  const pairs = [];
  for (let index = 0; index < teams.length; index += 2) {
    pairs.push([index, index + 1].filter((teamIndex) => teams[teamIndex]));
  }
  return pairs;
}

function matchupLabel(pair) {
  if (pair.length === 1) return `Time ${pair[0] + 1}`;
  return `Time ${pair[0] + 1} x Time ${pair[1] + 1}`;
}

function matchupNotice(index, pair) {
  if (pair.length !== 1 || index === 0) return "";
  return `<span class="matchup-solo-notice">Vencedor do Confronto 1</span>`;
}

function renderMatchupControls(matchupId, pairs) {
  if (pairs.length <= 1) return "";
  return `
    <div class="matchup-controls" data-matchup-controls="${matchupId}">
      <button type="button" data-matchup-prev="${matchupId}" aria-label="Confronto anterior">‹</button>
      <div>
        <strong data-matchup-label="${matchupId}">${escapeHtml(matchupLabel(pairs[0]))}</strong>
        <span data-matchup-count="${matchupId}">Confronto 1 de ${pairs.length}</span>
      </div>
      <button type="button" data-matchup-next="${matchupId}" aria-label="Proximo confronto">›</button>
    </div>
  `;
}

function renderMatchupSlide(pair, pairIndex, matchupId, teams, isVolei) {
  const leftIndex = pair[0];
  const rightIndex = pair[1];
  const leftTeam = teams[leftIndex] || [];
  const rightTeam = rightIndex === undefined ? [] : teams[rightIndex] || [];
  return `
    <div class="matchup-slide ${pairIndex === 0 ? "active" : ""}" data-matchup-slide="${matchupId}" data-matchup-index="${pairIndex}" data-matchup-title="${escapeHtml(matchupLabel(pair))}">
      <div class="soccer-field-card ${isVolei ? "volei-field" : ""}">
        <div class="field-lines" aria-hidden="true"></div>
        ${assignFormationSlots(leftTeam, "left").map(({ player, slot }) => teamPlayerNode(player, slot, teamColorClasses[leftIndex % teamColorClasses.length])).join("")}
        ${assignFormationSlots(rightTeam, "right").map(({ player, slot }) => teamPlayerNode(player, slot, teamColorClasses[(rightIndex || 1) % teamColorClasses.length])).join("")}
        ${matchupNotice(pairIndex, pair)}
      </div>
      <div class="team-rosters-grid">
        ${pair.map((teamIndex) => renderRoster(teams[teamIndex], teamIndex)).join("")}
      </div>
    </div>
  `;
}

function renderDrawCard(teams) {
  const isVolei = panelEvent.sport === "volei";
  const pairs = matchupPairs(teams);
  const matchupId = `organizer-${panelEvent.id}`;
  return `
    <section class="drawn-teams-section">
      <div class="drawn-teams-head">
        <h3>Times Sorteados</h3>
        <span>${teams.length} ${teams.length === 1 ? "time" : "times"}</span>
      </div>
      ${renderMatchupControls(matchupId, pairs)}
      <div class="matchup-slider" data-matchup="${matchupId}">
        ${pairs.map((pair, index) => renderMatchupSlide(pair, index, matchupId, teams, isVolei)).join("")}
      </div>
    </section>
  `;
}

function setMatchupSlide(matchupId, nextIndex) {
  const slides = [...document.querySelectorAll(`[data-matchup-slide="${CSS.escape(matchupId)}"]`)];
  if (!slides.length) return;
  const total = slides.length;
  const activeIndex = ((nextIndex % total) + total) % total;
  slides.forEach((slide, index) => slide.classList.toggle("active", index === activeIndex));
  const activeSlide = slides[activeIndex];
  const label = document.querySelector(`[data-matchup-label="${CSS.escape(matchupId)}"]`);
  const count = document.querySelector(`[data-matchup-count="${CSS.escape(matchupId)}"]`);
  if (label) label.textContent = activeSlide.dataset.matchupTitle || "";
  if (count) count.textContent = `Confronto ${activeIndex + 1} de ${total}`;
}

document.addEventListener("click", (event) => {
  const next = event.target.closest("[data-matchup-next]");
  const prev = event.target.closest("[data-matchup-prev]");
  const matchupId = next?.dataset.matchupNext || prev?.dataset.matchupPrev;
  if (!matchupId) return;
  const active = document.querySelector(`[data-matchup-slide="${CSS.escape(matchupId)}"].active`);
  const currentIndex = Number(active?.dataset.matchupIndex || 0);
  setMatchupSlide(matchupId, currentIndex + (next ? 1 : -1));
});

function renderSlots(event) {
  const players = panelPlayers.filter((player) => player.status !== "excluido");
  const overflowCount = Math.max(players.length - Number(event.capacity), 0);
  const slots = Array.from({ length: event.capacity }, (_, index) => {
    if (overflowCount > 0 && index === event.capacity - 1) return `<span class="player-bubble overflow">+${overflowCount}</span>`;
    const player = players[index];
    if (!player) return `<span class="player-bubble empty"></span>`;
    const code = positionCodes[player.position] || player.position.slice(0, 3).toUpperCase();
    return `<span class="player-bubble ${player.status}" title="${escapeHtml(player.name)}">${escapeHtml(initials(player.name))}<small>${escapeHtml(code)}</small></span>`;
  });
  return `<div class="slots-grid admin-slots">${slots.join("")}</div>`;
}

function proofCell(player) {
  if (!player.proofName) return `<span class="muted">Nao enviado</span>`;
  return `
    <span class="proof-sent-label">Enviado</span>
    <button class="proof-icon-button" type="button" data-proof-id="${player.id}" aria-label="Abrir comprovante">
      <span class="expand-icon" aria-hidden="true"></span>
    </button>
  `;
}

function statusText(player) {
  return player.status === "confirmado" ? "Confirmado" : "Pendente";
}

function row(player) {
  const statusClass = player.status === "confirmado" ? "confirmado" : "pendente";
  return `
    <tr>
      <td><strong>${escapeHtml(player.name)}</strong><div class="muted">${escapeHtml(player.phone)}</div>${renderStars(playerLevel(player))}</td>
      <td>${escapeHtml(player.position)}</td>
      <td><span class="status ${statusClass}">${statusText(player)}</span></td>
      <td>${proofCell(player)}</td>
      <td>
        <div class="actions">
          <button class="secondary-button" type="button" data-action="confirm" data-id="${player.id}">Confirmar</button>
          <button class="secondary-button" type="button" data-action="edit" data-id="${player.id}">Editar</button>
          <button class="danger-button" type="button" data-action="delete" data-id="${player.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `;
}

function renderPanel() {
  const confirmed = panelPlayers.filter((player) => player.status === "confirmado").length;
  organizerEventCard.innerHTML = `
    <div class="event-card-head">
      <div>
        <h3>${escapeHtml(panelEvent.title)}</h3>
        <span class="pill gold">${panelEvent.sport === "volei" ? "VOLEI" : "FUTEBOL"}</span>
      </div>
      <div class="event-actions">
        <button class="icon-link-button draw-action" type="button" data-event-action="draw-teams">Sortear Times</button>
        <button class="icon-link-button" type="button" data-event-action="add-player">+ Jogador</button>
        <button class="icon-link-button" type="button" data-event-action="edit-event">Editar Racha</button>
        <button class="icon-link-button danger-outline" type="button" data-event-action="delete-event">Excluir</button>
        <a class="icon-link-button" href="/racha.html?eventId=${encodeURIComponent(panelEvent.id)}" target="_blank" rel="noreferrer">Ver Link</a>
      </div>
    </div>
    <div class="admin-metrics-row">
      <span class="admin-metric cyan"><small>Confirmados / Inscricoes feitas</small><strong>${confirmed}/${panelPlayers.length}</strong></span>
      <span class="admin-metric gold"><small>Custo total do racha</small><strong>${money.format(Number(panelEvent.price || 0) * Number(panelEvent.capacity || 0))}</strong></span>
      <span class="admin-metric green"><small>Custo por pessoa</small><strong>${money.format(panelEvent.price || 0)}</strong></span>
    </div>
    ${renderSlots(panelEvent)}
    <table class="player-table">
      <thead>
        <tr><th>Jogador</th><th>Posicao</th><th>Status pagamento</th><th>Comprovante</th><th>Acoes</th></tr>
      </thead>
      <tbody>${panelPlayers.length ? panelPlayers.map(row).join("") : `<tr><td colspan="5" class="muted">Nenhum jogador inscrito ainda.</td></tr>`}</tbody>
    </table>
  `;
}

async function loadPanel() {
  const response = await fetch(`/api/organizer/me?eventId=${encodeURIComponent(eventId || "")}`);
  const data = await response.json();
  if (!response.ok) {
    organizerDenied.classList.remove("hidden");
    organizerContent.classList.add("hidden");
    return;
  }

  panelEvent = data.event;
  panelPlayers = data.event.players || [];
  organizerName.textContent = data.organizer.name;
  organizerPhone.textContent = data.organizer.phone;
  organizerEventTitle.textContent = data.event.title;
  organizerDenied.classList.add("hidden");
  organizerContent.classList.remove("hidden");
  renderPanel();
}

function findPlayer(id) {
  return panelPlayers.find((player) => player.id === id);
}

function openProof(player) {
  if (!player?.proofName) return;
  proofBody.innerHTML = `
    <p class="muted">${escapeHtml(player.name)} - ${escapeHtml(player.proofName)}</p>
    ${player.proofData.startsWith("data:image/") ? `<img src="${player.proofData}" alt="Comprovante">` : `<a class="proof-link proof-file-link" href="${player.proofData}" target="_blank" rel="noreferrer">Abrir arquivo enviado</a>`}
  `;
  proofModal.classList.remove("hidden");
}

function closePlayer() {
  editingPlayerId = "";
  playerForm.reset();
  playerMessage.textContent = "";
  playerModal.classList.add("hidden");
}

function closeEvent() {
  eventForm.reset();
  eventMessage.textContent = "";
  eventModal.classList.add("hidden");
}

function closeAddPlayer() {
  addPlayerForm.reset();
  addPlayerMessage.textContent = "";
  addPlayerModal.classList.add("hidden");
}

function openAddPlayer() {
  addPlayerForm.elements.position.innerHTML = (positionsBySport[panelEvent.sport] || [])
    .map((position) => `<option value="${escapeHtml(position)}">${escapeHtml(position)}</option>`)
    .join("");
  addPlayerForm.elements.level.value = "3";
  addPlayerMessage.textContent = "";
  addPlayerModal.classList.remove("hidden");
}

function openEvent() {
  eventForm.elements.title.value = panelEvent.title || "";
  eventForm.elements.date.value = panelEvent.date || "";
  eventForm.elements.time.value = panelEvent.time || "";
  eventForm.elements.capacity.value = panelEvent.capacity || 1;
  eventForm.elements.location.value = panelEvent.location || "";
  eventForm.elements.price.value = panelEvent.price || 0;
  eventForm.elements.totalPrice.value = (Number(panelEvent.price || 0) * Number(panelEvent.capacity || 1)).toFixed(2);
  eventForm.elements.pixKey.value = panelEvent.pixKey || "";
  eventForm.elements.notes.value = panelEvent.notes || "";
  eventModal.classList.remove("hidden");
}

function openPlayer(player) {
  editingPlayerId = player.id;
  playerForm.elements.name.value = player.name || "";
  playerForm.elements.phone.value = player.phone || "";
  playerForm.elements.position.innerHTML = (positionsBySport[panelEvent.sport] || []).map((position) => `<option value="${escapeHtml(position)}" ${position === player.position ? "selected" : ""}>${escapeHtml(position)}</option>`).join("");
  playerForm.elements.level.value = playerLevel(player);
  playerForm.elements.confirmed.checked = player.status === "confirmado";
  playerModal.classList.remove("hidden");
}

organizerEventCard.addEventListener("click", async (event) => {
  const eventAction = event.target.closest("[data-event-action]");
  if (eventAction?.dataset.eventAction === "edit-event") {
    openEvent();
    return;
  }

  if (eventAction?.dataset.eventAction === "add-player") {
    openAddPlayer();
    return;
  }

  if (eventAction?.dataset.eventAction === "draw-teams") {
    openDrawSizeModal(eventAction);
    return;
  }

  if (eventAction?.dataset.eventAction === "delete-event") {
    if (!window.confirm("Excluir este racha tambem remove as inscricoes ligadas a ele. Deseja continuar?")) return;
    const response = await fetch(`/api/organizer/events/${encodeURIComponent(panelEvent.id)}`, { method: "DELETE" });
    if (response.ok) window.location.href = "/";
    return;
  }

  const proofButton = event.target.closest("[data-proof-id]");
  if (proofButton) {
    openProof(findPlayer(proofButton.dataset.proofId));
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const player = findPlayer(button.dataset.id);
  if (!player) return;

  if (button.dataset.action === "edit") {
    openPlayer(player);
    return;
  }

  if (button.dataset.action === "delete") {
    await fetch(`/api/organizer/players/${encodeURIComponent(player.id)}`, { method: "DELETE" });
    await loadPanel();
    return;
  }

  if (button.dataset.action === "confirm") {
    await fetch(`/api/organizer/players/${encodeURIComponent(player.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true })
    });
    await loadPanel();
  }
});

addPlayerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  addPlayerMessage.textContent = "Adicionando...";
  const formData = new FormData(addPlayerForm);
  const payload = Object.fromEntries(formData.entries());
  payload.eventId = panelEvent.id;
  payload.confirmed = formData.has("confirmed");
  const response = await fetch("/api/organizer/players", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    addPlayerMessage.textContent = data.error || "Nao foi possivel adicionar.";
    return;
  }
  closeAddPlayer();
  await loadPanel();
});

async function sortAndSaveTeams(button, teamSize) {
  const confirmedPlayers = panelPlayers.filter((player) => player.status === "confirmado");
  if (!confirmedPlayers.length) {
    window.alert("Nenhum jogador confirmado para sortear.");
    return false;
  }
  const previousLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Sorteando...";
  }
  const teams = drawTeams(confirmedPlayers, teamSize);
  const storedTeams = teams.map((team, index) => ({
    name: `Time ${index + 1}`,
    players: team.map((player) => player.id)
  }));
  const response = await fetch(`/api/organizer/events/${encodeURIComponent(panelEvent.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...panelEvent,
      teams: storedTeams
    })
  });
  const data = await response.json();
  if (!response.ok) {
    window.alert(data.error || "Nao foi possivel salvar o sorteio.");
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
    return false;
  }
  await loadPanel();
  return true;
}

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  eventMessage.textContent = "Salvando...";
  const formData = new FormData(eventForm);
  const payload = Object.fromEntries(formData.entries());
  delete payload.totalPrice;
  payload.sport = panelEvent.sport;
  payload.organizerName = organizerName.textContent;
  payload.organizerPhone = organizerPhone.textContent;
  payload.requireProof = Boolean(panelEvent.requireProof);
  const response = await fetch(`/api/organizer/events/${encodeURIComponent(panelEvent.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    eventMessage.textContent = data.error || "Nao foi possivel salvar.";
    return;
  }
  closeEvent();
  await loadPanel();
});

playerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  playerMessage.textContent = "Salvando...";
  const formData = new FormData(playerForm);
  const payload = Object.fromEntries(formData.entries());
  payload.confirmed = formData.has("confirmed");
  const response = await fetch(`/api/organizer/players/${encodeURIComponent(editingPlayerId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    playerMessage.textContent = data.error || "Nao foi possivel salvar.";
    return;
  }
  closePlayer();
  await loadPanel();
});

organizerRefreshButton.addEventListener("click", loadPanel);
closeProofButton.addEventListener("click", () => proofModal.classList.add("hidden"));
proofModal.addEventListener("click", (event) => {
  if (event.target === proofModal) proofModal.classList.add("hidden");
});
closePlayerButton.addEventListener("click", closePlayer);
cancelPlayerButton.addEventListener("click", closePlayer);
closeEventButton.addEventListener("click", closeEvent);
cancelEventButton.addEventListener("click", closeEvent);
closeAddPlayerButton.addEventListener("click", closeAddPlayer);
cancelAddPlayerButton.addEventListener("click", closeAddPlayer);
closeDrawSizeButton.addEventListener("click", closeDrawSizeModal);
cancelDrawSizeButton.addEventListener("click", closeDrawSizeModal);
decreaseDrawSizeButton.addEventListener("click", () => {
  selectedTeamSize = clampDrawSize(selectedTeamSize - 1);
  updateDrawSizeView();
});
increaseDrawSizeButton.addEventListener("click", () => {
  selectedTeamSize = clampDrawSize(selectedTeamSize + 1);
  updateDrawSizeView();
});
drawSizeModal.addEventListener("click", (event) => {
  if (event.target === drawSizeModal) closeDrawSizeModal();
});
confirmDrawSizeButton.addEventListener("click", async () => {
  const sorted = await sortAndSaveTeams(drawTriggerButton, selectedTeamSize);
  if (sorted) closeDrawSizeModal();
});
eventForm.elements.price.addEventListener("input", () => syncEventMoney("price"));
eventForm.elements.totalPrice.addEventListener("input", () => syncEventMoney("total"));
eventForm.elements.capacity.addEventListener("input", () => syncEventMoney(activeEventPriceField));
playerModal.addEventListener("click", (event) => {
  if (event.target === playerModal) closePlayer();
});
eventModal.addEventListener("click", (event) => {
  if (event.target === eventModal) closeEvent();
});
addPlayerModal.addEventListener("click", (event) => {
  if (event.target === addPlayerModal) closeAddPlayer();
});
organizerLogoutButton.addEventListener("click", async () => {
  await fetch("/api/organizer/logout", { method: "POST" });
  window.location.href = "/";
});

loadPanel();
