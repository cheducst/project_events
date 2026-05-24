const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const adminContent = document.querySelector("#admin-content");
const eventCreate = document.querySelector("#event-create");
const adminEvents = document.querySelector("#admin-events");
const refreshButton = document.querySelector("#refresh-button");
const eventForm = document.querySelector("#event-form");
const eventMessage = document.querySelector("#event-message");
const openCreateButton = document.querySelector("#open-create-button");
const closeCreateButton = document.querySelector("#close-create-button");
const proofModal = document.querySelector("#proof-modal");
const proofModalBody = document.querySelector("#proof-modal-body");
const closeProofButton = document.querySelector("#close-proof-button");
const adminOrganizerName = document.querySelector("#admin-organizer-name");
const adminOrganizerPhone = document.querySelector("#admin-organizer-phone");
const adminOrganizerEvents = document.querySelector("#admin-organizer-events");
const playerEditModal = document.querySelector("#player-edit-modal");
const playerEditForm = document.querySelector("#player-edit-form");
const playerEditMessage = document.querySelector("#player-edit-message");
const closePlayerEditButton = document.querySelector("#close-player-edit-button");
const cancelPlayerEditButton = document.querySelector("#cancel-player-edit-button");
const playerAddModal = document.querySelector("#player-add-modal");
const playerAddForm = document.querySelector("#player-add-form");
const playerAddMessage = document.querySelector("#player-add-message");
const closePlayerAddButton = document.querySelector("#close-player-add-button");
const cancelPlayerAddButton = document.querySelector("#cancel-player-add-button");
const drawSizeModal = document.querySelector("#draw-size-modal");
const drawSizeValue = document.querySelector("#draw-size-value");
const drawSizeHint = document.querySelector("#draw-size-hint");
const closeDrawSizeButton = document.querySelector("#close-draw-size-button");
const cancelDrawSizeButton = document.querySelector("#cancel-draw-size-button");
const confirmDrawSizeButton = document.querySelector("#confirm-draw-size-button");
const decreaseDrawSizeButton = document.querySelector("#decrease-draw-size-button");
const increaseDrawSizeButton = document.querySelector("#increase-draw-size-button");

const moneyAdmin = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

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

const positionsBySport = {
  futebol: ["Goleiro", "Zagueiro", "Lateral", "Meia", "Atacante", "Coringa"],
  volei: ["Levantador", "Ponteiro", "Oposto", "Central", "Libero"]
};

let adminPassword = localStorage.getItem("rachaAdminPassword") || "";
let adminEventsData = [];
let editingPlayerId = "";
let addingPlayerEventId = "";
let drawingEventId = "";
let drawingTriggerButton = null;
let selectedTeamSize = 5;
let activeAdminPriceField = "price";

function headers() {
  return {
    "Content-Type": "application/json",
    "x-admin-password": adminPassword
  };
}

function moneyNumber(value) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function syncEventFormMoney(source = activeAdminPriceField) {
  if (!eventForm?.elements.totalPrice) return;
  const capacity = Math.max(Number(eventForm.elements.capacity.value) || 1, 1);
  if (source === "total") {
    eventForm.elements.price.value = (moneyNumber(eventForm.elements.totalPrice.value) / capacity).toFixed(2);
    activeAdminPriceField = "total";
    return;
  }
  eventForm.elements.totalPrice.value = (moneyNumber(eventForm.elements.price.value) * capacity).toFixed(2);
  activeAdminPriceField = "price";
}

function statusText(status) {
  return {
    aguardando_pagamento: "Pendente",
    pendente: "Pendente",
    confirmado: "Confirmado",
    excluido: "Excluido"
  }[status] || status;
}

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
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] || "";
  return `${first}${last}`.toUpperCase();
}

function playerLevel(player) {
  const level = Number(player?.level);
  return Number.isInteger(level) && level >= 1 && level <= 5 ? level : 3;
}

function renderStars(level) {
  const safeLevel = Math.max(1, Math.min(Number(level) || 3, 5));
  return `
    <span class="star-display" aria-label="Nivel ${safeLevel} de 5">
      ${Array.from({ length: 5 }, (_, index) => `<span class="${index < safeLevel ? "filled" : ""}">★</span>`).join("")}
    </span>
  `;
}

