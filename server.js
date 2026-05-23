const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DB_DIR, "db.json");
const PROOFS_DIR = path.join(DB_DIR, "proofs");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DEFAULT_PIX_KEY = "edcdesigner@hotmail.com";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_STATE_TABLE = process.env.SUPABASE_STATE_TABLE || "app_state";

const positionsBySport = {
  futebol: ["Goleiro", "Zagueiro", "Lateral", "Meia", "Atacante", "Coringa"],
  volei: ["Levantador", "Ponteiro", "Oposto", "Central", "Libero"]
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const initialDb = {
  events: [
    {
      id: "society-quinta",
      title: "Racha Society de Quinta",
      sport: "futebol",
      date: "2026-05-21",
      time: "20:30",
      location: "Arena Society",
      price: 25,
      capacity: 14,
      pixKey: DEFAULT_PIX_KEY,
      requireProof: true,
      notes: "Levar chuteira society. Times equilibrados antes do inicio."
    },
    {
      id: "volei-sabado",
      title: "Volei de Sabado",
      sport: "volei",
      date: "2026-05-23",
      time: "09:00",
      location: "Quadra de Areia Central",
      price: 15,
      capacity: 12,
      pixKey: DEFAULT_PIX_KEY,
      requireProof: true,
      notes: "Confirmar ate sexta-feira a noite."
    }
  ],
  players: []
};

function usingSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeDb(db) {
  let changed = false;
  const nextDb = {
    events: Array.isArray(db?.events) ? db.events : [],
    players: Array.isArray(db?.players) ? db.players : []
  };

  nextDb.events = nextDb.events.map((event) => {
    const upgraded = {
      ...event,
      pixKey: event.pixKey || DEFAULT_PIX_KEY,
      requireProof: typeof event.requireProof === "boolean" ? event.requireProof : true
    };
    changed = changed || upgraded.pixKey !== event.pixKey || upgraded.requireProof !== event.requireProof;
    return upgraded;
  });

  nextDb.players = nextDb.players.map((player) => {
    const level = Number(player.level);
    const upgraded = {
      ...player,
      proofName: player.proofName || "",
      proofData: player.proofData || "",
      proofMime: player.proofMime || "",
      proofSentAt: player.proofSentAt || "",
      phoneConfirmed: Boolean(player.phoneConfirmed || player.mfaVerified),
      paidIntentAt: player.paidIntentAt || "",
      level: Number.isInteger(level) && level >= 1 && level <= 5 ? level : 3
    };
    changed = changed || upgraded.proofName !== player.proofName || upgraded.proofData !== player.proofData || upgraded.proofMime !== player.proofMime || upgraded.proofSentAt !== player.proofSentAt || upgraded.level !== player.level;
    return upgraded;
  });

  return { db: nextDb, changed };
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || "Erro ao acessar Supabase.";
    throw new Error(message);
  }
  return data;
}

async function readSupabaseDb() {
  const rows = await supabaseRequest(`${SUPABASE_STATE_TABLE}?id=eq.main&select=data`);
  if (!rows.length) {
    await writeSupabaseDb(initialDb);
    return normalizeDb(initialDb).db;
  }

  const normalized = normalizeDb(rows[0].data);
  if (normalized.changed) await writeSupabaseDb(normalized.db);
  return normalized.db;
}

