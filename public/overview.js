const overviewList = document.querySelector("#overview-list");
const overviewMessage = document.querySelector("#overview-message");
const overviewUserCard = document.querySelector("#overview-user-card");
const overviewUserName = document.querySelector("#overview-user-name");
const overviewUserPhone = document.querySelector("#overview-user-phone");
const overviewUserMeta = document.querySelector("#overview-user-meta");
const overviewEditButton = document.querySelector("#overview-edit-button");
const overviewEditModal = document.querySelector("#overview-edit-modal");
const overviewEditForm = document.querySelector("#overview-edit-form");
const overviewEditMessage = document.querySelector("#overview-edit-message");
const closeOverviewEditButton = document.querySelector("#close-overview-edit-button");
const cancelOverviewEditButton = document.querySelector("#cancel-overview-edit-button");
const overviewEventsTitle = document.querySelector("#overview-events-title");
const params = new URLSearchParams(window.location.search);
const phone = params.get("phone") || "";
const maxProofSize = 1_200_000;

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

let countdownTimer = null;
let currentRegistrations = [];
let editingRegistration = null;

const positionsBySport = {
  futebol: ["Goleiro", "Zagueiro", "Lateral", "Meia", "Atacante", "Coringa"],
  volei: ["Levantador", "Ponteiro", "Oposto", "Central", "Libero"]
};