function renderSlots(event) {
  const players = event.players.filter((player) => player.status !== "excluido");
  const overflowCount = Math.max(players.length - Number(event.capacity), 0);
  const slots = Array.from({ length: event.capacity }, (_, index) => {
    if (overflowCount > 0 && index === event.capacity - 1) {
      return `<span class="player-bubble overflow" aria-label="${overflowCount} inscricoes excedentes">+${overflowCount}</span>`;
    }

    const player = players[index];
    if (!player) return `<span class="player-bubble empty" aria-label="Vaga aberta"></span>`;
    const code = positionCodes[player.position] || player.position.slice(0, 3).toUpperCase();
    const state = player.status;
    return `
      <span class="player-bubble ${state}" title="${escapeHtml(player.name)} - ${escapeHtml(player.position)}">
        ${escapeHtml(initials(player.name))}
        <small>${escapeHtml(code)}</small>
      </span>
    `;
  });
  return `<div class="slots-grid admin-slots">${slots.join("")}</div>`;
}

function eventShareLink(eventId) {
  return new URL(`/racha.html?eventId=${encodeURIComponent(eventId)}`, window.location.origin).href;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Fallback for browsers that block clipboard access outside secure user gestures.
    }
  }

  const input = document.createElement("input");
  input.value = text;
  input.setAttribute("readonly", "");
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function proofCell(player) {
  if (!player.proofName) return `<span class="muted">Nao enviado</span>`;
  return `
    <span class="proof-sent-label">Enviado</span>
    <button class="proof-icon-button" type="button" data-proof-id="${player.id}" aria-label="Abrir comprovante de ${escapeHtml(player.name)}">
      <span class="expand-icon" aria-hidden="true"></span>
    </button>
  `;
}

function paymentStatusText(player) {
  return player.status === "confirmado" ? "Confirmado" : "Pendente";
}

function updateOrganizerCard(events) {
  const eventWithOrganizer = events.find((event) => event.organizerName || event.organizerPhone) || {};
  adminOrganizerName.textContent = eventWithOrganizer.organizerName || "Administrador do racha";
  adminOrganizerPhone.textContent = eventWithOrganizer.organizerPhone || "Telefone nao informado";
  adminOrganizerEvents.textContent = `${events.length} ${events.length === 1 ? "racha criado" : "rachas criados"}`;
}

function findEvent(eventId) {
  return adminEventsData.find((eventCard) => eventCard.id === eventId);
}

function positionOptions(sport, selected = "") {
  return (positionsBySport[sport] || [])
    .map((position) => `<option value="${escapeHtml(position)}" ${position === selected ? "selected" : ""}>${escapeHtml(position)}</option>`)
    .join("");
}

function totalCost(event) {
  return Number(event.price || 0) * Number(event.capacity || 0);
}

