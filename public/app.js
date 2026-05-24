const eventsContainer = document.querySelector("#events");
const lookupForm = document.querySelector("#lookup-form");
const lookupMessage = document.querySelector("#lookup-message");
const organizerLoginModal = document.querySelector("#organizer-login-modal");
const organizerLoginForm = document.querySelector("#organizer-login-form");
const organizerLoginMessage = document.querySelector("#organizer-login-message");
const closeOrganizerLogin = document.querySelector("#close-organizer-login");
const profileChoiceModal = document.querySelector("#profile-choice-modal");
const closeProfileChoice = document.querySelector("#close-profile-choice");
const choicePlayerButton = document.querySelector("#choice-player-button");
const choiceAdminButton = document.querySelector("#choice-admin-button");

let lookupPhone = "";
let lookupOrganizerEvents = [];

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

function signupAction(event, label = "INSCREVER") {
  if (eventIsFull(event)) {
    return `<span class="signup-link signup-disabled" aria-disabled="true">LISTA CHEIA</span>`;
  }

  return `<a class="signup-link" href="/inscricao.html?eventId=${encodeURIComponent(event.id)}">${label}</a>`;
}

function renderEvents(events) {
  if (!events.length) {
    eventsContainer.innerHTML = `
      <div class="empty-events">
        <strong>Nenhum racha disponível no momento :(</strong>
        <p>Que tal puxar a fila e criar o primeiro?</p>
        <a class="signup-link" href="/organizar.html">CRIAR RACHA</a>
      </div>
    `;
    return;
  }

  eventsContainer.innerHTML = events.map((event) => `
    <article class="event-card home-event-card">
      <div class="event-card-head">
        <h3>${escapeHtml(event.title)}</h3>
        <span class="pill gold">${money.format(event.price)}</span>
      </div>
      <div class="meta-row">
        <span class="pill">${sportLabel(event.sport)}</span>
        <span class="pill blue">${formatDate(event.date)} as ${event.time}</span>
      </div>
      <p class="muted">${escapeHtml(event.location)}</p>
      ${renderSlots(event)}
      <div class="score-line">
        <strong><span>${event.confirmed}</span>/${event.capacity}</strong>
        <p>confirmados<br>${event.registrationAvailable ?? event.available} inscricoes abertas</p>
      </div>
      <p class="event-notes">${escapeHtml(event.notes)}</p>
      <div class="home-card-actions">
        ${signupAction(event)}
        <a class="details-link" href="/racha.html?eventId=${encodeURIComponent(event.id)}">VER DETALHES</a>
      </div>
    </article>
  `).join("");
}

async function loadEvents() {
  const response = await fetch("/api/events");
  const data = await response.json();
  renderEvents(data.events);
}

loadEvents().catch(() => {
  eventsContainer.innerHTML = "<p>Nao foi possivel carregar os rachas.</p>";
});

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = new FormData(lookupForm).get("phone").replace(/\D/g, "");

  if (phone.length < 8) {
    lookupMessage.textContent = "Informe um celular valido.";
    return;
  }

  lookupPhone = phone;
  lookupMessage.textContent = "Consultando...";

  fetch(`/api/organizer/access-check?phone=${encodeURIComponent(phone)}`)
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        lookupMessage.textContent = data.error || "Nao foi possivel consultar.";
        return;
      }

      lookupOrganizerEvents = data.organizerEvents || [];
      if (data.isPlayer && data.isOrganizer) {
        lookupMessage.textContent = "";
        profileChoiceModal.classList.remove("hidden");
        return;
      }

      if (data.isOrganizer) {
        openOrganizerLogin(phone, lookupOrganizerEvents);
        return;
      }

      window.location.href = `/overview.html?phone=${encodeURIComponent(phone)}`;
    })
    .catch(() => {
      lookupMessage.textContent = "Nao foi possivel consultar agora.";
    });
});

function openOrganizerLogin(phone, events) {
  organizerLoginForm.elements.phone.value = phone;
  organizerLoginForm.elements.eventId.innerHTML = events.map((event) => `
    <option value="${escapeHtml(event.eventId)}">${escapeHtml(event.title)}</option>
  `).join("");
  organizerLoginMessage.textContent = "";
  organizerLoginModal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

closeOrganizerLogin.addEventListener("click", () => closeModal(organizerLoginModal));
closeProfileChoice.addEventListener("click", () => closeModal(profileChoiceModal));

organizerLoginModal.addEventListener("click", (event) => {
  if (event.target === organizerLoginModal) closeModal(organizerLoginModal);
});

profileChoiceModal.addEventListener("click", (event) => {
  if (event.target === profileChoiceModal) closeModal(profileChoiceModal);
});

choicePlayerButton.addEventListener("click", () => {
  window.location.href = `/overview.html?phone=${encodeURIComponent(lookupPhone)}`;
});

choiceAdminButton.addEventListener("click", () => {
  closeModal(profileChoiceModal);
  openOrganizerLogin(lookupPhone, lookupOrganizerEvents);
});

organizerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  organizerLoginMessage.textContent = "Entrando...";
  const payload = Object.fromEntries(new FormData(organizerLoginForm).entries());
  const response = await fetch("/api/organizer/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    organizerLoginMessage.textContent = data.error || "Telefone ou senha invalidos";
    return;
  }
  window.location.href = data.organizerPanelUrl;
});
