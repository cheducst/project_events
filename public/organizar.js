const organizerForm = document.querySelector("#organizer-form");
const organizerMessage = document.querySelector("#organizer-message");
const organizerSteps = document.querySelectorAll("[data-organizer-step]");
const organizerNextButton = document.querySelector("#organizer-next-button");
const organizerPrevButton = document.querySelector("#organizer-prev-button");
const capacityInput = organizerForm.elements.capacity;
const priceInput = organizerForm.elements.price;
const totalPriceInput = organizerForm.elements.totalPrice;
const passwordRules = document.querySelector("#password-rules");

let activePriceField = "price";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setOrganizerStep(step) {
  organizerSteps.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.organizerStep !== String(step));
  });
}

function moneyNumber(value) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function syncMoneyFields(source) {
  const capacity = Math.max(Number(capacityInput.value) || 1, 1);
  if (source === "total") {
    const total = moneyNumber(totalPriceInput.value);
    priceInput.value = (total / capacity).toFixed(2);
    activePriceField = "total";
    return;
  }

  const price = moneyNumber(priceInput.value);
  totalPriceInput.value = (price * capacity).toFixed(2);
  activePriceField = "price";
}

function validateFirstStep() {
  const requiredFields = ["title", "organizerName", "organizerPhone", "date", "time", "capacity", "location", "pixKey"];
  for (const fieldName of requiredFields) {
    const field = organizerForm.elements[fieldName];
    if (!field?.value?.trim()) {
      organizerMessage.textContent = "Preencha todos os campos obrigatorios antes de continuar.";
      field?.focus();
      return false;
    }
  }
  organizerMessage.textContent = "";
  return true;
}

function localPasswordFeedback(payload) {
  const missing = passwordRequirements(payload);
  return missing[0] || "";
}

function passwordRequirements(payload) {
  const password = String(payload.password || "");
  const lowered = password.toLowerCase();
  const phone = String(payload.organizerPhone || "").replace(/\D/g, "");
  const blocked = [payload.organizerName, payload.title]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => value.length >= 3);
  const requirements = [
    [password.length >= 8, "Minimo 8 caracteres"],
    [/[A-Z]/.test(password), "1 letra maiuscula"],
    [/[a-z]/.test(password), "1 letra minuscula"],
    [/\d/.test(password), "1 numero"],
    [/[^A-Za-z0-9]/.test(password), "1 caractere especial"],
    [!(phone && password.replace(/\D/g, "") === phone) && !blocked.some((item) => lowered.includes(item)), "Nao pode conter telefone, nome do organizador ou nome do evento"],
    [password === String(payload.confirmPassword || ""), "Senha e confirmacao iguais"]
  ];
  return requirements.filter(([ok]) => !ok).map(([, message]) => message);
}

function updatePasswordRules() {
  const payload = Object.fromEntries(new FormData(organizerForm).entries());
  const missing = passwordRequirements(payload);
  passwordRules.classList.toggle("is-complete", missing.length === 0);
  passwordRules.querySelector("strong").textContent = missing.length ? "Requisitos pendentes" : "Senha segura";
  passwordRules.querySelector("ul").innerHTML = missing.length
    ? missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Tudo certo para publicar.</li>";
}

priceInput.addEventListener("input", () => syncMoneyFields("price"));
totalPriceInput.addEventListener("input", () => syncMoneyFields("total"));
capacityInput.addEventListener("input", () => syncMoneyFields(activePriceField));

organizerNextButton.addEventListener("click", () => {
  if (!validateFirstStep()) return;
  setOrganizerStep(2);
});

organizerPrevButton.addEventListener("click", () => {
  organizerMessage.textContent = "";
  setOrganizerStep(1);
});

["password", "confirmPassword", "organizerName", "organizerPhone", "title"].forEach((name) => {
  organizerForm.elements[name].addEventListener("input", updatePasswordRules);
});

organizerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  organizerMessage.textContent = "Publicando racha...";

  const formData = new FormData(organizerForm);
  const payload = Object.fromEntries(formData.entries());
  payload.requireProof = formData.has("requireProof");
  delete payload.totalPrice;

  const passwordError = localPasswordFeedback(payload);
  if (passwordError) {
    organizerMessage.textContent = passwordError;
    return;
  }

  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    organizerMessage.textContent = data.error || "Nao foi possivel criar o racha.";
    return;
  }

  organizerMessage.textContent = "Racha criado. Abrindo painel...";
  window.location.href = data.organizerPanelUrl || `/painel-organizador.html?eventId=${encodeURIComponent(data.event.id)}`;
});

syncMoneyFields("price");
setOrganizerStep(1);
updatePasswordRules();