function adminMetric(label, value, tone = "") {
  return `
    <span class="admin-metric ${tone}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;
}

const teamColorClasses = ["mint", "gold", "violet", "cyan", "lime", "amber"];

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

function renderTeamList(team, playersById, index) {
  const players = team.players.map((id) => playersById.get(id)).filter(Boolean);
  const colorClass = teamColorClasses[index % teamColorClasses.length];
  return `
    <div class="team-roster team-${colorClass}">
      <h4>${escapeHtml(team.name || `Time ${index + 1}`)}</h4>
      ${players.length ? `
        <ul>
          ${players.map((player) => `
            <li>
              <span class="mini-player-bubble">${escapeHtml(initials(player.name))}</span>
              <strong>${escapeHtml(player.name)}</strong>
              <em>${escapeHtml(positionCodes[player.position] || player.position)}</em>
              ${renderStars(playerLevel(player))}
            </li>
          `).join("")}
        </ul>
      ` : `<p class="muted">Sem jogadores neste time.</p>`}
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

function renderMatchupSlide(pair, pairIndex, matchupId, teams, playersById, isVolei) {
  const leftIndex = pair[0];
  const rightIndex = pair[1];
  const leftTeam = (teams[leftIndex]?.players || []).map((id) => playersById.get(id)).filter(Boolean);
  const rightTeam = rightIndex === undefined ? [] : (teams[rightIndex]?.players || []).map((id) => playersById.get(id)).filter(Boolean);
  return `
    <div class="matchup-slide ${pairIndex === 0 ? "active" : ""}" data-matchup-slide="${matchupId}" data-matchup-index="${pairIndex}" data-matchup-title="${escapeHtml(matchupLabel(pair))}">
      <div class="soccer-field-card ${isVolei ? "volei-field" : ""}">
        <div class="field-lines" aria-hidden="true"></div>
        ${assignFormationSlots(leftTeam, "left").map(({ player, slot }) => teamPlayerNode(player, slot, teamColorClasses[leftIndex % teamColorClasses.length])).join("")}
        ${assignFormationSlots(rightTeam, "right").map(({ player, slot }) => teamPlayerNode(player, slot, teamColorClasses[(rightIndex || 1) % teamColorClasses.length])).join("")}
        ${matchupNotice(pairIndex, pair)}
      </div>
      <div class="team-rosters-grid">
        ${pair.map((teamIndex) => renderTeamList(teams[teamIndex], playersById, teamIndex)).join("")}
      </div>
    </div>
  `;
}

function renderDrawnTeams(event) {
  const teams = Array.isArray(event.teams) ? event.teams : [];
  if (!teams.length) return "";

  const confirmedPlayers = event.players.filter((player) => player.status === "confirmado");
  const playersById = new Map(confirmedPlayers.map((player) => [player.id, player]));
  const isVolei = event.sport === "volei";
  const pairs = matchupPairs(teams);
  const matchupId = `admin-${event.id}`;

  return `
    <section class="drawn-teams-section">
      <div class="drawn-teams-head">
        <h3>Times Sorteados</h3>
        <span>${teams.length} ${teams.length === 1 ? "time" : "times"}</span>
      </div>
      ${renderMatchupControls(matchupId, pairs)}
      <div class="matchup-slider" data-matchup="${matchupId}">
        ${pairs.map((pair, index) => renderMatchupSlide(pair, index, matchupId, teams, playersById, isVolei)).join("")}
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

function playerRow(player) {
  const paymentClass = player.status === "confirmado" ? "confirmado" : "pendente";
  return `
    <tr>
      <td>
        <strong>${escapeHtml(player.name)}</strong>
        <div class="muted">${escapeHtml(player.phone)}</div>
        ${renderStars(playerLevel(player))}
      </td>
      <td>${escapeHtml(player.position)}</td>
      <td><span class="status ${paymentClass}">${paymentStatusText(player)}</span></td>
      <td>${proofCell(player)}</td>
      <td>
        <div class="actions">
          <button type="button" class="secondary-button" data-action="paid" data-id="${player.id}">Confirmar</button>
          <button type="button" class="secondary-button" data-action="edit" data-id="${player.id}">Editar</button>
          <button type="button" class="danger-button" data-action="exclude" data-id="${player.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `;
}

function renderAdmin(events) {
  updateOrganizerCard(events);
  adminEvents.innerHTML = events.map((event) => {
    const activePlayers = event.players.filter((player) => player.status !== "excluido");
    const confirmedCount = activePlayers.filter((player) => player.status === "confirmado").length;
    const totalRegistered = activePlayers.length;
    const rows = event.players.length
      ? event.players.map(playerRow).join("")
      : `<tr><td colspan="5" class="muted">Nenhum jogador inscrito ainda.</td></tr>`;

    return `
      <article class="admin-event">
        <div class="event-card-head">
          <div>
            <h3>${escapeHtml(event.title)}</h3>
            <span class="pill gold">${event.sport === "volei" ? "VOLEI" : "FUTEBOL"}</span>
          </div>
          <div class="event-actions">
            <button class="icon-link-button draw-action" type="button" data-event-action="draw-teams" data-event-id="${event.id}" aria-label="Sortear times de ${escapeHtml(event.title)}">Sortear Times</button>
            <button class="icon-link-button" type="button" data-event-action="add-player" data-event-id="${event.id}" aria-label="Adicionar jogador em ${escapeHtml(event.title)}">+ Jogador</button>
            <button class="icon-link-button" type="button" data-event-action="copy-link" data-event-id="${event.id}" aria-label="Copiar link de ${escapeHtml(event.title)}">Copiar Link</button>
            <a class="icon-link-button" href="/admin-edit-event.html?eventId=${encodeURIComponent(event.id)}" aria-label="Editar ${escapeHtml(event.title)}">Editar</a>
            <button class="icon-link-button danger-outline" type="button" data-event-action="delete" data-event-id="${event.id}" aria-label="Excluir ${escapeHtml(event.title)}">Excluir</button>
          </div>
        </div>
        <div class="admin-metrics-row">
          ${adminMetric("Confirmados / Inscricoes feitas", `${confirmedCount}/${totalRegistered}`, "cyan")}
          ${adminMetric("Custo total do racha", moneyAdmin.format(totalCost(event)), "gold")}
          ${adminMetric("Custo por pessoa", moneyAdmin.format(event.price), "green")}
        </div>
        ${renderSlots(event)}
        ${renderDrawnTeams(event)}
        <table class="player-table">
          <thead>
            <tr>
              <th>Jogador</th>
              <th>Posicao</th>
              <th>Status pagamento</th>
              <th>Comprovante</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </article>
    `;
  }).join("");
}

function findPlayer(playerId) {
  for (const eventCard of adminEventsData) {
    const player = eventCard.players.find((item) => item.id === playerId);
    if (player) return player;
  }
  return null;
}

function openProofModal(player) {
  if (!player?.proofName) return;

  proofModalBody.innerHTML = `
    <p class="muted">${escapeHtml(player.name)} - ${escapeHtml(player.proofName)}</p>
    ${
      player.proofData.startsWith("data:image/")
        ? `<img src="${player.proofData}" alt="Comprovante de ${escapeHtml(player.name)}">`
        : `<a class="proof-link proof-file-link" href="${player.proofData}" target="_blank" rel="noreferrer">Abrir arquivo enviado</a>`
    }
  `;
  proofModal.classList.remove("hidden");
}

function closePlayerEditModal() {
  editingPlayerId = "";
  playerEditForm.reset();
  playerEditMessage.textContent = "";
  playerEditModal.classList.add("hidden");
}

function openPlayerEditModal(player) {
  if (!player) return;
  editingPlayerId = player.id;
  playerEditForm.elements.name.value = player.name || "";
  playerEditForm.elements.phone.value = player.phone || "";
  playerEditForm.elements.position.value = player.position || "";
  playerEditForm.elements.level.value = String(playerLevel(player));
  playerEditForm.elements.confirmed.checked = player.status === "confirmado";
  playerEditMessage.textContent = "";
  playerEditModal.classList.remove("hidden");
}

function closePlayerAddModal() {
  addingPlayerEventId = "";
  playerAddForm.reset();
  playerAddMessage.textContent = "";
  playerAddModal.classList.add("hidden");
}

function openPlayerAddModal(eventCard) {
  if (!eventCard) return;
  addingPlayerEventId = eventCard.id;
  playerAddForm.elements.position.innerHTML = positionOptions(eventCard.sport);
  playerAddForm.elements.level.value = "3";
  playerAddMessage.textContent = "";
  playerAddModal.classList.remove("hidden");
}

function shufflePlayers(players) {
  const shuffled = [...players];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
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
    const candidates = teams.filter((team) => team.length < teamSize);
    const rankedTeams = shufflePlayers(candidates).sort((a, b) => compareTeamScore(a, b, player));

    rankedTeams[0].push(player);
  });

  return teams;
}

