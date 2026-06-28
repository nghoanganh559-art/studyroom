const api = {
  rooms: "/api/rooms",
  avatars: "/api/avatars",
  join: "/api/join",
  leave: "/api/leave",
  kick: "/api/kick",
  heartbeat: "/api/heartbeat",
  signal: "/api/signal",
  signals: "/api/signals",
  config: "/api/config",
};

const clientIdKey = "meetRoomsTabClientId";
const avatarStorageKey = "meetRoomsAvatarId";
const themeStorageKey = "studyChillTheme";
const fallbackAvatarOptions = [
  { id: "bear", name: "Gấu kính", src: "assets/avatar-bear.svg" },
  { id: "cat", name: "Mèo xanh", src: "assets/avatar-cat.svg" },
  { id: "monkey", name: "Khỉ kính", src: "assets/avatar-monkey.svg" },
  { id: "bunny", name: "Thỏ tím", src: "assets/avatar-bunny.svg" },
];
let avatarOptions = [...fallbackAvatarOptions];

function getClientId() {
  const fallbackId = `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const existing = sessionStorage.getItem(clientIdKey);
    if (existing) return existing;
    sessionStorage.setItem(clientIdKey, fallbackId);
  } catch {
    return fallbackId;
  }
  return fallbackId;
}

const clientId = getClientId();

function getStoredTheme() {
  try {
    return localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  dom.themeLightButton?.classList.toggle("is-active", nextTheme === "light");
  dom.themeDarkButton?.classList.toggle("is-active", nextTheme === "dark");
  dom.themeLightButton?.setAttribute("aria-pressed", String(nextTheme === "light"));
  dom.themeDarkButton?.setAttribute("aria-pressed", String(nextTheme === "dark"));
  try {
    localStorage.setItem(themeStorageKey, nextTheme);
  } catch {
    // Ignore storage failures; the current session still updates.
  }
}

const dom = {
  appShell: document.querySelector("#appShell"),
  roomsPanel: document.querySelector("#roomsPanel"),
  roomList: document.querySelector("#roomList"),
  roomTotal: document.querySelector("#roomTotal"),
  roomSearch: document.querySelector("#roomSearch"),
  openCreateRoomButton: document.querySelector("#openCreateRoomButton"),
  createRoomDialog: document.querySelector("#createRoomDialog"),
  createRoomForm: document.querySelector("#createRoomForm"),
  roomName: document.querySelector("#roomName"),
  roomPassword: document.querySelector("#roomPassword"),
  createAvatarPicker: document.querySelector("#createAvatarPicker"),
  createNameError: document.querySelector("#createNameError"),
  createPasswordError: document.querySelector("#createPasswordError"),
  clearRoomsButton: document.querySelector("#clearRoomsButton"),
  themeLightButton: document.querySelector("#themeLightButton"),
  themeDarkButton: document.querySelector("#themeDarkButton"),
  globalUserName: document.querySelector("#globalUserName"),
  connectionText: document.querySelector("#connectionText"),
  heroTitle: document.querySelector("#heroTitle"),
  heroSubtitle: document.querySelector("#heroSubtitle"),
  movieTicket: document.querySelector(".movie-ticket"),
  emptyState: document.querySelector("#emptyState"),
  roomView: document.querySelector("#roomView"),
  videoGrid: document.querySelector("#videoGrid"),
  roomChatPanel: document.querySelector("#roomChatPanel"),
  chatButton: document.querySelector("#chatButton"),
  closeChatButton: document.querySelector("#closeChatButton"),
  chatMenuButton: document.querySelector("#chatMenuButton"),
  chatToolMenu: document.querySelector("#chatToolMenu"),
  createPollButton: document.querySelector("#createPollButton"),
  randomSpinButton: document.querySelector("#randomSpinButton"),
  pollDialog: document.querySelector("#pollDialog"),
  pollForm: document.querySelector("#pollForm"),
  pollQuestion: document.querySelector("#pollQuestion"),
  pollOptions: document.querySelector("#pollOptions"),
  pollError: document.querySelector("#pollError"),
  closePollDialog: document.querySelector("#closePollDialog"),
  spinDialog: document.querySelector("#spinDialog"),
  spinForm: document.querySelector("#spinForm"),
  spinPrompt: document.querySelector("#spinPrompt"),
  closeSpinDialog: document.querySelector("#closeSpinDialog"),
  kickDialog: document.querySelector("#kickDialog"),
  kickForm: document.querySelector("#kickForm"),
  kickDialogTitle: document.querySelector("#kickDialogTitle"),
  kickDurationGrid: document.querySelector("#kickDurationGrid"),
  kickCustomMinutes: document.querySelector("#kickCustomMinutes"),
  kickError: document.querySelector("#kickError"),
  closeKickDialog: document.querySelector("#closeKickDialog"),
  banNoticeDialog: document.querySelector("#banNoticeDialog"),
  banNoticeText: document.querySelector("#banNoticeText"),
  chatUnread: document.querySelector("#chatUnread"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  activeRoomName: document.querySelector("#activeRoomName"),
  participantCount: document.querySelector("#participantCount"),
  meetingControls: document.querySelector("#meetingControls"),
  micButton: document.querySelector("#micButton"),
  cameraButton: document.querySelector("#cameraButton"),
  screenButton: document.querySelector("#screenButton"),
  leaveButton: document.querySelector("#leaveButton"),
  mediaStatus: document.querySelector("#mediaStatus"),
  joinDialog: document.querySelector("#joinDialog"),
  joinForm: document.querySelector("#joinForm"),
  joinRoomLabel: document.querySelector("#joinRoomLabel"),
  joinUserName: document.querySelector("#joinUserName"),
  joinPasswordLabel: document.querySelector("#joinPasswordLabel"),
  joinPassword: document.querySelector("#joinPassword"),
  joinPasswordError: document.querySelector("#joinPasswordError"),
  joinAvatarPicker: document.querySelector("#joinAvatarPicker"),
  joinError: document.querySelector("#joinError"),
  closeCreateRoomDialog: document.querySelector("#closeCreateRoomDialog"),
  closeJoinDialog: document.querySelector("#closeJoinDialog"),
};

let rooms = [];
let activeRoom = null;
let localParticipant = null;
let pendingJoinRoomId = null;
let lastSignalSeq = 0;
let roomsPollTimer = null;
let roomPollTimer = null;
let signalPollTimer = null;
let heartbeatTimer = null;
let cameraStream = null;
let micStream = null;
let screenStream = null;
let meetingSignature = "";
let mediaStatusTimer = null;
let chatOpen = false;
let unreadChatCount = 0;
let chatMessages = [];
let createErrorTimer = null;
let joinErrorTimer = null;
let banNoticeTimer = null;
let audioContext = null;
let pendingKickTargetId = null;
let selectedKickMinutes = 1;
let selectedKickMode = "temporary";
const peers = new Map();
const remoteStreams = new Map();
const remoteScreenTrackIds = new Map();
const remoteScreenStreamIds = new Map();
const remoteTrackStreamIds = new Map();
const pendingIceCandidates = new Map();
const screenStateSentTo = new Set();
const mediaStateSentTo = new Set();
const participantMediaStates = new Map();
const speakingParticipants = new Set();
const voiceMonitors = new Map();
const mutedStreams = new Set();
const streamVolumes = new Map();
const teaseItems = {
  bomb: { label: "Ném bom", noun: "bom", icon: "💣" },
  rock: { label: "Ném đá", noun: "đá", icon: "🪨" },
  tomato: { label: "Ném cà chua", noun: "cà chua", icon: "🍅" },
  banana: { label: "Ném chuối", noun: "chuối", icon: "🍌" },
  rose: { label: "Tặng hoa hồng", noun: "hoa hồng", verb: "tặng", icon: "🌹" },
};
const roomPenVariants = [
  { icon: "✎", className: "pen-ink" },
  { icon: "✐", className: "pen-pencil" },
  { icon: "✏", className: "pen-note" },
  { icon: "✒", className: "pen-fountain" },
];

const peerConfig = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

const audioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const cameraConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 24, max: 30 },
  facingMode: "user",
};

const heroSlides = [
  {
    title: "Góc học chung, vào nhanh bằng mật khẩu",
    subtitle: "Tạo room nhỏ, rủ bạn vào học cùng và bắt đầu phiên focus trong vài giây.",
  },
  {
    title: "Share màn hình để chữa bài cùng nhau",
    subtitle: "Trình chiếu tài liệu, tab bài tập hoặc slide với khung xem rõ ràng.",
  },
  {
    title: "Không cần tài khoản, chỉ cần một tên gọi",
    subtitle: "Room riêng tư, có mật khẩu nếu muốn, hợp cho học nhóm nhanh sau giờ học.",
  },
  {
    title: "Chill đủ yên, focus đủ sâu",
    subtitle: "Glass UI dịu mắt, điều khiển mic/cam gọn và avatar thân thiện cho từng người.",
  },
];

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    Object.assign(error, data);
    throw error;
  }
  return data;
}

function getUserName(source = dom.globalUserName.value) {
  return source.trim() || "Khach";
}

async function loadAvatarOptions() {
  try {
    const data = await requestJson(api.avatars);
    if (Array.isArray(data.avatars) && data.avatars.length) {
      avatarOptions = data.avatars;
    }
  } catch {
    avatarOptions = [...fallbackAvatarOptions];
  }
}

function getRandomAvatarId(settings = {}) {
  const availableAvatars = avatarOptions.length ? avatarOptions : fallbackAvatarOptions;
  const previousId = settings.previousId ?? getStoredAvatarId();
  const avoidIds = new Set((settings.avoidIds || []).filter(Boolean));
  let candidates = availableAvatars.filter((avatar) => !avoidIds.has(avatar.id));

  if (settings.avoidPrevious !== false && candidates.length > 1) {
    const withoutPrevious = candidates.filter((avatar) => avatar.id !== previousId);
    if (withoutPrevious.length) candidates = withoutPrevious;
  }

  if (!candidates.length && availableAvatars.length > 1) {
    candidates = availableAvatars.filter((avatar) => avatar.id !== previousId);
  }

  if (!candidates.length) candidates = availableAvatars;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

function isValidAvatarId(avatarId) {
  return avatarOptions.some((avatar) => avatar.id === avatarId);
}

function getStoredAvatarId() {
  try {
    const stored = localStorage.getItem(avatarStorageKey);
    if (isValidAvatarId(stored)) return stored;
  } catch {
    return null;
  }
  return null;
}

function setStoredAvatarId(avatarId) {
  if (!isValidAvatarId(avatarId)) return;
  try {
    localStorage.setItem(avatarStorageKey, avatarId);
  } catch {
    // Selection still works for this page load if localStorage is unavailable.
  }
}

function getSelectedAvatarId() {
  const stored = getStoredAvatarId();
  if (stored) return stored;
  const randomAvatarId = getRandomAvatarId();
  setStoredAvatarId(randomAvatarId);
  return randomAvatarId;
}

function getAvatarOption(avatarId) {
  return avatarOptions.find((avatar) => avatar.id === avatarId) || avatarOptions[0] || fallbackAvatarOptions[0];
}

function renderAvatarPicker(container, selectedId = getSelectedAvatarId()) {
  if (!container) return;
  container.innerHTML = "";

  avatarOptions.forEach((avatar) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "avatar-choice";
    button.dataset.avatarId = avatar.id;
    button.title = avatar.name;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", avatar.name);
    button.setAttribute("aria-checked", String(avatar.id === selectedId));
    button.innerHTML = `<img src="${avatar.src}" alt="" />`;
    button.addEventListener("click", () => {
      setStoredAvatarId(avatar.id);
      renderAvatarPickers(avatar.id);
    });
    container.append(button);
  });
}

function renderAvatarPickers(selectedId = getSelectedAvatarId()) {
  renderAvatarPicker(dom.createAvatarPicker, selectedId);
  renderAvatarPicker(dom.joinAvatarPicker, selectedId);
}

function selectRandomAvatar(avoidIds = []) {
  const avatarId = getRandomAvatarId({ avoidIds, avoidPrevious: true });
  setStoredAvatarId(avatarId);
  renderAvatarPickers(avatarId);
  return avatarId;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeText(element, text, speed) {
  element.textContent = "";
  for (let index = 0; index < text.length; index += 1) {
    element.textContent += text[index];
    await wait(speed);
  }
}

async function eraseText(element, speed) {
  while (element.textContent.length) {
    element.textContent = element.textContent.slice(0, -1);
    await wait(speed);
  }
}

async function startHeroTypewriter() {
  if (!dom.heroTitle || !dom.heroSubtitle) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    dom.heroTitle.textContent = heroSlides[0].title;
    dom.heroSubtitle.textContent = heroSlides[0].subtitle;
    return;
  }

  let slideIndex = 0;
  while (true) {
    const slide = heroSlides[slideIndex];
    await typeText(dom.heroTitle, slide.title, 58);
    dom.heroSubtitle.textContent = slide.subtitle;
    await wait(2600);
    await eraseText(dom.heroTitle, 34);
    slideIndex = (slideIndex + 1) % heroSlides.length;
    await wait(420);
  }
}

function setupTicketInteraction() {
  const ticket = dom.movieTicket;
  if (!ticket) return;

  const reset = () => {
    ticket.classList.remove("is-active", "is-pressed");
    ticket.style.setProperty("--tilt-x", "0deg");
    ticket.style.setProperty("--tilt-y", "0deg");
    ticket.style.setProperty("--glow-x", "50%");
    ticket.style.setProperty("--glow-y", "50%");
  };

  const move = (event) => {
    const rect = ticket.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    ticket.classList.add("is-active");
    ticket.style.setProperty("--tilt-x", `${(0.5 - y) * 10}deg`);
    ticket.style.setProperty("--tilt-y", `${(x - 0.5) * 14}deg`);
    ticket.style.setProperty("--glow-x", `${x * 100}%`);
    ticket.style.setProperty("--glow-y", `${y * 100}%`);
  };

  ticket.addEventListener("pointermove", move);
  ticket.addEventListener("pointerenter", move);
  ticket.addEventListener("pointerleave", reset);
  ticket.addEventListener("pointerdown", (event) => {
    ticket.classList.add("is-pressed");
    move(event);
  });
  ticket.addEventListener("pointerup", () => ticket.classList.remove("is-pressed"));
  ticket.addEventListener("pointercancel", reset);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
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

function getStableIndex(value, length) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function getRoomPenVariant(room) {
  const key = `${room.id}-${room.name}-${room.createdAt}`;
  return roomPenVariants[getStableIndex(key, roomPenVariants.length)];
}

function setMediaStatus(message) {
  clearTimeout(mediaStatusTimer);
  dom.mediaStatus.textContent = message;
  if (!message) {
    mediaStatusTimer = null;
    return;
  }
  mediaStatusTimer = setTimeout(() => {
    dom.mediaStatus.textContent = "";
    mediaStatusTimer = null;
  }, 4000);
}

function requireActiveRoom() {
  if (activeRoom && localParticipant) return true;
  setMediaStatus("Vào phòng trước rồi bật mic/cam.");
  return false;
}

function clearCreateErrors() {
  clearTimeout(createErrorTimer);
  createErrorTimer = null;
  if (dom.createNameError) dom.createNameError.textContent = "";
  if (dom.createPasswordError) dom.createPasswordError.textContent = "";
}

function showCreateError(message) {
  clearCreateErrors();
  const lowerMessage = String(message || "").toLocaleLowerCase("vi-VN");
  if (lowerMessage.includes("mật khẩu") || lowerMessage.includes("mat khau")) {
    if (dom.createPasswordError) dom.createPasswordError.textContent = message;
  } else if (dom.createNameError) {
    dom.createNameError.textContent = message;
  }
  createErrorTimer = setTimeout(clearCreateErrors, 4000);
}

function clearJoinErrors() {
  clearTimeout(joinErrorTimer);
  joinErrorTimer = null;
  if (dom.joinError) dom.joinError.textContent = "";
  if (dom.joinPasswordError) dom.joinPasswordError.textContent = "";
}

function showJoinError(message) {
  clearJoinErrors();
  const lowerMessage = String(message || "").toLocaleLowerCase("vi-VN");
  if (lowerMessage.includes("mật khẩu") || lowerMessage.includes("mat khau")) {
    if (dom.joinPasswordError) dom.joinPasswordError.textContent = message;
  } else if (dom.joinError) {
    dom.joinError.textContent = message;
  }
  joinErrorTimer = setTimeout(clearJoinErrors, 4000);
}

function getBanNoticeMessage(roomOrBan) {
  const ban = roomOrBan?.ban || roomOrBan;
  if (!ban) return "";
  if (ban.permanent) return "Không thể vào phòng. Bạn đã được mời khỏi phòng vĩnh viễn.";
  const remainingSeconds =
    ban.until && Number.isFinite(Number(ban.until))
      ? Math.max(0, Math.ceil((Number(ban.until) - Date.now()) / 1000))
      : Number(ban.remainingSeconds || 0);
  return `Không thể vào phòng. Hãy thử lại sau ${formatRemainingTime(remainingSeconds)}.`;
}

function clearBanNoticeTimer() {
  clearInterval(banNoticeTimer);
  banNoticeTimer = null;
}

function showBanNotice(roomOrBan) {
  clearBanNoticeTimer();
  const ban = roomOrBan?.ban || roomOrBan;
  const updateNotice = () => {
    const message = getBanNoticeMessage(ban);
    if (!message) return false;
    if (dom.banNoticeText) dom.banNoticeText.textContent = message;
    if (!ban?.permanent && Number(ban?.until) && Number(ban.until) <= Date.now()) {
      clearBanNoticeTimer();
    }
    return true;
  };
  if (!updateNotice()) return;
  if (!ban?.permanent && Number(ban?.until)) {
    banNoticeTimer = setInterval(updateNotice, 1000);
  }
  dom.banNoticeDialog?.showModal();
}

function hasMediaDevices(methodName) {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices[methodName]);
}

function getMediaUnavailableMessage() {
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  if (!window.isSecureContext && !isLocalhost) {
    return "Mic/camera cần HTTPS. Hãy dùng link https của web đã deploy.";
  }
  return "Trình duyệt không hỗ trợ mở mic/camera ở trang này.";
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isIOSLikeBrowser() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function supportsScreenShare() {
  return hasMediaDevices("getDisplayMedia") && !isIOSLikeBrowser();
}

function syncViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  if (height) document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
}

function setupViewportHeight() {
  syncViewportHeight();
  window.visualViewport?.addEventListener("resize", syncViewportHeight);
  window.addEventListener("resize", syncViewportHeight);
  window.addEventListener("orientationchange", () => setTimeout(syncViewportHeight, 250));
}

function setupPlatformControls() {
  if (!dom.screenButton || supportsScreenShare()) return;
  dom.screenButton.disabled = true;
  dom.screenButton.setAttribute("aria-disabled", "true");
  dom.screenButton.title = isIOSLikeBrowser()
    ? "iPhone/iPad không hỗ trợ trình chiếu màn hình trên Safari."
    : "Trình duyệt này không hỗ trợ trình chiếu màn hình.";
}

async function loadRuntimeConfig() {
  try {
    const config = await requestJson(api.config);
    if (Array.isArray(config.iceServers) && config.iceServers.length) {
      peerConfig.iceServers = config.iceServers;
    }
  } catch {
    // Keep the bundled STUN config when the server has no runtime config.
  }
}

function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

function getOutgoingTracks() {
  return getOutgoingMediaEntries().map((entry) => entry.track);
}

function getOutgoingMediaEntries() {
  return [
    ...(cameraStream ? cameraStream.getVideoTracks().map((track) => ({ track, streams: [cameraStream] })) : []),
    ...(micStream ? micStream.getAudioTracks().map((track) => ({ track, streams: [micStream] })) : []),
    ...(screenStream ? screenStream.getTracks().map((track) => ({ track, streams: [screenStream] })) : []),
  ];
}

function getScreenTrackIds() {
  return screenStream ? screenStream.getVideoTracks().map((track) => track.id) : [];
}

function getScreenStreamIds() {
  return screenStream ? [screenStream.id] : [];
}

function attachStream(video, stream, muted) {
  video.muted = muted;
  video.defaultMuted = muted;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.srcObject = stream;

  const playVideo = () => playMediaElement(video);
  video.addEventListener("loadedmetadata", playVideo);
  video.addEventListener("canplay", playVideo);
}

function playMediaElement(media) {
  return media.play().then(
    () => {
      media.dispatchEvent(new CustomEvent("streamplay", { bubbles: true }));
      return true;
    },
    () => {
      media.dispatchEvent(new CustomEvent("streamblocked", { bubbles: true }));
      if (!media.muted) {
        setMediaStatus("Safari đang chặn âm thanh/video. Chạm vào màn hình hoặc nút phát để kết nối.");
      }
      return false;
    },
  );
}

async function unlockRemoteMedia() {
  resumeAudioContext();
  const mediaItems = [...dom.videoGrid.querySelectorAll("video, audio")];
  if (!mediaItems.length) return;
  const results = await Promise.all(mediaItems.map((media) => playMediaElement(media)));
  if (results.some(Boolean)) setMediaStatus("");
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!audioContext) audioContext = new AudioContextConstructor();
  return audioContext;
}

function resumeAudioContext() {
  if (audioContext?.state === "suspended") audioContext.resume().catch(() => {});
}

function getParticipantMicState(participantId, stream = null) {
  if (participantId === localParticipant?.id) return Boolean(micStream);
  if (participantMediaStates.has(participantId)) return Boolean(participantMediaStates.get(participantId).mic);
  return hasLiveAudioTrack(stream);
}

function setParticipantMicState(participantId, mic) {
  if (!participantId) return;
  participantMediaStates.set(participantId, { ...(participantMediaStates.get(participantId) || {}), mic: Boolean(mic) });
  updateTileMediaState(participantId);
}

function getParticipantSelector(participantId) {
  const escaped = window.CSS?.escape ? CSS.escape(String(participantId)) : String(participantId).replace(/"/g, '\\"');
  return `[data-participant-id="${escaped}"]`;
}

function getMicIconMarkup(micOn) {
  return micOn
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.7 3.3 16 16-1.4 1.4-3.1-3.1A7 7 0 0 1 13 17.92V21h-2v-3.08A7 7 0 0 1 5 11h2a5 5 0 0 0 7.7 4.2l-1.5-1.5A3 3 0 0 1 9 11V9.5L3.3 4.7l1.4-1.4ZM12 3a3 3 0 0 1 3 3v5c0 .28-.04.55-.11.8L9.2 6.1A3 3 0 0 1 12 3Zm5 8h2a7 7 0 0 1-.92 3.47l-1.5-1.5c.27-.6.42-1.27.42-1.97Z"/></svg>';
}

function createTileName(name, options = {}) {
  const label = document.createElement("div");
  label.className = "tile-name";

  const text = document.createElement("span");
  text.className = "tile-name-text";
  text.textContent = name;
  label.append(text);

  if (options.participantId) {
    const micOn = getParticipantMicState(options.participantId, options.stream);
    const canForceMute = Boolean(options.muteTargetId);
    const mic = document.createElement(canForceMute ? "button" : "span");
    mic.className = `tile-mic-state${canForceMute ? " tile-mic-action" : ""}${micOn ? "" : " is-muted"}`;
    if (canForceMute) {
      mic.type = "button";
      mic.title = micOn ? "Tắt mic người này" : "Mic người này đang tắt";
      mic.addEventListener("pointerdown", (event) => event.stopPropagation());
      mic.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        forceMuteParticipant(options.muteTargetId);
      });
    } else {
      mic.title = micOn ? "Mic đang bật" : "Mic đang tắt";
    }
    mic.innerHTML = getMicIconMarkup(micOn);
    label.append(mic);
  }

  return label;
}

function updateTileMediaState(participantId) {
  const micOn = getParticipantMicState(participantId);
  const speaking = speakingParticipants.has(participantId);
  dom.videoGrid.querySelectorAll(getParticipantSelector(participantId)).forEach((tile) => {
    tile.classList.toggle("is-speaking", speaking && micOn);
    tile.classList.toggle("is-mic-muted", !micOn);
    const mic = tile.querySelector(".tile-mic-state");
    if (mic) {
      mic.classList.toggle("is-muted", !micOn);
      mic.title = mic.classList.contains("tile-mic-action") ? (micOn ? "Tắt mic người này" : "Mic người này đang tắt") : micOn ? "Mic đang bật" : "Mic đang tắt";
      mic.innerHTML = getMicIconMarkup(micOn);
    }
  });
}

function setParticipantSpeaking(participantId, speaking) {
  if (!participantId) return;
  if (speaking) speakingParticipants.add(participantId);
  else speakingParticipants.delete(participantId);
  updateTileMediaState(participantId);
}

function stopVoiceMonitor(participantId) {
  const monitor = voiceMonitors.get(participantId);
  if (!monitor) return;
  cancelAnimationFrame(monitor.rafId);
  monitor.source.disconnect();
  monitor.analyser.disconnect();
  voiceMonitors.delete(participantId);
  setParticipantSpeaking(participantId, false);
}

function startVoiceMonitor(participantId, stream) {
  const audioTracks = stream?.getAudioTracks().filter((track) => track.readyState === "live") || [];
  if (!participantId || !audioTracks.length) {
    stopVoiceMonitor(participantId);
    return;
  }

  const streamKey = `${getStreamKey(stream)}:${audioTracks.map((track) => track.id).join(",")}`;
  const existing = voiceMonitors.get(participantId);
  if (existing?.streamKey === streamKey) return;
  stopVoiceMonitor(participantId);

  const context = getAudioContext();
  if (!context) return;

  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.72;
  const data = new Uint8Array(analyser.fftSize);
  const source = context.createMediaStreamSource(new MediaStream(audioTracks));
  source.connect(analyser);

  let quietFrames = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let total = 0;
    for (const value of data) {
      const normalized = (value - 128) / 128;
      total += normalized * normalized;
    }
    const rms = Math.sqrt(total / data.length);
    const speaking = rms > 0.045;

    if (speaking) {
      quietFrames = 0;
      setParticipantSpeaking(participantId, true);
    } else {
      quietFrames += 1;
      if (quietFrames > 10) setParticipantSpeaking(participantId, false);
    }

    const monitor = voiceMonitors.get(participantId);
    if (monitor) monitor.rafId = requestAnimationFrame(tick);
  };

  voiceMonitors.set(participantId, { streamKey, source, analyser, rafId: requestAnimationFrame(tick) });
}

function streamSignature(stream) {
  if (!stream) return "none";
  return stream
    .getTracks()
    .map((track) => `${track.kind}:${track.id}:${track.readyState}`)
    .join("|");
}

function getRemoteScreenSignature(remoteId) {
  return [
    ...(remoteScreenTrackIds.get(remoteId) || []),
    ...(remoteScreenStreamIds.get(remoteId) || []),
  ]
    .sort()
    .join(",");
}

async function addIceCandidateSafely(remoteId, candidatePayload) {
  if (!candidatePayload) return;
  const peer = ensurePeer(remoteId);
  const candidate = new RTCIceCandidate(candidatePayload);

  if (!peer.pc.remoteDescription) {
    if (!pendingIceCandidates.has(remoteId)) pendingIceCandidates.set(remoteId, []);
    pendingIceCandidates.get(remoteId).push(candidate);
    return;
  }

  await peer.pc.addIceCandidate(candidate);
}

async function flushPendingIceCandidates(remoteId) {
  const peer = peers.get(remoteId);
  const candidates = pendingIceCandidates.get(remoteId) || [];
  if (!peer || !peer.pc.remoteDescription || !candidates.length) return;

  pendingIceCandidates.delete(remoteId);
  for (const candidate of candidates) {
    try {
      await peer.pc.addIceCandidate(candidate);
    } catch {
      // Safari can reject stale candidates after renegotiation; keeping the call alive matters more.
    }
  }
}

function getStreamKey(stream) {
  return stream?.id || streamSignature(stream);
}

function getStreamMuted(stream, fallback = false) {
  return mutedStreams.has(getStreamKey(stream)) || fallback;
}

function setStreamMuted(stream, muted) {
  const key = getStreamKey(stream);
  if (muted) mutedStreams.add(key);
  else mutedStreams.delete(key);
}

function getStreamVolume(stream) {
  const volume = streamVolumes.get(getStreamKey(stream));
  return typeof volume === "number" ? volume : 1;
}

function setStreamVolume(stream, volume) {
  streamVolumes.set(getStreamKey(stream), Math.max(0, Math.min(1, volume)));
}

function hasLiveAudioTrack(stream) {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === "live"));
}

function getMuteIcon(muted) {
  return muted
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-5v16l-5-5H4V9Zm13.6 3 2.2 2.2-1.4 1.4-2.2-2.2-2.2 2.2-1.4-1.4 2.2-2.2-2.2-2.2 1.4-1.4 2.2 2.2 2.2-2.2 1.4 1.4L17.6 12Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-5v16l-5-5H4V9Zm12.5-2.1a6 6 0 0 1 0 10.2l-1-1.7a4 4 0 0 0 0-6.8l1-1.7Zm2.1-3.2a10 10 0 0 1 0 16.6l-1-1.7a8 8 0 0 0 0-13.2l1-1.7Z"/></svg>';
}

function updateMuteButton(button, muted) {
  button.title = muted ? "Bật tiếng" : "Tắt tiếng";
  button.setAttribute("aria-pressed", String(muted));
  button.innerHTML = getMuteIcon(muted);
}

function getMeetingSignature() {
  if (!activeRoom || !localParticipant) return "empty";
  const remoteTiles = activeRoom.participants
    .filter((participant) => participant.id !== localParticipant.id)
    .map(
      (participant) =>
        `${participant.id}:${participant.name}:${participant.avatar || ""}:${streamSignature(
          remoteStreams.get(participant.id),
        )}:${getRemoteScreenSignature(participant.id)}:${getParticipantMicState(participant.id, remoteStreams.get(participant.id))}`,
    );

  return [
    activeRoom.id,
    activeRoom.ownerId || "",
    localParticipant.id,
    localParticipant.name,
    localParticipant.avatar || "",
    getParticipantMicState(localParticipant.id),
    streamSignature(screenStream),
    streamSignature(cameraStream),
    ...remoteTiles,
  ].join("::");
}

function requestTileFullscreen(tile) {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  if (fullscreenElement) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit) exit.call(document);
    return;
  }

  const request = tile.requestFullscreen || tile.webkitRequestFullscreen || tile.msRequestFullscreen;
  if (request) request.call(tile);
}

function clearMediaElements() {
  dom.videoGrid.querySelectorAll("video, audio").forEach((media) => {
    media.pause();
    media.srcObject = null;
    media.removeAttribute("src");
    media.load();
  });
}

function stopAllVoiceMonitors() {
  [...voiceMonitors.keys()].forEach(stopVoiceMonitor);
}

function getParticipantDisplayName(participantId) {
  return getParticipantInfo(participantId).name;
}

function getParticipantInfo(participantId, fallback = {}) {
  const participant =
    participantId === localParticipant?.id
      ? localParticipant
      : activeRoom?.participants.find((item) => item.id === participantId);

  return {
    name: participant?.name || fallback.name || "Khách",
    avatar: fallback.avatar || participant?.avatar || avatarOptions[0]?.id || fallbackAvatarOptions[0].id,
  };
}

function formatChatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function updateChatUnread() {
  dom.chatButton?.setAttribute("aria-expanded", String(chatOpen));
  dom.roomChatPanel?.classList.toggle("is-hidden", !chatOpen);
  dom.chatUnread?.classList.toggle("is-hidden", unreadChatCount <= 0);
  if (dom.chatUnread) {
    dom.chatUnread.textContent = unreadChatCount > 9 ? "9+" : String(unreadChatCount);
  }
}

function setChatToolMenuOpen(open) {
  dom.chatToolMenu?.classList.toggle("is-hidden", !open);
  dom.chatMenuButton?.setAttribute("aria-expanded", String(Boolean(open)));
}

function getPollVoteCounts(message) {
  const counts = new Map(message.options.map((option) => [option.id, 0]));
  Object.values(message.votes || {}).forEach((optionId) => {
    if (counts.has(optionId)) counts.set(optionId, counts.get(optionId) + 1);
  });
  return counts;
}

function renderPollMessage(message, bubble) {
  const poll = document.createElement("div");
  poll.className = "chat-poll";

  const title = document.createElement("strong");
  title.textContent = message.question;
  poll.append(title);

  const counts = getPollVoteCounts(message);
  const totalVotes = Object.keys(message.votes || {}).length;
  const myVote = message.votes?.[localParticipant?.id];

  message.options.forEach((option) => {
    const count = counts.get(option.id) || 0;
    const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-poll-option";
    button.classList.toggle("is-selected", myVote === option.id);
    button.addEventListener("click", () => votePoll(message.id, option.id));

    const label = document.createElement("span");
    label.textContent = option.text;
    const result = document.createElement("em");
    result.textContent = `${count} vote${percent ? ` · ${percent}%` : ""}`;
    const bar = document.createElement("i");
    bar.style.width = `${percent}%`;

    button.append(label, result, bar);
    poll.append(button);
  });

  bubble.append(poll);
}

function renderSpinMessage(message, bubble) {
  const spin = document.createElement("div");
  spin.className = "chat-spin";

  const title = document.createElement("strong");
  title.textContent = message.prompt || "Bốc thăm";
  const winner = document.createElement("p");
  winner.textContent = `Kết quả: ${message.winnerName}`;
  const participants = document.createElement("span");
  participants.textContent = `Trong ${message.participants?.length || 0} người`;

  spin.append(title, winner, participants);
  bubble.append(spin);
}

function renderChatMessages() {
  if (!dom.chatMessages) return;

  const wasNearBottom =
    dom.chatMessages.scrollHeight - dom.chatMessages.scrollTop - dom.chatMessages.clientHeight < 48;

  dom.chatMessages.innerHTML = "";
  if (!chatMessages.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = "Chưa có tin nhắn.";
    dom.chatMessages.append(empty);
    return;
  }

  chatMessages.slice(-80).forEach((message) => {
    const profile = getParticipantInfo(message.from, message);
    const item = document.createElement("div");
    item.className = `chat-message${message.self ? " is-self" : ""}`;

    const avatar = getAvatarOption(profile.avatar);
    const avatarWrap = document.createElement("span");
    avatarWrap.className = "chat-avatar";
    const avatarImg = document.createElement("img");
    avatarImg.src = avatar.src;
    avatarImg.alt = "";
    avatarWrap.append(avatarImg);

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";

    const meta = document.createElement("span");
    meta.className = "chat-message-meta";
    meta.textContent = `${profile.name} · ${formatChatTime(message.createdAt)}`;

    bubble.append(meta);
    if (message.kind === "poll") {
      renderPollMessage(message, bubble);
    } else if (message.kind === "spin") {
      renderSpinMessage(message, bubble);
    } else {
      const text = document.createElement("p");
      text.textContent = message.text;
      bubble.append(text);
    }
    item.append(avatarWrap, bubble);
    dom.chatMessages.append(item);
  });

  if (wasNearBottom) {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  }
}

function setChatOpen(open) {
  chatOpen = Boolean(open && activeRoom && localParticipant);
  if (chatOpen) unreadChatCount = 0;
  updateChatUnread();
  if (chatOpen) {
    renderChatMessages();
    setTimeout(() => dom.chatInput?.focus(), 0);
  }
}

function addChatMessage(message) {
  chatMessages.push(message);
  if (chatMessages.length > 120) chatMessages = chatMessages.slice(-120);
  if (!message.self && !chatOpen) unreadChatCount += 1;
  renderChatMessages();
  updateChatUnread();
}

function updatePollVote(pollId, voterId, optionId) {
  const poll = chatMessages.find((message) => message.kind === "poll" && message.id === pollId);
  if (!poll || !poll.options.some((option) => option.id === optionId)) return;
  poll.votes = { ...(poll.votes || {}), [voterId]: optionId };
  renderChatMessages();
}

async function votePoll(pollId, optionId) {
  if (!activeRoom || !localParticipant) return;
  updatePollVote(pollId, localParticipant.id, optionId);
  await sendSignal("*", "poll-vote", { pollId, optionId });
}

function getChatToolAuthor() {
  return {
    from: localParticipant.id,
    name: localParticipant.name,
    avatar: localParticipant.avatar,
    createdAt: new Date().toISOString(),
    self: true,
  };
}

async function createPoll() {
  if (!requireActiveRoom()) return;
  setChatToolMenuOpen(false);
  if (!dom.pollDialog || !dom.pollForm) return;
  dom.pollForm.reset();
  if (dom.pollError) dom.pollError.textContent = "";
  dom.pollDialog.showModal();
  requestAnimationFrame(() => dom.pollQuestion?.focus());
}

async function submitPoll(event) {
  event.preventDefault();
  if (!requireActiveRoom()) return;
  if (dom.pollError) dom.pollError.textContent = "";

  const question = dom.pollQuestion?.value.trim() || "";
  const rawOptions = dom.pollOptions?.value || "";
  const uniqueOptions = [...new Set(String(rawOptions || "").split(",").map((option) => option.trim()).filter(Boolean))].slice(0, 6);
  if (!question) return;
  if (uniqueOptions.length < 2) {
    if (dom.pollError) dom.pollError.textContent = "Bình chọn cần ít nhất 2 lựa chọn.";
    return;
  }

  const message = {
    ...getChatToolAuthor(),
    id: `poll-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: "poll",
    question: question.trim().slice(0, 120),
    options: uniqueOptions.map((text, index) => ({ id: `option-${index + 1}`, text: text.slice(0, 60) })),
    votes: {},
  };

  addChatMessage(message);
  await sendSignal("*", "chat", {
    kind: "poll",
    id: message.id,
    name: message.name,
    avatar: message.avatar,
    question: message.question,
    options: message.options,
    votes: message.votes,
    createdAt: message.createdAt,
  });
  dom.pollDialog?.close();
}

