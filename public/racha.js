const shareTitle = document.querySelector("#share-title");
const shareMeta = document.querySelector("#share-meta");
const shareCard = document.querySelector("#share-card");
const shareMessage = document.querySelector("#share-message");
const params = new URLSearchParams(window.location.search);
const eventId = params.get("eventId") || "";

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

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit"
});

function formatDate(date) {
  return dateFormat.format(new Date(`${date}T12:00:00`));
}

function formatCreatedAt(value) {
  if (!value) return "Data nao informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function sportLabel(sport) {
  return sport === "volei" ? "Volei" : "Futebol";
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
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
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

function eventShareLink(id) {
  return new URL(`/racha.html?eventId=${encodeURIComponent(id)}`, window.location.origin).href;
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

function renderSlots(event) {
  const players = event.players || [];
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
      <span class="player-bubble ${state}" title="${escapeHtml(player.name)} - ${escapeHtml(player.position)} - Nivel ${playerLevel(player)}">
        ${escapeHtml(initials(player.name))}
        <small>${escapeHtml(code)}</small>
      </span>
    `;
  });
  return `<div class="slots-grid">${slots.join("")}</div>`;
}

function eventIsFull(event) {
  return Number(event.confirmed || 0) >= Number(event.capacity || 0);
}

function signupAction(event) {
  if (eventIsFull(event)) {
    return `<span class="signup-link signup-disabled" aria-disabled="true">LISTA CHEIA</span>`;
  }

  return `<a class="signup-link" href="/inscricao.html?eventId=${encodeURIComponent(event.id)}">INSCREVER NESTE RACHA</a>`;
}

function playerRow(player) {
  const code = positionCodes[player.position] || player.position.slice(0, 3).toUpperCase();
  return `
    <li class="racha-player-row">
      <span class="player-bubble ${player.status}">
        ${escapeHtml(initials(player.name))}
        <small>${escapeHtml(code)}</small>
      </span>
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <p>${escapeHtml(player.position)}</p>
        ${renderStars(playerLevel(player))}
      </div>
      ${player.status === "confirmado" ? `<em>CONFIRMADO</em>` : `<em class="waiting">PENDENTE</em>`}
    </li>
  `;
}

function playerSection(title, players, emptyText) {
  return `
    <section class="racha-list-section">
      <div class="racha-section-title">
        <h3>${title}</h3>
        <span>${players.length}</span>
      </div>
      ${
        players.length
          ? `<ul class="racha-player-list">${players.map(playerRow).join("")}</ul>`
          : `<p class="racha-empty-line">${emptyText}</p>`
      }
    </section>
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

function lineupSection(event) {
  const teams = Array.isArray(event.teams) ? event.teams : [];
  if (!teams.length) return "";

  const confirmedPlayers = (event.players || []).filter((player) => player.status === "confirmado");
  const playersById = new Map(confirmedPlayers.map((player) => [player.id, player]));
  const isVolei = event.sport === "volei";
  const pairs = matchupPairs(teams);
  const matchupId = `racha-${event.id}`;

  return `
    <section class="drawn-teams-section racha-lineup-section">
      <div class="drawn-teams-head">
        <h3>ESCALACAO SORTEADA</h3>
        <span>${teams.length} ${teams.length === 1 ? "time" : "times"}</span>
      </div>
      <div class="drawn-teams-card">
        ${renderMatchupControls(matchupId, pairs)}
        <div class="matchup-slider" data-matchup="${matchupId}">
          ${pairs.map((pair, index) => renderMatchupSlide(pair, index, matchupId, teams, playersById, isVolei)).join("")}
        </div>
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

function revenuePanel(event) {
  const paidPlayers = (event.players || []).filter((player) => player.paid);
  const collected = paidPlayers.length * Number(event.price || 0);
  const total = Number(event.capacity || 0) * Number(event.price || 0);
  const percent = total > 0 ? Math.min((collected / total) * 100, 100) : 0;

  return `
    <section class="racha-revenue-panel">
      <div>
        <span>Pix arrecadado</span>
        <strong>${money.format(collected)} <small>/ ${money.format(total)}</small></strong>
      </div>
      <div class="racha-progress-bar" aria-label="Arrecadacao do racha">
        <span style="width: ${percent}%"></span>
      </div>
    </section>
  `;
}

function renderEvent(event) {
  const link = eventShareLink(event.id);
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`Bora pro racha: ${event.title} - ${link}`)}`;
  const confirmedPlayers = (event.players || []).filter((player) => player.status === "confirmado");
  const pendingPlayers = (event.players || []).filter((player) => player.status !== "confirmado");
  shareTitle.textContent = event.title;
  shareMeta.textContent = `${sportLabel(event.sport)} para compartilhar com os convidados.`;
  document.title = `${event.title} | Racha Ai`;

  shareCard.innerHTML = `
    <section class="racha-hero-card">
      <span class="racha-status-pill">${eventIsFull(event) ? "Fechada" : "Aberta"}</span>
      <h2>${escapeHtml(event.title)}</h2>
      <div class="racha-organizer-meta">
        <p>Racha organizado por: <strong>${escapeHtml(event.organizerName || "Administrador do racha")}</strong></p>
        <p>Criado em: <strong>${formatCreatedAt(event.createdAt)}</strong></p>
      </div>
      <div class="racha-hero-meta">
        <span>${formatDate(event.date)} · ${event.time}</span>
        <span>${escapeHtml(event.location)}</span>
        <span>${money.format(event.price)}</span>
      </div>
    </section>

    <section class="racha-slots-panel">
      <span class="racha-panel-label">Vagas</span>
      ${renderSlots(event)}
      <div class="score-line">
        <strong><span>${event.confirmed}</span>/${event.capacity}</strong>
        <p>confirmados<br>${event.registrationAvailable ?? event.available} inscricoes abertas</p>
      </div>
      ${event.notes ? `<p class="event-notes">${escapeHtml(event.notes)}</p>` : ""}
      ${eventIsFull(event) ? `<p class="full-list-message">Limite maximo de inscricoes atingido. Se alguem sair, o botao de inscricao volta a ficar disponivel.</p>` : ""}
    </section>

    <div class="share-actions">
      ${signupAction(event)}
      <a class="whatsapp-share-link" href="${whatsappLink}" target="_blank" rel="noreferrer">MANDAR NO GRUPO</a>
      <button class="details-link copy-link-button" type="button" data-share-link="${escapeHtml(link)}">COPIAR LINK</button>
    </div>

    ${lineupSection(event)}
    ${playerSection("Confirmados", confirmedPlayers, "Ninguem confirmado ainda")}
    ${playerSection("Pendentes", pendingPlayers, "Ninguem pendente")}
    ${revenuePanel(event)}
  `;
}

async function loadEvent() {
  if (!eventId) {
    shareCard.innerHTML = `<p class="muted">Link do racha invalido.</p>`;
    return;
  }

  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
  const data = await response.json();

  if (!response.ok) {
    shareCard.innerHTML = `<p class="muted">${escapeHtml(data.error || "Nao foi possivel carregar este racha.")}</p>`;
    return;
  }

  renderEvent(data.event);
}

shareCard.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-share-link]");
  if (!button) return;

  await copyText(button.dataset.shareLink);
  button.textContent = "LINK COPIADO";
  shareMessage.textContent = "Link pronto para enviar no grupo.";
  window.setTimeout(() => {
    button.textContent = "COPIAR LINK";
  }, 2200);
});

loadEvent().catch(() => {
  shareCard.innerHTML = `<p class="muted">Nao foi possivel carregar este racha.</p>`;
});