function confirmedPlayersForEvent(eventCard) {
  return (eventCard?.players || []).filter((player) => player.status === "confirmado");
}

function smartTeamSize(eventCard) {
  const confirmedCount = confirmedPlayersForEvent(eventCard).length;
  const baseSize = eventCard?.sport === "volei" ? 6 : 5;
  if (confirmedCount <= 1) return 1;
  if (confirmedCount <= baseSize * 2) return Math.max(1, Math.ceil(confirmedCount / 2));
  return baseSize;
}

function updateDrawSizeView() {
  const eventCard = findEvent(drawingEventId);
  const confirmedCount = confirmedPlayersForEvent(eventCard).length;
  if (drawSizeValue) drawSizeValue.textContent = selectedTeamSize;
  if (drawSizeHint) {
    const teamCount = selectedTeamSize ? Math.ceil(confirmedCount / selectedTeamSize) : 0;
    drawSizeHint.textContent = `${confirmedCount} confirmados · sugestao inteligente: ${teamCount} ${teamCount === 1 ? "time" : "times"}`;
  }
}

function clampDrawSize(value) {
  const eventCard = findEvent(drawingEventId);
  const confirmedCount = confirmedPlayersForEvent(eventCard).length || 1;
  return Math.max(1, Math.min(Number(value) || 1, confirmedCount));
}

