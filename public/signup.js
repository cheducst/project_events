const eventTitle = document.querySelector("#event-title");
const eventMeta = document.querySelector("#event-meta");
const detailsForm = document.querySelector("#details-form");
const phoneConfirmForm = document.querySelector("#phone-confirm-form");
const detailsMessage = document.querySelector("#details-message");
const phoneMessage = document.querySelector("#phone-message");
const phonePreview = document.querySelector("#phone-preview");
const positionSelect = detailsForm.elements.position;
const stepBackButton = document.querySelector("#step-back-button");
const stepIndicatorButtons = document.querySelectorAll("[data-step-indicator]");

const params = new URLSearchParams(window.location.search);
const eventId = params.get("eventId");

let selectedEvent = null;
let formPayload = {};
let currentPlayerId = "";
let currentStep = 1;
let maxAvailableStep = 1;

const positionsBySport = {
  futebol: ["Goleiro", "Zagueiro", "Lateral", "Meia", "Atacante", "Coringa"],
  volei: ["Levantador", "Ponteiro", "Oposto", "Central", "Libero"]
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function setStep(step) {
  currentStep = step;
  maxAvailableStep = Math.max(maxAvailableStep, step);
  document.querySelectorAll("[data-step]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.step !== String(step));
  });
  stepIndicatorButtons.forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("active", indicatorStep === step);
    indicator.classList.toggle("done", indicatorStep < step);
    indicator.classList.toggle("locked", indicatorStep > maxAvailableStep);
    indicator.disabled = false;
    indicator.setAttribute("aria-disabled", indicatorStep > maxAvailableStep ? "true" : "false");
    indicator.setAttribute("aria-current", indicatorStep === step ? "step" : "false");
  });
  stepBackButton.disabled = step === 1;
}

function goBackOneStep() {
  if (currentStep <= 1) return;
  setStep(currentStep - 1);
}

function goToStep(step) {
  if (step > maxAvailableStep) {
    detailsMessage.textContent = "Preencha seus dados para liberar a confirmacao do telefone.";
    return;
  }

  phoneMessage.textContent = "";
  setStep(step);
}

function preparePhoneConfirmation() {
  phonePreview.textContent = formPayload.phone;
  phoneMessage.textContent = "Confira o telefone antes de continuar.";
}

async function createRegistration() {
  const isEditingExistingRegistration = Boolean(currentPlayerId);
  const response = await fetch(isEditingExistingRegistration ? `/api/registrations/${currentPlayerId}` : "/api/registrations", {
    method: isEditingExistingRegistration ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...formPayload, confirmPhone: true })
  });
  const data = await response.json();

  if (response.status === 409 && data.existingPhone) {
    phoneMessage.textContent = "Este telefone ja tem inscricao. Abrindo sua situacao...";
    window.location.href = `/overview.html?phone=${encodeURIComponent(data.existingPhone)}`;
    return false;
  }

  if (!response.ok) {
    phoneMessage.textContent = data.error || "Nao foi possivel criar a inscricao.";
    return false;
  }

  currentPlayerId = data.player.id;
  return true;
}

async function loadEvent() {
  if (!eventId) {
    window.location.href = "/";
    return;
  }

  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
  const data = await response.json();
  if (!response.ok) {
    window.location.href = "/";
    return;
  }

  selectedEvent = data.event;
  eventTitle.textContent = selectedEvent.title;
  eventMeta.textContent = `${formatDate(selectedEvent.date)} as ${selectedEvent.time} - ${selectedEvent.location} - ${money.format(selectedEvent.price)}`;
  positionSelect.innerHTML = [
    `<option value="">Selecione</option>`,
    ...positionsBySport[selectedEvent.sport].map((position) => `<option>${escapeHtml(position)}</option>`)
  ].join("");
}

detailsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  detailsMessage.textContent = "";
  formPayload = {
    eventId,
    ...Object.fromEntries(new FormData(detailsForm).entries())
  };

  if (!formPayload.name.trim().includes(" ")) {
    detailsMessage.textContent = "Informe nome e sobrenome.";
    return;
  }

  if (!formPayload.level) {
    detailsMessage.textContent = "Informe o nivel do jogador.";
    return;
  }

  setStep(2);
  preparePhoneConfirmation();
});

stepBackButton.addEventListener("click", goBackOneStep);

stepIndicatorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    goToStep(Number(button.dataset.stepIndicator));
  });
});

phoneConfirmForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  phoneMessage.textContent = "Salvando inscricao...";
  const created = await createRegistration();
  if (created) {
    window.location.href = `/overview.html?phone=${encodeURIComponent(cleanPhone(formPayload.phone))}`;
  }
});

loadEvent();
setStep(1);
