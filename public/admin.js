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
const teamDrawModal = document.querySelector("#team-draw-modal");
const teamDrawForm = document.querySelector("#team-draw-form");
const teamDrawResult = document.querySelector("#team-draw-result");
const closeTeamDrawButton = document.querySelector("#close-team-draw-button");

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
let currentTeamImageUrl = "";

function headers() {
  return {
    "Content-Type": "application/json",
    "x-admin-password": adminPassword
  };
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

function teamPlayerNode(player, side, index, total) {
  if (!player) return "";
  const code = positionCodes[player.position] || player.position.slice(0, 3).toUpperCase();
  const lanes = side === "left"
    ? [
        [10, 48], [22, 24], [22, 72], [36, 42], [50, 22], [50, 68]
      ]
    : [
        [90, 48], [78, 24], [78, 72], [64, 42], [50, 32], [50, 78]
      ];
  const fallbackX = side === "left" ? 14 + (index % 3) * 13 : 86 - (index % 3) * 13;
  const fallbackY = 24 + Math.floor(index / 3) * 22;
  const point = lanes[index] || [fallbackX, fallbackY];

  return `
    <span class="team-field-player" style="left:${point[0]}%; top:${point[1]}%;" data-player-name="${escapeHtml(player.name)}">
      <span class="team-dot">${escapeHtml(initials(player.name))}</span>
      <small>${escapeHtml(code)}</small>
      <span class="team-tooltip">${escapeHtml(player.name)}</span>
    </span>
  `;
}

function renderTeamList(team, playersById, index) {
  const players = team.players.map((id) => playersById.get(id)).filter(Boolean);
  return `
    <div class="team-roster">
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

function renderDrawnTeams(event) {
  const teams = Array.isArray(event.teams) ? event.teams : [];
  if (!teams.length) return "";

  const confirmedPlayers = event.players.filter((player) => player.status === "confirmado");
  const playersById = new Map(confirmedPlayers.map((player) => [player.id, player]));
  const firstTeam = (teams[0]?.players || []).map((id) => playersById.get(id)).filter(Boolean);
  const secondTeam = (teams[1]?.players || []).map((id) => playersById.get(id)).filter(Boolean);
  const extraTeams = teams.slice(2);

  return `
    <section class="drawn-teams-section">
      <div class="drawn-teams-head">
        <h3>Times Sorteados</h3>
        <span>${teams.length} ${teams.length === 1 ? "time" : "times"}</span>
      </div>
      <div class="soccer-field-card">
        <div class="field-lines" aria-hidden="true"></div>
        ${firstTeam.map((player, index) => teamPlayerNode(player, "left", index, firstTeam.length)).join("")}
        ${secondTeam.map((player, index) => teamPlayerNode(player, "right", index, secondTeam.length)).join("")}
      </div>
      <div class="team-rosters-grid">
        ${teams.slice(0, 2).map((team, index) => renderTeamList(team, playersById, index)).join("")}
      </div>
      ${extraTeams.length ? `
        <div class="team-rosters-grid extra-teams">
          ${extraTeams.map((team, index) => renderTeamList(team, playersById, index + 2)).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

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

function closeTeamDrawModal() {
  drawingEventId = "";
  teamDrawForm.reset();
  teamDrawResult.innerHTML = "";
  if (currentTeamImageUrl) URL.revokeObjectURL(currentTeamImageUrl);
  currentTeamImageUrl = "";
  teamDrawModal.classList.add("hidden");
}

function openTeamDrawModal(eventCard) {
  if (!eventCard) return;
  drawingEventId = eventCard.id;
  teamDrawForm.elements.teamSize.value = eventCard.sport === "volei" ? 6 : 5;
  teamDrawResult.innerHTML = `<p class="muted">Somente jogadores confirmados entram no sorteio.</p>`;
  teamDrawModal.classList.remove("hidden");
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
  return team.filter((teamPlayer) => teamPlayer.position === player.position).length;
}

function drawTeams(players, teamSize) {
  const confirmedPlayers = players.filter((player) => player.status === "confirmado");
  if (confirmedPlayers.length <= teamSize) return [shufflePlayers(confirmedPlayers)];

  const teamCount = Math.ceil(confirmedPlayers.length / teamSize);
  const teams = Array.from({ length: teamCount }, () => []);

  const sortedPlayers = shufflePlayers(confirmedPlayers).sort((a, b) => playerLevel(b) - playerLevel(a));
  sortedPlayers.forEach((player) => {
    const candidates = teams.filter((team) => team.length < teamSize);
    const rankedTeams = shufflePlayers(candidates).sort((a, b) => {
      const totalDiff = teamTotalLevel(a) - teamTotalLevel(b);
      if (totalDiff !== 0) return totalDiff;

      const averageDiff = teamAverageLevel(a) - teamAverageLevel(b);
      if (averageDiff !== 0) return averageDiff;

      const positionDiff = samePositionCount(a, player) - samePositionCount(b, player);
      if (positionDiff !== 0) return positionDiff;

      return a.length - b.length;
    });

    rankedTeams[0].push(player);
  });

  return teams;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function teamSvg(eventCard, teams) {
  const width = 960;
  const headerHeight = 142;
  const teamHeader = 58;
  const rowHeight = 38;
  const gap = 18;
  const teamBlocks = teams.map((team) => teamHeader + Math.max(team.length, 1) * rowHeight + 24);
  const height = headerHeight + teamBlocks.reduce((sum, block) => sum + block + gap, 0) + 24;
  let y = headerHeight;

  const blocks = teams.map((team, index) => {
    const blockHeight = teamBlocks[index];
    const rows = team.length
      ? team.map((player, playerIndex) => {
          const rowY = y + teamHeader + playerIndex * rowHeight;
          return `
            <text x="72" y="${rowY}" fill="#ffffff" font-size="24" font-family="Arial, sans-serif" font-weight="700">${escapeXml(player.name)}</text>
            <text x="792" y="${rowY}" fill="#ffd447" font-size="20" font-family="Arial, sans-serif" font-weight="700" text-anchor="end">${escapeXml(positionCodes[player.position] || player.position)}</text>
          `;
        }).join("")
      : `<text x="72" y="${y + teamHeader}" fill="#d8e2dc" font-size="22" font-family="Arial, sans-serif">Sem jogadores</text>`;
    const block = `
      <rect x="42" y="${y - 34}" width="876" height="${blockHeight}" rx="22" fill="#15221d" stroke="#315346"/>
      <text x="72" y="${y + 8}" fill="#00d9ff" font-size="26" font-family="Arial, sans-serif" font-weight="900">TIME ${index + 1}</text>
      <text x="886" y="${y + 8}" fill="#9cffb6" font-size="19" font-family="Arial, sans-serif" font-weight="700" text-anchor="end">${team.length} jogadores</text>
      ${rows}
    `;
    y += blockHeight + gap;
    return block;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="960" height="${height}" fill="#07130f"/>
      <circle cx="790" cy="44" r="220" fill="#1f5fff" opacity="0.18"/>
      <circle cx="100" cy="${height - 80}" r="230" fill="#1fb45a" opacity="0.16"/>
      <text x="42" y="58" fill="#ffd447" font-size="24" font-family="Arial, sans-serif" font-weight="900">SORTEIO DE TIMES</text>
      <text x="42" y="104" fill="#ffffff" font-size="42" font-family="Arial, sans-serif" font-weight="900">${escapeXml(eventCard.title)}</text>
      <text x="42" y="132" fill="#d8e2dc" font-size="20" font-family="Arial, sans-serif">${escapeXml(eventCard.location || "")}</text>
      ${blocks}
    </svg>
  `;
}

function renderTeamDrawResult(eventCard, teams) {
  if (currentTeamImageUrl) URL.revokeObjectURL(currentTeamImageUrl);
  const svg = teamSvg(eventCard, teams);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  currentTeamImageUrl = URL.createObjectURL(blob);
  teamDrawResult.innerHTML = `
    <div class="team-export-card">
      <img src="${currentTeamImageUrl}" alt="Times sorteados de ${escapeHtml(eventCard.title)}">
      <a class="icon-link-button" href="${currentTeamImageUrl}" download="times-${escapeHtml(eventCard.id)}.svg">Baixar imagem</a>
    </div>
  `;
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

closeTeamDrawButton.addEventListener("click", closeTeamDrawModal);

teamDrawModal.addEventListener("click", (event) => {
  if (event.target === teamDrawModal) closeTeamDrawModal();
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
      openTeamDrawModal(findEvent(eventId));
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

teamDrawForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const eventCard = findEvent(drawingEventId);
  if (!eventCard) return;

  const teamSize = Math.max(Number(new FormData(teamDrawForm).get("teamSize")) || 1, 1);
  const confirmedPlayers = eventCard.players.filter((player) => player.status === "confirmado");
  if (!confirmedPlayers.length) {
    teamDrawResult.innerHTML = `<p class="form-message">Nenhum jogador confirmado para sortear.</p>`;
    return;
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
    teamDrawResult.innerHTML = `<p class="form-message">${escapeHtml(data.error || "Nao foi possivel salvar o sorteio.")}</p>`;
    return;
  }

  renderTeamDrawResult(eventCard, teams);
  await loadAdmin();
});

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  eventMessage.textContent = "Criando racha...";
  const formData = new FormData(eventForm);
  const payload = Object.fromEntries(formData.entries());
  payload.requireProof = formData.has("requireProof");

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