function openDrawSizeModal(eventCard, button) {
  if (!eventCard) return;
  const confirmedCount = confirmedPlayersForEvent(eventCard).length;
  if (!confirmedCount) {
    window.alert("Nenhum jogador confirmado para sortear.");
    return;
  }
  drawingEventId = eventCard.id;
  drawingTriggerButton = button;
  selectedTeamSize = clampDrawSize(smartTeamSize(eventCard));
  updateDrawSizeView();
  drawSizeModal.classList.remove("hidden");
}

function closeDrawSizeModal() {
  drawingEventId = "";
  drawingTriggerButton = null;
  drawSizeModal.classList.add("hidden");
}

async function loadAdmin() {
  const response = await fetch("/api/admin/summary", { headers: headers() });
  const data = await response.json();

  if (!response.ok) {
    localStorage.removeItem("rachaAdminPassword");
    adminPassword = "";
    loginPanel.classList.remove("hidden");
    adminContent.classList.add("hidden");
    eventCreate.classList.add("hidden");
    openCreateButton.classList.add("hidden");
    return;
  }

  loginPanel.classList.add("hidden");
  adminContent.classList.remove("hidden");
  openCreateButton.classList.remove("hidden");
  adminEventsData = data.events;
  renderAdmin(data.events);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminPassword = new FormData(loginForm).get("password");
  localStorage.setItem("rachaAdminPassword", adminPassword);
  await loadAdmin();
});

refreshButton.addEventListener("click", loadAdmin);

openCreateButton.addEventListener("click", () => {
  eventCreate.classList.remove("hidden");
});

closeCreateButton.addEventListener("click", () => {
  eventCreate.classList.add("hidden");
});

eventForm.elements.price?.addEventListener("input", () => syncEventFormMoney("price"));
eventForm.elements.totalPrice?.addEventListener("input", () => syncEventFormMoney("total"));
eventForm.elements.capacity?.addEventListener("input", () => syncEventFormMoney(activeAdminPriceField));

eventCreate.addEventListener("click", (event) => {
  if (event.target === eventCreate) eventCreate.classList.add("hidden");
});

closeProofButton.addEventListener("click", () => {
  proofModal.classList.add("hidden");
});

proofModal.addEventListener("click", (event) => {
  if (event.target === proofModal) proofModal.classList.add("hidden");
});

closePlayerEditButton.addEventListener("click", closePlayerEditModal);
cancelPlayerEditButton.addEventListener("click", closePlayerEditModal);

playerEditModal.addEventListener("click", (event) => {
  if (event.target === playerEditModal) closePlayerEditModal();
});

closePlayerAddButton.addEventListener("click", closePlayerAddModal);
cancelPlayerAddButton.addEventListener("click", closePlayerAddModal);

playerAddModal.addEventListener("click", (event) => {
  if (event.target === playerAddModal) closePlayerAddModal();
});

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
  const eventCard = findEvent(drawingEventId);
  const sorted = await sortAndSaveTeams(eventCard, drawingTriggerButton, selectedTeamSize);
  if (sorted) closeDrawSizeModal();
});

