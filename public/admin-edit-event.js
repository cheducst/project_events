const editForm = document.querySelector("#edit-event-form");
const editMessage = document.querySelector("#edit-event-message");
const params = new URLSearchParams(window.location.search);
const eventId = params.get("eventId");
const adminPassword = localStorage.getItem("rachaAdminPassword") || "";

function headers() {
  return {
    "Content-Type": "application/json",
    "x-admin-password": adminPassword
  };
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
  editForm.elements.pixKey.value = event.pixKey || "edcdesigner@hotmail.com";
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

loadEvent();
