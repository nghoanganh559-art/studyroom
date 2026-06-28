const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

const port = Number(process.env.PORT || 5501);
const httpsPort = Number(process.env.HTTPS_PORT || 5443);
const root = __dirname;
const httpsPfxPath = process.env.HTTPS_PFX || path.join(root, "certs", "meet-rooms.pfx");
const httpsPfxPassphrase = process.env.HTTPS_PFX_PASSPHRASE || "meet-rooms-dev";
const rooms = new Map();
let signalSeq = 0;
const signals = [];
const participantTtlMs = 15_000;
const assetRoot = path.join(root, "assets");
const avatarExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getActiveBan(room, clientId) {
  if (!clientId || !room.bans) return null;
  const ban = room.bans.get(clientId);
  if (!ban) return null;
  if (ban.until && ban.until <= Date.now()) {
    room.bans.delete(clientId);
    return null;
  }
  return ban;
}

function getPublicBanStatus(room, clientId) {
  const ban = getActiveBan(room, clientId);
  if (!ban) return null;
  const remainingSeconds = ban.until ? Math.max(0, Math.ceil((ban.until - Date.now()) / 1000)) : null;
  return {
    permanent: !ban.until,
    until: ban.until,
    remainingSeconds,
    remainingMinutes: remainingSeconds ? Math.max(1, Math.ceil(remainingSeconds / 60)) : null,
    message: formatBanMessage(ban),
  };
}

function publicRoom(room, clientId = "") {
  const result = {
    id: room.id,
    name: room.name,
    ownerId: room.ownerId,
    hasPassword: Boolean(room.password),
    createdAt: room.createdAt,
    participants: [...room.participants.values()].map(({ lastSeen, clientId, ...participant }) => participant),
  };
  const ban = getPublicBanStatus(room, clientId);
  if (ban) result.ban = ban;
  return result;
}

function getAvatarOptions() {
  try {
    return fs
      .readdirSync(assetRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => avatarExtensions.has(path.extname(fileName).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "vi-VN"))
      .map((fileName) => {
        const id = path.basename(fileName, path.extname(fileName));
        return {
          id,
          name: id
            .replace(/^avatar[-_]?/i, "")
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase()),
          src: `assets/${fileName}`,
        };
      });
  } catch {
    return [];
  }
}

function safeAvatar(value) {
  const avatar = String(value || "").trim();
  const options = getAvatarOptions();
  return options.some((option) => option.id === avatar) ? avatar : options[0]?.id || "";
}

function removeParticipant(room, participantId, options = {}) {
  if (!room.participants.has(participantId)) return;

  room.participants.delete(participantId);
  addSignal(room.id, participantId, "*", "leave", {});

  if (!room.participants.size) {
    if (!options.keepRoom) rooms.delete(room.id);
    return;
  }

  if (room.ownerId === participantId) {
    const remainingParticipants = [...room.participants.values()];
    room.ownerId = remainingParticipants[remainingParticipants.length - 1].id;
  }
}

function cleanupStaleParticipants() {
  const now = Date.now();
  [...rooms.values()].forEach((room) => {
    if (room.bans) {
      [...room.bans.entries()].forEach(([bannedClientId, ban]) => {
        if (ban.until && ban.until <= now) room.bans.delete(bannedClientId);
      });
    }
    [...room.participants.values()].forEach((participant) => {
      const lastSeen = participant.lastSeen || Date.parse(participant.joinedAt) || 0;
      if (now - lastSeen > participantTtlMs) {
        removeParticipant(room, participant.id);
      }
    });
  });
}

function formatBanMessage(ban) {
  if (!ban) return "";
  if (!ban.until) return "Không thể vào phòng. Bạn đã được mời khỏi phòng vĩnh viễn.";
  const remainingSeconds = Math.max(0, Math.ceil((ban.until - Date.now()) / 1000));
  return `Không thể vào phòng. Hãy thử lại sau ${formatRemainingTime(remainingSeconds)}.`;
}