async function randomSpin() {
  if (!requireActiveRoom()) return;
  setChatToolMenuOpen(false);
  if (!dom.spinDialog || !dom.spinForm) return;
  dom.spinForm.reset();
  dom.spinDialog.showModal();
  requestAnimationFrame(() => dom.spinPrompt?.focus());
}

async function submitSpin(event) {
  event.preventDefault();
  if (!requireActiveRoom()) return;

  const participants = activeRoom.participants || [];
  if (!participants.length) return;
  const prompt = dom.spinPrompt?.value.trim() || "Bốc thăm";
  const winner = participants[Math.floor(Math.random() * participants.length)];
  const message = {
    ...getChatToolAuthor(),
    id: `spin-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: "spin",
    prompt: prompt.slice(0, 120),
    winnerId: winner.id,
    winnerName: winner.name,
    winnerAvatar: winner.avatar,
    participants: participants.map((participant) => ({ id: participant.id, name: participant.name })),
  };

  addChatMessage(message);
  await sendSignal("*", "chat", {
    kind: "spin",
    id: message.id,
    name: message.name,
    avatar: message.avatar,
    prompt: message.prompt,
    winnerId: message.winnerId,
    winnerName: message.winnerName,
    winnerAvatar: message.winnerAvatar,
    participants: message.participants,
    createdAt: message.createdAt,
  });
  dom.spinDialog?.close();
}

function resetChat() {
  chatOpen = false;
  unreadChatCount = 0;
  chatMessages = [];
  setChatToolMenuOpen(false);
  renderChatMessages();
  updateChatUnread();
}

async function sendChatMessage(event) {
  event.preventDefault();
  if (!activeRoom || !localParticipant || !dom.chatInput) return;

  const text = dom.chatInput.value.trim();
  if (!text) return;

  const message = {
    id: `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: "text",
    from: localParticipant.id,
    name: localParticipant.name,
    avatar: localParticipant.avatar,
    text: text.slice(0, 240),
    createdAt: new Date().toISOString(),
    self: true,
  };

  dom.chatInput.value = "";
  addChatMessage(message);

  try {
    await sendSignal("*", "chat", {
      kind: "text",
      id: message.id,
      name: message.name,
      avatar: message.avatar,
      text: message.text,
      createdAt: message.createdAt,
    });
  } catch {
    setMediaStatus("Không gửi được tin nhắn.");
  }
}