async function writeSupabaseDb(db) {
  const normalized = normalizeDb(db).db;
  await supabaseRequest(`${SUPABASE_STATE_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      id: "main",
      data: normalized,
      updated_at: new Date().toISOString()
    })
  });
}

async function ensureDb() {
  if (usingSupabase()) return;
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await writeDb(initialDb);
  }
}

async function readDb() {
  if (usingSupabase()) return readSupabaseDb();

  await ensureDb();
  const raw = await fs.readFile(DB_FILE, "utf8");
  const normalized = normalizeDb(JSON.parse(raw));

  if (normalized.changed) await writeDb(normalized.db);
  return normalized.db;
}

async function writeDb(db) {
  if (usingSupabase()) {
    await writeSupabaseDb(db);
    return;
  }

  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, `${JSON.stringify(normalizeDb(db).db, null, 2)}\n`, "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 2_500_000) {
        req.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
    req.on("error", reject);
  });
}

function isAdmin(req) {
  return req.headers["x-admin-password"] === ADMIN_PASSWORD;
}

function registrationPriority(player) {
  if (player.status === "confirmado") return 50;
  if (player.paid) return 40;
  if (player.proofName) return 30;
  if (player.status === "pendente") return 20;
  return 10;
}

function preferredRegistration(current, candidate) {
  if (!current) return candidate;
  const currentScore = registrationPriority(current);
  const candidateScore = registrationPriority(candidate);
  if (candidateScore !== currentScore) return candidateScore > currentScore ? candidate : current;

  const currentTime = new Date(current.createdAt || 0).getTime();
  const candidateTime = new Date(candidate.createdAt || 0).getTime();
  return candidateTime < currentTime ? candidate : current;
}

function uniqueEventPlayers(players, eventId) {
  const byPhone = new Map();
  players
    .filter((player) => player.eventId === eventId && player.status !== "excluido")
    .forEach((player) => {
      const key = cleanPhone(player.phone) || player.id;
      byPhone.set(key, preferredRegistration(byPhone.get(key), player));
    });
  return Array.from(byPhone.values()).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function publicEvent(event, players) {
  const activePlayers = uniqueEventPlayers(players, event.id);
  const confirmed = activePlayers.filter((player) => player.status === "confirmado").length;
  const registrationLimit = Number(event.capacity) * 2;
  return {
    ...event,
    registered: activePlayers.length,
    confirmed,
    available: Math.max(event.capacity - confirmed, 0),
    registrationLimit,
    registrationAvailable: Math.max(registrationLimit - activePlayers.length, 0),
    teams: Array.isArray(event.teams) ? event.teams : [],
    players: activePlayers.map(({ id, name, position, status, paid, level }) => ({ id, name, position, status, paid, level: normalizeLevel(level) }))
  };
}

function recomputeEventConfirmations(db, event) {
  if (!event) return;

  const players = db.players
    .filter((player) => {
      if (player.eventId !== event.id || player.status === "excluido") return false;
      return player.paid || player.proofName || ["pendente", "confirmado"].includes(player.status);
    })
    .sort((a, b) => {
      const aTime = new Date(a.paidIntentAt || a.proofSentAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.paidIntentAt || b.proofSentAt || b.createdAt || 0).getTime();
      return aTime - bTime;
    });

  let confirmedSlots = 0;
  for (const player of players) {
    if (!player.paid) {
      player.status = "pendente";
      continue;
    }

    if (confirmedSlots < Number(event.capacity)) {
      player.status = "confirmado";
      confirmedSlots += 1;
    } else {
      player.status = "pendente";
    }
  }
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    phone: player.phone,
    position: player.position,
    note: player.note || "",
    status: player.status,
    paid: player.paid,
    proofName: player.proofName,
    proofSentAt: player.proofSentAt,
    paidIntentAt: player.paidIntentAt,
    createdAt: player.createdAt,
    level: normalizeLevel(player.level)
  };
}

function normalizeLevel(value) {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 1 || level > 5) return 3;
  return level;
}

function validatePlayer(payload, event) {
  const name = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const position = String(payload.position || "").trim();

  if (name.length < 3) return "Informe um nome com pelo menos 3 letras.";
  if (phone.length < 8) return "Informe um telefone valido.";
  if (!position) return "Informe a posicao em que costuma jogar.";
  if (payload.level !== undefined) {
    const level = Number(payload.level);
    if (!Number.isInteger(level) || level < 1 || level > 5) return "Informe o nivel do jogador de 1 a 5 estrelas.";
  }
  if (!event) return "Racha nao encontrado.";
  if (!positionsBySport[event.sport]?.includes(position)) return "Escolha uma posicao valida para este tipo de racha.";

  return null;
}

function proofExtension(proofName, mime) {
  const byMime = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp"
  };
  const nameExt = path.extname(String(proofName || "")).toLowerCase();
  if ([".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(nameExt)) return nameExt;
  return byMime[mime] || ".bin";
}

async function saveProofFile(playerId, proofName, proofData) {
  const match = String(proofData || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { proofData, proofMime: "" };

  let mime = match[1];
  const base64 = match[2];
  const nameExt = path.extname(String(proofName || "")).toLowerCase();
  const mimeByExt = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };
  if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(mime) && mimeByExt[nameExt]) {
    mime = mimeByExt[nameExt];
  }
  if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(mime)) {
    throw new Error("Envie um PDF ou imagem do comprovante.");
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > 1_200_000) {
    throw new Error("Comprovante muito grande. Envie um PDF ou imagem ate 1,2 MB.");
  }

  await fs.mkdir(PROOFS_DIR, { recursive: true });
  const filename = `${playerId}${proofExtension(proofName, mime)}`;
  await fs.writeFile(path.join(PROOFS_DIR, filename), buffer);
  return {
    proofData: `/proofs/${filename}`,
    proofMime: mime
  };
}

function eventPayloadFrom(payload, existingEvent = {}) {
  const title = String(payload.title ?? existingEvent.title ?? "").trim();
  const sport = String(payload.sport ?? existingEvent.sport ?? "").trim();
  const date = String(payload.date ?? existingEvent.date ?? "").trim();
  const time = String(payload.time ?? existingEvent.time ?? "").trim();
  const location = String(payload.location ?? existingEvent.location ?? "").trim();
  const capacity = Number(payload.capacity ?? existingEvent.capacity);
  const price = Number(payload.price ?? existingEvent.price);
  const pixKey = String(payload.pixKey ?? existingEvent.pixKey ?? DEFAULT_PIX_KEY).trim();
  const organizerName = String(payload.organizerName ?? existingEvent.organizerName ?? "Administrador do racha").trim();
  const organizerPhone = String(payload.organizerPhone ?? existingEvent.organizerPhone ?? "").trim();
  const requireProof = typeof payload.requireProof === "boolean" ? payload.requireProof : Boolean(existingEvent.requireProof);

  return {
    title,
    sport,
    date,
    time,
    location,
    capacity,
    price: Number.isFinite(price) ? price : 0,
    pixKey,
    organizerName,
    organizerPhone,
    requireProof,
    notes: String(payload.notes ?? existingEvent.notes ?? "").trim()
  };
}

function validateEventPayload(event) {
  if (!event.title || !event.sport || !event.date || !event.time || !event.location || !event.capacity) {
    return "Preencha titulo, esporte, data, horario, local e vagas.";
  }
  if (!["futebol", "volei"].includes(event.sport)) return "Escolha futebol ou volei.";
  if (!event.pixKey) return "Informe a chave Pix do administrador.";
  if (!event.organizerName) return "Informe o nome do organizador.";
  if (event.capacity < 1) return "Informe pelo menos uma vaga.";
  return null;
}

function cleanPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
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

async function handleApi(req, res, pathname) {
  const db = await readDb();

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "racha-ai",
      database: usingSupabase() ? "supabase" : "local",
      phoneConfirmation: "simple",
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "GET" && pathname === "/api/events") {
    return sendJson(res, 200, {
      events: db.events.map((event) => publicEvent(event, db.players))
    });
  }

  if (req.method === "POST" && pathname === "/api/events") {
    const payload = await parseBody(req);
    const eventData = eventPayloadFrom({ ...payload, requireProof: Boolean(payload.requireProof) });
    const validationError = validateEventPayload(eventData);
    if (validationError) return sendJson(res, 400, { error: validationError });

    const event = {
      id: `${eventData.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`,
      ...eventData,
      createdAt: new Date().toISOString()
    };

    db.events.push(event);
    await writeDb(db);
    return sendJson(res, 201, { event });
  }

  if (req.method === "GET" && pathname.startsWith("/api/events/")) {
    const eventId = decodeURIComponent(pathname.split("/")[3] || "");
    const event = db.events.find((item) => item.id === eventId);
    if (!event) return sendJson(res, 404, { error: "Racha nao encontrado." });

    const players = db.players
      .filter((player) => player.eventId === eventId && player.status !== "excluido")
      .map(({ id, name, position, status, paid, level }) => ({ id, name, position, status, paid, level: normalizeLevel(level) }));

    return sendJson(res, 200, { event: publicEvent(event, db.players), players });
  }

  if (req.method === "GET" && pathname === "/api/registrations/overview") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const phone = cleanPhone(url.searchParams.get("phone"));
    if (phone.length < 8) return sendJson(res, 400, { error: "Informe um telefone valido." });

    const byEvent = new Map();
    db.players
      .filter((player) => cleanPhone(player.phone) === phone && player.status !== "excluido")
      .forEach((player) => {
        byEvent.set(player.eventId, preferredRegistration(byEvent.get(player.eventId), player));
      });

    const registrations = Array.from(byEvent.values())
      .map((player) => {
        const event = db.events.find((item) => item.id === player.eventId);
        return {
          player: publicPlayer(player),
          event: event ? publicEvent(event, db.players) : null
        };
      })
      .filter((item) => item.event);

    return sendJson(res, 200, { registrations });
  }

  if (req.method === "POST" && pathname === "/api/registrations") {
    const payload = await parseBody(req);
    const event = db.events.find((item) => item.id === payload.eventId);
    const validationError = validatePlayer(payload, event);
    if (validationError) return sendJson(res, 400, { error: validationError });
    if (!payload.confirmPhone) return sendJson(res, 403, { error: "Confirme o telefone antes de avancar." });

    const phoneDigits = cleanPhone(payload.phone);
    const duplicate = db.players.find((item) => item.status !== "excluido" && cleanPhone(item.phone) === phoneDigits);
    if (duplicate) {
      return sendJson(res, 409, {
        error: "Este telefone ja possui uma inscricao. Acesse sua situacao pela Home.",
        existingPhone: phoneDigits
      });
    }

    const player = {
      id: crypto.randomUUID(),
      eventId: event.id,
      name: String(payload.name).trim(),
      phone: String(payload.phone).trim(),
      position: String(payload.position).trim(),
      level: normalizeLevel(payload.level),
      note: String(payload.note || "").trim(),
      status: "aguardando_pagamento",
      paid: false,
      proofName: "",
      proofData: "",
      proofSentAt: "",
      phoneConfirmed: true,
      paidIntentAt: "",
      createdAt: new Date().toISOString()
    };

    db.players.push(player);
    await writeDb(db);
    return sendJson(res, 201, {
      player,
      payment: {
        amount: event.price,
        pixKey: event.pixKey || DEFAULT_PIX_KEY,
        requireProof: event.requireProof,
        eventTitle: event.title
      }
    });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/registrations/") && !pathname.endsWith("/proof")) {
    const playerId = decodeURIComponent(pathname.split("/")[3] || "");
    const player = db.players.find((item) => item.id === playerId);
    if (!player) return sendJson(res, 404, { error: "Inscricao nao encontrada." });
    if (player.status !== "aguardando_pagamento") {
      return sendJson(res, 409, { error: "Esta inscricao ja foi enviada para validacao." });
    }

    const payload = await parseBody(req);
    const event = db.events.find((item) => item.id === player.eventId);
    const validationError = validatePlayer({ ...payload, eventId: player.eventId }, event);
    if (validationError) return sendJson(res, 400, { error: validationError });
    if (!payload.confirmPhone) return sendJson(res, 403, { error: "Confirme o telefone antes de atualizar." });

    const phoneDigits = cleanPhone(payload.phone);
    const duplicate = db.players.find((item) => item.id !== player.id && item.status !== "excluido" && cleanPhone(item.phone) === phoneDigits);
    if (duplicate) {
      return sendJson(res, 409, {
        error: "Este telefone ja possui uma inscricao. Acesse sua situacao pela Home.",
        existingPhone: phoneDigits
      });
    }

    player.name = String(payload.name).trim();
    player.phone = String(payload.phone).trim();
    player.position = String(payload.position).trim();
    player.level = normalizeLevel(payload.level);
    player.note = String(payload.note || "").trim();
    await writeDb(db);
    return sendJson(res, 200, {
      player,
      payment: {
        amount: event.price,
        pixKey: event.pixKey || DEFAULT_PIX_KEY,
        requireProof: event.requireProof,
        eventTitle: event.title
      }
    });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/registrations/") && pathname.endsWith("/proof")) {
    const playerId = decodeURIComponent(pathname.split("/")[3] || "");
    const player = db.players.find((item) => item.id === playerId);
    if (!player) return sendJson(res, 404, { error: "Inscricao nao encontrada." });
    const event = db.events.find((item) => item.id === player.eventId);
    if (!event) return sendJson(res, 404, { error: "Racha nao encontrado." });
    if (paymentWindowClosed(event)) {
      return sendJson(res, 403, { error: "Prazo encerrado para envio de comprovante." });
    }

    const payload = await parseBody(req);
    const proofName = String(payload.proofName || "").trim();
    const proofData = String(payload.proofData || "").trim();

    if (!proofName || !proofData) return sendJson(res, 400, { error: "Anexe o comprovante antes de enviar." });
    if (proofData.length > 1_800_000) return sendJson(res, 413, { error: "Comprovante muito grande. Envie um PDF ou imagem ate 1,2 MB." });

    let savedProof;
    try {
      savedProof = await saveProofFile(player.id, proofName, proofData);
    } catch (error) {
      return sendJson(res, 413, { error: error.message || "Nao foi possivel salvar o comprovante." });
    }
    player.proofName = proofName;
    player.proofData = savedProof.proofData;
    player.proofMime = savedProof.proofMime;
    player.proofSentAt = new Date().toISOString();
    player.paid = false;
    player.status = "pendente";
    await writeDb(db);
    return sendJson(res, 200, { player });
  }

  if (pathname.startsWith("/api/admin") && !isAdmin(req)) {
    return sendJson(res, 401, { error: "Senha de admin invalida." });
  }

  if (req.method === "GET" && pathname === "/api/admin/summary") {
    return sendJson(res, 200, {
      events: db.events.map((event) => ({
        ...publicEvent(event, db.players),
        players: db.players
          .filter((player) => player.eventId === event.id && player.status !== "excluido")
          .map((player) => ({ ...player, level: normalizeLevel(player.level) }))
      }))
    });
  }

  if (pathname.startsWith("/api/admin/events/")) {
    const eventId = decodeURIComponent(pathname.split("/")[4] || "");
    const event = db.events.find((item) => item.id === eventId);
    if (!event) return sendJson(res, 404, { error: "Racha nao encontrado." });

    if (req.method === "GET") {
      return sendJson(res, 200, { event });
    }

    if (req.method === "PATCH") {
      const payload = await parseBody(req);
      const updatedEvent = eventPayloadFrom(payload, event);
      const validationError = validateEventPayload(updatedEvent);
      if (validationError) return sendJson(res, 400, { error: validationError });

      const nextTeams = Array.isArray(payload.teams) ? payload.teams : event.teams;
      Object.assign(event, updatedEvent);
      if (Array.isArray(nextTeams)) {
        event.teams = nextTeams.map((team, index) => ({
          name: String(team.name || `Time ${index + 1}`).trim(),
          players: Array.isArray(team.players) ? team.players.map((id) => String(id)) : []
        }));
      }
      await writeDb(db);
      return sendJson(res, 200, { event });
    }

    if (req.method === "DELETE") {
      db.events = db.events.filter((item) => item.id !== eventId);
      db.players = db.players.filter((player) => player.eventId !== eventId);
      await writeDb(db);
      return sendJson(res, 200, { ok: true });
    }
  }

  if (req.method === "POST" && pathname === "/api/admin/events") {
    const payload = await parseBody(req);
    const eventData = eventPayloadFrom({ ...payload, requireProof: Boolean(payload.requireProof) });
    const validationError = validateEventPayload(eventData);
    if (validationError) return sendJson(res, 400, { error: validationError });

    const event = {
      id: `${eventData.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`,
      ...eventData,
      createdAt: new Date().toISOString()
    };

    db.events.push(event);
    await writeDb(db);
    return sendJson(res, 201, { event });
  }

  if (req.method === "POST" && pathname === "/api/admin/players") {
    const payload = await parseBody(req);
    const event = db.events.find((item) => item.id === payload.eventId);
    const validationError = validatePlayer(payload, event);
    if (validationError) return sendJson(res, 400, { error: validationError });

    const phoneDigits = cleanPhone(payload.phone);
    const duplicate = db.players.find((item) => item.status !== "excluido" && cleanPhone(item.phone) === phoneDigits);
    if (duplicate) {
      return sendJson(res, 409, { error: "Este telefone ja possui uma inscricao." });
    }

    const confirmedByAdmin = Boolean(payload.confirmed);
    const player = {
      id: crypto.randomUUID(),
      eventId: event.id,
      name: String(payload.name).trim(),
      phone: String(payload.phone).trim(),
      position: String(payload.position).trim(),
      level: normalizeLevel(payload.level),
      note: String(payload.note || "").trim(),
      status: confirmedByAdmin ? "confirmado" : "aguardando_pagamento",
      paid: confirmedByAdmin,
      proofName: "",
      proofData: "",
      proofMime: "",
      proofSentAt: "",
      phoneConfirmed: true,
      paidIntentAt: confirmedByAdmin ? new Date(0).toISOString() : "",
      createdAt: new Date().toISOString()
    };

    db.players.push(player);
    recomputeEventConfirmations(db, event);
    await writeDb(db);
    return sendJson(res, 201, { player });
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/admin/players/")) {
    const playerId = decodeURIComponent(pathname.split("/")[4] || "");
    const player = db.players.find((item) => item.id === playerId);
    if (!player) return sendJson(res, 404, { error: "Jogador nao encontrado." });

    const payload = await parseBody(req);
    if (typeof payload.name === "string") player.name = String(payload.name).trim();
    if (typeof payload.phone === "string") player.phone = String(payload.phone).trim();
    if (typeof payload.position === "string") player.position = String(payload.position).trim();
    if (payload.level !== undefined) player.level = normalizeLevel(payload.level);
    if (typeof payload.note === "string") player.note = String(payload.note).trim();
    if (payload.status && ["aguardando_pagamento", "pendente", "confirmado", "excluido"].includes(payload.status)) {
      player.status = payload.status;
    }
    if (typeof payload.confirmed === "boolean") {
      if (payload.confirmed) {
        player.paid = true;
        player.status = "confirmado";
        player.paidIntentAt = new Date(0).toISOString();
      } else {
        player.paid = false;
        player.status = player.proofName ? "pendente" : "aguardando_pagamento";
        player.paidIntentAt = "";
      }
    }
    if (typeof payload.paid === "boolean") {
      player.paid = payload.paid;
      if (payload.paid) player.paidIntentAt = player.paidIntentAt || new Date().toISOString();
    }
    const event = db.events.find((item) => item.id === player.eventId);
    recomputeEventConfirmations(db, event);

    await writeDb(db);
    return sendJson(res, 200, { player });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/players/")) {
    const playerId = decodeURIComponent(pathname.split("/")[4] || "");
    const existingCount = db.players.length;
    db.players = db.players.filter((item) => item.id !== playerId);
    if (db.players.length === existingCount) return sendJson(res, 404, { error: "Jogador nao encontrado." });

    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Rota nao encontrada." });
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Acesso negado.");
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>Pagina nao encontrada</h1>");
  }
}

async function serveProof(req, res, pathname) {
  const safeName = path.basename(decodeURIComponent(pathname.replace("/proofs/", "")));
  const filePath = path.normalize(path.join(PROOFS_DIR, safeName));

  if (!filePath.startsWith(PROOFS_DIR)) {
    res.writeHead(403);
    return res.end("Acesso negado.");
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Comprovante nao encontrado.");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
    } else if (url.pathname.startsWith("/proofs/")) {
      await serveProof(req, res, url.pathname);
    } else {
      await serveStatic(req, res, url.pathname);
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erro interno." });
  }
});

server.listen(PORT, () => {
  console.log(`App rodando em http://localhost:${PORT}`);
  console.log(`Senha admin padrao: ${ADMIN_PASSWORD}`);
});