function formatRemainingTime(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = seconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours} tiếng`);
  if (minutes) parts.push(`${minutes} phút`);
  if (restSeconds || !parts.length) parts.push(`${restSeconds} giây`);
  return parts.join(" ");
}

function removeParticipantByClient(room, clientId, options = {}) {
  if (!clientId) return;

  [...room.participants.values()].forEach((participant) => {
    if (participant.clientId === clientId) {
      removeParticipant(room, participant.id, options);
    }
  });
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addSignal(roomId, from, to, type, payload) {
  signals.push({ seq: ++signalSeq, roomId, from, to, type, payload });
  if (signals.length > 2000) signals.splice(0, signals.length - 2000);
}

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function getIceServers() {
  const iceServers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turnUrls = String(process.env.TURN_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (turnUrls.length) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME || "",
      credential: process.env.TURN_CREDENTIAL || "",
    });
  }

  return iceServers;
}

async function handleApi(request, response, url) {
  try {
    if (request.method === "GET" && url.pathname === "/api/config") {
      sendJson(response, 200, { iceServers: getIceServers() });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/avatars") {
      sendJson(response, 200, { avatars: getAvatarOptions() });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/rooms") {
      cleanupStaleParticipants();
      const requestClientId = String(url.searchParams.get("clientId") || "");
      sendJson(response, 200, { rooms: [...rooms.values()].map((room) => publicRoom(room, requestClientId)) });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      cleanupStaleParticipants();
      const body = await readBody(request);
      const name = String(body.name || "").trim();
      const password = String(body.password || "");
      const userName = String(body.userName || "").trim() || "Khach";
      const clientId = String(body.clientId || "");
      const avatar = safeAvatar(body.avatar);

      if (!name) {
        sendJson(response, 400, { error: "Ten phong khong duoc de trong." });
        return true;
      }

      if (password && password.length < 3) {
        sendJson(response, 400, { error: "Mat khau toi thieu 3 ky tu hoac bo trong." });
        return true;
      }

      const nameExists = [...rooms.values()].some(
        (room) => room.name.toLocaleLowerCase("vi-VN") === name.toLocaleLowerCase("vi-VN"),
      );
      if (nameExists) {
        sendJson(response, 409, { error: "Ten phong da ton tai." });
        return true;
      }

      const now = Date.now();
      const participant = {
        id: createId("user"),
        name: userName,
        avatar,
        clientId,
        joinedAt: new Date(now).toISOString(),
        lastSeen: now,
      };
      const room = {
        id: createId("room"),
        name,
        ownerId: participant.id,
        password,
        createdAt: new Date().toISOString(),
        participants: new Map([[participant.id, participant]]),
        bans: new Map(),
      };

      rooms.set(room.id, room);
      sendJson(response, 200, { room: publicRoom(room), participant });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/join") {
      cleanupStaleParticipants();
      const body = await readBody(request);
      const room = rooms.get(String(body.roomId || ""));
      const userName = String(body.userName || "").trim() || "Khach";
      const clientId = String(body.clientId || "");
      const avatar = safeAvatar(body.avatar);

      if (!room) {
        sendJson(response, 404, { error: "Phòng không tồn tại." });
        return true;
      }

      if (String(body.password || "") !== room.password) {
        sendJson(response, 403, { error: "Mật khẩu phòng chưa đúng." });
        return true;
      }

      const ban = getActiveBan(room, clientId);
      if (ban) {
        sendJson(response, 403, { error: formatBanMessage(ban), ban: getPublicBanStatus(room, clientId) });
        return true;
      }

      const now = Date.now();
      const wasOwner = [...room.participants.values()].some(
        (participant) => participant.clientId === clientId && participant.id === room.ownerId,
      );
      removeParticipantByClient(room, clientId, { keepRoom: true });
      const participant = {
        id: createId("user"),
        name: userName,
        avatar,
        clientId,
        joinedAt: new Date(now).toISOString(),
        lastSeen: now,
      };
      room.participants.set(participant.id, participant);
      if (wasOwner || !room.participants.has(room.ownerId)) {
        room.ownerId = participant.id;
      }
      rooms.set(room.id, room);
      sendJson(response, 200, { room: publicRoom(room), participant });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/heartbeat") {
      const body = await readBody(request);
      const room = rooms.get(String(body.roomId || ""));
      const participant = room?.participants.get(String(body.participantId || ""));

      if (!room || !participant) {
        sendJson(response, 404, { error: "Phòng hoặc người tham gia không còn tồn tại." });
        return true;
      }

      participant.lastSeen = Date.now();
      participant.clientId = String(body.clientId || participant.clientId || "");
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/leave") {
      const body = await readBody(request);
      const room = rooms.get(String(body.roomId || ""));
      const participantId = String(body.participantId || "");

      if (room) {
        removeParticipant(room, participantId);
      }

      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/kick") {
      const body = await readBody(request);
      const room = rooms.get(String(body.roomId || ""));
      const ownerId = String(body.ownerId || "");
      const targetId = String(body.targetId || "");
      const mode = String(body.mode || "temporary");
      const minutes = Number(body.minutes || 0);

      if (!room) {
        sendJson(response, 404, { error: "Phòng không tồn tại." });
        return true;
      }

      if (room.ownerId !== ownerId) {
        sendJson(response, 403, { error: "Chỉ chủ phòng mới được mời người khác khỏi phòng." });
        return true;
      }

      if (!targetId || targetId === ownerId || !room.participants.has(targetId)) {
        sendJson(response, 400, { error: "Không thể mời người này khỏi phòng." });
        return true;
      }

      const target = room.participants.get(targetId);
      if (target.clientId) {
        if (!room.bans) room.bans = new Map();
        const permanent = mode === "permanent";
        const durationMinutes = Math.max(1, Math.min(1440, Math.round(minutes || 1)));
        room.bans.set(target.clientId, {
          until: permanent ? null : Date.now() + durationMinutes * 60_000,
          reason: permanent ? "permanent" : `${durationMinutes} minutes`,
          createdAt: Date.now(),
        });
      }

      addSignal(room.id, ownerId, targetId, "kicked", {
        message:
          mode === "permanent"
            ? "Bạn đã được mời khỏi phòng vĩnh viễn."
            : `Bạn đã được mời khỏi phòng trong ${Math.max(1, Math.round(minutes || 1))} phút.`,
      });
      removeParticipant(room, targetId, { keepRoom: true });
      sendJson(response, 200, { room: publicRoom(room) });
      return true;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/rooms/")) {
      const roomId = url.pathname.split("/").pop();
      const room = rooms.get(roomId);
      const ownerId = String(url.searchParams.get("ownerId") || "");

      if (!room) {
        sendJson(response, 404, { error: "Phong khong ton tai." });
        return true;
      }

      if (room.ownerId !== ownerId) {
        sendJson(response, 403, { error: "Chi nguoi tao phong moi duoc xoa phong nay." });
        return true;
      }

      rooms.delete(roomId);
      addSignal(roomId, "server", "*", "room-deleted", {});
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/rooms/")) {
      cleanupStaleParticipants();
      const roomId = url.pathname.split("/").pop();
      const room = rooms.get(roomId);
      if (!room) {
        sendJson(response, 404, { error: "Phòng không tồn tại." });
        return true;
      }
      const requestClientId = String(url.searchParams.get("clientId") || "");
      sendJson(response, 200, { room: publicRoom(room, requestClientId) });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/signal") {
      const body = await readBody(request);
      const roomId = String(body.roomId);
      const from = String(body.from);
      const type = String(body.type);
      let payload = body.payload;
      const room = rooms.get(roomId);

      if (!room || !room.participants.has(from)) {
        sendJson(response, 404, { error: "Phòng hoặc người gửi không tồn tại." });
        return true;
      }

      if (type === "force-mute") {
        const targetId = String(body.to || "");
        if (room.ownerId !== from) {
          sendJson(response, 403, { error: "Chỉ chủ phòng mới được tắt mic người khác." });
          return true;
        }
        if (!targetId || targetId === from || !room.participants.has(targetId)) {
          sendJson(response, 400, { error: "Không thể tắt mic người này." });
          return true;
        }
      }

      if (type === "chat") {
        const participant = room.participants.get(from);
        payload = {
          ...(payload || {}),
          name: participant?.name || payload?.name || "Khách",
          avatar: participant?.avatar || payload?.avatar || "",
        };
      }

      addSignal(roomId, from, String(body.to), type, payload);
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/signals") {
      const roomId = String(url.searchParams.get("roomId") || "");
      const participantId = String(url.searchParams.get("participantId") || "");
      const since = Number(url.searchParams.get("since") || 0);
      const items = signals.filter(
        (signal) =>
          signal.seq > since &&
          signal.roomId === roomId &&
          signal.from !== participantId &&
          (signal.to === participantId || signal.to === "*"),
      );
      sendJson(response, 200, { signals: items, latestSeq: signalSeq });
      return true;
    }
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
    return true;
  }

  return false;
}

function serveStatic(request, response, url) {
  const pathname = decodeURIComponent(url.pathname);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const requested = safePath === path.sep ? "index.html" : safePath.replace(/^[/\\]/, "");
  const filePath = path.join(root, requested);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
}

const requestHandler = async (request, response) => {
  const protocol = request.socket.encrypted ? "https" : "http";
  const url = new URL(request.url, `${protocol}://${request.headers.host}`);
  if (url.pathname.startsWith("/api/") && (await handleApi(request, response, url))) return;
  serveStatic(request, response, url);
};

const server = http.createServer(requestHandler);

server.listen(port, "0.0.0.0", () => {
  console.log(`Meet Rooms running at http://127.0.0.1:${port}`);
  getLanAddresses().forEach((address) => console.log(`LAN: http://${address}:${port}`));
});

if (fs.existsSync(httpsPfxPath)) {
  const secureServer = https.createServer(
    {
      pfx: fs.readFileSync(httpsPfxPath),
      passphrase: httpsPfxPassphrase,
    },
    requestHandler,
  );

  secureServer.listen(httpsPort, "0.0.0.0", () => {
    console.log(`Meet Rooms HTTPS running at https://localhost:${httpsPort}`);
    getLanAddresses().forEach((address) => console.log(`LAN HTTPS: https://${address}:${httpsPort}`));
  });
} else {
  console.log(`HTTPS disabled: certificate not found at ${httpsPfxPath}`);
}

setInterval(cleanupStaleParticipants, 5_000);