function animateTeaseHit(participantIdOrTile, kind = "tomato") {
  const participantId = String(participantIdOrTile || "");
  const escapedParticipantId =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(participantId)
      : participantId.replace(/"/g, '\\"');
  const tile =
    participantIdOrTile instanceof Element
      ? participantIdOrTile
      : dom.videoGrid.querySelector(`[data-participant-id="${escapedParticipantId}"]`);
  if (!tile) return;

  const item = teaseItems[kind] || teaseItems.tomato;
  tile.querySelectorAll(".tease-object, .tease-splat").forEach((element) => element.remove());

  const object = document.createElement("span");
  object.className = `tease-object tease-${kind}`;
  object.setAttribute("aria-hidden", "true");
  object.textContent = item.icon;

  const splat = document.createElement("span");
  splat.className = `tease-splat tease-${kind}`;
  splat.setAttribute("aria-hidden", "true");

  tile.append(object, splat);
  tile.classList.add("is-teased");

  setTimeout(() => {
    object.remove();
    splat.remove();
    tile.classList.remove("is-teased");
  }, 1300);
}

async function sendTease(targetId, kind = "tomato") {
  if (!activeRoom || !localParticipant || !targetId) return;
  const item = teaseItems[kind] || teaseItems.tomato;
  const verb = item.verb || "ném";
  setMediaStatus(`Đã ${verb} ${item.noun} ${verb === "tặng" ? "cho" : "vào"} ${getParticipantDisplayName(targetId)}.`);
  await sendSignal("*", "tease", { kind, targetId });
}

function addTeaseButton(tile, targetId) {
  tile.classList.add("has-tease-picker");

  const picker = document.createElement("div");
  picker.className = "tile-tease-picker tile-name-tease-picker";

  const menu = document.createElement("div");
  menu.className = "tile-tease-menu";
  Object.entries(teaseItems).forEach(([kind, item]) => {
    const itemButton = document.createElement("button");
    itemButton.type = "button";
    itemButton.className = `tile-tease-item tease-${kind}`;
    itemButton.title = item.label;
    itemButton.textContent = item.icon;
    itemButton.addEventListener("click", (event) => {
      event.stopPropagation();
      picker.classList.remove("is-open");
      animateTeaseHit(tile, kind);
      sendTease(targetId, kind);
    });
    menu.append(itemButton);
  });

  tile.classList.add("is-tease-trigger");
  tile.title = "Chọc ghẹo";
  tile.addEventListener("click", (event) => {
    if (event.target.closest("button, input, .tile-tease-menu")) return;
    event.stopPropagation();
    dom.videoGrid.querySelectorAll(".tile-tease-picker.is-open").forEach((openPicker) => {
      if (openPicker !== picker) openPicker.classList.remove("is-open");
    });
    picker.classList.toggle("is-open");
  });
  picker.append(menu);
  tile.append(picker);
  requestAnimationFrame(() => {
    const label = tile.querySelector(".tile-name");
    const compact = tile.clientWidth < 520;
    const labelHeight = label ? Math.round(label.getBoundingClientRect().height) : 34;
    const itemSize = compact ? Math.min(32, labelHeight) : labelHeight;
    const menuGap = compact ? 4 : 5;
    const menuPadding = 0;
    const menuWidth = 5 * itemSize + 4 * menuGap + menuPadding * 2;
    const labelRight = label ? label.offsetLeft + label.offsetWidth + 8 : 12;
    const left = Math.max(12, Math.min(tile.clientWidth - menuWidth - 12, labelRight));
    picker.style.left = `${left}px`;
    picker.style.right = "auto";
    picker.style.bottom = "auto";
    picker.style.top = "auto";
    picker.style.bottom = "12px";
    menu.style.setProperty("--tease-item-size", `${itemSize}px`);
    menu.style.setProperty("--tease-item-gap", `${menuGap}px`);
    menu.style.setProperty("--tease-menu-pad", `${menuPadding}px`);
  });
}

function addKickButton(tile, targetId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile-kick";
  button.title = "Mời khỏi phòng";
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9v-2h9V6h-9V4Zm-1.6 4.4L10 10H3v4h7l-1.6 1.6L9.8 17 14 12 9.8 7 8.4 8.4Z"/></svg>';
  button.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dom.videoGrid.querySelectorAll(".tile-tease-picker.is-open").forEach((picker) => picker.classList.remove("is-open"));
    openKickDialog(targetId);
  });
  tile.append(button);
}