function formatDate(date) {
  return dateFormat.format(new Date(`${date}T12:00:00`));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function positionOptions(sport, selected = "") {
  return (positionsBySport[sport] || [])
    .map((position) => `<option value="${escapeHtml(position)}" ${position === selected ? "selected" : ""}>${escapeHtml(position)}</option>`)
    .join("");
}

function statusLabel(status) {
  return {
    aguardando_pagamento: "Aguardando pagamento",
    pendente: "Em Analise",
    confirmado: "Confirmado",
    excluido: "Excluído"
  }[status] || status;
}

function paymentState(player) {
  if (player.status === "confirmado") {
    return { className: "confirmed", icon: "✓", label: "Confirmado", helper: "Pagamento validado pelo admin. Sua vaga esta confirmada." };
  }

  if (player.proofName) {
    return { className: "analysis", icon: "!", label: "Em Analise", helper: "Comprovante enviado. Aguarde o admin validar seu pagamento." };
  }

  return { className: "pending", icon: "!", label: "Pendente", helper: "Pagamento ainda nao confirmado. Envie o comprovante para entrar em analise." };
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
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

function eventDateTime(event) {
  return new Date(`${event.date}T${event.time}:00`);
}

function paymentDeadline(event) {
  return new Date(eventDateTime(event).getTime() - 24 * 60 * 60 * 1000);
}

function paymentWindowClosed(event) {
  return new Date() >= paymentDeadline(event);
}

function countdownParts(milliseconds) {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function countdownState(event) {
  const now = new Date();
  const deadline = paymentDeadline(event);
  const eventStart = eventDateTime(event);
  const remaining = deadline - now;

  if (remaining > 6 * 60 * 60 * 1000) {
    return {
      className: "safe",
      label: "Prazo para pagar",
      time: countdownParts(remaining),
      helper: "Limite maximo: 24h antes do horario do racha."
    };
  }

  if (remaining > 2 * 60 * 60 * 1000) {
    return {
      className: "warning",
      label: "Prazo se aproximando",
      time: countdownParts(remaining),
      helper: "Faltam poucas horas para o limite recomendado de pagamento."
    };
  }

  if (remaining > 60 * 60 * 1000) {
    return {
      className: "critical",
      label: "Ultimas horas",
      time: countdownParts(remaining),
      helper: "Pague e envie o comprovante para nao perder prioridade na validacao."
    };
  }

  if (remaining > 0) {
    return {
      className: "danger",
      label: "Menos de 1 hora",
      time: countdownParts(remaining),
      helper: "Falta menos de 1h para o limite. Pague agora e envie o comprovante."
    };
  }

  return {
    className: now < eventStart ? "urgent" : "expired",
    label: now < eventStart ? "Prazo encerrado" : "Racha iniciado",
    time: "00:00:00",
    helper: now < eventStart
      ? "O prazo para pagamento encerrou. O envio de comprovante nao esta mais disponivel."
      : "O horario do racha ja passou. Consulte o organizador."
  };
}

function countdownMarkup(event) {
  const state = countdownState(event);
  return `
    <div class="payment-countdown ${state.className}" data-countdown-event="${escapeHtml(event.id)}">
      <span>${state.label}</span>
      <strong>${state.time}</strong>
      <p>${state.helper}</p>
    </div>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Nao foi possivel ler o comprovante."));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1000)} KB`;
}

function proofIsValid(file) {
  if (!file) return false;
  const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
  const lowerName = file.name.toLowerCase();
  return (allowedTypes.includes(file.type) || allowedExtensions.some((ext) => lowerName.endsWith(ext))) && file.size <= maxProofSize;
}

function updateOverviewCountdowns(registrations) {
  document.querySelectorAll("[data-countdown-event]").forEach((element) => {
    const registration = registrations.find((item) => item.event.id === element.dataset.countdownEvent);
    if (!registration) return;
    const state = countdownState(registration.event);
    element.className = `payment-countdown ${state.className}`.trim();
    element.querySelector("span").textContent = state.label;
    element.querySelector("strong").textContent = state.time;
    element.querySelector("p").textContent = state.helper;

    if (paymentWindowClosed(registration.event)) {
      document.querySelectorAll(`[data-proof-event="${CSS.escape(registration.event.id)}"]`).forEach((form) => {
        form.querySelectorAll("input, button").forEach((control) => {
          control.disabled = true;
        });
        const message = form.querySelector("[data-proof-message]");
        if (message) message.textContent = "Prazo encerrado para envio de comprovante.";
      });
    }
  });
}

function renderPaymentCard({ player, event }) {
  const pixKey = event.pixKey || "edcdesigner@hotmail.com";
  const state = paymentState(player);
  const isPaymentClosed = paymentWindowClosed(event);
  const showProofForm = player.status !== "confirmado" && !player.proofName && !isPaymentClosed;
  return `
    <section class="overview-payment-card embedded-payment-card">
      <div class="payment-status-banner ${state.className}">
        <span class="status-icon ${state.className}" aria-hidden="true"></span>
        <div>
          <span>Status do pagamento</span>
          <strong>${state.label}</strong>
          <p>${state.helper}</p>
        </div>
      </div>
      <div class="overview-payment-title">
        <span class="payment-eyebrow">Pagamento Pix</span>
        <h2>PIX DO RACHA</h2>
        <p>Use o QR Code ou copie a chave Pix. Depois envie o comprovante por aqui.</p>
      </div>
      ${countdownMarkup(event)}
      <div class="overview-payment-content">
        <button class="pix-qr overview-qr pix-copy-button" type="button" data-copy-pix="${escapeHtml(pixKey)}" aria-label="Copiar chave Pix pelo QR Code">
          <img src="/assets/pix-qrcode.png" alt="QR Code Pix">
        </button>
        <div class="payment-summary overview-payment-summary">
          <div>
            <span>Valor</span>
            <strong>${money.format(event.price)}</strong>
          </div>
          <div>
            <span>Chave Pix</span>
            <strong>${escapeHtml(pixKey)}</strong>
          </div>
          <div>
            <span>Recebedor</span>
            <strong>Administrador do racha</strong>
          </div>
        </div>
      </div>
      ${showProofForm ? `
        <form class="overview-proof-form" data-proof-player="${escapeHtml(player.id)}" data-proof-event="${escapeHtml(event.id)}">
          <label>
            Comprovante de pagamento
            <input name="proof" type="file" accept="image/*,.pdf,application/pdf" required>
          </label>
          <div class="proof-file-info" data-proof-info>
            Envie PDF ou imagem ate 1,2 MB. Para comprovantes grandes, prefira print da tela.
          </div>
          <button type="submit">FIZ O PAGAMENTO</button>
          <p class="form-message" data-proof-message role="status"></p>
        </form>
      ` : ""}
      ${player.status !== "confirmado" && !player.proofName && isPaymentClosed ? `
        <div class="payment-closed-note">
          <strong>Prazo encerrado</strong>
          <p>Nao e mais possivel enviar comprovante ou confirmar pagamento por esta pagina.</p>
        </div>
      ` : ""}
    </section>
  `;
}

function renderRegistration({ player, event }) {
  return `
    <article class="overview-card overview-event-card">
      <div class="event-card-head">
        <div>
          <span class="payment-eyebrow">${event.sport === "volei" ? "Volei" : "Futebol"}</span>
          <h2>${escapeHtml(event.title)}</h2>
        </div>
        <span class="overview-price-tag">${money.format(event.price)}</span>
      </div>
      <div class="meta-row">
        <span class="pill blue">${formatDate(event.date)} as ${event.time} | ${escapeHtml(event.location)}</span>
      </div>
      ${renderSlots(event)}
      <div class="score-line">
        <strong><span>${event.confirmed}</span>/${event.capacity}</strong>
        <p>confirmados<br>${event.registrationAvailable ?? event.available} inscricoes abertas</p>
      </div>
      ${renderPaymentCard({ player, event })}
    </article>
  `;
}

function closeOverviewEditModal() {
  editingRegistration = null;
  overviewEditForm.reset();
  overviewEditMessage.textContent = "";
  overviewEditModal.classList.add("hidden");
}

function openOverviewEditModal(registration) {
  if (!registration) return;
  editingRegistration = registration;
  overviewEditForm.elements.name.value = registration.player.name || "";
  overviewEditForm.elements.phone.value = registration.player.phone || "";
  overviewEditForm.elements.position.innerHTML = positionOptions(registration.event.sport, registration.player.position);
  overviewEditForm.elements.level.value = String(playerLevel(registration.player));
  overviewEditForm.elements.note.value = registration.player.note || "";
  overviewEditMessage.textContent = "";
  overviewEditModal.classList.remove("hidden");
}

async function loadOverview() {
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 8) {
    overviewMessage.textContent = "Volte para a Home e informe seu celular.";
    return;
  }

  const response = await fetch(`/api/registrations/overview?phone=${encodeURIComponent(cleanPhone)}`);
  const data = await response.json();
  if (!response.ok) {
    overviewMessage.textContent = data.error || "Nao foi possivel carregar sua inscricao.";
    return;
  }

  if (!data.registrations.length) {
    overviewMessage.textContent = "Nenhuma inscricao encontrada para este telefone.";
    return;
  }

  currentRegistrations = data.registrations;
  const mainPlayer = data.registrations[0].player;
  overviewUserName.textContent = mainPlayer.name;
  overviewUserPhone.textContent = formatPhone(mainPlayer.phone);
  overviewUserMeta.innerHTML = `${renderStars(playerLevel(mainPlayer))} <span>| ${escapeHtml(mainPlayer.position)}</span>`;
  overviewUserCard.classList.remove("hidden");
  overviewEventsTitle.classList.remove("hidden");
  overviewList.innerHTML = data.registrations.map(renderRegistration).join("");
  window.clearInterval(countdownTimer);
  updateOverviewCountdowns(data.registrations);
  countdownTimer = window.setInterval(() => updateOverviewCountdowns(data.registrations), 1000);
}

overviewEditButton.addEventListener("click", () => {
  openOverviewEditModal(currentRegistrations[0]);
});

closeOverviewEditButton.addEventListener("click", closeOverviewEditModal);
cancelOverviewEditButton.addEventListener("click", closeOverviewEditModal);

overviewEditModal.addEventListener("click", (event) => {
  if (event.target === overviewEditModal) closeOverviewEditModal();
});

overviewEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingRegistration) return;

  overviewEditMessage.textContent = "Salvando...";
  const payload = Object.fromEntries(new FormData(overviewEditForm).entries());
  payload.eventId = editingRegistration.event.id;
  payload.confirmPhone = true;

  const response = await fetch(`/api/registrations/${encodeURIComponent(editingRegistration.player.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    overviewEditMessage.textContent = data.error || "Nao foi possivel salvar.";
    return;
  }

  closeOverviewEditModal();
  await loadOverview();
});

overviewList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-pix]");
  if (!button) return;

  await copyText(button.dataset.copyPix);
  button.classList.add("copied");
  overviewMessage.textContent = "Chave Pix copiada.";
  window.setTimeout(() => {
    button.classList.remove("copied");
  }, 1800);
});

overviewList.addEventListener("change", (event) => {
  const input = event.target.closest('input[type="file"]');
  if (!input) return;

  const form = input.closest(".overview-proof-form");
  const info = form.querySelector("[data-proof-info]");
  const message = form.querySelector("[data-proof-message]");
  const file = input.files[0];
  message.textContent = "";

  if (!file) {
    info.textContent = "Envie PDF ou imagem ate 1,2 MB. Para comprovantes grandes, prefira print da tela.";
    return;
  }

  const isValid = proofIsValid(file);
  info.innerHTML = `
    <strong>${escapeHtml(file.name)}</strong>
    <span>${formatFileSize(file.size)} ${isValid ? "- pronto para enviar" : "- arquivo muito grande ou formato invalido"}</span>
  `;
  if (!isValid) {
    message.textContent = "Use PDF, PNG, JPG ou WEBP ate 1,2 MB.";
  }
});

overviewList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".overview-proof-form");
  if (!form) return;
  event.preventDefault();

  const file = form.elements.proof.files[0];
  const message = form.querySelector("[data-proof-message]");
  const info = form.querySelector("[data-proof-info]");
  const button = form.querySelector('button[type="submit"]');
  const playerId = form.dataset.proofPlayer;

  message.textContent = "";
  if (!file || !playerId) {
    message.textContent = "Selecione o comprovante primeiro.";
    return;
  }

  if (!proofIsValid(file)) {
    message.textContent = "Envie um PDF, PNG, JPG ou WEBP ate 1,2 MB.";
    return;
  }

  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = "ENVIANDO...";
  message.textContent = "Preparando arquivo...";

  try {
    const proofData = await readFileAsDataUrl(file);
    message.textContent = "Enviando comprovante...";
    const response = await fetch(`/api/registrations/${encodeURIComponent(playerId)}/proof`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proofName: file.name, proofData })
    });
    const data = await response.json();

    if (!response.ok) {
      message.textContent = data.error || "Nao foi possivel enviar o comprovante.";
      return;
    }

    form.reset();
    info.textContent = "Comprovante enviado.";
    overviewMessage.textContent = "Pagamento enviado para analise do admin.";
    await loadOverview();
  } catch (error) {
    message.textContent = error.message || "Nao foi possivel enviar o comprovante.";
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = "FIZ O PAGAMENTO";
  }
});

loadOverview();
