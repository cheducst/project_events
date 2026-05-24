const editForm = document.querySelector("#edit-event-form");
const editMessage = document.querySelector("#edit-event-message");
const params = new URLSearchParams(window.location.search);
const eventId = params.get("eventId");
const adminPassword = localStorage.getItem("rachaAdminPassword") || "";
let activeEditPriceField = "price";

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

function syncEditMoney(source = activeEditPriceField) {
  const capacity = Math.max(Number(editForm.elements.capacity.value) || 1, 1);
  if (source === "total") {
    editForm.elements.price.value = (moneyNumber(editForm.elements.totalPrice.value) / capacity).toFixed(2);
    activeEditPriceField = "total";
    return;
  }

  editForm.elements.totalPrice.value = (moneyNumber(editForm.elements.price.value) * capacity).toFixed(2);
  activeEditPriceField = "price";
}

function setForm(event) {
  editForm.elements.title.value = event.title || "";
  editForm.elements.organizerName.value = event.organizerName || "Administrador do racha";
  editForm.elements.organizerPhone.value = event.organizerPhone || "";
  editForm.elements.date.value = event.date || "";
  editForm.elements.time.value = event.time || "";
  editForm.elements.capacity.value = event.capacity || 1;
  editForm.elements.location.value = event.location || "";
  editForm.elements.price.value = event.price || 0;
  editForm.elements.totalPrice.value = ((Number(event.price || 0)) * (Number(event.capacity || 1))).toFixed(2);
  editForm.elements.pixKey.value = event.pixKey || "";
  editForm.elements.notes.value = event.notes || "";
  editForm.elements.requireProof.checked = Boolean(event.requireProof);
  const sportInput = editForm.querySelector(`input[name="sport"][value="${event.sport}"]`);
  if (sportInput) sportInput.checked = true;
}

async function loadEvent() {
  if (!eventId || !adminPassword) {
    window.location.href = "/admin.html";
    return;
  }

  const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
    headers: headers()
  });
  const data = await response.json();

  if (!response.ok) {
    editMessage.textContent = data.error || "Nao foi possivel carregar o racha.";
    return;
  }

  setForm(data.event);
}

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  editMessage.textContent = "Salvando...";

  const formData = new FormData(editForm);
  const payload = Object.fromEntries(formData.entries());
  payload.requireProof = formData.has("requireProof");
  delete payload.totalPrice;

  const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    editMessage.textContent = data.error || "Nao foi possivel salvar.";
    return;
  }

  editMessage.textContent = "Racha atualizado.";
});

editForm.elements.price.addEventListener("input", () => syncEditMoney("price"));
editForm.elements.totalPrice.addEventListener("input", () => syncEditMoney("total"));
editForm.elements.capacity.addEventListener("input", () => syncEditMoney(activeEditPriceField));

loadEvent();