function createAvatarTile(name, avatarId, stream = null, options = {}) {
  const tile = document.createElement("div");
  tile.className = "video-tile avatar-tile";
  if (options.participantId) tile.dataset.participantId = options.participantId;
  const avatar = getAvatarOption(avatarId);
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "avatar";
  const avatarImage = document.createElement("img");
  avatarImage.src = avatar.src;
  avatarImage.alt = "";
  avatarWrap.append(avatarImage);
  tile.append(avatarWrap, createTileName(name, { participantId: options.participantId, stream, muteTargetId: options.muteTargetId }));

  if (stream?.getAudioTracks().length) {
    const audio = document.createElement("audio");
    attachStream(audio, stream, false);
    tile.append(audio);
  }

  if (options.teaseTargetId) addTeaseButton(tile, options.teaseTargetId);
  if (options.kickTargetId) addKickButton(tile, options.kickTargetId);
  if (options.participantId) {
    updateTileMediaState(options.participantId);
    startVoiceMonitor(options.participantId, stream);
  }
  return tile;
}

function createStreamTile(name, stream, options = {}) {
  const tile = document.createElement("div");
  tile.className = `video-tile has-video${options.screen ? " screen-tile" : ""}`;
  if (options.participantId) tile.dataset.participantId = options.participantId;

  const video = document.createElement("video");
  attachStream(video, stream, getStreamMuted(stream, Boolean(options.muted)));
  video.volume = getStreamVolume(stream);

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "tile-play is-hidden";
  playButton.title = "Phát video";
  playButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z"/></svg>';

  const playStream = () => {
    unlockRemoteMedia();
    video.play().then(
      () => playButton.classList.add("is-hidden"),
      () => playButton.classList.remove("is-hidden"),
    );
  };

  video.addEventListener("streamblocked", () => playButton.classList.remove("is-hidden"));
  video.addEventListener("streamplay", () => playButton.classList.add("is-hidden"));
  video.addEventListener("click", playStream);
  playButton.addEventListener("click", (event) => {
    event.stopPropagation();
    playStream();
  });

  const label = createTileName(name, { participantId: options.participantId, stream, muteTargetId: options.muteTargetId });

  const fullscreenButton = document.createElement("button");
  fullscreenButton.type = "button";
  fullscreenButton.className = "tile-fullscreen";
  fullscreenButton.title = "Xem toàn màn hình";
  fullscreenButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h6v2H7v4H5V5Zm8 0h6v6h-2V7h-4V5ZM7 13v4h4v2H5v-6h2Zm10 4v-4h2v6h-6v-2h4Z"/></svg>';
  fullscreenButton.addEventListener("click", (event) => {
    event.stopPropagation();
    requestTileFullscreen(tile);
  });

  tile.append(video, playButton, fullscreenButton);

  const showAudioControls = hasLiveAudioTrack(stream) && !Boolean(options.muted);
  if (showAudioControls) {
    const muteButton = document.createElement("button");
    muteButton.type = "button";
    muteButton.className = "tile-mute";
    updateMuteButton(muteButton, video.muted);
    muteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const shouldMute = !video.muted;
      video.muted = shouldMute;
      if (shouldMute) {
        video.volume = 0;
        volumeControl.value = "0";
        setStreamVolume(stream, 0);
      } else {
        const volume = getStreamVolume(stream) || 1;
        video.volume = volume;
        volumeControl.value = String(Math.round(volume * 100));
        setStreamVolume(stream, volume);
      }
      setStreamMuted(stream, video.muted);
      updateMuteButton(muteButton, video.muted);
    });

    const volumeControl = document.createElement("input");
    volumeControl.type = "range";
    volumeControl.className = "tile-volume";
    volumeControl.min = "0";
    volumeControl.max = "100";
    volumeControl.step = "1";
    volumeControl.value = String(Math.round(video.volume * 100));
    volumeControl.title = "Âm lượng";
    volumeControl.addEventListener("input", (event) => {
      event.stopPropagation();
      const volume = Number(volumeControl.value) / 100;
      video.volume = volume;
      setStreamVolume(stream, volume);

      if (volume === 0) video.muted = true;
      if (volume > 0 && video.muted) video.muted = false;
      setStreamMuted(stream, video.muted);
      updateMuteButton(muteButton, video.muted);
    });

    tile.append(muteButton);
    tile.append(volumeControl);
  }

  tile.append(label);
  if (options.teaseTargetId) addTeaseButton(tile, options.teaseTargetId);
  if (options.kickTargetId) addKickButton(tile, options.kickTargetId);
  if (options.participantId) {
    updateTileMediaState(options.participantId);
    startVoiceMonitor(options.participantId, stream);
  }
  return tile;
}

