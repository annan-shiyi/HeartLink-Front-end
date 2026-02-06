// public/app.js

/* =========================
   0) 常量 & LocalStorage Keys
   ========================= */
const LS = {
    settings: "heartlink_settings_v1",
    mood: "heartlink_mood_v1",
    events: "heartlink_events_v1",
    timeline: "heartlink_timeline_v1",
    messages: "heartlink_messages_v1",
    pokeSince: "heartlink_poke_since_v1"
};

// ---- 云函数路径（如果你文件名不一样，只改这里） ----
const CLOUD_API = {
    get: "/api/sync",
    set: "/api/sync",
};

// 【插入代码 1/3】云同步配置（智能轮询）
const POLL_INTERVAL_ACTIVE = 2000; // 活跃时 2秒
const POLL_INTERVAL_BG = 10000;    // 后台时 10秒
let currentPollInterval = POLL_INTERVAL_ACTIVE;

// 轮询间隔（毫秒）
const CLOUD_POLL_MS = 3000;

// --- 默认配置（兜底） ---
const DEFAULTS = {
    settings: {
        togetherSince: "",
        nextMeetAt: "2026-02-08T20:00:00+08:00",
        coupleCode: "",
        avatarBoy: "",
        avatarGirl: "",
        bgTheme: "warm",
        bgImage: "",
        likes: ["", "", "", "", "", ""]
    },
    mood: {
        weather: "thunderstorm", // sun | rain | thunderstorm
        energy: 15,
        note: "工作有点不开心",
    },
    events: {
        // "YYYY-MM-DD": [{ id, time, title, isReunion }]
    },
    timeline: [
        // { id, text, ts, tag }
    ],
};

/* =========================
   1) 小工具
   ========================= */
const el = (id) => document.getElementById(id);

function safeJSONParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function loadStore(key, fallback) {
    return safeJSONParse(localStorage.getItem(key), fallback);
}
function saveStore(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
}



let USER_TOKEN = localStorage.getItem("heartlink_token") || "";
let USER_USER = safeJSONParse(localStorage.getItem("heartlink_user"), null);
function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function formatCNDate(d) {
    return `${d.getMonth() + 1}月 ${d.getDate()}日`;
}

function daysBetween(startISO, endDate = new Date()) {
    const start = new Date(startISO);
    const end = new Date(endDate);
    const ms = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor(ms / 86400000));
}

