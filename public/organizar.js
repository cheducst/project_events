const organizerForm = document.querySelector("#organizer-form");
const organizerMessage = document.querySelector("#organizer-message");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

organizerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  organizerMessage.textContent = "Publicando racha...";

  const formData = new FormData(organizerForm);
  const payload = Object.fromEntries(formData.entries());
  payload.requireProof = formData.has("requireProof");

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

  const shareLink = eventShareLink(data.event.id);
  organizerMessage.innerHTML = `
    Racha criado.
    <a class="inline-success-link" href="/racha.html?eventId=${encodeURIComponent(data.event.id)}">Abrir pagina do racha</a>
    <button class="inline-copy-button" type="button" data-created-link="${escapeHtml(shareLink)}">Copiar link</button>
  `;
  organizerForm.reset();
});

organizerMessage.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-created-link]");
  if (!button) return;

  await copyText(button.dataset.createdLink);
  button.textContent = "Link copiado";
  window.setTimeout(() => {
    button.textContent = "Copiar link";
  }, 2200);
});