function setRemoteScreenTracks(remoteId, trackIds = [], streamIds = []) {
  const ids = trackIds.filter(Boolean);
  const streams = streamIds.filter(Boolean);
  if (ids.length) remoteScreenTrackIds.set(remoteId, new Set(ids));
  else remoteScreenTrackIds.delete(remoteId);
  if (streams.length) remoteScreenStreamIds.set(remoteId, new Set(streams));
  else remoteScreenStreamIds.delete(remoteId);
  meetingSignature = "";
  renderMeeting();
}

function isRemoteScreenTrack(remoteId, track) {
  const screenIds = remoteScreenTrackIds.get(remoteId);
  if (screenIds?.has(track.id)) return true;

  const streamId = remoteTrackStreamIds.get(remoteId)?.get(track.id);
  if (streamId && remoteScreenStreamIds.get(remoteId)?.has(streamId)) return true;

  const settings = typeof track.getSettings === "function" ? track.getSettings() : {};
  if (settings.displaySurface) return true;

  return false;
}

function splitRemoteStreams(remoteId, stream) {
  if (!stream) return { screen: null, camera: null, audio: [] };

  const videoTracks = stream.getVideoTracks().filter((track) => track.readyState === "live");
  const audioTracks = stream.getAudioTracks().filter((track) => track.readyState === "live");
  const screenTracks = videoTracks.filter((track) => isRemoteScreenTrack(remoteId, track));
  const cameraTracks = videoTracks.filter((track) => !screenTracks.includes(track));
  const screenStreamIds = new Set(remoteScreenStreamIds.get(remoteId) || []);
  screenTracks.forEach((track) => {
    const streamId = remoteTrackStreamIds.get(remoteId)?.get(track.id);
    if (streamId) screenStreamIds.add(streamId);
  });
  const screenAudioTracks = audioTracks.filter((track) => {
    const streamId = remoteTrackStreamIds.get(remoteId)?.get(track.id);
    return Boolean(streamId && screenStreamIds.has(streamId));
  });
  const normalAudioTracks = audioTracks.filter((track) => !screenAudioTracks.includes(track));

  return {
    screen: screenTracks.length ? new MediaStream([...screenTracks, ...screenAudioTracks]) : null,
    camera: cameraTracks.length ? new MediaStream([...cameraTracks, ...normalAudioTracks]) : null,
    audio: normalAudioTracks,
  };
}

function renderRooms() {
  dom.roomTotal.textContent = `${rooms.length} phòng`;
  dom.roomList.innerHTML = "";
  const searchTerm = dom.roomSearch.value.trim().toLocaleLowerCase("vi-VN");
  const visibleRooms = searchTerm
    ? rooms.filter((room) => room.name.toLocaleLowerCase("vi-VN").includes(searchTerm))
    : rooms;

  if (!rooms.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.innerHTML = `
      <div class="empty-list-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4l-3.5 3v-3H7a3 3 0 0 1-3-3V8Zm3-1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h4.5v.65L12.25 15H17a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H7Z"/></svg>
      </div>
      <strong>Chưa có phòng nào</strong>
      <span>Ấn dấu + để tạo phòng mới.</span>
    `;
    dom.roomList.append(empty);
    return;
  }

  if (!visibleRooms.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.innerHTML = `
      <div class="empty-list-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 0 1 5.13 10.49l4.44 4.44-1.42 1.42-4.44-4.44A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>
      </div>
      <strong>Không tìm thấy phòng</strong>
      <span>Thử nhập tên khác.</span>
    `;
    dom.roomList.append(empty);
    return;
  }

  visibleRooms.forEach((room) => {
    const canDelete = room.ownerId && room.ownerId === localParticipant?.id;
    const penVariant = getRoomPenVariant(room);
    const card = document.createElement("article");
    card.className = `room-card ${penVariant.className}${room.id === activeRoom?.id ? " active" : ""}`;
    card.dataset.pen = penVariant.className;

    const decoration = document.createElement("div");
    decoration.className = "room-card-decor";
    decoration.setAttribute("aria-hidden", "true");
    decoration.innerHTML = `
      <span class="decor-paper"></span>
      <span class="decor-pencil"></span>
      <span class="decor-dot decor-dot-a"></span>
      <span class="decor-dot decor-dot-b"></span>
      <span class="decor-dot decor-dot-c"></span>
      <span class="decor-rule decor-rule-a"></span>
      <span class="decor-rule decor-rule-b"></span>
    `;

    const titleWrap = document.createElement("div");
    titleWrap.className = "room-card-title";

    const title = document.createElement("h3");
    title.title = room.name;
    const titleText = document.createElement("span");
    titleText.className = "room-title-text";
    titleText.textContent = room.name;
    title.append(titleText);

    const status = document.createElement("span");
    status.textContent = room.id === activeRoom?.id ? "Đang trong góc học này" : "Góc học đang mở";
    titleWrap.append(title, status);

    const meta = document.createElement("div");
    meta.className = "room-meta";
    meta.innerHTML = `
      <span class="badge">${room.participants.length} người</span>
      <span class="badge">${formatTime(room.createdAt)}</span>
      <span class="badge">${room.hasPassword ? "Có khóa" : "Mở tự do"}</span>
    `;

    const actions = document.createElement("div");
    actions.className = `room-actions${canDelete ? "" : " single-action"}`;

    const joinButton = document.createElement("button");
    joinButton.type = "button";
    joinButton.className = "room-join-btn";
    joinButton.textContent = room.id === activeRoom?.id ? "Đang ở trong phòng" : "Vào phòng";
    joinButton.addEventListener("click", () => openJoinDialog(room.id));
    actions.append(joinButton);

    if (canDelete) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "icon-btn";
      deleteButton.title = "Xóa phòng";
      deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Z"/></svg>';
      deleteButton.addEventListener("click", () => deleteRoom(room.id));
      actions.append(deleteButton);
    }
    card.append(decoration, titleWrap, meta, actions);
    dom.roomList.append(card);
  });
}