function getTogetherDays() {
    const raw = String(state?.settings?.togetherSince || "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return daysBetween(raw, new Date());
}

function getTogetherDays() {
    const raw = String(state?.settings?.togetherSince || "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return daysBetween(raw, new Date());
}

function formatCountdown(targetISO) {
    const now = new Date();
    const target = new Date(targetISO);
    let diff = target - now;
    if (diff <= 0) return "0 天 00 小时";
    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    return `${days} 天 ${pad2(hours)} 小时`;
}

function escapeHTML(s) {
    return String(s || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function toISODate(d) {
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
}

function toLocalDatetimeValue(isoOrOffset) {
    const d = new Date(isoOrOffset);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${y}-${m}-${day}T${hh}:${mm}`;
}

function fromLocalDatetimeValue(v) {
    const d = new Date(v);
    return d.toISOString();
}

function nowTs() { return Date.now(); }

function normalizeCloudEnvelope(payload) {
    // 兼容两种云端格式：
    // 1) 直接存 data
    // 2) { updatedAt, data }
    if (payload && typeof payload === "object" && "data" in payload) return payload;
    return { updatedAt: 0, data: payload ?? null };
}

function normalizeLikes(list, legacyValue = "") {
    const arr = Array.isArray(list) ? list.map((s) => String(s || "").trim()) : [];
    const normalized = arr.length <= 5 ? ["", ...arr] : arr;
    const legacy = String(legacyValue || "").trim();
    if (legacy && !normalized[0]) normalized[0] = legacy;
    while (normalized.length < 6) normalized.push("");
    return normalized.slice(0, 6);
}

function normalizeSettingsLikes() {
    if (!state || !state.settings) return;
    const legacy = "herFavoriteDrink" in state.settings ? state.settings.herFavoriteDrink : "";
    const likes = normalizeLikes(state.settings.likes, legacy);
    state.settings.likes = likes;
    if ("herFavoriteDrink" in state.settings) delete state.settings.herFavoriteDrink;
}

/* =========================
   1.5) 头像/背景（UI 个性化）
   ========================= */
function applyTheme(themeKey) {
    const root = document.documentElement;
    const themes = {
        warm:   { bg: "#FFF9F5", pink: "#FFB7B2", blue: "#AEC6CF" },
        blush:  { bg: "#FFF5F7", pink: "#FFA8A8", blue: "#B2F2BB" },
        ocean:  { bg: "#F5FBFF", pink: "#FFB7C5", blue: "#74C0FC" },
        night:  { bg: "#0f172a", pink: "#fb7185", blue: "#60a5fa", dark:"#EAEAF0", light:"#A8A8B3" },
    };
    const t = themes[themeKey] || themes.warm;
    root.style.setProperty("--bg-color", t.bg);
    root.style.setProperty("--primary-pink", t.pink);
    root.style.setProperty("--primary-blue", t.blue);
    if (t.dark) root.style.setProperty("--text-dark", t.dark);
    if (t.light) root.style.setProperty("--text-light", t.light);
    if (!t.dark) root.style.removeProperty("--text-dark");
    if (!t.light) root.style.removeProperty("--text-light");
}

function applyBackgroundImage(dataUrl) {
    const root = document.documentElement;
    if (dataUrl) {
        root.style.setProperty("--bg-image", `url("${dataUrl}")`);
        applyAutoContrastFromBg(dataUrl);
    } else {
        root.style.setProperty("--bg-image", "none");
        if (document.body) {
            document.body.classList.remove("bg-light", "bg-dark", "bg-mixed");
        }
    }
}

function applyAutoContrastFromBg(dataUrl) {
    if (!dataUrl || !document.body) return;
    const img = new Image();
    img.onload = () => {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        }
        const avg = sum / (data.length / 4);
        document.body.classList.remove("bg-light", "bg-dark", "bg-mixed");
        if (avg >= 0.72) document.body.classList.add("bg-light");
        else if (avg <= 0.35) document.body.classList.add("bg-dark");
        else document.body.classList.add("bg-mixed");
    };
    img.onerror = () => {
        document.body.classList.remove("bg-light", "bg-dark", "bg-mixed");
    };
    img.src = dataUrl;
}

function getMyRole() {
    // 优先用登录返回的 user
    const role = USER_USER && USER_USER.role ? String(USER_USER.role) : "";
    if (role === "girl" || role === "boy") return role;
    // fallback: 默认 boy
    return "boy";
}

function getPartnerPronoun() {
    const role = getMyRole();
    if (role === "boy") return "她";
    if (role === "girl") return "他";
    return "TA";
}

function applyAvatar() {
    if (!dom.headerAvatar) return;
    const role = getMyRole();
    const url = role === "girl" ? state.settings.avatarGirl : state.settings.avatarBoy;
    if (url) {
        dom.headerAvatar.classList.add("has-img");
        dom.headerAvatar.style.backgroundImage = `url("${url}")`;
    } else {
        dom.headerAvatar.classList.remove("has-img");
        dom.headerAvatar.style.backgroundImage = "";
    }
}

function applyUiCustom() {
    applyTheme(state.settings.bgTheme || "warm");
    applyBackgroundImage(state.settings.bgImage || "");
    applyAvatar();
}

function tryVibrate(pattern) {
    // iOS 限制很多；Android Chrome 一般可用
    try {
        if (!("vibrate" in navigator)) return false;
        return navigator.vibrate(pattern);
    } catch (_) { return false; }
}

async function fileToDataUrl(file, maxBytes = 250 * 1024) {
    if (!file) return "";
    if (file.size > maxBytes) {
        throw new Error(`图片太大了（${Math.round(file.size/1024)}KB），请换一张小一点的（建议 < ${Math.round(maxBytes/1024)}KB）`);
    }
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
    });
}

/* =========================
   2) App State
   ========================= */
const state = {
    settings: loadStore(LS.settings, DEFAULTS.settings),
    mood: loadStore(LS.mood, DEFAULTS.mood),
    events: loadStore(LS.events, DEFAULTS.events),
    timeline: loadStore(LS.timeline, DEFAULTS.timeline),
    messages: loadStore(LS.messages, []),

    calendarView: {
        monthCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        selectedDate: toISODate(new Date()),
    },

    cloud: {
        pollingTimer: null,
        errorCount: 0,
        isPolling: false,
        lastPullAt: 0,
        busy: false,
    }
};

function persistAll() {
    saveStore(LS.settings, state.settings);
    saveStore(LS.mood, state.mood);
    saveStore(LS.events, state.events);
    saveStore(LS.timeline, state.timeline);
    saveStore(LS.messages, state.messages);
}

/* =========================
   3) DOM refs (Chat + Top)
   ========================= */
const dom = {
    // header
    dateTitle: el("js-date-title"),
    daysTogether: el("js-days-together"),

    // home
    homeGreeting: el("home-greeting"),
    homeSub: el("home-sub"),
    homeDays: el("home-days"),
    homeCountdown: el("home-countdown"),
    homeMoodEmoji: el("home-mood-emoji"),
    homeMoodTitle: el("home-mood-title"),
    homeMoodNote: el("home-mood-note"),
    homeEventsPreview: el("home-events-preview"),
    homeTimelinePreview: el("home-timeline-preview"),
    homeGoChat: el("home-go-chat"),
    homeGoCalendar: el("home-go-calendar"),
    homeGoDiary: el("home-go-diary"),
    homeGoSettings: el("home-go-settings"),

    // top mood+countdown (chat page)
    moodEmoji: el("js-mood-emoji"),
    moodTitle: el("js-mood-title"),
    moodSubtitle: el("js-mood-subtitle"),
    countdown: el("js-countdown"),

    // chat
    chat: el("js-chat-messages"),
    input: el("js-input"),
    send: el("js-send"),
    chips: el("js-chips"),
    chatClear: el("chat-clear"),

    // tabs
    tabCalendar: el("tab-calendar"),
    tabDiary: el("tab-diary"),
    tabChat: el("tab-chat"),
    tabSettings: el("tab-settings"),
    navbar: document.querySelector(".navbar"),

    // pages
    pageCalendar: el("page-calendar"),
    pageDiary: el("page-diary"),
    pageChat: el("page-chat"),
    pageSettings: el("page-settings"),

    // calendar ui
    calPrev: el("cal-prev"),
    calNext: el("cal-next"),
    calMonthTitle: el("cal-month-title"),
    calGrid: el("cal-grid"),
    calSelectedDate: el("cal-selected-date"),
    eventTime: el("event-time"),
    eventTitle: el("event-title"),
    eventAdd: el("event-add"),
    eventAddReunion: el("event-add-reunion"),
    eventList: el("event-list"),

    // mood edit (calendar page)
    moodSeg: el("mood-weather-seg"),
    moodEnergy: el("mood-energy"),
    moodEnergyPill: el("mood-energy-pill"),
    moodNote: el("mood-note"),
    moodSave: el("mood-save"),
    moodReset: el("mood-reset"),

    // timeline
    tlText: el("tl-text"),
    tlAdd: el("tl-add"),
    tlAddFromMood: el("tl-add-from-mood"),
    tlClear: el("tl-clear"),
    tlList: el("tl-list"),

    // settings
    stTogether: el("st-together"),
    stNextMeet: el("st-nextmeet"),
    stDrink: el("st-drink"),
    stLike1: el("st-like1"),
    stLike2: el("st-like2"),
    stLike3: el("st-like3"),
    stLike4: el("st-like4"),
    stLike5: el("st-like5"),
    stCoupleCode: el("st-couplecode"),
    stSave: el("st-save"),
    stReset: el("st-reset"),
    stExport: el("st-export"),
    stImport: el("st-import"),
    stWipe: el("st-wipe"),
    stDebug: el("st-debug"),
    coupleCopy: el("couple-copy"),
    coupleClear: el("couple-clear"),
    coupleSave: el("couple-save"),
    coupleStatus: el("couple-status"),

    // header interactions
    pokeBtn: el("poke-btn"),
    headerAvatar: el("js-avatar"),
    pokeOverlay: el("poke-overlay"),
    pokeOk: el("poke-ok"),
    pokeFx: el("poke-fx"),
    pokeClose: el("poke-close"),

    // ui customize
    stAvatar: el("st-avatar"),
    stAvatarPreview: el("st-avatar-preview"),
    stAvatarClear: el("st-avatar-clear"),
    stBgTheme: el("st-bg-theme"),
    stBgImage: el("st-bg-image"),
    stBgClear: el("st-bg-clear"),
    cropperOverlay: el("cropper-overlay"),
    cropperTitle: el("cropper-title"),
    cropperStage: el("cropper-stage"),
    cropperCanvas: el("cropper-canvas"),
    cropperPreview: el("cropper-preview"),
    cropperZoom: el("cropper-zoom"),
    cropperCancel: el("cropper-cancel"),
    cropperConfirm: el("cropper-confirm"),

};

/* =========================
   4) 顶部 UI 刷新
   ========================= */
function weatherToEmoji(w) {
    if (w === "sun") return "☀️";
    if (w === "rain") return "🌧️";
    return "⛈️";
}

function weatherToTitle(w) {
    if (w === "sun") return "今天放晴啦";
    if (w === "rain") return "有点小雨";
    return "有点小雷暴";
}

function refreshTopUI() {
    const now = new Date();
    dom.dateTitle.textContent = formatCNDate(now);

    const days = getTogetherDays();
    dom.daysTogether.textContent = (days === null) ? "未设置天数" : `在一起 ${days} 天`;

    dom.moodEmoji.textContent = weatherToEmoji(state.mood.weather);
    dom.moodTitle.textContent = weatherToTitle(state.mood.weather);
    dom.moodSubtitle.textContent = `能量值 ${state.mood.energy}% · ${state.mood.note || "我在这里"}`;

    dom.countdown.textContent = formatCountdown(state.settings.nextMeetAt);
    refreshHomeUI();
    applyUiCustom();
}

function timeGreetingCN(d){
    const h = d.getHours();
    if (h < 6) return "夜深了";
    if (h < 12) return "早安";
    if (h < 18) return "下午好";
    return "晚上好";
}
function formatDateKey(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
}
function fmtShortTime(ts){
    try{
        const d = new Date(ts);
        const m = d.getMonth()+1;
        const day = d.getDate();
        const hh = String(d.getHours()).padStart(2,"0");
        const mm = String(d.getMinutes()).padStart(2,"0");
        return `${m}/${day} ${hh}:${mm}`;
    }catch(_){
        return "";
    }
}
function renderHomeEventsPreview(){
    if (!dom.homeEventsPreview) return;
    const todayKey = formatDateKey(new Date());
    const list = (state.events && state.events[todayKey]) ? state.events[todayKey] : [];
    if (!Array.isArray(list) || list.length === 0){
        dom.homeEventsPreview.innerHTML = `<div class="muted">还没有计划，去日历里写一个小目标吧～</div>`;
        return;
    }
    const sorted = [...list].sort((a,b)=> String(a.time||"").localeCompare(String(b.time||"")));
    const show = sorted.slice(0, 3);
    dom.homeEventsPreview.innerHTML = show.map(e => {
        const badge = e.isReunion ? `<div class="badge">🚄 见面</div>` : `<div class="badge">${escapeHTML(e.time || "—")}</div>`;
        return `
            <div class="home-preview-item">
                <div>
                    <div class="t">${escapeHTML(e.title || "（未命名）")}</div>
                    <div class="m">${escapeHTML(e.isReunion ? "下次见面" : "今日计划")}</div>
                </div>
                ${badge}
            </div>
        `;
    }).join("") + (sorted.length>3 ? `<div class="muted">还有 ${sorted.length-3} 个…</div>` : "");
}
function renderHomeTimelinePreview(){
    if (!dom.homeTimelinePreview) return;
    const list = Array.isArray(state.timeline) ? state.timeline : [];
    if (list.length === 0){
        dom.homeTimelinePreview.innerHTML = `<div class="muted">还没有记录，去时光轴写下第一个闪光瞬间吧～</div>`;
        return;
    }
    const sorted = [...list].sort((a,b)=> Number(b.ts||0)-Number(a.ts||0));
    const show = sorted.slice(0, 2);
    dom.homeTimelinePreview.innerHTML = show.map(it => {
        const tag = it.tag ? `<span class="tag">${escapeHTML(it.tag)}</span>` : "";
        return `
            <div class="home-preview-item">
                <div>
                    <div class="t">${escapeHTML((it.text||"").slice(0, 60) || "（空）")}</div>
                    <div class="m">${fmtShortTime(it.ts)} ${tag}</div>
                </div>
                <div class="badge">✨</div>
            </div>
        `;
    }).join("") + (sorted.length>2 ? `<div class="muted">还有更多瞬间在时光轴里～</div>` : "");
}
function refreshHomeUI(){
    if (!dom.homeGreeting) return; // 未启用首页
    const now = new Date();
    dom.homeGreeting.textContent = `${timeGreetingCN(now)}，今天也要好好相爱`;
    if (dom.homeSub){
        startHomeTipLoop();
    }
    const days = getTogetherDays();
    if (dom.homeDays) dom.homeDays.textContent = (days === null) ? "未设置天数" : `在一起 ${days} 天`;
    if (dom.homeCountdown) dom.homeCountdown.textContent = formatCountdown(state.settings.nextMeetAt);

    if (dom.homeMoodEmoji) dom.homeMoodEmoji.textContent = weatherToEmoji(state.mood.weather);
    if (dom.homeMoodTitle) dom.homeMoodTitle.textContent = weatherToTitle(state.mood.weather);
    if (dom.homeMoodNote) dom.homeMoodNote.textContent = `能量 ${state.mood.energy}% · ${state.mood.note || "我在这里"}`;

    renderHomeEventsPreview();
    renderHomeTimelinePreview();
}

let homeTipTimer = null;
let homeTipIndex = 0;

function buildHomeTips() {
    const likes = normalizeLikes(state.settings.likes);
    return likes.map((s) => String(s || "").trim()).filter(Boolean);
}

function startHomeTipLoop() {
    stopHomeTipLoop();
    if (!dom.homeSub) return;
    const tips = buildHomeTips();
    if (tips.length === 0) {
        dom.homeSub.textContent = "小熊提示：把喜欢写进日常";
        return;
    }
    homeTipIndex = 0;
    dom.homeSub.textContent = `小熊提示：${tips[homeTipIndex]}`;
    homeTipTimer = setInterval(() => {
        const list = buildHomeTips();
        if (list.length === 0) {
            dom.homeSub.textContent = "小熊提示：把喜欢写进日常";
            return;
        }
        homeTipIndex = (homeTipIndex + 1) % list.length;
        dom.homeSub.textContent = `小熊提示：${list[homeTipIndex]}`;
    }, 4000);
}

function stopHomeTipLoop() {
    if (homeTipTimer) {
        clearInterval(homeTipTimer);
        homeTipTimer = null;
    }
}


function syncMoodEditorUI() {
    const btns = dom.moodSeg.querySelectorAll("button[data-weather]");
    btns.forEach(b => {
        b.classList.toggle("active", b.dataset.weather === state.mood.weather);
    });

    dom.moodEnergy.value = String(state.mood.energy);
    dom.moodEnergyPill.textContent = `${state.mood.energy}%`;
    dom.moodNote.value = state.mood.note || "";
}

/* =========================
   5) 云同步（核心）
   ========================= */

// 1. 设置状态灯颜色
function setCloudStatus(status) {
    // status: 'ok' | 'syncing' | 'error' | 'offline'
    const el = document.getElementById("js-cloud-status");
    if (!el) return;

    const map = {
        ok: "#69DB7C",      // 绿
        syncing: "#FFD43B", // 黄
        error: "#FF6B6B",   // 红
        offline: "#ced4da"  // 灰
    };
    el.style.backgroundColor = map[status] || map.offline;
    el.title = `状态: ${status}`;
}

// 2. 通用 API 调用
async function apiCall(url, body, methodOverride) {
    const headers = { "Content-Type": "application/json" };
    if (USER_TOKEN) headers.token = USER_TOKEN;

    const method = methodOverride || (body ? "POST" : "GET");
    const conf = body
        ? { method, headers, body: JSON.stringify(body) }
        : { method, headers };

    try {
        const resp = await fetch(url, conf);
        const text = await resp.text();
        let payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }

        if (!resp.ok) {
            const msg = (payload && typeof payload === "object" && payload.error) ? payload.error : (text || `${resp.status}`);
            throw new Error(`API ${resp.status}: ${msg}`);
        }
        return payload;
    } catch (e) {
        console.warn("API Fail:", url, e);
        throw e;
    }
}

function getCoupleCode() {
    return String(state.settings.coupleCode || "").trim();
}

async function cloudGet(kind) {
    if (!USER_TOKEN) {
        setCloudStatus("offline");
        return null;
    }

    const url = `${CLOUD_API.get}?kind=${encodeURIComponent(kind)}`;
    const json = await apiCall(url, null, "GET");
    return json?.data ?? null;
}

async function cloudSet(kind, data) {
    if (!USER_TOKEN) {
        setCloudStatus("offline");
        return;
    }

    setCloudStatus("syncing");
    try {
        await apiCall(CLOUD_API.set, { kind, data }, "POST");
        setCloudStatus("ok");
        state.cloud.errorCount = 0;
    } catch (e) {
        state.cloud.errorCount = (state.cloud.errorCount || 0) + 1;
        setCloudStatus("error");
        throw e;
    }
}

async function cloudPushTimeline(item) {
    // V4：统一走 /api/sync，timeline 采用整份 upsert
    return cloudSet("timeline", state.timeline);
}

function fireAndForget(p) {
    Promise.resolve(p).catch(() => {});
}

function applyCloudMood(remote) {
    if (!remote) return;
    const r = normalizeCloudEnvelope(remote);
    const remoteMood = r.data || remote; // 兼容直接存 mood 的情况
    if (!remoteMood) return;

    const remoteUpdated = Number(remoteMood.updatedAt || r.updatedAt || 0);
    const localUpdated = Number(state.mood.updatedAt || 0);

    if (remoteUpdated > localUpdated) {
        state.mood = { ...state.mood, ...remoteMood };
        saveStore(LS.mood, state.mood);
        refreshTopUI();
        syncMoodEditorUI();
    }
}

function applyCloudTimeline(remote) {
    if (!remote) return;

    const r = normalizeCloudEnvelope(remote);
    const arr = Array.isArray(r.data) ? r.data : (Array.isArray(remote) ? remote : []);
    if (!Array.isArray(arr)) return;

    // 合并去重：按 id
    const map = new Map();
    for (const it of state.timeline || []) {
        if (it && it.id) map.set(it.id, it);
    }
    for (const it of arr) {
        if (it && it.id) map.set(it.id, it);
    }
    state.timeline = Array.from(map.values());
    saveStore(LS.timeline, state.timeline);
    renderTimeline();
}

function applyCloudEvents(remote) {
    if (!remote) return;

    const r = normalizeCloudEnvelope(remote);
    const remoteEvents = r.data && typeof r.data === "object" ? r.data : (typeof remote === "object" ? remote : null);
    if (!remoteEvents) return;

    // 事件整份覆盖 + 用 updatedAt 做简单冲突解决
    const remoteUpdated = Number(r.updatedAt || remoteEvents.updatedAt || 0);
    const localUpdated = Number(state.events?.updatedAt || 0);

    // 如果云端是纯对象（没有 updatedAt），直接覆盖一次
    if (!remoteUpdated) {
        state.events = remoteEvents;
        saveStore(LS.events, state.events);
        renderCalendar();
        renderEventsForSelectedDate();
        return;
    }

    if (remoteUpdated > localUpdated) {
        state.events = remoteEvents.data || remoteEvents;
        // 保留 updatedAt（如果是 envelope）
        if (remoteEvents.data) state.events.updatedAt = remoteUpdated;
        saveStore(LS.events, state.events);
        renderCalendar();
        renderEventsForSelectedDate();
    }
}

function applyCloudSettings(remote) {
    if (!remote) return;
    const r = normalizeCloudEnvelope(remote);
    const remoteSettings = r.data && typeof r.data === "object" ? r.data : (typeof remote === "object" ? remote : null);
    if (!remoteSettings) return;

    const merged = {
        ...state.settings,
        togetherSince: remoteSettings.togetherSince || state.settings.togetherSince,
        nextMeetAt: remoteSettings.nextMeetAt || state.settings.nextMeetAt,
        likes: normalizeLikes(
            Array.isArray(remoteSettings.likes) ? remoteSettings.likes : state.settings.likes,
            remoteSettings.herFavoriteDrink ?? state.settings.herFavoriteDrink
        ),
        // coupleCode 由登录态决定（这里保留本地展示）
        coupleCode: state.settings.coupleCode,
        avatarBoy: remoteSettings.avatarBoy ?? state.settings.avatarBoy ?? "",
        avatarGirl: remoteSettings.avatarGirl ?? state.settings.avatarGirl ?? "",
        bgTheme: remoteSettings.bgTheme ?? state.settings.bgTheme ?? "warm",
        bgImage: remoteSettings.bgImage ?? state.settings.bgImage ?? "",
    };

    if ("herFavoriteDrink" in merged) delete merged.herFavoriteDrink;
    state.settings = merged;
    saveStore(LS.settings, state.settings);
    refreshTopUI();
    syncSettingsUI();
    renderSettingsDebug();
}

async function syncFromCloudOnce() {
    if (!USER_TOKEN) {
        setCloudStatus("offline");
        return;
    }
    setCloudStatus("syncing");

    if (state.cloud.busy) return;
    state.cloud.busy = true;

    try {
        const [mood, timeline, events, settings] = await Promise.allSettled([
            cloudGet("mood"),
            cloudGet("timeline"),
            cloudGet("events"),
            cloudGet("settings"),
        ]);

        if (mood.status === "fulfilled") applyCloudMood(mood.value);
        if (timeline.status === "fulfilled") applyCloudTimeline(timeline.value);
        if (events.status === "fulfilled") applyCloudEvents(events.value);
        if (settings.status === "fulfilled") applyCloudSettings(settings.value);

        state.cloud.lastPullAt = nowTs();

        setCloudStatus("ok");
        state.cloud.errorCount = 0;
    } catch (e) {
        state.cloud.errorCount = (state.cloud.errorCount || 0) + 1;
        if (state.cloud.errorCount > 2) setCloudStatus("error");
        throw e;
    } finally {
        state.cloud.busy = false;
    }
}

async function bootstrapCloudIfEmpty() {
    // 第一次绑定 coupleCode：如果云端没有数据，用本地作为初始
    if (!USER_TOKEN) return;
    try {
        const mood = await cloudGet("mood");
        if (!mood) {
            if (!state.mood.updatedAt) state.mood.updatedAt = nowTs();
            await cloudSet("mood", state.mood);
        }

        const tl = await cloudGet("timeline");
        if (!tl || (Array.isArray(tl) && tl.length === 0)) {
            await cloudSet("timeline", state.timeline);
        }

        const ev = await cloudGet("events");
        if (!ev || (typeof ev === "object" && Object.keys(ev).length === 0)) {
            if (!state.events.updatedAt) state.events.updatedAt = nowTs();
            await cloudSet("events", state.events);
        }

        const st = await cloudGet("settings");
        if (!st) {
            // 只上传公共字段
            await cloudSet("settings", {
                togetherSince: state.settings.togetherSince,
                nextMeetAt: state.settings.nextMeetAt,
                likes: normalizeLikes(state.settings.likes),
                updatedAt: nowTs(),
            });
        }
    } catch (e) {
        // ignore bootstrap failure
    }
}

// 6. 智能轮询启动器（前台更快 / 后台更慢）
function startSmartPolling() {
    // 清理旧轮询
    if (state.cloud.pollingTimer) {
        clearTimeout(state.cloud.pollingTimer);
        state.cloud.pollingTimer = null;
    }
    if (!USER_TOKEN) {
        state.cloud.isPolling = false;
        setCloudStatus("offline");
        return;
    }
    state.cloud.isPolling = true;

    const loop = async () => {
        try {
            await syncFromCloudOnce();
        } catch (e) {
            // syncFromCloudOnce 内部会计数/点灯，这里不再重复
        }

        currentPollInterval = document.hidden ? POLL_INTERVAL_BG : POLL_INTERVAL_ACTIVE;
        state.cloud.pollingTimer = setTimeout(loop, currentPollInterval);
    };

    loop();

    // 监听切换后台（防止重复绑定）
    document.removeEventListener("visibilitychange", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
}

function stopSmartPolling() {
    if (state.cloud.pollingTimer) {
        clearTimeout(state.cloud.pollingTimer);
        state.cloud.pollingTimer = null;
    }
    state.cloud.isPolling = false;
}

function handleVisibility() {
    if (!document.hidden) {
        if (!USER_TOKEN) return;
        // 切回来时立即刷新 & 重启定时器，保证前台更“同步”
        startSmartPolling();
        startPokePolling();
        fireAndForget(syncFromCloudOnce());
    }
}

// 兼容旧名字：项目其它地方若还在调用 startCloudPolling/stopCloudPolling，不需要改
function startCloudPolling() { startSmartPolling();
    startPokePolling(); }
function stopCloudPolling() { stopSmartPolling(); }
/* =========================
   5.9) Poke
   - POST /api/poke ??
   - GET  /api/poke ????
   ========================= */
let lastPokeAt = Number(localStorage.getItem(LS.pokeSince) || 0);
let pokeTimer = null;
let pokeQueue = [];
let pokeShowing = false;
let lastAckedPokeAt = 0;
let pokeFxRaf = null;
let pokeFxParticles = [];
let pokeFxRunning = false;
let pokeFxResize = null;

function drawHeart(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size, size);
    ctx.beginPath();
    ctx.moveTo(0.5, 0.85);
    ctx.bezierCurveTo(0.15, 0.6, 0.0, 0.35, 0.2, 0.2);
    ctx.bezierCurveTo(0.35, 0.05, 0.5, 0.12, 0.5, 0.25);
    ctx.bezierCurveTo(0.5, 0.12, 0.65, 0.05, 0.8, 0.2);
    ctx.bezierCurveTo(1.0, 0.35, 0.85, 0.6, 0.5, 0.85);
    ctx.closePath();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.6;
    ctx.fill();
    ctx.restore();
}

function drawSpark(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function startPokeFx() {
    const canvas = dom.pokeFx;
    if (!canvas || pokeFxRunning) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    pokeFxRunning = true;
    const resize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    pokeFxResize = resize;
    window.addEventListener("resize", resize);

    const count = 48;
    pokeFxParticles = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vy: 30 + Math.random() * 90,
        vx: -15 + Math.random() * 30,
        size: 18 + Math.random() * 24,
        life: 1 + Math.random() * 1.2,
        maxLife: 1.2 + Math.random() * 1.2,
        kind: Math.random() > 0.3 ? "heart" : "spark",
        color: Math.random() > 0.5 ? "rgba(255,92,120,0.9)" : "rgba(255,140,170,0.9)"
    }));

    let last = performance.now();
    const tick = (now) => {
        if (!pokeFxRunning) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);
        for (const p of pokeFxParticles) {
            p.y += p.vy * dt;
            p.x += p.vx * dt;
            p.life -= dt;
            if (p.y > h + 60 || p.life <= 0) {
                p.x = Math.random() * w;
                p.y = -20 - Math.random() * 80;
                p.vy = 30 + Math.random() * 90;
                p.vx = -15 + Math.random() * 30;
                p.size = 18 + Math.random() * 24;
                p.life = 1 + Math.random() * 1.2;
                p.maxLife = 1.2 + Math.random() * 1.2;
            }
            const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
            if (p.kind === "spark") {
                drawSpark(ctx, p.x, p.y, p.size * 0.12, "rgba(255, 230, 240, 0.9)", alpha);
            } else {
                drawHeart(ctx, p.x, p.y, p.size * 0.9, p.color, alpha);
            }
        }
        pokeFxRaf = requestAnimationFrame(tick);
    };
    pokeFxRaf = requestAnimationFrame(tick);
}

function stopPokeFx() {
    pokeFxRunning = false;
    if (pokeFxRaf) {
        cancelAnimationFrame(pokeFxRaf);
        pokeFxRaf = null;
    }
    if (pokeFxResize) {
        window.removeEventListener("resize", pokeFxResize);
        pokeFxResize = null;
    }
    if (dom.pokeFx) {
        const ctx = dom.pokeFx.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, dom.pokeFx.width, dom.pokeFx.height);
    }
}

function closePokeOverlay() {
    if (!dom.pokeOverlay) return;
    clearTimeout(showPokeOverlay._t);
    dom.pokeOverlay.classList.add("hidden");
    document.body?.classList.remove("poke-lock");
    stopPokeFx();
    pokeShowing = false;
    if (pokeQueue.length) setTimeout(showNextPoke, 120);
}

function showPokeOverlay(evt) {
    if (!dom.pokeOverlay) return;
    pokeShowing = true;
    dom.pokeOverlay.classList.remove("hidden");
    document.body?.classList.add("poke-lock");

    const txt = dom.pokeOverlay.querySelector(".poke-text");
    if (txt) txt.textContent = "Ta ????";

    tryVibrate([30, 60, 30]);
    startPokeFx();

    if (evt && evt.t) ackPoke(evt.t);
}

function showNextPoke() {
    if (pokeShowing) return;
    const evt = pokeQueue.shift();
    if (evt) showPokeOverlay(evt);
}

async function sendPoke() {
    if (!USER_TOKEN) {
        showAuthOverlay(true);
        return;
    }
    if (!dom.pokeBtn) return;

    dom.pokeBtn.classList.add("beat");
    setTimeout(() => dom.pokeBtn.classList.remove("beat"), 650);

    tryVibrate(25);

    try {
        const r = await apiCall("/api/poke", { type: "poke" }, "POST");
        if (r && r.t) {
            lastPokeAt = Math.max(lastPokeAt, Number(r.t));
            localStorage.setItem(LS.pokeSince, String(lastPokeAt));
        }
    } catch (e) {
        console.warn("send poke failed", e);
    }
}

async function ackPoke(t) {
    const n = Number(t || 0);
    if (!n || !USER_TOKEN) return;
    if (n <= lastAckedPokeAt) return;
    lastAckedPokeAt = n;
    try {
        await apiCall("/api/poke", { type: "ack", t: n }, "POST");
    } catch (_) {
        // ignore
    }
}

async function pollPokeOnce() {
    if (!USER_TOKEN) return;
    try {
        const res = await apiCall("/api/poke", null, "GET");
        const reason = String(res?.debug?.reason || "");
        if (reason === "NOT_PAIRED" || reason === "NOT_IN_RELATION") {
            stopPokePolling();
            if (dom.coupleStatus) dom.coupleStatus.textContent = "未配对/请先保存匹配码绑定";
            return;
        }
        const events = Array.isArray(res?.events) ? res.events : [];
        if (events.length) {
            const sorted = events.slice().sort((a, b) => Number(a.t) - Number(b.t));
            for (const evt of sorted) {
                if (!evt || !evt.t) continue;
                pokeQueue.push(evt);
            }
            showNextPoke();
        }
    } catch (e) {
        const msg = String(e?.message || "");
        if (msg.includes("NOT_PAIRED") || msg.includes("COUPLE_FULL") || msg.includes("NOT_IN_RELATION")) {
            stopPokePolling();
            if (dom.coupleStatus) dom.coupleStatus.textContent = "未配对/配对码被占用";
        }
    }
}

function startPokePolling() {
    stopPokePolling();
    if (!USER_TOKEN) return;
    const loop = async () => {
        await pollPokeOnce();
        pokeTimer = setTimeout(loop, document.hidden ? 8000 : 2500);
    };
    loop();
}

function stopPokePolling() {
    if (pokeTimer) {
        clearTimeout(pokeTimer);
        pokeTimer = null;
    }
}

function initPokeUI() {
    if (dom.pokeBtn) dom.pokeBtn.addEventListener("click", sendPoke);
    if (dom.pokeOk) dom.pokeOk.addEventListener("click", (e) => {
        e.stopPropagation();
        closePokeOverlay();
    });
    if (dom.pokeClose) dom.pokeClose.addEventListener("click", (e) => {
        e.stopPropagation();
        closePokeOverlay();
    });
}


/* =========================
   6) Chat 渲染与交互
   ========================= */
function renderMessage(m) {
    if (m.role === "user") {
        const div = document.createElement("div");
        div.className = "msg-bubble msg-user";
        div.innerHTML = escapeHTML(m.content);
        dom.chat.appendChild(div);
        return;
    }

    const group = document.createElement("div");
    group.className = "message-group";

    const avatar = document.createElement("div");
    avatar.className = "ai-avatar";
    avatar.textContent = "🧸";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble msg-ai";
    bubble.innerHTML = escapeHTML(m.content).replaceAll("\n", "<br>");

    group.appendChild(avatar);
    group.appendChild(bubble);
    dom.chat.appendChild(group);
}

function renderAllMessages() {
    dom.chat.innerHTML = "";
    for (const m of state.messages) renderMessage(m);
    dom.chat.scrollTop = dom.chat.scrollHeight;
}

function renderTyping(on) {
    const id = "js-typing";
    const existed = document.getElementById(id);
    if (!on && existed) existed.remove();
    if (on && existed) return;

    const group = document.createElement("div");
    group.className = "message-group";
    group.id = id;

    const avatar = document.createElement("div");
    avatar.className = "ai-avatar";
    avatar.textContent = "🧸";

    const typing = document.createElement("div");
    typing.className = "typing-indicator";
    typing.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;

    group.appendChild(avatar);
    group.appendChild(typing);
    dom.chat.appendChild(group);
    dom.chat.scrollTop = dom.chat.scrollHeight;
}

async function callAI(userText) {
    if (!USER_TOKEN) {
        throw new Error("请先登录");
    }

    const payload = {
        mood: {
            ...state.mood,
        },
        likes: normalizeLikes(state.settings.likes),
        messages: state.messages.slice(-12),
        userText,
        token: USER_TOKEN,
        meta: {
            coupleCode: state.settings.coupleCode || "",
            nextMeetAt: state.settings.nextMeetAt,
            togetherSince: state.settings.togetherSince
        }
    };

    const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": USER_TOKEN },
        body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { reply: text }; }

    if (!resp.ok) {
        const msg = (data && data.error) ? data.error : text;
        throw new Error(`API ${resp.status}: ${msg}`);
    }
    return data;
}

async function onSend(textOverride = null) {
    const text = (textOverride ?? dom.input.value ?? "").trim();
    if (!text) return;

    if (!USER_TOKEN) {
        showAuthOverlay(true);
        state.messages.push({ role: "ai", content: "要先登录才可以找小熊聊天哦～", ts: Date.now() });
        saveStore(LS.messages, state.messages);
        renderAllMessages();
        return;
    }

    dom.input.value = "";
    state.messages.push({ role: "user", content: text, ts: Date.now() });
    saveStore(LS.messages, state.messages);
    renderAllMessages();

    renderTyping(true);
    try {
        const data = await callAI(text);
        renderTyping(false);

        const aiText = data.reply || "我在这呢。";
        state.messages.push({ role: "ai", content: aiText, ts: Date.now() });
        saveStore(LS.messages, state.messages);
        renderAllMessages();
    } catch (e) {
        renderTyping(false);
        state.messages.push({ role: "ai", content: `小熊睡着了（报错）：${String(e.message || e)}`, ts: Date.now() });
        saveStore(LS.messages, state.messages);
        renderAllMessages();
    }
}

/* =========================
   7) Tabs 切换
   ========================= */
function initTabs() {
    const tabs = [
        { tabId: "tab-home", pageId: "page-home" },
        { tabId: "tab-calendar", pageId: "page-calendar" },
        { tabId: "tab-diary", pageId: "page-diary" },
        { tabId: "tab-chat", pageId: "page-chat" },
        { tabId: "tab-settings", pageId: "page-settings" }
    ];

    function setActive(tabId) {
        for (const t of tabs) {
            const tabEl = el(t.tabId);
            const pageEl = el(t.pageId);
            if (!tabEl || !pageEl) continue;
            const isActive = t.tabId === tabId;
            tabEl.classList.toggle("active", isActive);
            pageEl.classList.toggle("hidden", !isActive);
        }

        if (tabId === "tab-home") {
            refreshHomeUI();
            startHomeTipLoop();
        } else {
            stopHomeTipLoop();
        }

        if (tabId === "tab-calendar") {
            renderCalendar();
            renderEventsForSelectedDate();
            syncMoodEditorUI();
        }
        if (tabId === "tab-diary") {
            renderTimeline();
        }
        if (tabId === "tab-settings") {
            syncSettingsUI();
            renderSettingsDebug();
        }
        if (tabId === "tab-chat") {
            renderAllMessages();
            refreshTopUI();
        }
    }

    tabs.forEach(t => {
        const btn = el(t.tabId);
        if (!btn) return;
        btn.addEventListener("click", () => setActive(t.tabId));
    });

    setActive("tab-home");
}

/* =========================
   8) Calendar（月历 + 当天计划）
   ========================= */
function monthTitle(d) {
    return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
}

function getMonthMatrix(cursor) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    const first = new Date(year, month, 1);

    const jsDay = first.getDay(); // Sun=0
    const offset = (jsDay + 6) % 7; // Mon=0
    const start = new Date(year, month, 1 - offset);

    const cells = [];
    for (let i = 0; i < 42; i++) {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        cells.push(day);
    }
    return { first, cells };
}

function hasEventOn(dateISO) {
    const arr = state.events[dateISO] || [];
    return Array.isArray(arr) && arr.length > 0;
}

function renderCalendar() {
    const cursor = state.calendarView.monthCursor;
    dom.calMonthTitle.textContent = monthTitle(cursor);

    dom.calGrid.innerHTML = "";
    const { cells } = getMonthMatrix(cursor);

    const todayISO = toISODate(new Date());
    const selectedISO = state.calendarView.selectedDate;
    const month = cursor.getMonth();

    cells.forEach(d => {
        const iso = toISODate(d);
        const btn = document.createElement("div");
        btn.className = "day";
        btn.textContent = String(d.getDate());

        if (d.getMonth() !== month) btn.classList.add("dim");
        if (iso === todayISO) btn.classList.add("today");
        if (iso === selectedISO) btn.classList.add("selected");
        if (hasEventOn(iso)) {
            const dot = document.createElement("div");
            dot.className = "dot-badge";
            btn.appendChild(dot);
        }

        btn.addEventListener("click", () => {
            state.calendarView.selectedDate = iso;
            renderCalendar();
            renderEventsForSelectedDate();
        });

        dom.calGrid.appendChild(btn);
    });

    dom.calSelectedDate.textContent = selectedISO;
}

function renderEventsForSelectedDate() {
    const dateISO = state.calendarView.selectedDate;
    dom.calSelectedDate.textContent = dateISO;

    const items = state.events[dateISO] || [];
    if (!Array.isArray(items) || items.length === 0) {
        dom.eventList.innerHTML = `<div class="muted">这一天还没有计划～</div>`;
        return;
    }

    dom.eventList.innerHTML = "";
    items
        .slice()
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
        .forEach(ev => {
            const row = document.createElement("div");
            row.className = "event-item";

            const left = document.createElement("div");
            left.style.flex = "1";

            const title = document.createElement("div");
            title.className = "event-title";
            title.textContent = ev.title || "(无标题)";

            const meta = document.createElement("div");
            meta.className = "event-meta";
            meta.textContent = `${ev.time || "--:--"}${ev.isReunion ? " · 🚄 下次见面" : ""}`;

            left.appendChild(title);
            left.appendChild(meta);

            const actions = document.createElement("div");
            actions.className = "event-actions";

            const del = document.createElement("button");
            del.className = "btn btn-danger btn-small";
            del.textContent = "删除";
            del.addEventListener("click", () => {
                const arr = state.events[dateISO] || [];
                state.events[dateISO] = arr.filter(x => x.id !== ev.id);

                // 事件更新标记
                state.events.updatedAt = nowTs();

                saveStore(LS.events, state.events);
                renderCalendar();
                renderEventsForSelectedDate();

                // 云同步：events
                fireAndForget(cloudSet("events", state.events));

                if (ev.isReunion) {
                    syncNextMeetFromEvents();
                    refreshTopUI();
                    syncSettingsUI();

                    // 公共 settings 同步
                    fireAndForget(cloudSet("settings", {
                        updatedAt: nowTs(),
                        data: {
                            togetherSince: state.settings.togetherSince,
                            nextMeetAt: state.settings.nextMeetAt,
                            likes: normalizeLikes(state.settings.likes)
                        }
                    }));
                }
            });

            actions.appendChild(del);

            row.appendChild(left);
            row.appendChild(actions);
            dom.eventList.appendChild(row);
        });

    refreshHomeUI();
}

function stripEventsMeta(eventsObj) {
    // eventsObj 里我们加了 updatedAt 字段，不希望混进实际日期 key
    const out = {};
    for (const [k, v] of Object.entries(eventsObj || {})) {
        if (k === "updatedAt") continue;
        out[k] = v;
    }
    return out;
}

function addEventForSelectedDate({ title, time, isReunion }) {
    const dateISO = state.calendarView.selectedDate;
    const arr = state.events[dateISO] || [];
    arr.push({ id: uid("ev"), title, time, isReunion: !!isReunion });
    state.events[dateISO] = arr;

    // 事件更新标记
    state.events.updatedAt = nowTs();

    saveStore(LS.events, state.events);

    renderCalendar();
    renderEventsForSelectedDate();

    // 云同步：events（整份覆盖）
    fireAndForget(cloudSet("events", state.events));

    if (isReunion) {
        const t = time && time.includes(":") ? time : "20:00";
        const dt = new Date(`${dateISO}T${t}:00`);
        state.settings.nextMeetAt = dt.toISOString();
        saveStore(LS.settings, state.settings);
        refreshTopUI();
        syncSettingsUI();

        // 公共 settings 同步
        fireAndForget(cloudSet("settings", {
            updatedAt: nowTs(),
            data: {
                togetherSince: state.settings.togetherSince,
                nextMeetAt: state.settings.nextMeetAt,
                likes: normalizeLikes(state.settings.likes)
            }
        }));
    }
}

function syncNextMeetFromEvents() {
    const now = new Date();
    const candidates = [];

    Object.entries(stripEventsMeta(state.events)).forEach(([dateISO, arr]) => {
        (arr || []).forEach(ev => {
            if (!ev.isReunion) return;
            const time = ev.time && ev.time.includes(":") ? ev.time : "20:00";
            const dt = new Date(`${dateISO}T${time}:00`);
            if (dt > now) candidates.push(dt);
        });
    });

    candidates.sort((a, b) => a - b);
    if (candidates.length > 0) {
        state.settings.nextMeetAt = candidates[0].toISOString();
        saveStore(LS.settings, state.settings);
    }
}

/* =========================
   9) Mood 编辑（同步顶部 + 云同步）
   ========================= */
function saveMood(newMood) {
    state.mood = { ...state.mood, ...newMood, updatedAt: nowTs() };
    saveStore(LS.mood, state.mood);

    refreshTopUI();
    syncMoodEditorUI();

    const note = state.mood.note ? `「${state.mood.note}」` : "";
    const msg = `状态已更新：${weatherToEmoji(state.mood.weather)} ${weatherToTitle(state.mood.weather)} · 能量 ${state.mood.energy}% ${note}`;
    state.messages.push({ role: "ai", content: msg, ts: Date.now() });
    saveStore(LS.messages, state.messages);

    // 云同步：mood（last-write-wins）
    fireAndForget(cloudSet("mood", state.mood));
}

function resetMood() {
    saveMood({ ...DEFAULTS.mood });
}

/* =========================
   10) Timeline（共享时光轴 + 云同步）
   ========================= */
function renderTimeline() {
    const list = (state.timeline || []).slice().sort((a, b) => b.ts - a.ts);
    dom.tlList.innerHTML = "";

    if (list.length === 0) {
        dom.tlList.innerHTML = `<div class="muted">还没有瞬间～写一条吧 ✨</div>`;
        return;
    }

    list.forEach(item => {
        const wrap = document.createElement("div");
        wrap.className = "timeline-item";

        const dot = document.createElement("div");
        dot.className = "timeline-dot";

        const content = document.createElement("div");
        content.className = "timeline-content";

        const text = document.createElement("div");
        text.innerHTML = escapeHTML(item.text).replaceAll("\n", "<br>");

        const time = document.createElement("div");
        time.className = "timeline-time";
        const d = new Date(item.ts);
        const ts = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        time.innerHTML = `<span>${ts}</span>${item.tag ? `<span class="tag">${escapeHTML(item.tag)}</span>` : ""}`;

        const actions = document.createElement("div");
        actions.style.marginTop = "8px";
        const del = document.createElement("button");
        del.className = "btn btn-danger btn-small";
        del.textContent = "删除";
        del.addEventListener("click", () => {
            state.timeline = (state.timeline || []).filter(x => x.id !== item.id);
            saveStore(LS.timeline, state.timeline);
            renderTimeline();

            // 简化：删除暂不回写云端（避免误删对方的记录）
            // 真要做：云端需要带 ownerId 或 tombstone 机制
        });
        actions.appendChild(del);

        content.appendChild(text);
        content.appendChild(time);
        content.appendChild(actions);

        wrap.appendChild(dot);
        wrap.appendChild(content);
        dom.tlList.appendChild(wrap);
    });

    refreshHomeUI();
}

function addTimeline(text, tag = null) {
    const t = (text || "").trim();
    if (!t) return;

    const item = { id: uid("tl"), text: t, ts: nowTs(), tag: tag || "" };

    state.timeline.push(item);
    saveStore(LS.timeline, state.timeline);
    dom.tlText.value = "";
    renderTimeline();

    // 云同步：timeline（整份 upsert）
    if (USER_TOKEN) fireAndForget(cloudSet("timeline", state.timeline));
}

/* =========================
   11) Settings（保存/重置/导入导出/清空）+ 绑定云同步
   ========================= */
function syncSettingsUI() {
    normalizeSettingsLikes();
    dom.stTogether.value = state.settings.togetherSince;
    dom.stNextMeet.value = toLocalDatetimeValue(state.settings.nextMeetAt);
    dom.stDrink.value = (state.settings.likes && state.settings.likes[0]) ? state.settings.likes[0] : "";
    dom.stCoupleCode.value = state.settings.coupleCode || "";
    // 登录后：匹配码来自后端关系，不建议在前端手改
    dom.stCoupleCode.disabled = false;
    if (dom.coupleStatus) dom.coupleStatus.textContent = "已保存";
    const likes = normalizeLikes(state.settings.likes);
    if (dom.stLike1) dom.stLike1.value = likes[1] || "";
    if (dom.stLike2) dom.stLike2.value = likes[2] || "";
    if (dom.stLike3) dom.stLike3.value = likes[3] || "";
    if (dom.stLike4) dom.stLike4.value = likes[4] || "";
    if (dom.stLike5) dom.stLike5.value = likes[5] || "";

    // UI 个性化
    if (dom.stBgTheme) dom.stBgTheme.value = state.settings.bgTheme || "warm";
    if (dom.stAvatarPreview) {
        const role = getMyRole();
        const url = role === "girl" ? state.settings.avatarGirl : state.settings.avatarBoy;
        dom.stAvatarPreview.style.backgroundImage = url ? `url("${url}")` : "";
        dom.stAvatarPreview.classList.toggle("has-img", !!url);
    }
    if (dom.stBgImage && dom.stBgImage.value) dom.stBgImage.value = "";
}

function saveSettingsFromUI() {
    const together = (dom.stTogether.value || "").trim();
    const nextMeetLocal = dom.stNextMeet.value;
    const nextMeetISO = nextMeetLocal ? fromLocalDatetimeValue(nextMeetLocal) : DEFAULTS.settings.nextMeetAt;
    const likes = normalizeLikes([
        dom.stDrink?.value,
        dom.stLike1?.value,
        dom.stLike2?.value,
        dom.stLike3?.value,
        dom.stLike4?.value,
        dom.stLike5?.value
    ]);

    // coupleCode 在 V4 里由后端关系决定（这里仅用于展示，不影响同步）
    state.settings = {
        togetherSince: together,
        nextMeetAt: nextMeetISO,
        coupleCode: (dom.stCoupleCode.value || "").trim(),
        avatarBoy: state.settings.avatarBoy || "",
        avatarGirl: state.settings.avatarGirl || "",
        bgTheme: state.settings.bgTheme || "warm",
        bgImage: state.settings.bgImage || "",
        likes
    };

    saveStore(LS.settings, state.settings);
    refreshTopUI();
    renderSettingsDebug();
    if (dom.coupleStatus) dom.coupleStatus.textContent = "已保存";

    // 同步到云端（两人共享）
    if (USER_TOKEN) {
        fireAndForget(cloudSet("settings", {
            updatedAt: nowTs(),
            togetherSince: state.settings.togetherSince,
            nextMeetAt: state.settings.nextMeetAt,
            avatarBoy: state.settings.avatarBoy || "",
            avatarGirl: state.settings.avatarGirl || "",
            bgTheme: state.settings.bgTheme || "warm",
            bgImage: state.settings.bgImage || "",
            likes: normalizeLikes(state.settings.likes)
        }));
    }
}

function resetSettings() {
    stopCloudPolling();

    state.settings = { ...DEFAULTS.settings, avatarBoy:"", avatarGirl:"", bgTheme:"warm", bgImage:"", likes: normalizeLikes(DEFAULTS.settings.likes) };
    saveStore(LS.settings, state.settings);
    syncSettingsUI();
    refreshTopUI();
    renderSettingsDebug();
    if (dom.coupleStatus) dom.coupleStatus.textContent = "未保存";

    if (USER_TOKEN) {
        fireAndForget(cloudSet("settings", {
            updatedAt: nowTs(),
            togetherSince: state.settings.togetherSince,
            nextMeetAt: state.settings.nextMeetAt,
            avatarBoy: state.settings.avatarBoy || "",
            avatarGirl: state.settings.avatarGirl || "",
            bgTheme: state.settings.bgTheme || "warm",
            bgImage: state.settings.bgImage || "",
            likes: normalizeLikes(state.settings.likes)
        }));
    }
}

function exportJSON() {
    const data = {
        settings: state.settings,
        mood: state.mood,
        events: stripEventsMeta(state.events),
        timeline: state.timeline,
        messages: state.messages
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heartlink_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(String(reader.result || "{}"));
            if (data.settings) state.settings = { ...DEFAULTS.settings, ...data.settings };
            if (data.mood) state.mood = { ...DEFAULTS.mood, ...data.mood };
            if (data.events) state.events = data.events;
            if (data.timeline) state.timeline = data.timeline;
            if (data.messages) state.messages = data.messages;

            persistAll();
            refreshTopUI();
            renderAllMessages();
            renderCalendar();
            renderEventsForSelectedDate();
            renderTimeline();
            syncSettingsUI();
            syncMoodEditorUI();
            renderSettingsDebug();
            alert("导入成功 ✅");

            // 导入后：如果有 coupleCode，尝试推送到云端（只做 bootstrap，不覆盖对方已有）
            if (USER_TOKEN) {
                fireAndForget((async () => {
                    await bootstrapCloudIfEmpty();
                    await syncFromCloudOnce();
                    startCloudPolling();
                })());
            }
        } catch (e) {
            alert("导入失败：JSON 不合法");
        }
    };
    reader.readAsText(file);
}

function wipeAll() {
    if (!confirm("确定清空全部数据？（不可恢复）")) return;

    stopCloudPolling();

    Object.values(LS).forEach(k => localStorage.removeItem(k));

    state.settings = { ...DEFAULTS.settings };
    state.mood = { ...DEFAULTS.mood };
    state.events = { ...DEFAULTS.events };
    state.timeline = [...DEFAULTS.timeline];
    state.messages = [];

    persistAll();
    bootstrapDefaultMessages();
    refreshTopUI();
    renderAllMessages();
    renderCalendar();
    renderEventsForSelectedDate();
    renderTimeline();
    syncSettingsUI();
    syncMoodEditorUI();
    renderSettingsDebug();
}

function renderSettingsDebug() {
    const likesText = normalizeLikes(state.settings.likes).filter(Boolean).join(", ");
    const lines = [
        `coupleCode: ${state.settings.coupleCode || "-"}`,
        `togetherSince: ${state.settings.togetherSince}`,
        `nextMeetAt: ${new Date(state.settings.nextMeetAt).toString()}`,
        `likes: ${likesText || "-"}`,
        `mood: ${state.mood.weather}, ${state.mood.energy}%, ${state.mood.note || "-"}`,
        `eventsDays: ${Object.keys(stripEventsMeta(state.events)).length}`,
        `timeline: ${state.timeline.length}`,
        `messages: ${state.messages.length}`,
        `cloudPolling: ${state.cloud.pollingTimer ? "ON" : "OFF"}`,
        `lastPullAt: ${state.cloud.lastPullAt ? new Date(state.cloud.lastPullAt).toLocaleString() : "-"}`,
    ];
    dom.stDebug.textContent = lines.join("\n");
}

let navHideTimer = null;
function showNav() {
    if (!dom.navbar) return;
    dom.navbar.classList.remove("is-hidden");
    document.body.classList.remove("nav-hidden");
}
function hideNav() {
    if (!dom.navbar) return;
    dom.navbar.classList.add("is-hidden");
    document.body.classList.add("nav-hidden");
}
function scheduleHide(delay = 3200) {
    if (navHideTimer) clearTimeout(navHideTimer);
    navHideTimer = setTimeout(() => {
        hideNav();
    }, delay);
}

const cropperState = {
    mode: null,
    img: null,
    file: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragId: null,
    dragging: false,
    lastX: 0,
    lastY: 0,
    pointerId: null
};
function openCropper(mode, file) {
    if (!dom.cropperOverlay) return;
    cropperState.mode = mode;
    cropperState.file = file || null;
    cropperState.img = null;
    cropperState.zoom = 1;
    cropperState.offsetX = 0;
    cropperState.offsetY = 0;
    cropperState.dragId = null;
    cropperState.dragging = false;
    cropperState.lastX = 0;
    cropperState.lastY = 0;
    cropperState.pointerId = null;
    if (dom.cropperZoom) dom.cropperZoom.value = "1";
    if (dom.cropperTitle) dom.cropperTitle.textContent = mode === "bg" ? "背景裁剪" : "头像裁剪";
    dom.cropperOverlay.classList.remove("hidden");
    if (file) {
        loadImageForCropper(file);
    }
}
function closeCropper() {
    if (!dom.cropperOverlay) return;
    dom.cropperOverlay.classList.add("hidden");
    cropperState.mode = null;
    cropperState.img = null;
    cropperState.file = null;
    cropperState.zoom = 1;
    cropperState.offsetX = 0;
    cropperState.offsetY = 0;
    cropperState.dragId = null;
    cropperState.dragging = false;
    cropperState.lastX = 0;
    cropperState.lastY = 0;
    cropperState.pointerId = null;
}

async function loadImageForCropper(file) {
    if (!file) return;
    const maxEdge = 2048;
    const dataUrl = await fileToDataUrl(file, 3 * 1024 * 1024);
    await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const w = img.width;
            const h = img.height;
            const scale = Math.min(1, maxEdge / Math.max(w, h));
            const cw = Math.max(1, Math.round(w * scale));
            const ch = Math.max(1, Math.round(h * scale));
            const c = document.createElement("canvas");
            c.width = cw;
            c.height = ch;
            const ctx = c.getContext("2d");
            if (!ctx) return reject(new Error("无法读取图片"));
            ctx.drawImage(img, 0, 0, cw, ch);
            const img2 = new Image();
            img2.onload = () => {
                cropperState.img = img2;
                cropperState.offsetX = 0;
                cropperState.offsetY = 0;
                renderCropper();
                updateCropPreview();
                resolve();
            };
            img2.onerror = () => reject(new Error("读取图片失败"));
            img2.src = c.toDataURL("image/jpeg", 0.9);
        };
        img.onerror = () => reject(new Error("读取图片失败"));
        img.src = dataUrl;
    });
}

function getCropRect() {
    const mode = cropperState.mode || "avatar";
    const stage = dom.cropperStage;
    const cw = stage ? stage.clientWidth : 280;
    const ratio = mode === "bg" ? 9 / 16 : 1;
    let w = cw;
    let h = cw / ratio;
    if (h > 360) {
        h = 360;
        w = h * ratio;
    }
    return { w, h, ratio };
}

function renderCropper() {
    if (!dom.cropperCanvas || !dom.cropperStage) return;
    const ctx = dom.cropperCanvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = getCropRect();
    dom.cropperCanvas.width = Math.round(w);
    dom.cropperCanvas.height = Math.round(h);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, w, h);

    const img = cropperState.img;
    if (img) {
        const scale = cropperState.zoom;
        const iw = img.width * scale;
        const ih = img.height * scale;
        const cx = w / 2 + cropperState.offsetX;
        const cy = h / 2 + cropperState.offsetY;
        const x = cx - iw / 2;
        const y = cy - ih / 2;
        ctx.drawImage(img, x, y, iw, ih);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
}

function exportCropped() {
    const img = cropperState.img;
    if (!img) return "";
    const mode = cropperState.mode || "avatar";
    const outW = mode === "bg" ? 1080 : 512;
    const outH = mode === "bg" ? 1920 : 512;
    const out = document.createElement("canvas");
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext("2d");
    if (!ctx) return "";

    const { w, h } = getCropRect();
    const scale = cropperState.zoom;
    const iw = img.width * scale;
    const ih = img.height * scale;
    const cx = w / 2 + cropperState.offsetX;
    const cy = h / 2 + cropperState.offsetY;
    const x = cx - iw / 2;
    const y = cy - ih / 2;

    const scaleX = outW / w;
    const scaleY = outH / h;
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(img, x, y, iw, ih);

    if (mode === "bg") return out.toDataURL("image/jpeg", 0.88);
    return out.toDataURL("image/jpeg", 0.92);
}

function updateCropPreview() {
    if (!dom.cropperPreview) return;
    const ctx = dom.cropperPreview.getContext("2d");
    if (!ctx) return;
    const dataUrl = exportCropped();
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
        const w = dom.cropperPreview.width || 64;
        const h = dom.cropperPreview.height || 64;
        dom.cropperPreview.width = w;
        dom.cropperPreview.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
    };
    img.src = dataUrl;
}

function applyCroppedResult(dataUrl) {
    if (!dataUrl) return;
    const mode = cropperState.mode || "avatar";
    if (mode === "bg") {
        state.settings.bgImage = dataUrl;
        saveStore(LS.settings, state.settings);
        applyUiCustom();
        if (USER_TOKEN) fireAndForget(cloudSet("settings", {
            updatedAt: nowTs(),
            togetherSince: state.settings.togetherSince,
            nextMeetAt: state.settings.nextMeetAt,
            likes: normalizeLikes(state.settings.likes),
            avatarBoy: state.settings.avatarBoy || "",
            avatarGirl: state.settings.avatarGirl || "",
            bgTheme: state.settings.bgTheme || "warm",
            bgImage: state.settings.bgImage || ""
        }));
        return;
    }
    const role = getMyRole();
    if (role === "girl") state.settings.avatarGirl = dataUrl;
    else state.settings.avatarBoy = dataUrl;

    saveStore(LS.settings, state.settings);
    applyUiCustom();

    if (dom.stAvatarPreview) {
        dom.stAvatarPreview.style.backgroundImage = `url("${dataUrl}")`;
        dom.stAvatarPreview.classList.add("has-img");
    }

    if (USER_TOKEN) fireAndForget(cloudSet("settings", {
        updatedAt: nowTs(),
        togetherSince: state.settings.togetherSince,
        nextMeetAt: state.settings.nextMeetAt,
        likes: normalizeLikes(state.settings.likes),
        avatarBoy: state.settings.avatarBoy || "",
        avatarGirl: state.settings.avatarGirl || "",
        bgTheme: state.settings.bgTheme || "warm",
        bgImage: state.settings.bgImage || ""
    }));
}

/* =========================
   12) 初始消息 + 绑定事件
   ========================= */
function bootstrapDefaultMessages() {
    if (state.messages.length > 0) return;
    const role = getMyRole();
    const greeting = role === "girl"
        ? "我是你的专属恋爱专家,今天开心吗？"
        : "我是你的专属军师,有什么能够帮助你的吗？";
    state.messages.push({
        role: "ai",
        content: greeting,
        ts: Date.now()
    });
    saveStore(LS.messages, state.messages);
}

function bindEvents() {
    hideNav();
    const onNavWake = (y) => {
        if (typeof y === "number") {
            if (window.innerHeight - y > 80) return;
        }
        showNav();
        scheduleHide(3200);
    };
    window.addEventListener("pointerdown", (e) => onNavWake(e.clientY));
    window.addEventListener("touchstart", (e) => onNavWake(e.touches && e.touches[0] ? e.touches[0].clientY : undefined), { passive: true });
    window.addEventListener("pointermove", (e) => onNavWake(e.clientY), { passive: true });
    window.addEventListener("touchmove", (e) => onNavWake(e.touches && e.touches[0] ? e.touches[0].clientY : undefined), { passive: true });

    // chat
    dom.send.addEventListener("click", () => onSend());
    dom.input.addEventListener("keydown", (e) => { if (e.key === "Enter") onSend(); });

    dom.chips.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-text]");
        if (!btn){
            console('文本获取失败')
            return;
        }
        onSend(btn.dataset.text);
    });

    dom.chatClear.addEventListener("click", () => {
        if (!confirm("清空聊天记录？")) return;
        state.messages = [];
        saveStore(LS.messages, state.messages);
        bootstrapDefaultMessages();
        renderAllMessages();
    });

    // calendar month nav
    dom.calPrev.addEventListener("click", () => {
        const d = state.calendarView.monthCursor;
        state.calendarView.monthCursor = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        renderCalendar();
    });
    dom.calNext.addEventListener("click", () => {
        const d = state.calendarView.monthCursor;
        state.calendarView.monthCursor = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        renderCalendar();
    });

    // add event
    dom.eventAdd.addEventListener("click", () => {
        const title = (dom.eventTitle.value || "").trim();
        const time = dom.eventTime.value || "";
        if (!title) { alert("先写个计划标题～"); return; }
        addEventForSelectedDate({ title, time, isReunion: false });
        dom.eventTitle.value = "";
    });

    dom.eventAddReunion.addEventListener("click", () => {
        const title = (dom.eventTitle.value || "").trim() || "下次见面";
        const time = dom.eventTime.value || "20:00";
        addEventForSelectedDate({ title, time, isReunion: true });
        dom.eventTitle.value = "";
    });

    // mood seg
    dom.moodSeg.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-weather]");
        if (!btn) return;
        saveMood({ weather: btn.dataset.weather });
    });

    dom.moodEnergy.addEventListener("input", () => {
        const v = Number(dom.moodEnergy.value || 0);
        dom.moodEnergyPill.textContent = `${v}%`;
    });

    dom.moodSave.addEventListener("click", () => {
        const energy = Number(dom.moodEnergy.value || 0);
        const note = (dom.moodNote.value || "").trim();
        saveMood({ energy, note });
        alert("状态已保存 ✅（聊天顶部已同步）");
    });

    dom.moodReset.addEventListener("click", () => {
        resetMood();
        alert("已恢复默认 ✅");
    });

    // timeline
    dom.tlAdd.addEventListener("click", () => addTimeline(dom.tlText.value, "瞬间"));
    dom.tlAddFromMood.addEventListener("click", () => {
        const t = `今天的状态：${weatherToEmoji(state.mood.weather)} ${weatherToTitle(state.mood.weather)}，能量 ${state.mood.energy}%。\n${state.mood.note || ""}`.trim();
        addTimeline(t, "状态");
    });
    dom.tlClear.addEventListener("click", () => {
        if (!confirm("清空时光轴？")) return;
        state.timeline = [];
        saveStore(LS.timeline, state.timeline);
        renderTimeline();

        // 清空也同步云端（谨慎：会清空双方的 timeline）
        if (USER_TOKEN) {
            fireAndForget(cloudSet("timeline", state.timeline));
        }
    });

    // settings
    dom.stSave.addEventListener("click", () => {
        saveSettingsFromUI();
        alert("设置已保存 ✅");
    });
    dom.stReset.addEventListener("click", () => {
        resetSettings();
        alert("已恢复默认 ✅");
    });
    if (dom.stCoupleCode) {
        dom.stCoupleCode.addEventListener("input", () => {
            if (dom.coupleStatus) dom.coupleStatus.textContent = "未保存";
        });
    }
    if (dom.coupleSave) {
        dom.coupleSave.addEventListener("click", () => {
            saveSettingsFromUI();
            if (dom.coupleStatus) dom.coupleStatus.textContent = "已保存";
        });
    }
    if (dom.coupleClear) {
        dom.coupleClear.addEventListener("click", () => {
            if (dom.stCoupleCode) dom.stCoupleCode.value = "";
            if (dom.coupleStatus) dom.coupleStatus.textContent = "已清空未保存";
        });
    }
    if (dom.coupleCopy) {
        dom.coupleCopy.addEventListener("click", async () => {
            const code = String(dom.stCoupleCode?.value || "").trim();
            if (!code) {
                if (dom.coupleStatus) dom.coupleStatus.textContent = "没有可复制的匹配码";
                return;
            }
            try {
                await navigator.clipboard.writeText(code);
                if (dom.coupleStatus) dom.coupleStatus.textContent = "已复制";
            } catch (_) {
                if (dom.coupleStatus) dom.coupleStatus.textContent = "复制失败，请手动复制";
            }
        });
    }
    if (dom.cropperCancel) {
        dom.cropperCancel.addEventListener("click", () => {
            closeCropper();
        });
    }
    if (dom.cropperCanvas) {
        dom.cropperCanvas.addEventListener("pointerdown", (e) => {
            if (!cropperState.img) return;
            cropperState.dragging = true;
            cropperState.pointerId = e.pointerId;
            cropperState.lastX = e.clientX;
            cropperState.lastY = e.clientY;
            dom.cropperCanvas.setPointerCapture(e.pointerId);
        });
        dom.cropperCanvas.addEventListener("pointermove", (e) => {
            if (!cropperState.dragging || cropperState.pointerId !== e.pointerId) return;
            const dx = e.clientX - cropperState.lastX;
            const dy = e.clientY - cropperState.lastY;
            cropperState.lastX = e.clientX;
            cropperState.lastY = e.clientY;
            cropperState.offsetX += dx;
            cropperState.offsetY += dy;
            renderCropper();
            updateCropPreview();
        });
        const endDrag = (e) => {
            if (cropperState.pointerId !== e.pointerId) return;
            cropperState.dragging = false;
            cropperState.pointerId = null;
            dom.cropperCanvas.releasePointerCapture(e.pointerId);
        };
        dom.cropperCanvas.addEventListener("pointerup", endDrag);
        dom.cropperCanvas.addEventListener("pointercancel", endDrag);
    }
    if (dom.cropperZoom) {
        dom.cropperZoom.addEventListener("input", () => {
            cropperState.zoom = Number(dom.cropperZoom.value || 1);
            renderCropper();
            updateCropPreview();
        });
    }
    if (dom.cropperConfirm) {
        dom.cropperConfirm.addEventListener("click", () => {
            const dataUrl = exportCropped();
            if (dataUrl) applyCroppedResult(dataUrl);
            closeCropper();
        });
    }
    dom.stExport.addEventListener("click", exportJSON);
    dom.stImport.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) importJSON(f);
        e.target.value = "";
    });
    // home quick actions
    if (dom.homeGoChat) dom.homeGoChat.addEventListener("click", () => el("tab-chat")?.click());
    if (dom.homeGoCalendar) dom.homeGoCalendar.addEventListener("click", () => el("tab-calendar")?.click());
    if (dom.homeGoDiary) dom.homeGoDiary.addEventListener("click", () => el("tab-diary")?.click());
    if (dom.homeGoSettings) dom.homeGoSettings.addEventListener("click", () => el("tab-settings")?.click());

    dom.stWipe.addEventListener("click", wipeAll);
}


/* =========================
   12.5) Auth（登录/注册）
   ========================= */
function showAuthOverlay(show) {
    const overlay = document.getElementById("auth-overlay");
    if (!overlay) return;
    overlay.classList.toggle("hidden", !show);
}

function bindAuthEvents() {
    const overlay = document.getElementById("auth-overlay");
    if (!overlay) return;

    let isRegister = false;
    const toggleBtn = el("toggle-auth");
    const submitBtn = el("btn-submit");
    const regFields = el("register-fields");

    function syncMode() {
        regFields.classList.toggle("hidden", !isRegister);
        toggleBtn.textContent = isRegister ? "已有账号？去登录" : "没有账号？去注册";
        submitBtn.textContent = isRegister ? "注册并进入" : "登录";
    }

    toggleBtn.onclick = () => {
        isRegister = !isRegister;
        syncMode();
    };
    syncMode();

    // 角色切换点击
    const roleSeg = el("auth-role-seg");
    if (roleSeg) {
        roleSeg.onclick = (e) => {
            if (e.target.tagName === "BUTTON") {
                roleSeg.querySelectorAll("button").forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
            }
        };
    }

    submitBtn.onclick = async () => {
        const username = (el("auth-user").value || "").trim();
        const password = (el("auth-pass").value || "").trim();
        const coupleCode = (el("auth-code")?.value || "").trim();

        const roleBtn = el("auth-role-seg")?.querySelector(".active");
        const role = roleBtn ? roleBtn.dataset.role : "boy";

        if (!username || !password) { alert("请输入用户名和密码"); return; }
        if (isRegister && !coupleCode) { alert("注册需要填写配对码"); return; }

        try {
            const res = await apiCall("/api/auth", {
                action: isRegister ? "register" : "login",
                username, password, coupleCode, role
            }, "POST");

            if (res && res.ok) {
                if (isRegister) {
                    alert("注册成功！请直接登录");
                    isRegister = false;
                    syncMode();
                } else {
                    USER_TOKEN = res.token;
                    USER_USER = res.user || null;
                    localStorage.setItem("heartlink_token", USER_TOKEN);
                    localStorage.setItem("heartlink_user", JSON.stringify(USER_USER || {}));

                    // 将 coupleCode 写入设置，仅用于展示
                    if (USER_USER?.coupleCode) {
                        state.settings.coupleCode = USER_USER.coupleCode;
                        saveStore(LS.settings, state.settings);
                        syncSettingsUI();
                    }

                    showAuthOverlay(false);

                    // 启动云同步
                    console.log("🚀 已登录，启动智能同步...");
                    startSmartPolling();
                    startPokePolling();
                    fireAndForget((async () => {
                        await bootstrapCloudIfEmpty();
                        await syncFromCloudOnce();
                    })());
                }
            } else {
                alert(res?.error || "操作失败");
            }
        } catch (e) {
            alert(String(e.message || e));
        }
    };
}
/* =========================
   13) Init
   ========================= */
function initUiCustomizeSettings() {
    // 背景主题切换
    if (dom.stBgTheme) {
        dom.stBgTheme.addEventListener("change", () => {
            state.settings.bgTheme = dom.stBgTheme.value || "warm";
            saveStore(LS.settings, state.settings);
            applyUiCustom();
            // 同步到云端
            if (USER_TOKEN) fireAndForget(cloudSet("settings", {
                updatedAt: nowTs(),
                togetherSince: state.settings.togetherSince,
                nextMeetAt: state.settings.nextMeetAt,
                likes: normalizeLikes(state.settings.likes),
                avatarBoy: state.settings.avatarBoy || "",
                avatarGirl: state.settings.avatarGirl || "",
                bgTheme: state.settings.bgTheme || "warm",
                bgImage: state.settings.bgImage || ""
            }));
        });
    }

    // 背景图片上传
    if (dom.stBgImage) {
        dom.stBgImage.addEventListener("change", async () => {
            try {
                const f = dom.stBgImage.files && dom.stBgImage.files[0];
                if (!f) return;
                openCropper("bg", f);
                dom.stBgImage.value = "";
            } catch (e) {
                alert(String(e.message || e));
                dom.stBgImage.value = "";
            }
        });
    }

    if (dom.stBgClear) {
        dom.stBgClear.addEventListener("click", () => {
            state.settings.bgImage = "";
            saveStore(LS.settings, state.settings);
            applyUiCustom();
            if (USER_TOKEN) fireAndForget(cloudSet("settings", {
                updatedAt: nowTs(),
                togetherSince: state.settings.togetherSince,
                nextMeetAt: state.settings.nextMeetAt,
                likes: normalizeLikes(state.settings.likes),
                avatarBoy: state.settings.avatarBoy || "",
                avatarGirl: state.settings.avatarGirl || "",
                bgTheme: state.settings.bgTheme || "warm",
                bgImage: ""
            }));
        });
    }

    // 头像上传（按角色分别存）
    if (dom.stAvatar) {
        dom.stAvatar.addEventListener("change", async () => {
            try {
                const f = dom.stAvatar.files && dom.stAvatar.files[0];
                if (!f) return;
                openCropper("avatar", f);
                dom.stAvatar.value = "";
            } catch (e) {
                alert(String(e.message || e));
                dom.stAvatar.value = "";
            }
        });
    }

    if (dom.stAvatarClear) {
        dom.stAvatarClear.addEventListener("click", () => {
            const role = getMyRole();
            if (role === "girl") state.settings.avatarGirl = "";
            else state.settings.avatarBoy = "";

            saveStore(LS.settings, state.settings);
            applyUiCustom();

            if (dom.stAvatarPreview) {
                dom.stAvatarPreview.style.backgroundImage = "";
                dom.stAvatarPreview.classList.remove("has-img");
            }

            if (USER_TOKEN) fireAndForget(cloudSet("settings", {
                updatedAt: nowTs(),
                togetherSince: state.settings.togetherSince,
                nextMeetAt: state.settings.nextMeetAt,
                likes: normalizeLikes(state.settings.likes),
                avatarBoy: state.settings.avatarBoy || "",
                avatarGirl: state.settings.avatarGirl || "",
                bgTheme: state.settings.bgTheme || "warm",
                bgImage: state.settings.bgImage || ""
            }));
        });
    }

    // 点击头像快速进入设置
    if (dom.headerAvatar) {
        dom.headerAvatar.addEventListener("click", () => {
            const tab = el("tab-settings");
            if (tab) tab.click();
        });
    }
}

function init() {
    initPokeUI();
    initUiCustomizeSettings();
    // 兜底：如果 localStorage 没有数据就写

    if (!localStorage.getItem(LS.settings)) saveStore(LS.settings, state.settings);
    if (!localStorage.getItem(LS.mood)) saveStore(LS.mood, state.mood);
    if (!localStorage.getItem(LS.events)) saveStore(LS.events, state.events);
    if (!localStorage.getItem(LS.timeline)) saveStore(LS.timeline, state.timeline);
    if (!localStorage.getItem(LS.messages)) saveStore(LS.messages, state.messages);

    bootstrapDefaultMessages();

    normalizeSettingsLikes();
    saveStore(LS.settings, state.settings);

    refreshTopUI();
    refreshHomeUI();
    setInterval(refreshTopUI, 60 * 1000);

    // sync forms    啊啊啊吐了 这里还要改
    syncMoodEditorUI();
    syncSettingsUI();
    renderSettingsDebug();

    // render default page content
    renderAllMessages();
    renderCalendar();
    renderEventsForSelectedDate();
    renderTimeline();

    bindEvents();
    initTabs();

    // Auth Gate：没有 token 就显示登录遮罩
    bindAuthEvents();
    if (!USER_TOKEN) {
        setCloudStatus("offline");
        showAuthOverlay(true);
    } else {
        showAuthOverlay(false);
        console.log("🚀 启动智能同步...");
        startSmartPolling();
        startPokePolling();
        fireAndForget((async () => {
            await bootstrapCloudIfEmpty();
            await syncFromCloudOnce();
        })());
    }

    const setupRopeSheet = () => {
        console.log("JS运行了");
        const backdrop = document.querySelector("#backdrop");
        const sheet = document.querySelector("#sheet");
        const rope = document.querySelector("#rope");
        const pageChat = document.querySelector("#page-chat");

        if (!backdrop || !sheet || !rope) {
            console.warn("[rope] missing elements", {
                backdrop: !!backdrop,
                sheet: !!sheet,
                rope: !!rope
            });
            return;
        }

        const logError = (scope, err) => {
            console.error(`[rope] ${scope}`, err);
        };
        const safe = (scope, fn) => (...args) => {
            try {
                return fn(...args);
            } catch (err) {
                logError(scope, err);
            }
        };
        const pointEvent = (target, handlers) => {
            if (!target) return;
            const opts = { passive: false };
            if (handlers.down) target.addEventListener("pointerdown", handlers.down, opts);
            if (handlers.move) target.addEventListener("pointermove", handlers.move, opts);
            if (handlers.up) target.addEventListener("pointerup", handlers.up, opts);
            if (handlers.cancel) target.addEventListener("pointercancel", handlers.cancel, opts);
        };

        const uiState = { isOpen: false, animating: false };
        const ropeState = { pointerId: null, startY: 0, moved: false, pulled: false, startAt: 0 };
        const pullConfig = { minPull: 28, maxPull: 90, maxDuration: 1200 };

        const setPageChatVisible = (on) => {
            if (!pageChat) return;
            if (on) {
                if (pageChat.dataset.prevHidden === undefined) {
                    pageChat.dataset.prevHidden = String(pageChat.classList.contains("hidden"));
                }
                pageChat.classList.remove("hidden");
            } else {
                const prevHidden = pageChat.dataset.prevHidden === "true";
                if (prevHidden) pageChat.classList.add("hidden");
                delete pageChat.dataset.prevHidden;
            }
        };
        const syncAria = () => {
            rope.setAttribute("aria-expanded", uiState.isOpen ? "true" : "false");
            sheet.setAttribute("aria-hidden", uiState.isOpen ? "false" : "true");
            backdrop.setAttribute("aria-hidden", uiState.isOpen ? "false" : "true");
        };
        const setAnimating = () => {
            uiState.animating = true;
            window.setTimeout(() => {
                uiState.animating = false;
            }, 360);
        };

        function openSheet() {
            if (uiState.isOpen || uiState.animating) return;
            uiState.isOpen = true;
            setAnimating();
            backdrop.classList.add("open");
            sheet.classList.add("open");
            rope.classList.add("open");
            document.body.classList.add("sheet-open");
            setPageChatVisible(true);
            syncAria();
            if (typeof renderAllMessages === "function") renderAllMessages();
        }
        function closeSheet() {
            if (!uiState.isOpen || uiState.animating) return;
            uiState.isOpen = false;
            setAnimating();
            backdrop.classList.remove("open");
            sheet.classList.remove("open");
            rope.classList.remove("open");
            document.body.classList.remove("sheet-open");
            setPageChatVisible(false);
            syncAria();
        }

        function resetPull() {
            if (ropeState.pointerId !== null && rope.releasePointerCapture) {
                try {
                    rope.releasePointerCapture(ropeState.pointerId);
                } catch (err) {
                    logError("releasePointerCapture", err);
                }
            }
            ropeState.pointerId = null;
            ropeState.moved = false;
            ropeState.pulled = false;
            ropeState.startAt = 0;
            rope.classList.remove("pulling");
            rope.style.removeProperty("--rope-pull");
        }

        const onPullSuccess = () => openSheet();

        const onPointerDown = safe("pointerdown", (e) => {
            if (uiState.isOpen || uiState.animating) return;
            if (e.button !== undefined && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            ropeState.pointerId = e.pointerId;
            ropeState.startY = e.clientY;
            ropeState.startAt = Date.now();
            ropeState.moved = false;
            ropeState.pulled = false;
            rope.classList.add("pulling");
            if (rope.setPointerCapture) rope.setPointerCapture(e.pointerId);
        });
        const onPointerMove = safe("pointermove", (e) => {
            if (ropeState.pointerId === null || ropeState.pointerId !== e.pointerId) return;
            e.preventDefault();
            const deltaY = Math.max(0, e.clientY - ropeState.startY);
            if (deltaY > 2) ropeState.moved = true;
            if (deltaY >= pullConfig.minPull) ropeState.pulled = true;
            const clamped = Math.min(deltaY, pullConfig.maxPull);
            rope.style.setProperty("--rope-pull", `${clamped}px`);
        });
        const onPointerUp = safe("pointerup", (e) => {
            if (ropeState.pointerId !== e.pointerId) return;
            e.preventDefault();
            e.stopPropagation();
            const duration = Date.now() - ropeState.startAt;
            const ok = ropeState.moved && ropeState.pulled && duration <= pullConfig.maxDuration;
            resetPull();
            if (!ok) return;
            onPullSuccess();
        });
        const onPointerCancel = safe("pointercancel", () => {
            resetPull();
        });

        pointEvent(rope, {
            down: onPointerDown,
            move: onPointerMove,
            up: onPointerUp,
            cancel: onPointerCancel
        });
        rope.addEventListener("click", (e) => e.stopPropagation());
        rope.addEventListener("keydown", safe("rope.keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            if (uiState.isOpen || uiState.animating) return;
            onPullSuccess();
        }));

        sheet.addEventListener("pointerdown", (e) => e.stopPropagation());
        sheet.addEventListener("click", (e) => e.stopPropagation());

        pointEvent(backdrop, {
            down: safe("backdrop.down", (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeSheet();
            })
        });
        backdrop.addEventListener("click", (e) => {
            e.stopPropagation();
            closeSheet();
        });
        document.addEventListener("keydown", safe("sheet.escape", (e) => {
            if (e.key === "Escape") closeSheet();
        }));

        syncAria();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupRopeSheet, { once: true });
    } else {
        setupRopeSheet();
    }
}

init();