adminEvents.addEventListener("click", async (event) => {
  const eventButton = event.target.closest("button[data-event-action]");
  if (eventButton) {
    const eventId = eventButton.dataset.eventId;
    const action = eventButton.dataset.eventAction;

    if (action === "copy-link") {
      await copyText(eventShareLink(eventId));
      eventButton.textContent = "Copiado";
      window.setTimeout(() => {
        eventButton.textContent = "Copiar Link";
      }, 2200);
      return;
    }

    if (action === "add-player") {
      openPlayerAddModal(findEvent(eventId));
      return;
    }

    if (action === "draw-teams") {
      openDrawSizeModal(findEvent(eventId), eventButton);
      return;
    }

    if (action !== "delete") return;

    const confirmed = window.confirm("Excluir este racha tambem remove todas as inscricoes ligadas a ele. Deseja continuar?");
    if (!confirmed) return;

    await fetch(`/api/admin/events/${eventId}`, {
      method: "DELETE",
      headers: headers()
    });
    await loadAdmin();
    return;
  }

  const proofButton = event.target.closest("button[data-proof-id]");
  if (proofButton) {
    openProofModal(findPlayer(proofButton.dataset.proofId));
    return;
  }

  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  const player = findPlayer(id);

  if (action === "exclude") {
    await fetch(`/api/admin/players/${id}`, {
      method: "DELETE",
      headers: headers()
    });
    await loadAdmin();
    return;
  }

  if (action === "edit" && player) {
    openPlayerEditModal(player);
    return;
  }

  if (action === "paid") {
    await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ paid: true })
    });
    await loadAdmin();
  }
});

playerEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingPlayerId) return;

  playerEditMessage.textContent = "Salvando...";
  const formData = new FormData(playerEditForm);
  const payload = Object.fromEntries(formData.entries());
  payload.confirmed = formData.has("confirmed");

  const response = await fetch(`/api/admin/players/${editingPlayerId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    playerEditMessage.textContent = data.error || "Nao foi possivel salvar.";
    return;
  }

  closePlayerEditModal();
  await loadAdmin();
});

playerAddForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!addingPlayerEventId) return;

  playerAddMessage.textContent = "Adicionando...";
  const formData = new FormData(playerAddForm);
  const payload = Object.fromEntries(formData.entries());
  payload.eventId = addingPlayerEventId;
  payload.confirmed = formData.has("confirmed");

  const response = await fetch("/api/admin/players", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    playerAddMessage.textContent = data.error || "Nao foi possivel adicionar.";
    return;
  }

  closePlayerAddModal();
  await loadAdmin();
});

async function sortAndSaveTeams(eventCard, button, teamSize) {
  if (!eventCard) return false;

  const confirmedPlayers = eventCard.players.filter((player) => player.status === "confirmado");
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

  const response = await fetch(`/api/admin/events/${encodeURIComponent(eventCard.id)}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ teams: storedTeams })
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

  await loadAdmin();
  return true;
}

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  eventMessage.textContent = "Criando racha...";
  const formData = new FormData(eventForm);
  const payload = Object.fromEntries(formData.entries());
  payload.requireProof = formData.has("requireProof");
  delete payload.totalPrice;

  const response = await fetch("/api/admin/events", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    eventMessage.textContent = data.error || "Nao foi possivel criar o racha.";
    return;
  }

  eventForm.reset();
  syncEventFormMoney("price");
  const shareLink = eventShareLink(data.event.id);
  eventMessage.innerHTML = `
    Racha criado.
    <a class="inline-success-link" href="/racha.html?eventId=${encodeURIComponent(data.event.id)}" target="_blank" rel="noreferrer">Abrir link</a>
    <button class="inline-copy-button" type="button" data-created-link="${escapeHtml(shareLink)}">Copiar link</button>
  `;
  await loadAdmin();
});

eventMessage.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-created-link]");
  if (!button) return;

  await copyText(button.dataset.createdLink);
  button.textContent = "Link copiado";
  window.setTimeout(() => {
    button.textContent = "Copiar link";
  }, 2200);
});

if (adminPassword) {
  loadAdmin();
}