function renderMeeting() {
  if (!activeRoom || !localParticipant) {
    dom.appShell.classList.remove("in-room");
    dom.roomsPanel.classList.remove("is-hidden");
    dom.emptyState.classList.remove("is-hidden");
    dom.roomView.classList.add("is-hidden");
    dom.meetingControls.classList.add("is-hidden");
    dom.videoGrid.classList.remove("has-screen-share");
    dom.connectionText.textContent = "Chọn hoặc tạo phòng để bắt đầu";
    dom.videoGrid.innerHTML = "";
    stopAllVoiceMonitors();
    meetingSignature = "";
    return;
  }

  dom.appShell.classList.add("in-room");
  dom.roomsPanel.classList.add("is-hidden");
  dom.emptyState.classList.add("is-hidden");
  dom.roomView.classList.remove("is-hidden");
  dom.meetingControls.classList.remove("is-hidden");
  dom.connectionText.textContent = `Đang học trong ${activeRoom.name}`;
  dom.activeRoomName.textContent = activeRoom.name;
  dom.participantCount.textContent = activeRoom.participants.length;

  const remoteViews = activeRoom.participants
    .filter((participant) => participant.id !== localParticipant.id)
    .map((participant) => ({
      participant,
      streams: splitRemoteStreams(participant.id, remoteStreams.get(participant.id)),
    }));
  const canManageParticipants = activeRoom.ownerId === localParticipant.id;
  const hasScreenShare = Boolean(screenStream) || remoteViews.some((view) => view.streams.screen);
  dom.videoGrid.classList.toggle("has-screen-share", hasScreenShare);

  const nextSignature = getMeetingSignature();
  if (nextSignature === meetingSignature) return;
  meetingSignature = nextSignature;
  stopAllVoiceMonitors();
  clearMediaElements();
  dom.videoGrid.innerHTML = "";

  if (screenStream) {
    dom.videoGrid.append(createStreamTile("Bạn đang trình chiếu", screenStream, { muted: true, screen: true }));
  }

  remoteViews.forEach(({ participant, streams }) => {
    if (streams.screen) {
      dom.videoGrid.append(createStreamTile(`${participant.name} đang trình chiếu`, streams.screen, { muted: false, screen: true }));
    }
  });

  if (cameraStream) {
    const localDisplayStream = micStream
      ? new MediaStream([...cameraStream.getVideoTracks(), ...micStream.getAudioTracks()])
      : cameraStream;
    dom.videoGrid.append(createStreamTile(`${localParticipant.name} - Camera`, localDisplayStream, { muted: true, participantId: localParticipant.id }));
  } else {
    dom.videoGrid.append(createAvatarTile(`${localParticipant.name} (Bạn)`, localParticipant.avatar, micStream, { participantId: localParticipant.id }));
  }

  remoteViews.forEach(({ participant, streams }) => {
    if (streams.camera) {
      dom.videoGrid.append(
        createStreamTile(participant.name, streams.camera, {
          muted: false,
          participantId: participant.id,
          teaseTargetId: participant.id,
          kickTargetId: canManageParticipants ? participant.id : "",
          muteTargetId: canManageParticipants ? participant.id : "",
        }),
      );
      return;
    }

    const avatarAudioStream = streams.audio.length ? new MediaStream(streams.audio) : null;
    dom.videoGrid.append(
      createAvatarTile(participant.name, participant.avatar, streams.screen ? avatarAudioStream : remoteStreams.get(participant.id), {
        participantId: participant.id,
        teaseTargetId: participant.id,
        kickTargetId: canManageParticipants ? participant.id : "",
        muteTargetId: canManageParticipants ? participant.id : "",
      }),
    );
  });
}

async function refreshRooms() {
  try {
    const data = await requestJson(`${api.rooms}?clientId=${encodeURIComponent(clientId)}`);
    rooms = data.rooms;
    if (activeRoom) {
      const updated = rooms.find((room) => room.id === activeRoom.id);
      if (updated) activeRoom = updated;
    }
    renderRooms();
  } catch (error) {
    setMediaStatus("Không lấy được danh sách phòng.");
  }
}

async function refreshActiveRoom() {
  if (!activeRoom) return;
  try {
    const data = await requestJson(`${api.rooms}/${activeRoom.id}?clientId=${encodeURIComponent(clientId)}`);
    const stillInRoom = data.room.participants.some((participant) => participant.id === localParticipant?.id);
    if (!stillInRoom) {
      await leaveLocalRoom(false);
      setMediaStatus("Bạn đã được mời khỏi phòng.");
      refreshRooms();
      return;
    }
    activeRoom = data.room;
    connectMissingPeers();
    renderRooms();
    renderMeeting();
  } catch {
    await leaveLocalRoom(false);
    setMediaStatus("Phòng đã bị xóa hoặc server đã dừng.");
  }
}

function startPolling() {
  if (!roomsPollTimer) roomsPollTimer = setInterval(refreshRooms, 1500);
  refreshRooms();
}

function startRoomPolling() {
  clearInterval(roomPollTimer);
  clearInterval(signalPollTimer);
  clearInterval(heartbeatTimer);
  roomPollTimer = setInterval(refreshActiveRoom, 1000);
  signalPollTimer = setInterval(pollSignals, 500);
  heartbeatTimer = setInterval(sendHeartbeat, 5000);
  refreshActiveRoom();
  pollSignals();
  sendHeartbeat();
}

function stopRoomPolling() {
  clearInterval(roomPollTimer);
  clearInterval(signalPollTimer);
  clearInterval(heartbeatTimer);
  roomPollTimer = null;
  signalPollTimer = null;
  heartbeatTimer = null;
}

async function sendHeartbeat() {
  if (!activeRoom || !localParticipant) return;

  try {
    await requestJson(api.heartbeat, {
      method: "POST",
      body: JSON.stringify({ roomId: activeRoom.id, participantId: localParticipant.id, clientId }),
    });
  } catch {
    await leaveLocalRoom(false);
    setMediaStatus("Bạn đã rời phòng vì kết nối bị gián đoạn.");
  }
}

async function createRoom(event) {
  event.preventDefault();
  clearCreateErrors();
  try {
    const userName = getUserName();
    const data = await requestJson(api.rooms, {
      method: "POST",
      body: JSON.stringify({
        name: dom.roomName.value.trim(),
        password: dom.roomPassword.value,
        userName,
        avatar: getSelectedAvatarId(),
        clientId,
      }),
    });
    dom.globalUserName.value = userName;
    dom.createRoomForm.reset();
    dom.createRoomDialog.close();
    await enterRoom(data.room, data.participant);
  } catch (error) {
    showCreateError(error.message);
  }
}

function openJoinDialog(roomId) {
  const room = rooms.find((item) => item.id === roomId);
  if (!room) return;
  if (room.ban) {
    showBanNotice(room);
    return;
  }

  pendingJoinRoomId = roomId;
  dom.joinRoomLabel.textContent = room.hasPassword
    ? `Nhập mật khẩu để vào "${room.name}".`
    : `Vào "${room.name}" không cần mật khẩu.`;
  dom.joinUserName.value = getUserName();
  selectRandomAvatar(room.participants.map((participant) => participant.avatar));
  dom.joinPassword.value = "";
  dom.joinPassword.required = Boolean(room.hasPassword);
  dom.joinPasswordLabel.classList.toggle("is-hidden", !room.hasPassword);
  clearJoinErrors();
  dom.joinDialog.showModal();
  (room.hasPassword ? dom.joinPassword : dom.joinUserName).focus();
}

function openCreateRoomDialog() {
  selectRandomAvatar();
  clearCreateErrors();
  dom.createRoomDialog.showModal();
  requestAnimationFrame(() => dom.roomName.focus());
}

async function joinRoom(event) {
  event.preventDefault();
  try {
    const userName = getUserName(dom.joinUserName.value);
    const data = await requestJson(api.join, {
      method: "POST",
      body: JSON.stringify({
        roomId: pendingJoinRoomId,
        password: dom.joinPassword.value,
        userName,
        avatar: getSelectedAvatarId(),
        clientId,
      }),
    });
    dom.globalUserName.value = userName;
    pendingJoinRoomId = null;
    dom.joinDialog.close();
    await enterRoom(data.room, data.participant);
  } catch (error) {
    if (error.ban) {
      dom.joinDialog.close();
      showBanNotice(error.ban);
      refreshRooms();
      return;
    }
    showJoinError(error.message);
  }
}

async function enterRoom(room, participant) {
  await leaveLocalRoom(true);
  activeRoom = room;
  localParticipant = participant;
  lastSignalSeq = 0;
  resetChat();
  mediaStateSentTo.clear();
  setParticipantMicState(localParticipant.id, false);
  setMediaStatus("Đã vào phòng. Bật cam/mic để người kia thấy và nghe bạn.");
  startRoomPolling();
  renderRooms();
  renderMeeting();
}

async function deleteRoom(roomId) {
  if (!localParticipant) {
    setMediaStatus("Chỉ người tạo phòng mới được xóa phòng.");
    return;
  }

  try {
    await requestJson(`${api.rooms}/${roomId}?ownerId=${encodeURIComponent(localParticipant.id)}`, { method: "DELETE" });
    if (activeRoom?.id === roomId) await leaveLocalRoom(false);
    refreshRooms();
  } catch (error) {
    setMediaStatus(error.message);
  }
}

function setKickError(message = "") {
  if (dom.kickError) dom.kickError.textContent = message;
}

function setSelectedKickMinutes(minutes) {
  selectedKickMode = "temporary";
  selectedKickMinutes = Number(minutes) || 1;
  dom.kickDurationGrid?.querySelectorAll("button[data-kick-minutes], button[data-kick-mode]").forEach((button) => {
    button.classList.toggle("is-selected", Number(button.dataset.kickMinutes) === selectedKickMinutes);
  });
}

function setSelectedKickPermanent() {
  selectedKickMode = "permanent";
  dom.kickDurationGrid?.querySelectorAll("button[data-kick-minutes], button[data-kick-mode]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.kickMode === "permanent");
  });
}

function openKickDialog(targetId) {
  if (!activeRoom || !localParticipant || activeRoom.ownerId !== localParticipant.id) {
    setMediaStatus("Chỉ chủ phòng mới được mời người khác khỏi phòng.");
    return;
  }

  const target = participantById(targetId);
  if (!target || target.id === localParticipant.id) {
    setMediaStatus("Không thể mời người này khỏi phòng.");
    return;
  }

  pendingKickTargetId = targetId;
  setKickError("");
  setSelectedKickMinutes(1);
  if (dom.kickCustomMinutes) dom.kickCustomMinutes.value = "";
  if (dom.kickDialogTitle) dom.kickDialogTitle.textContent = `Mời ${target.name} khỏi phòng?`;
  dom.kickDialog?.showModal();
}

async function kickParticipant(targetId, options = {}) {
  if (!activeRoom || !localParticipant || activeRoom.ownerId !== localParticipant.id) {
    setMediaStatus("Chỉ chủ phòng mới được mời người khác khỏi phòng.");
    return;
  }

  try {
    const targetName = getParticipantDisplayName(targetId);
    const permanent = options.mode === "permanent";
    const minutes = Math.max(1, Math.min(1440, Math.round(Number(options.minutes || selectedKickMinutes || 1))));
    const data = await requestJson(api.kick, {
      method: "POST",
      body: JSON.stringify({
        roomId: activeRoom.id,
        ownerId: localParticipant.id,
        targetId,
        mode: permanent ? "permanent" : "temporary",
        minutes,
      }),
    });
    activeRoom = data.room;
    closePeer(targetId);
    setMediaStatus(permanent ? `Đã mời ${targetName} khỏi phòng vĩnh viễn.` : `Đã mời ${targetName} khỏi phòng trong ${minutes} phút.`);
    renderMeeting();
    refreshRooms();
  } catch (error) {
    setKickError(error.message);
  }
}

async function forceMuteParticipant(targetId) {
  if (!activeRoom || !localParticipant || activeRoom.ownerId !== localParticipant.id) {
    setMediaStatus("Chỉ chủ phòng mới được tắt mic người khác.");
    return;
  }

  const target = participantById(targetId);
  if (!target || target.id === localParticipant.id) {
    setMediaStatus("Không thể tắt mic người này.");
    return;
  }

  if (!getParticipantMicState(targetId)) {
    setMediaStatus(`${target.name} đang tắt mic.`);
    return;
  }

  try {
    await sendSignal(targetId, "force-mute", { targetId });
    setParticipantMicState(targetId, false);
    setMediaStatus(`Đã yêu cầu tắt mic của ${target.name}.`);
  } catch (error) {
    setMediaStatus(error.message || "Không tắt được mic người này.");
  }
}

async function submitKick(event) {
  event.preventDefault();
  if (!pendingKickTargetId) return;

  const customMinutes = Number(dom.kickCustomMinutes?.value || 0);
  if (!customMinutes && selectedKickMode === "permanent") {
    await kickParticipant(pendingKickTargetId, { mode: "permanent" });
    if (!dom.kickError?.textContent) {
      pendingKickTargetId = null;
      dom.kickDialog?.close();
    }
    return;
  }

  const minutes = customMinutes || selectedKickMinutes || 1;
  if (!minutes || minutes < 1 || minutes > 1440) {
    setKickError("Nhập số phút từ 1 đến 1440.");
    return;
  }

  await kickParticipant(pendingKickTargetId, { mode: "temporary", minutes });
  if (!dom.kickError?.textContent) {
    pendingKickTargetId = null;
    dom.kickDialog?.close();
  }
}

async function leaveRoom() {
  await leaveLocalRoom(true);
}

async function leaveLocalRoom(sendLeave) {
  const roomId = activeRoom?.id;
  const participantId = localParticipant?.id;

  stopRoomPolling();
  closeAllPeers();
  stopAllMedia();
  activeRoom = null;
  localParticipant = null;
  resetChat();
  remoteStreams.clear();
  remoteScreenTrackIds.clear();
  remoteScreenStreamIds.clear();
  remoteTrackStreamIds.clear();
  pendingIceCandidates.clear();
  mediaStateSentTo.clear();
  participantMediaStates.clear();
  speakingParticipants.clear();
  stopAllVoiceMonitors();
  screenStateSentTo.clear();
  renderMeeting();
  renderRooms();

  if (sendLeave && roomId && participantId) {
    await fetch(api.leave, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, participantId }),
    });
    refreshRooms();
  }
}

async function sendSignal(to, type, payload) {
  if (!activeRoom || !localParticipant) return;
  await requestJson(api.signal, {
    method: "POST",
    body: JSON.stringify({
      roomId: activeRoom.id,
      from: localParticipant.id,
      to,
      type,
      payload,
    }),
  });
}

function participantById(id) {
  return activeRoom?.participants.find((participant) => participant.id === id);
}

function removeRemoteVideoTracks(remoteId, trackIds = []) {
  const stream = remoteStreams.get(remoteId);
  if (!stream) return;

  const idSet = new Set(trackIds);
  const videoTracks = stream.getVideoTracks();
  const tracksToRemove = idSet.size ? videoTracks.filter((track) => idSet.has(track.id)) : [];

  tracksToRemove.forEach((track) => {
    stream.removeTrack(track);
    remoteTrackStreamIds.get(remoteId)?.delete(track.id);
    track.stop?.();
  });
  clearMediaElements();
  meetingSignature = "";
  renderMeeting();
}

function removeRemoteCameraTracks(remoteId, trackIds = []) {
  const stream = remoteStreams.get(remoteId);
  if (!stream) return;

  const idSet = new Set(trackIds);
  const videoTracks = stream.getVideoTracks();
  let tracksToRemove = idSet.size ? videoTracks.filter((track) => idSet.has(track.id)) : [];

  if (!tracksToRemove.length) {
    tracksToRemove = videoTracks.filter((track) => !isRemoteScreenTrack(remoteId, track));
  }

  tracksToRemove.forEach((track) => {
    stream.removeTrack(track);
    remoteTrackStreamIds.get(remoteId)?.delete(track.id);
    track.stop?.();
  });
  clearMediaElements();
  meetingSignature = "";
  renderMeeting();
}

function removeRemoteScreenTracks(remoteId, trackIds = []) {
  const stream = remoteStreams.get(remoteId);
  if (!stream) return;

  const idSet = new Set(trackIds);
  const videoTracks = stream.getVideoTracks();
  let tracksToRemove = idSet.size ? videoTracks.filter((track) => idSet.has(track.id)) : [];

  if (!tracksToRemove.length) {
    tracksToRemove = videoTracks.filter((track) => isRemoteScreenTrack(remoteId, track));
  }

  tracksToRemove.forEach((track) => {
    stream.removeTrack(track);
    remoteTrackStreamIds.get(remoteId)?.delete(track.id);
    track.stop?.();
  });
  clearMediaElements();
  meetingSignature = "";
  renderMeeting();
}

function shouldOffer(remoteId) {
  return localParticipant.id < remoteId;
}

function connectMissingPeers() {
  if (!activeRoom || !localParticipant) return;

  activeRoom.participants
    .filter((participant) => participant.id !== localParticipant.id)
    .forEach((participant) => {
      const peer = ensurePeer(participant.id);
      if (shouldOffer(participant.id) && !peer.offered) {
        makeOffer(participant.id);
      }
      if (screenStream && !screenStateSentTo.has(participant.id)) {
        screenStateSentTo.add(participant.id);
        sendSignal(participant.id, "screen-started", { trackIds: getScreenTrackIds(), streamIds: getScreenStreamIds() });
      }
      const mediaStateKey = `${participant.id}:${Boolean(micStream)}`;
      if (!mediaStateSentTo.has(mediaStateKey)) {
        mediaStateSentTo.add(mediaStateKey);
        sendSignal(participant.id, "media-state", { mic: Boolean(micStream) });
      }
    });

  [...peers.keys()].forEach((remoteId) => {
    if (!participantById(remoteId)) {
      closePeer(remoteId);
    }
  });
}

function ensurePeer(remoteId) {
  if (peers.has(remoteId)) return peers.get(remoteId);

  const pc = new RTCPeerConnection(peerConfig);
  const remoteStream = new MediaStream();
  remoteStreams.set(remoteId, remoteStream);

  pc.onicecandidate = (event) => {
    if (event.candidate) sendSignal(remoteId, "candidate", event.candidate);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      setMediaStatus("Kết nối video đang yếu hoặc bị mạng chặn. Thử vào lại phòng; nếu khác mạng vẫn lỗi thì cần bật TURN.");
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") {
      pc.restartIce?.();
      if (shouldOffer(remoteId)) makeOffer(remoteId);
    }
  };

  pc.ontrack = (event) => {
    const incomingStream = event.streams[0] || new MediaStream([event.track]);
    if (!remoteTrackStreamIds.has(remoteId)) remoteTrackStreamIds.set(remoteId, new Map());
    incomingStream.getTracks().forEach((track) => {
      remoteTrackStreamIds.get(remoteId).set(track.id, incomingStream.id);
      if (!remoteStream.getTracks().some((item) => item.id === track.id)) {
        remoteStream.addTrack(track);
        track.addEventListener("ended", () => {
          removeRemoteVideoTracks(remoteId, [track.id]);
        });
        if (track.kind === "video") {
          track.addEventListener("mute", () => {
            setTimeout(() => {
              if (track.muted && !isRemoteScreenTrack(remoteId, track)) {
                removeRemoteCameraTracks(remoteId, [track.id]);
              }
            }, 1200);
          });
          track.addEventListener("unmute", () => {
            meetingSignature = "";
            renderMeeting();
          });
        }
      }
    });
    renderMeeting();
  };

  getOutgoingMediaEntries().forEach(({ track, streams }) => pc.addTrack(track, ...streams));

  const peer = { pc, offered: false };
  peers.set(remoteId, peer);
  return peer;
}

async function makeOffer(remoteId) {
  const peer = ensurePeer(remoteId);
  if (peer.pc.signalingState !== "stable") return;
  syncSenders(peer.pc);
  const offer = await peer.pc.createOffer();
  await peer.pc.setLocalDescription(offer);
  peer.offered = true;
  await sendSignal(remoteId, "offer", peer.pc.localDescription);
}

async function handleSignal(signal) {
  if (signal.type === "kicked") {
    await leaveLocalRoom(false);
    setMediaStatus(signal.payload?.message || "Bạn đã được chủ phòng mời khỏi phòng.");
    refreshRooms();
    return;
  }

  if (signal.type === "leave" || signal.type === "room-deleted") {
    if (signal.type === "room-deleted") await leaveLocalRoom(false);
    if (signal.from) closePeer(signal.from);
    return;
  }

  if (signal.type === "screen-stopped") {
    removeRemoteScreenTracks(signal.from, signal.payload?.trackIds || []);
    setRemoteScreenTracks(signal.from, [], []);
    return;
  }

  if (signal.type === "camera-stopped") {
    removeRemoteCameraTracks(signal.from, signal.payload?.trackIds || []);
    return;
  }

  if (signal.type === "screen-started") {
    setRemoteScreenTracks(signal.from, signal.payload?.trackIds || [], signal.payload?.streamIds || []);
    return;
  }

  if (signal.type === "media-state") {
    setParticipantMicState(signal.from, Boolean(signal.payload?.mic));
    meetingSignature = "";
    renderMeeting();
    return;
  }

  if (signal.type === "force-mute") {
    if (micStream) {
      await stopLocalMic("Trưởng phòng đã tắt mic của bạn.");
    } else {
      setParticipantMicState(localParticipant?.id, false);
    }
    return;
  }

  if (signal.type === "tease") {
    const targetId = signal.payload?.targetId || localParticipant?.id;
    const kind = signal.payload?.kind || "tomato";
    if (targetId) animateTeaseHit(targetId, kind);
    const targetName = targetId === localParticipant?.id ? "bạn" : getParticipantDisplayName(targetId);
    const item = teaseItems[kind] || teaseItems.tomato;
    const verb = item.verb || "ném";
    setMediaStatus(`${getParticipantDisplayName(signal.from)} vừa ${verb} ${item.noun} ${verb === "tặng" ? "cho" : "vào"} ${targetName}.`);
    return;
  }

  if (signal.type === "poll-vote") {
    updatePollVote(signal.payload?.pollId, signal.from, signal.payload?.optionId);
    return;
  }

  if (signal.type === "chat") {
    const participant = getParticipantInfo(signal.from, {
      name: signal.payload?.name,
      avatar: signal.payload?.avatar,
    });
    const kind = signal.payload?.kind || "text";

    if (kind === "poll") {
      const question = String(signal.payload?.question || "").trim();
      const options = Array.isArray(signal.payload?.options) ? signal.payload.options : [];
      if (!question || options.length < 2) return;
      addChatMessage({
        id: signal.payload?.id || `poll-${signal.seq}`,
        kind: "poll",
        from: signal.from,
        name: participant.name,
        avatar: participant.avatar,
        question,
        options: options
          .map((option, index) => ({
            id: String(option.id || `option-${index + 1}`),
            text: String(option.text || "").trim(),
          }))
          .filter((option) => option.text),
        votes: signal.payload?.votes || {},
        createdAt: signal.payload?.createdAt || new Date().toISOString(),
        self: false,
      });
      return;
    }

    if (kind === "spin") {
      const winnerName = String(signal.payload?.winnerName || "").trim();
      if (!winnerName) return;
      addChatMessage({
        id: signal.payload?.id || `spin-${signal.seq}`,
        kind: "spin",
        from: signal.from,
        name: participant.name,
        avatar: participant.avatar,
        prompt: signal.payload?.prompt || "Bốc thăm",
        winnerId: signal.payload?.winnerId,
        winnerName,
        winnerAvatar: signal.payload?.winnerAvatar,
        participants: Array.isArray(signal.payload?.participants) ? signal.payload.participants : [],
        createdAt: signal.payload?.createdAt || new Date().toISOString(),
        self: false,
      });
      return;
    }

    const text = String(signal.payload?.text || "").trim();
    if (!text) return;
    addChatMessage({
      id: signal.payload?.id || `chat-${signal.seq}`,
      kind: "text",
      from: signal.from,
      name: participant.name,
      avatar: participant.avatar,
      text,
      createdAt: signal.payload?.createdAt || new Date().toISOString(),
      self: false,
    });
    return;
  }

  const peer = ensurePeer(signal.from);
  const pc = peer.pc;

  if (signal.type === "offer") {
    syncSenders(pc);
    await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
    await flushPendingIceCandidates(signal.from);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal(signal.from, "answer", pc.localDescription);
  }

  if (signal.type === "answer") {
    await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
    await flushPendingIceCandidates(signal.from);
  }

  if (signal.type === "candidate" && signal.payload) {
    try {
      await addIceCandidateSafely(signal.from, signal.payload);
    } catch {
      setMediaStatus("ICE candidate bị bỏ qua.");
    }
  }
}

async function pollSignals() {
  if (!activeRoom || !localParticipant) return;

  try {
    const url = `${api.signals}?roomId=${encodeURIComponent(activeRoom.id)}&participantId=${encodeURIComponent(
      localParticipant.id,
    )}&since=${lastSignalSeq}`;
    const data = await requestJson(url);
    lastSignalSeq = Math.max(lastSignalSeq, ...data.signals.map((signal) => signal.seq));
    for (const signal of data.signals) {
      await handleSignal(signal);
    }
  } catch {
    setMediaStatus("Mất kết nối signaling.");
  }
}

function syncSenders(pc) {
  const activeEntries = getOutgoingMediaEntries();
  const activeTracks = activeEntries.map((entry) => entry.track);
  pc.getSenders().forEach((sender) => {
    if (sender.track && !activeTracks.includes(sender.track)) {
      pc.removeTrack(sender);
    }
  });

  const sentTracks = pc.getSenders().map((sender) => sender.track).filter(Boolean);
  activeEntries.forEach(({ track, streams }) => {
    if (!sentTracks.includes(track)) pc.addTrack(track, ...streams);
  });
}

async function renegotiateAll() {
  for (const remoteId of peers.keys()) {
    await makeOffer(remoteId);
  }
}

function closePeer(remoteId) {
  const peer = peers.get(remoteId);
  if (peer) peer.pc.close();
  peers.delete(remoteId);
  remoteStreams.delete(remoteId);
  remoteScreenTrackIds.delete(remoteId);
  remoteScreenStreamIds.delete(remoteId);
  remoteTrackStreamIds.delete(remoteId);
  pendingIceCandidates.delete(remoteId);
  participantMediaStates.delete(remoteId);
  speakingParticipants.delete(remoteId);
  stopVoiceMonitor(remoteId);
  screenStateSentTo.delete(remoteId);
  renderMeeting();
}

function closeAllPeers() {
  [...peers.keys()].forEach(closePeer);
}

async function toggleMic() {
  if (!requireActiveRoom()) return;
  if (!hasMediaDevices("getUserMedia")) {
    setMediaStatus(getMediaUnavailableMessage());
    return;
  }

  if (micStream) {
    await stopLocalMic("Mic đã tắt.");
    return;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
    dom.micButton.setAttribute("aria-pressed", "true");
    mediaStateSentTo.clear();
    setParticipantMicState(localParticipant.id, true);
    setMediaStatus("Mic đang bật.");
    renderMeeting();
    await sendSignal("*", "media-state", { mic: true });
    await renegotiateAll();
  } catch {
    setMediaStatus("Không mở được mic. Hãy kiểm tra quyền trình duyệt.");
  }
}

async function stopLocalMic(message = "Mic đã tắt.") {
  if (!micStream || !localParticipant) return;
  stopStream(micStream);
  micStream = null;
  dom.micButton.setAttribute("aria-pressed", "false");
  mediaStateSentTo.clear();
  setParticipantMicState(localParticipant.id, false);
  setParticipantSpeaking(localParticipant.id, false);
  stopVoiceMonitor(localParticipant.id);
  setMediaStatus(message);
  renderMeeting();
  await sendSignal("*", "media-state", { mic: false });
  await renegotiateAll();
}

async function toggleCamera() {
  if (!requireActiveRoom()) return;
  if (!hasMediaDevices("getUserMedia")) {
    setMediaStatus(getMediaUnavailableMessage());
    return;
  }

  if (cameraStream) {
    const stoppedTrackIds = cameraStream.getVideoTracks().map((track) => track.id);
    stopStream(cameraStream);
    cameraStream = null;
    dom.cameraButton.setAttribute("aria-pressed", "false");
    setMediaStatus("Camera đã tắt.");
    renderMeeting();
    await sendSignal("*", "camera-stopped", { trackIds: stoppedTrackIds });
    await renegotiateAll();
    return;
  }

  try {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints, audio: false });
    } catch (constraintError) {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    dom.cameraButton.setAttribute("aria-pressed", "true");
    setMediaStatus("Camera đang bật.");
    renderMeeting();
    await renegotiateAll();
  } catch {
    setMediaStatus("Không mở được camera. Hãy kiểm tra quyền trình duyệt.");
  }
}

async function stopScreenShare() {
  if (!screenStream) return;

  const stoppedTrackIds = screenStream.getTracks().map((track) => track.id);
  stopStream(screenStream);
  screenStream = null;
  screenStateSentTo.clear();
  dom.screenButton.setAttribute("aria-pressed", "false");
  setMediaStatus("Đã dừng trình chiếu.");
  renderMeeting();
  await sendSignal("*", "screen-stopped", { trackIds: stoppedTrackIds });
  await renegotiateAll();
}

async function toggleScreenShare() {
  if (!requireActiveRoom()) return;
  if (!supportsScreenShare()) {
    setMediaStatus("iPhone/iPad thường không hỗ trợ chia sẻ màn hình trên trình duyệt. Hãy share từ Mac hoặc máy tính; điện thoại vẫn xem được.");
    return;
  }

  if (screenStream) {
    await stopScreenShare();
    return;
  }

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const [screenTrack] = screenStream.getVideoTracks();
    if (screenTrack) {
      screenTrack.addEventListener("ended", async () => {
        await stopScreenShare();
      });
    }
    dom.screenButton.setAttribute("aria-pressed", "true");
    setMediaStatus("Đang trình chiếu màn hình.");
    screenStateSentTo.clear();
    renderMeeting();
    await sendSignal("*", "screen-started", { trackIds: getScreenTrackIds(), streamIds: getScreenStreamIds() });
    await renegotiateAll();
  } catch {
    setMediaStatus("Không thể trình chiếu màn hình.");
  }
}

function stopAllMedia() {
  stopStream(cameraStream);
  stopStream(micStream);
  stopStream(screenStream);
  cameraStream = null;
  micStream = null;
  screenStream = null;
  dom.cameraButton.setAttribute("aria-pressed", "false");
  dom.micButton.setAttribute("aria-pressed", "false");
  dom.screenButton.setAttribute("aria-pressed", "false");
  setMediaStatus("");
}

dom.createRoomForm.addEventListener("submit", createRoom);
dom.openCreateRoomButton.addEventListener("click", openCreateRoomDialog);
dom.closeCreateRoomDialog.addEventListener("click", () => dom.createRoomDialog.close());
dom.roomSearch.addEventListener("input", renderRooms);
dom.joinForm.addEventListener("submit", joinRoom);
dom.closeJoinDialog.addEventListener("click", () => dom.joinDialog.close());
dom.clearRoomsButton.addEventListener("click", async () => {
  if (!localParticipant) return;
  const ownedRooms = rooms.filter((room) => room.ownerId === localParticipant.id);
  await Promise.all(
    ownedRooms.map((room) =>
      requestJson(`${api.rooms}/${room.id}?ownerId=${encodeURIComponent(localParticipant.id)}`, { method: "DELETE" }),
    ),
  );
  if (ownedRooms.some((room) => room.id === activeRoom?.id)) await leaveLocalRoom(false);
  refreshRooms();
});
dom.leaveButton.addEventListener("click", leaveRoom);
dom.micButton.addEventListener("click", toggleMic);
dom.cameraButton.addEventListener("click", toggleCamera);
dom.screenButton.addEventListener("click", toggleScreenShare);
dom.chatButton?.addEventListener("click", () => setChatOpen(!chatOpen));
dom.closeChatButton?.addEventListener("click", () => setChatOpen(false));
dom.chatForm?.addEventListener("submit", sendChatMessage);
dom.chatMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  setChatToolMenuOpen(dom.chatToolMenu?.classList.contains("is-hidden"));
});
dom.createPollButton?.addEventListener("click", createPoll);
dom.randomSpinButton?.addEventListener("click", randomSpin);
dom.pollForm?.addEventListener("submit", submitPoll);
dom.closePollDialog?.addEventListener("click", () => dom.pollDialog?.close());
dom.spinForm?.addEventListener("submit", submitSpin);
dom.closeSpinDialog?.addEventListener("click", () => dom.spinDialog?.close());
dom.kickForm?.addEventListener("submit", submitKick);
dom.kickDurationGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-kick-minutes], button[data-kick-mode]");
  if (!button) return;
  if (button.dataset.kickMode === "permanent") {
    setSelectedKickPermanent();
  } else {
    setSelectedKickMinutes(Number(button.dataset.kickMinutes));
  }
  if (dom.kickCustomMinutes) dom.kickCustomMinutes.value = "";
  setKickError("");
});
dom.kickCustomMinutes?.addEventListener("input", () => {
  selectedKickMode = "temporary";
  dom.kickDurationGrid?.querySelectorAll("button[data-kick-minutes], button[data-kick-mode]").forEach((button) => button.classList.remove("is-selected"));
  setKickError("");
});
dom.closeKickDialog?.addEventListener("click", () => {
  pendingKickTargetId = null;
  dom.kickDialog?.close();
});
dom.banNoticeDialog?.addEventListener("close", clearBanNoticeTimer);
dom.themeLightButton?.addEventListener("click", () => setTheme("light"));
dom.themeDarkButton?.addEventListener("click", () => setTheme("dark"));
document.addEventListener("touchend", unlockRemoteMedia, { passive: true });
document.addEventListener("click", (event) => {
  unlockRemoteMedia();
  if (!dom.chatToolMenu?.contains(event.target) && !dom.chatMenuButton?.contains(event.target)) {
    setChatToolMenuOpen(false);
  }
  dom.videoGrid.querySelectorAll(".tile-tease-picker.is-open").forEach((picker) => picker.classList.remove("is-open"));
});
window.addEventListener("beforeunload", () => {
  if (!activeRoom || !localParticipant) return;
  navigator.sendBeacon(
    api.leave,
    new Blob([JSON.stringify({ roomId: activeRoom.id, participantId: localParticipant.id })], {
      type: "application/json",
    }),
  );
});

async function init() {
  setupViewportHeight();
  setTheme(getStoredTheme());
  await loadRuntimeConfig();
  await loadAvatarOptions();
  setupPlatformControls();
  startPolling();
  renderAvatarPickers(getSelectedAvatarId());
  renderMeeting();
  setupTicketInteraction();
  startHeroTypewriter();
}

init();
