// ==UserScript==
// @name         Random Mods
// @match        https://hordes.io/play*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hordes.io
// @version      21
// @description  Random mods taken from other scripts and put into one script.
// @author       rndms
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/notrndms/randommods/main/main.user.js
// @downloadURL  https://raw.githubusercontent.com/notrndms/randommods/main/main.user.js
// ==/UserScript==

(async function() {
    'use strict';

    // ==========================================
    // 0. STATE MANAGEMENT & DATA STORAGE
    // ==========================================

    const SETTINGS_KEY = 'rndms_mod_settings_v10';
    var settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
        fullscreen: true,
        blackBorders: true,
        ccIndicator: true,
        classColors: true,
        yellChat: true,
        killMsgFormat: true,
        ownBuffsOnly: false,
        moveableChat: false,
        rareMobRadar: true,
        gearSetManager: true,
        autoOpen: true,
        chatRemake: false,
        removeLevelBar: false,
        removeEntityPanel: false,
        removeInventoryFilter: false,
        removeUpgradeButton: false,
        removeBarTexts: false,
        partyTransition: true,
        mentionHighlight: true,
        chatPos: { x: null, y: null, xRatio: null, yRatio: null }
    };

    if (settings.killMsgFormat === undefined) settings.killMsgFormat = true;
    if (settings.ownBuffsOnly === undefined) settings.ownBuffsOnly = false;
    if (settings.moveableChat === undefined) settings.moveableChat = false;
    if (settings.rareMobRadar === undefined) settings.rareMobRadar = true;
    if (settings.gearSetManager === undefined) settings.gearSetManager = true;
    if (settings.autoOpen === undefined) settings.autoOpen = true;
    if (settings.chatRemake === undefined) settings.chatRemake = false;
    if (settings.removeLevelBar === undefined) settings.removeLevelBar = false;
    if (settings.removeEntityPanel === undefined) settings.removeEntityPanel = false;
    if (settings.removeInventoryFilter === undefined) settings.removeInventoryFilter = false;
    if (settings.removeUpgradeButton === undefined) settings.removeUpgradeButton = false;
    if (settings.removeBarTexts === undefined) settings.removeBarTexts = false;
    if (settings.partyTransition === undefined) settings.partyTransition = true;
    if (settings.mentionHighlight === undefined) settings.mentionHighlight = true;
    if (!settings.chatPos) settings.chatPos = { x: null, y: null, xRatio: null, yRatio: null };

    var syncNativeBuffsState = false;

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        updateRemovalStyles();
    }

    // Dynamic Style Engine for Non-Destructive Hiding
    var removalStyleRule = document.createElement('style');
    document.head.appendChild(removalStyleRule);

    function updateRemovalStyles() {
        let css = '';
        if (settings.removeLevelBar) {
            css += '.container.svelte-1m0q37p, .btn.border.black.textexp, .textexp { display: none !important; }\n';
        }
        if (settings.removeEntityPanel) {
            css += '.panel-black.container.svelte-1wip79f { display: none !important; }\n';
        }
        if (settings.removeInventoryFilter) {
            css += '.filter.svelte-ha50yv { display: none !important; }\n';
        }
        if (settings.removeBarTexts) {
            css += '.bar.btn.black.grey.svelte-nijy6x .textyellow, .bar.btn.black.grey.svelte-nijy6x .textorange, .bar.btn.black.grey.svelte-nijy6x .textpurp { display: none !important; }\n';
        }
        if (settings.chatRemake) {
            css += '.time.svelte-7c1tlw { display: none !important; }\n';
        }
        removalStyleRule.textContent = css;
    }

    // ==========================================
    // 1. SHARED WEBSOCKET & FETCH INTERCEPTOR ENGINE
    // ==========================================

    let clientVersion = "";
    let ws = null;

    function wsProxy(target, params) {
        let socket = new target(...params);
        if (typeof params[0] === "string" && params[0].includes("hordes.io")) {
            interceptSocket(socket);
        }
        return socket;
    }

    let Ws = window.WebSocket;
    window.WebSocket = new Proxy(Ws, { construct: wsProxy });

    try {
        fetch("https://hordes.io/play").then(i => i.text()).then(html => {
            let match = html.match(/src="([^"]*client\.js[^"]*)"/);
            if (match) {
                let versionMatch = match[1].match(/v=(\d+)/);
                if (versionMatch) clientVersion = versionMatch[1];
                console.log(`[Mod Suite] fetched latest client version: ${clientVersion}`);
                decodeCreatures();
            }
        });
    } catch (err) {
        console.error(err);
    }

    function fetchProxy(target, _, params) {
        let result = target.apply(window, params);
        let urlMatch = typeof params[0] === "string" && params[0].includes("/api/item/get");
        if (!urlMatch) return result;
        result.then(async r => {
            let items = await r.clone().json();
            if (!Array.isArray(items)) return;

            for (let item of items) {
                if (!item || item.slot == null) continue;
                let dbid = item.dbid ?? inventorySlots.get(item.slot);
                if (dbid == null || item.type == null) continue;
                loadedItems.set(dbid, item);
            }

            refreshGearUI();
        }).catch((err) => {
            console.error(err);
        });

        return result;
    }

    let origFetch = window.fetch;
    window.fetch = new Proxy(origFetch, { apply: fetchProxy });

    // Binary Encoders/Decoders & Buffers
    var z = 0;
    var ye = t => {
        let e = 0, n = 0, o = 0;
        do o = t[z++], e |= (o & 127) << 7 * n, n++; while (o & 128);
        return e;
    };
    var tr = (t, e) => {
            for (; e > 127;) t[z++] = e & 127 | 128, e >>= 7;
            t[z++] = e & 127;
        },
        ti = t => t <= 0 ? 1 : Math.floor(Math.log(t) / Math.log(128)) + 1,
        bi = t => t[z] & 128 ? (255 - t[z] + 1) * -1 : t[z],
        Le = t => t[z],
        Ki = (t, e) => { t[z] = e; z += 1; },
        Ot = t => t[z] | t[z + 1] << 8;
    var po = t => (t[z] | t[z + 1] << 8 | t[z + 2] << 16) + t[z + 3] * 16777216,
        p1 = new ArrayBuffer(8),
        nr = new Uint8Array(p1),
        _3 = new Float32Array(p1),
        lt = t => (nr[0] = t[z], nr[1] = t[z + 1], nr[2] = t[z + 2], nr[3] = t[z + 3], _3[0]);
    var y3 = t => {
            let e = t.length;
            for (let n = t.length - 1; n >= 0; n--) {
                let o = t.charCodeAt(n);
                o > 127 && o <= 2047 ? e++ : o > 2047 && o <= 65535 && (e += 2), o >= 56320 && o <= 57343 && n--;
            }
            return e;
        },
        v3 = (t, e) => {
            let n = y3(e);
            tr(t, n);
            for (let o = 0; o < e.length; o++) {
                let i = e.charCodeAt(o);
                i < 128 ? t[z++] = i : i < 2048 ? (t[z++] = i >> 6 | 192, t[z++] = i & 63 | 128) : (i & 64512) == 55296 && o + 1 < e.length && (e.charCodeAt(o + 1) & 64512) == 56320 ? (i = 65536 + ((i & 1023) << 10) + (e.charCodeAt(++o) & 1023), t[z++] = i >> 18 | 240, t[z++] = i >> 12 & 63 | 128, t[z++] = i >> 6 & 63 | 128, t[z++] = i & 63 | 128) : (t[z++] = i >> 12 | 224, t[z++] = i >> 6 & 63 | 128, t[z++] = i & 63 | 128);
            }
        };
    var h3 = { string: t => { let e = y3(t); return ti(e) + e; } };
    var C3 = {
        encode: t => {
            let e = t, n = 0;
            n += 1, n += h3.string(e.command), n += h3.string(e.string);
            let o = new Uint8Array(n);
            return z = 0, Ki(o, e._header), v3(o, e.command), v3(o, e.string), o;
        }
    };
    var Sn = t => {
        let e = ye(t), n = "", o = z + e;
        for (; z < o;) {
            let i = t[z++];
            if (i < 128) n += String.fromCharCode(i);
            else if (i > 191 && i < 224) {
                let s = t[z++];
                n += String.fromCharCode((i & 31) << 6 | s & 63);
            } else if (i > 239 && i < 365) {
                let s = t[z++], r = t[z++], l = t[z++],
                    a = ((i & 7) << 18 | (s & 63) << 12 | (r & 63) << 6 | l & 63) - 65536;
                n += String.fromCharCode(55296 + (a >> 10)), n += String.fromCharCode(56320 + (a & 1023));
            } else {
                let s = t[z++], r = t[z++];
                n += String.fromCharCode((i & 15) << 12 | (s & 63) << 6 | r & 63);
            }
        }
        return n;
    };

    var S3 = {
        decode: t => {
            let e = t, n = {};
            z = 0, n._header = Le(e), z += 1;
            let o = []; n.inputs = o;
            let i = ye(e);
            for (let u = 0; u < i; u++) {
                let m = {}; o[u] = m, m.id = po(e), z += 4, m.jump = Le(e), z += 1, m.rot = lt(e), z += 4, m.speed = Ot(e), z += 2;
                let g = []; m.steer = g, g[0] = bi(e), z += 1;
                let v = ye(e);
                for (let _ = 1; _ < v; _++) g[_] = bi(e), z += 1;
            }
            let s = []; n.log = s;
            let r = ye(e);
            for (let u = 0; u < r; u++) {
                let m = {}; s[u] = m;
                let g = []; m.data = g;
                let v = ye(e);
                for (let _ = 0; _ < v; _++) g[_] = ye(e);
                m.type = Le(e), z += 1;
            }
            let l = []; n.logPersonal = l;
            let a = ye(e);
            for (let u = 0; u < a; u++) {
                let m = {}; l[u] = m;
                let g = []; m.data = g;
                let v = ye(e);
                for (let _ = 0; _ < v; _++) g[_] = ye(e);
                m.type = Le(e), z += 1;
            }
            let c = []; n.movements = c;
            let f = ye(e);
            for (let u = 0; u < f; u++) {
                let m = {}; c[u] = m, m.id = po(e), z += 4;
                let g = []; m.pos = g, g[0] = lt(e), z += 4, g[1] = lt(e), z += 4;
                let v = ye(e);
                for (let k = 2; k < v; k++) g[k] = lt(e), z += 4;
                let _ = []; m.vel = _, _[0] = lt(e), z += 4, _[1] = lt(e), z += 4;
                let b = ye(e);
                for (let k = 2; k < b; k++) _[k] = lt(e), z += 4;
            }
            return n.tickId = po(e), z += 4, n;
        }
    };

    var send = (t, e = "") => {
        if (!ws || ws.readyState !== 1) return;
        ws.send(C3.encode({
            _header: 5,
            command: t,
            string: e + ""
        }));
    };

    function interceptSocket(socket) {
        ws = socket;
        socket.addEventListener("message", (event) => {
            if (!(event.data instanceof ArrayBuffer)) return;
            let data = new Uint8Array(event.data);
            if (data[0] !== 7) return;

            try {
                let decoded = S3.decode(data);
                if (settings.rareMobRadar) {
                    if (decoded.log && decoded.log.length) handleEntityLog(decoded.log);
                    if (decoded.movements && decoded.movements.length) handleMovements(decoded.movements);
                    if (decoded.inputs && decoded.inputs.length) handleInputs(decoded.inputs);
                }
                if (settings.gearSetManager) {
                    if (decoded.logPersonal && decoded.logPersonal.length) handlePersonalLog(decoded.logPersonal);
                }
            } catch (err) {
                console.error(err);
            }
        });

        socket.addEventListener("close", () => {
            if (ws === socket) {
                ws = null;
                alreadyNotified.clear();
                loadedMobs.clear();
            }
        });
    }

    // ==========================================
    // 2. RARE MOB RADAR COMPONENT
    // ==========================================

    let creatures = [];
    async function decodeCreatures() {
        let gameDataLink = "data/game/game.bin?v=" + clientVersion;
        try {
            let e = await fetch(gameDataLink),
                n = await e.arrayBuffer(),
                o = new Uint8Array(n);
            z = 0;
            let decoded = {};
            let animations = []; decoded.animations = animations;
            let i = ye(o);
            for (let J = 0; J < i; J++) {
                let O = {}; animations[J] = O;
                O.duration = lt(o), z += 4;
                let ue = []; O.effects = ue;
                let je = ye(o);
                for (let ze = 0; ze < je; ze++) {
                    let Oe = {}; ue[ze] = Oe;
                    Oe.body = Le(o), z += 1, Oe.end = lt(o), z += 4, Oe.id = Le(o), z += 1, Oe.priority = Le(o), z += 1, Oe.start = lt(o), z += 4, Oe.type = Le(o), z += 1;
                }
                O.id = Le(o), z += 1, O.movement = Le(o), z += 1, O.priority = Le(o), z += 1;
                let Ue = []; O.sounds = Ue;
                let ke = ye(o);
                for (let ze = 0; ze < ke; ze++) {
                    let Oe = {}; Ue[ze] = Oe, Oe.end = Le(o), z += 1, Oe.id = Le(o), z += 1, Oe.start = lt(o), z += 4;
                }
            }
            let s = []; decoded.areas = s;
            let r = ye(o);
            for (let J = 0; J < r; J++) {
                let O = {}; s[J] = O, O.ambientday = Le(o), z += 1, O.ambientnight = Le(o), z += 1, O.id = Le(o), z += 1, O.music = Le(o), z += 1, O.name = Sn(o);
            }
            let l = []; decoded.arenas = l;
            let a = ye(o);
            for (let J = 0; J < a; J++) {
                let O = {}; l[J] = O, O.group = Le(o), z += 1, O.id = Le(o), z += 1;
                let ue = []; O.pos = ue;
                let je = ye(o);
                for (let Ue = 0; Ue < je; Ue++) ue[Ue] = lt(o), z += 4;
                O.radius = Le(o), z += 1, O.rot = lt(o), z += 4, O.type = Le(o), z += 1, O.world = Le(o), z += 1;
            }
            let c = []; decoded.classes = c;
            let f = ye(o);
            for (let J = 0; J < f; J++) {
                let O = {}; c[J] = O;
                let ue = []; O.baseStats = ue;
                let je = ye(o);
                for (let Ze = 0; Ze < je; Ze++) {
                    let Ct = []; ue[Ze] = Ct;
                    let xe = ye(o);
                    for (let Je = 0; Je < xe; Je++) Ct[Je] = Le(o), z += 1;
                }
                let Ue = []; O.engineSkills = Ue;
                let ke = ye(o);
                for (let Ze = 0; Ze < ke; Ze++) Ue[Ze] = Le(o), z += 1;
                O.id = Le(o), z += 1;
                let ze = []; O.startSkills = ze;
                let Oe = ye(o);
                for (let Ze = 0; Ze < Oe; Ze++) ze[Ze] = Le(o), z += 1;
                let dt = []; O.statPerLevel = dt;
                let Ft = ye(o);
                for (let Ze = 0; Ze < Ft; Ze++) {
                    let Ct = []; dt[Ze] = Ct;
                    let xe = ye(o);
                    for (let Je = 0; Je < xe; Je++) Ct[Je] = Le(o), z += 1;
                }
            }
            let u = []; decoded.creatures = u;
            let m = ye(o);
            for (let J = 0; J < m; J++) {
                let O = {}; u[J] = O;
                let ue = []; O.col1 = ue;
                let je = ye(o);
                for (let ze = 0; ze < je; ze++) ue[ze] = lt(o), z += 4;
                let Ue = []; O.col2 = Ue;
                let ke = ye(o);
                for (let ze = 0; ze < ke; ze++) Ue[ze] = lt(o), z += 4;
                O.drProtection = !!bi(o), z += 1, O.faction = Le(o), z += 1, O.id = Ot(o), z += 2, O.level = Le(o), z += 1, O.name = Sn(o), O.skin = Le(o), z += 1, O.type = Le(o), z += 1;
            }

            creatures = decoded.creatures;
            console.log(`[Rare Mob Radar] loaded ${creatures.length} creatures.`);
        } catch (err) {
            console.error(err);
        }
    }

    const rareMobs = [
        { name: "Ghost", id: 15, type: "mount" },
        { name: "Keiler", id: 16, type: "mount" },
        { name: "Mireshell", id: 17, type: "mount" },
        { name: "Desert Scarab", id: 18, type: "mount" },
        { name: "Glimworm", id: 19, type: "mount" },
        { name: "Mudlasher", id: 20, type: "mount" },
        { name: "Sandpaw", id: 21, type: "mount" },
        { name: "Oakmane", id: 22, type: "mount" },
        { name: "Moonhowler", id: 23, type: "mount" },
        { name: "Silkrunner", id: 24, type: "mount" },
        { name: "Shimmerbranch", id: 25, type: "mount" },
        { name: "Coal Golem", id: 3, type: "pet" },
        { name: "Bandit Leader", id: 7, type: "pet" },
        { name: "Pirate Captain", id: 4, type: "pet" },
        { name: "Bonemother", id: 6, type: "pet" },
        { name: "Undead Necromancer", id: 2, type: "pet" },
        { name: "Nightshade", id: 5, type: "pet" }
    ];

    let alreadyNotified = new Map();
    let loadedMobs = new Map();
    let iconCache = new Map();

    let projMatrix = new Float32Array(16);
    let viewMatrix = new Float32Array(16);
    let haveMatrices = false;
    let cameraOffset = null;

    function handleEntityLog(events) {
        for (let { type, data } of events) {
            if (type !== 0) continue;

            let entityId = data[0];
            let hostility = data[1];
            let creatureTypeId = data[2];
            if (hostility !== 1) continue;

            let creature = creatures.find(c => c.id === creatureTypeId);
            if (!creature) continue;
            let mob = rareMobs.find(m => m.name === creature.name);
            if (!mob) continue;

            loadedMobs.set(entityId, { mob, pos: null });
            if (!alreadyNotified.get(entityId)) {
                alreadyNotified.set(entityId, true);
                notifyMob(mob);
            }
        }
    }

    async function playSound(soundId) {
        let audioContext = new (window.AudioContext || window.webkitAudioContext)();
        try {
            let response = await fetch(`data/assets/${soundId}.ogg`);
            let arrayBuffer = await response.arrayBuffer();
            let soundBuffer = await audioContext.decodeAudioData(arrayBuffer);
            let source = audioContext.createBufferSource();
            source.buffer = soundBuffer;

            source.playbackRate.value = 1.05;
            let gain = audioContext.createGain();
            gain.gain.value = 0.45;
            source.connect(gain);
            gain.connect(audioContext.destination);

            source.start(0);
        } catch (err) {
            console.error(err);
        }
    }

    function notifyMob(mob) {
        addChatMessage(`${mob.name} has been found nearby!`);
        playSound(1697);
    }

    function addChatMessage(text) {
        let chatPanel = document.getElementById("chat");
        if (!chatPanel) return;

        let article = document.createElement("article");
        article.style.pointerEvents = "none";
        article.style.textShadow = "1px 1px #000";
        article.style.direction = "ltr";

        let linewrap = document.createElement("div");
        linewrap.style.display = "inline";
        linewrap.style.borderRadius = "3px";
        linewrap.style.backgroundColor = "#10131d4d";
        linewrap.style.padding = "0 3px";

        let now = new Date();
        let hours = String(now.getHours()).padStart(2, "0");
        let minutes = String(now.getMinutes()).padStart(2, "0");
        let time = document.createElement("span");
        time.style.fontSize = "11px";
        time.style.color = "#5b858e";
        time.style.width = "2.8em";
        time.style.display = "inline-block";
        time.textContent = hours + "." + minutes;

        let contentSpan = document.createElement("span");
        contentSpan.style.display = "inline";
        contentSpan.style.whiteSpace = "nowrap";

        let msgSpan = document.createElement("span");
        msgSpan.style.color = "#00ffa1";
        msgSpan.style.backgroundColor = "#10131dcc";
        let textWrapper = document.createElement("span");
        textWrapper.textContent = text;
        msgSpan.appendChild(textWrapper);

        linewrap.appendChild(time);
        linewrap.appendChild(contentSpan);
        linewrap.appendChild(msgSpan);
        article.appendChild(linewrap);
        chatPanel.appendChild(article);

        setTimeout(() => {
            chatPanel.scrollTop = chatPanel.scrollHeight;
        }, 0);
    }

    function handleMovements(movements) {
        for (let m of movements) {
            let tracked = loadedMobs.get(m.id);
            if (tracked) {
                tracked.pos = [m.pos[0], m.pos[1] != null ? m.pos[1] : 0, m.pos[2] != null ? m.pos[2] : 0];
            }
        }
    }

    function handleInputs(inputs) {
        for (let m of inputs) {
            let tracked = loadedMobs.get(m.id);
            if (tracked) {
                tracked.steer = m.steer;
                tracked.rot = m.rot;
                tracked.speed = m.speed;
            }
        }
    }

    function getIcon(mob) {
        let cached = iconCache.get(mob.name);
        if (cached) return cached;
        let img = new Image();
        img.src = `https://hordes.io/data/items/${mob.type}/${mob.type}${mob.id}_q3.avif?v=8822612`;
        iconCache.set(mob.name, img);
        return img;
    }

    function projectToScreen(worldPos) {
        if (!haveMatrices) return null;
        let mvPos = [0, 0, 0, 1];
        for (let i = 0; i < 3; i++) {
            mvPos[i] = viewMatrix[i + 12];
            for (let j = 0; j < 3; j++) {
                mvPos[i] += viewMatrix[i + j * 4] * worldPos[j];
            }
        }
        let clipPos = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                clipPos[i] += projMatrix[i + j * 4] * mvPos[j];
            }
        }
        if (clipPos[3] <= 0) return null;
        let ndc = [clipPos[0] / clipPos[3], clipPos[1] / clipPos[3]];
        let centerX = window.innerWidth / 2;
        let centerY = window.innerHeight / 2;
        let screenX = centerX + ndc[0] * centerX;
        let screenY = centerY - ndc[1] * centerY;
        let dist = Math.sqrt(mvPos[0] * mvPos[0] + mvPos[1] * mvPos[1] + mvPos[2] * mvPos[2]);
        return [screenX, screenY, dist];
    }

    let lastFrameTime = performance.now();

    function drawOverlay() {
        if (!document.body || !settings.rareMobRadar) {
            let canvas = document.getElementById("_radarOverlay");
            if (canvas) canvas.style.display = "none";
            requestAnimationFrame(drawOverlay);
            return;
        }

        let canvas = document.getElementById("_radarOverlay");
        if (!canvas) {
            canvas = document.createElement("canvas");
            canvas.id = "_radarOverlay";
            canvas.style.position = "fixed";
            canvas.style.top = "0";
            canvas.style.left = "0";
            canvas.style.pointerEvents = "none";
            canvas.style.zIndex = "9999";
            document.body.appendChild(canvas);
        }
        canvas.style.display = "block";
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let now = performance.now();
        let dt = Math.min(0.1, (now - lastFrameTime) / 1000);
        lastFrameTime = now;

        for (let [mobId, tracked] of loadedMobs) {
            let pos = tracked.pos;
            if (!pos) continue;
            let steer = tracked.steer;
            if (steer && tracked.rot != null && tracked.speed != null && (steer[0] || steer[1])) {
                let s0 = steer[0], s1 = steer[1] || 0;
                let len = Math.sqrt(s0 * s0 + s1 * s1);
                if (len > 0) {
                    s0 /= len; s1 /= len;
                    if (s1 < 0) s1 *= 0.5;
                    let scale = tracked.speed / 20;
                    s0 *= scale; s1 *= scale;
                    let sinR = Math.sin(tracked.rot);
                    let cosR = Math.cos(tracked.rot);
                    let vx = s1 * sinR + s0 * cosR;
                    let vz = s1 * cosR - s0 * sinR;
                    pos[0] += vx * dt;
                    pos[2] += vz * dt;
                }
            }
            let screenPos = projectToScreen([pos[0], pos[1], pos[2]]);
            if (!screenPos) continue;
            if (screenPos[2] > 130 || screenPos[2] < 60) continue;
            let icon = getIcon(tracked.mob);
            let size = 24;
            if (icon.complete && icon.naturalWidth > 0) {
                ctx.drawImage(icon, screenPos[0] - size / 2, screenPos[1] - size / 2, size, size);
            }
        }
        requestAnimationFrame(drawOverlay);
    }

    function captureMatrices(buf, baseOff) {
        projMatrix.set(new Float32Array(buf, baseOff + cameraOffset, 16));
        viewMatrix.set(new Float32Array(buf, baseOff + cameraOffset + 64, 16));
        haveMatrices = true;
    }

    function isProjectionMatrix(f32) {
        if (!(f32[0] > 0.01)) return false;
        if (!(f32[5] > 0.01)) return false;
        if (!(f32[10] < -0.5 && f32[10] > -3)) return false;
        if (!(Math.abs(f32[11] + 1) < 0.01)) return false;
        if (!(f32[14] < 0)) return false;
        let z = (i) => Math.abs(f32[i]) < 0.001;
        if (!z(15) || !z(1) || !z(2) || !z(3) || !z(4) || !z(6) || !z(7) || !z(8) || !z(9) || !z(12) || !z(13)) return false;
        return true;
    }

    function scanMatrices(data) {
        if (!data || data.byteLength < 128) return;
        let buf, baseOff;
        if (ArrayBuffer.isView(data)) {
            buf = data.buffer;
            baseOff = data.byteOffset;
        } else {
            buf = data;
            baseOff = 0;
        }

        if (cameraOffset !== null) {
            let f32 = new Float32Array(buf, baseOff + cameraOffset, 16);
            if (isProjectionMatrix(f32)) {
                captureMatrices(buf, baseOff);
                return;
            }
            cameraOffset = null;
        }
        let maxOff = data.byteLength - 64;
        for (let offset = 0; offset <= maxOff; offset += 16) {
            let f32 = new Float32Array(buf, baseOff + offset, 16);
            if (!isProjectionMatrix(f32)) continue;
            cameraOffset = offset;
            captureMatrices(buf, baseOff);
            return;
        }
    }

    function hookWebGL(ctxPrototype) {
        let origBufferData = ctxPrototype.bufferData;
        let origBufferSubData = ctxPrototype.bufferSubData;

        ctxPrototype.bufferData = function(target, srcOrSize) {
            if (target === this.UNIFORM_BUFFER && typeof srcOrSize !== "number") {
                scanMatrices(srcOrSize);
            }
            return origBufferData.apply(this, arguments);
        };

        ctxPrototype.bufferSubData = function(target, dstByteOffset, src) {
            if (target === this.UNIFORM_BUFFER && dstByteOffset === 0) {
                scanMatrices(src);
            }
            return origBufferSubData.apply(this, arguments);
        };
    }

    hookWebGL(WebGLRenderingContext.prototype);
    hookWebGL(WebGL2RenderingContext.prototype);
    requestAnimationFrame(drawOverlay);

    // ==========================================
    // 3. GEAR SET MANAGER COMPONENT
    // ==========================================

    const gearConfig = {
        equipDelay: 250,
        stashDelay: 250,
        unstashDelay: 500,
        stashCharms: false,
        retryDelay: 1000,
        maxRetryAmount: 1,
    };

    const itemEquipSlots = {
        hammer: [101], bow: [101], staff: [101], sword: [101],
        armlet: [102], armor: [103], bag: [104], boot: [105], glove: [106],
        ring: [107], amulet: [108], quiver: [109], shield: [109], totem: [109], orb: [109],
        charm: [110, 111],
    };
    const equipSlotMin = 101;

    let inventorySlots = new Map();
    let loadedItems = new Map();
    let stashSlots = new Set();
    let currentPlayerName = null;
    let selectedGearSet = null;
    let selectedStashSet = null;
    let gearSetNameInput = "";

    const moveItem = (fromSlot, toSlot) => send("itemmove", `${fromSlot} ${toSlot}`);
    const clientPlayerCommand = (cmd, data) => send(cmd, data);
    const delay = ms => new Promise(r => setTimeout(r, ms));

    function handlePersonalLog(events) {
        let needsRefresh = false;
        for (let { type, data } of events) {
            if (type === 29) {
                inventorySlots.set(data[0], data[1]);
                needsRefresh = true;
                continue;
            }
            if (type === 30) {
                inventorySlots.delete(data[0]);
                needsRefresh = true;
                continue;
            }
            if (type === 38) {
                stashSlots.clear();
                let i = 2;
                for (let g = 0; g < 2; g++) {
                    let count = data[i++];
                    for (let j = 0; j < count; j++) stashSlots.add(data[i++]);
                }
                needsRefresh = true;
            }
        }
        if (needsRefresh) refreshGearUI();
    }

    function readAllSets() {
        try {
            return JSON.parse(localStorage.getItem("savedGearSets")) || [];
        } catch (err) {
            return [];
        }
    }

    function writeAllSets(sets) {
        localStorage.setItem("savedGearSets", JSON.stringify(sets));
    }

    function getSetByValue(value) {
        return readAllSets().find(s => s.value === value);
    }

    function getCurrentPlayerName() {
        if (currentPlayerName) return currentPlayerName;

        let equipSlots = document.getElementById("equipslots");
        if (equipSlots) {
            let charPanel = equipSlots.parentElement;
            if (charPanel) {
                let nameSpan = charPanel.querySelector(".statcol.panel-black span.bold.textwhite");
                if (nameSpan && nameSpan.textContent) {
                    currentPlayerName = nameSpan.textContent;
                    return currentPlayerName;
                }
            }
        }

        let sets = readAllSets();
        if (sets.length) return sets[sets.length - 1].playerId;
        return null;
    }

    function getPlayerSets() {
        let name = getCurrentPlayerName();
        if (!name) return [];
        return readAllSets().filter(s => s.playerId === name);
    }

    function findFirstEmptyBagSlot(exclude = new Set()) {
        for (let i = 0; i < 100; i++) {
            if (!inventorySlots.has(i) && !exclude.has(i)) return i;
        }
        return -1;
    }

    function gearSetCreate() {
        let equipped = [];
        let pid = getCurrentPlayerName();

        inventorySlots.forEach((dbid, slot) => {
            if (slot >= equipSlotMin) equipped.push(dbid);
        });
        if (!equipped.length || !pid) return;

        let name = gearSetNameInput || "unnamed";
        let sets = readAllSets();
        let equippedSet = new Set(equipped);

        let isDuplicate = sets.some(set => {
            if (set.playerId !== pid) return false;
            let items = set.items || [];
            return items.length === equipped.length && items.every(id => equippedSet.has(id));
        });
        if (isDuplicate) return;

        let value = Date.now().toString();
        sets.push({ name: name, value, items: equipped, playerId: pid });
        writeAllSets(sets);

        selectedGearSet = value;
        gearSetNameInput = "";
        refreshGearUI();
    }

    function gearSetDelete() {
        if (!selectedGearSet) return;
        let filtered = readAllSets().filter(s => s.value !== selectedGearSet);
        writeAllSets(filtered);

        let remaining = getPlayerSets().filter(s => s.value !== selectedGearSet);
        selectedGearSet = remaining.length ? remaining[0].value : null;
        refreshGearUI();
    }

    async function gearSetEquip(retry = 0) {
        let gearSet = selectedGearSet ? getSetByValue(selectedGearSet) : null;
        if (!gearSet) return;

        let targetIds = new Set(gearSet.items);
        let queued = new Set();
        let takenSlots = new Set();

        inventorySlots.forEach((dbid, slot) => {
            if (slot >= equipSlotMin && targetIds.has(dbid)) {
                queued.add(dbid);
                takenSlots.add(slot);
            }
        });

        let toEquip = [];
        inventorySlots.forEach((dbid, slot) => {
            if (slot >= equipSlotMin) return;
            if (!targetIds.has(dbid)) return;
            if (queued.has(dbid)) return;

            let info = loadedItems.get(dbid);
            if (!info) return;

            let validSlots = itemEquipSlots[info.type];
            if (!validSlots) return;

            queued.add(dbid);
            let equipSlot = validSlots.find(s => !inventorySlots.has(s) && !takenSlots.has(s)) ?? validSlots.find(s => !takenSlots.has(s));

            if (equipSlot !== undefined) {
                takenSlots.add(equipSlot);
                toEquip.push({ from: slot, to: equipSlot });
            }
        });

        if (toEquip.length === 0) {
            if (retry > gearConfig.maxRetryAmount) return;
            await delay(gearConfig.retryDelay);
            return gearSetEquip(retry++);
        }

        for (let { from, to } of toEquip) {
            moveItem(from, to);
            await delay(gearConfig.equipDelay);
        }
    }

    async function stashGearSetWithdraw() {
        let gearSet = selectedStashSet ? getSetByValue(selectedStashSet) : null;
        if (!gearSet) return;
        let targetIds = new Set(gearSet.items);
        let queued = new Set();
        for (let dbid of stashSlots) {
            if (!targetIds.has(dbid) || queued.has(dbid)) continue;
            if (findFirstEmptyBagSlot() === -1) break;
            queued.add(dbid);
            clientPlayerCommand("itemunstash", `${dbid}`);
            await delay(gearConfig.unstashDelay);
        }
    }

    async function stashGearSetDeposit() {
        let gearSet = selectedStashSet ? getSetByValue(selectedStashSet) : null;
        if (!gearSet) return;
        let targetIds = new Set(gearSet.items);
        let queued = new Set();
        let toStash = [];
        inventorySlots.forEach((dbid, slot) => {
            if (!targetIds.has(dbid) || queued.has(dbid)) return;
            let info = loadedItems.get(dbid);
            if (!gearConfig.stashCharms && info && info.type === "charm") return;
            queued.add(dbid);
            toStash.push(slot);
        });
        let takenSlots = new Set();
        for (let slot of toStash) {
            if (slot >= equipSlotMin) {
                let emptySlot = findFirstEmptyBagSlot(takenSlots);
                if (emptySlot === -1) continue;
                takenSlots.add(emptySlot);
                clientPlayerCommand("itemmove", `${slot} ${emptySlot}`);
                await delay(gearConfig.stashDelay / 2);
                clientPlayerCommand("itemstash", `${emptySlot}`);
                await delay(gearConfig.stashDelay / 2);
                await delay(gearConfig.stashDelay);
                continue;
            }
            clientPlayerCommand("itemstash", `${slot}`);
            await delay(gearConfig.stashDelay);
        }
    }

    function makeButton(text, cls, font, size) {
        let btn = document.createElement("button");
        btn.textContent = text;
        btn.className = cls;
        btn.style.font = font;
        btn.style.minWidth = size;
        return btn;
    }

    function makeOption(name, value) {
        let option = document.createElement("option");
        option.textContent = name;
        option.value = value;
        return option;
    }

    function fillSelect(selector, getSelected, setSelected) {
        let sets = getPlayerSets();
        while (selector.firstChild) selector.removeChild(selector.firstChild);
        for (let { name, value } of sets) selector.appendChild(makeOption(name, value));
        if (!getSelected() && sets.length) setSelected(sets[0].value);
        if (getSelected()) selector.value = getSelected();
    }

    function populateCharPanelSelect(selector) {
        fillSelect(selector, () => selectedGearSet, v => { selectedGearSet = v; });
    }

    function populateStashSelect(selector) {
        fillSelect(selector, () => selectedStashSet, v => { selectedStashSet = v; });
    }

    function injectGearSetUI(parent) {
        if (!settings.gearSetManager || document.getElementById("gearSetRow")) return;

        let row = document.createElement("div");
        row.id = "gearSetRow";
        row.style.display = "flex";
        row.style.gap = "5px";
        row.style.alignItems = "center";
        row.style.padding = "2px 0";
        row.style.width = "100%";
        row.style.overflow = "hidden";

        let createBtn = makeButton("Create", "btn black textprimary", "bold 15px hordes", "70px");
        let deleteBtn = makeButton("Delete", "btn black textprimary", "bold 15px hordes", "70px");
        let equipBtn = makeButton("Equip", "btn black textgreen", "bold 15px hordes", "70px");

        let selector = document.createElement("select");
        selector.style.maxWidth = "100px";
        selector.style.font = "15px bold hordes";

        let nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.placeholder = "Name";
        nameInput.className = "textwhite";
        nameInput.style.font = "bold 15px hordes";

        row.append(createBtn, deleteBtn, equipBtn, selector, nameInput);

        createBtn.addEventListener("click", gearSetCreate);
        deleteBtn.addEventListener("click", gearSetDelete);
        equipBtn.addEventListener("click", () => gearSetEquip());
        selector.addEventListener("change", e => { selectedGearSet = e.target.value || null; });
        nameInput.addEventListener("input", e => { gearSetNameInput = e.target.value; });

        parent.prepend(row);
        populateCharPanelSelect(selector);
    }

    function injectStashUI(formelements) {
        if (!settings.gearSetManager || document.getElementById("stashGearSetRow")) return;

        let row = document.createElement("div");
        row.id = "stashGearSetRow";
        row.style.display = "flex";
        row.style.gap = "5px";
        row.style.alignItems = "center";
        row.style.order = "-1";
        row.style.marginRight = "auto";

        let withdrawBtn = makeButton("Withdraw", "btn green textblack", "bold 14px hordes", "95px");
        let depositBtn = makeButton("Deposit", "btn cyan textblack", "bold 14px hordes", "95px");

        let selector = document.createElement("select");
        selector.style.maxWidth = "100px";
        selector.style.font = "15px bold hordes";

        row.append(selector, withdrawBtn, depositBtn);

        withdrawBtn.addEventListener("click", stashGearSetWithdraw);
        depositBtn.addEventListener("click", stashGearSetDeposit);
        selector.addEventListener("change", e => { selectedStashSet = e.target.value || null; });

        formelements.prepend(row);
        populateStashSelect(selector);
    }

    let alreadyRefreshingGear = false;
    function refreshGearUI() {
        if (alreadyRefreshingGear) return;
        alreadyRefreshingGear = true;
        requestAnimationFrame(() => {
            alreadyRefreshingGear = false;
            let row = document.getElementById("gearSetRow");
            if (row) {
                let nameField = row.querySelector("input");
                if (nameField) nameField.value = gearSetNameInput;
                let selector = row.querySelector("select");
                if (selector) populateCharPanelSelect(selector);
            }
            let stashRow = document.getElementById("stashGearSetRow");
            if (stashRow) {
                let selector = stashRow.querySelector("select");
                if (selector) populateStashSelect(selector);
            }
        });
    }

    function applyGearManagerVisibility() {
        let row = document.getElementById("gearSetRow");
        let stashRow = document.getElementById("stashGearSetRow");

        if (!settings.gearSetManager) {
            if (row) row.style.display = "none";
            if (stashRow) stashRow.style.display = "none";
        } else {
            let equipSlots = document.getElementById("equipslots");
            if (equipSlots && equipSlots.parentElement) injectGearSetUI(equipSlots.parentElement);

            let formelements = document.querySelector(".panel-black.marg-top > .marg-top.formelements");
            if (formelements) injectStashUI(formelements);
        }
    }

    // ==========================================
    // 4. INTEGRATED BELL ADD-ON MODULES
    // ==========================================

    function updateBuffsButtonState() {
        const buffBtn = document.getElementById('rndms-buffs-toggle-btn');
        if (buffBtn) {
            buffBtn.className = 'btn border black ' + (settings.ownBuffsOnly ? 'textgreen' : 'textwhite');
        }
    }

    function injectBuffsButton() {
        const target = document.querySelector('.btn.border.black.textcyan') || document.querySelector('.textcyan');
        if (!target) return;

        let buffBtn = document.getElementById('rndms-buffs-toggle-btn');
        if (!buffBtn) {
            buffBtn = document.createElement('div');
            buffBtn.id = 'rndms-buffs-toggle-btn';
            buffBtn.style.cursor = 'pointer';
            buffBtn.style.marginLeft = '1px';
            buffBtn.style.display = 'inline-flex';
            buffBtn.style.alignItems = 'center';
            buffBtn.style.justifyContent = 'center';
            buffBtn.textContent = '👁️';

            buffBtn.addEventListener('click', () => {
                settings.ownBuffsOnly = !settings.ownBuffsOnly;
                saveSettings();

                checkAndSyncBuffs();
                updateBuffsButtonState();

                const checkbox = document.getElementById('rndms-ownbuffs');
                if (checkbox) {
                    checkbox.classList.toggle('active', settings.ownBuffsOnly);
                }
            });

            target.insertAdjacentElement('afterend', buffBtn);
        } else {
            buffBtn.style.marginLeft = '1px';
        }

        updateBuffsButtonState();
    }

    function clickSpecificButton() {
        if (!settings.autoOpen) return;
        const buttons = document.querySelectorAll('.btn.border.black.textgreen');
        buttons.forEach(function (button) {
            const text = button.textContent.trim();
            if (text === 'Yes, open my Stash.' ||
                text === 'Show me your wares.' ||
                text === 'Yes, I have some items.' ||
                text === 'Yes, show me the items for sale.') {
                button.click();
            }
        });
    }

    function removeElements() {
        if (settings.removeUpgradeButton) {
            document.querySelectorAll('.btn.textwhite').forEach(element => {
                if (element.textContent.trim() === 'Upgrade') element.style.display = 'none';
            });
        }

        if (settings.removeBarTexts) {
            document.querySelectorAll('.marg-top.bar.btn.black.grey.svelte-nijy6x').forEach(parent => {
                const msElement = parent.querySelector('.textcyan');
                if (msElement && !msElement.dataset.bellBound) {
                    msElement.dataset.bellBound = "1";
                    msElement.style.cursor = "pointer";

                    msElement.addEventListener("click", async () => {
                        const ms = msElement.textContent.trim();
                        try {
                            await navigator.clipboard.writeText(`${ms}`);
                        } catch (err) {
                            console.error("Clipboard error:", err);
                        }
                    });
                }
            });
        }
    }

    function chatremake() {
        if (!settings.chatRemake) return;

        let senderElements = document.querySelectorAll('.sender.svelte-7c1tlw');
        senderElements.forEach(sender => {
            if (!sender.querySelector('#textf0, #textf1')) {
                const hasTextF1 = sender.querySelector('.textf1');
                let newSpan = document.createElement('span');
                newSpan.id = hasTextF1 ? 'textf1' : 'textf0';
                newSpan.className = hasTextF1 ? 'textf1' : 'textf0';
                newSpan.innerHTML = '&gt; ';
                sender.appendChild(newSpan);
            }
        });
    }

    function partyEntranceTransition() {
        if (!settings.partyTransition) return;

        if (!document.getElementById("bell-party-style")) {
            const style = document.createElement("style");
            style.id = "bell-party-style";
            style.textContent = `
                .partyframes.svelte-1xmlhk>.grid>* {
                    opacity: 0;
                    transform: translateX(-80px);
                    transition: transform .55s cubic-bezier(.22,1,.36,1), opacity .35s ease;
                    will-change: transform, opacity;
                }
                .partyframes.svelte-1xmlhk>.grid.tm-show>* {
                    opacity: 1;
                    transform: none;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        }

        document.querySelectorAll(".partyframes.svelte-1xmlhk").forEach(frame => {
            [...frame.children].forEach((el, index) => {
                if (!el.classList.contains("grid")) return;
                if (el.dataset.tmAnimated) return;
                el.dataset.tmAnimated = "1";
                setTimeout(() => {
                    el.classList.add("tm-show");
                }, index * 100);
            });
        });
    }

    const HIGHLIGHT_CLASS = "bell-mention-highlight";
    let mentionAudioCtx = null;
    let mentionLastPing = 0;

    function mentionPlayPing() {
        const now = Date.now();
        if (now - mentionLastPing < 800) return;
        mentionLastPing = now;
        try {
            if (!mentionAudioCtx)
                mentionAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (mentionAudioCtx.state === "suspended")
                mentionAudioCtx.resume();
            const osc = mentionAudioCtx.createOscillator();
            const gain = mentionAudioCtx.createGain();
            osc.type = "sine";
            osc.frequency.value = 1100;
            gain.gain.setValueAtTime(0.18, mentionAudioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, mentionAudioCtx.currentTime + 0.18);
            osc.connect(gain);
            gain.connect(mentionAudioCtx.destination);
            osc.start();
            osc.stop(mentionAudioCtx.currentTime + 0.18);
        } catch (e) {}
    }

    function mentionGetPlayerNames() {
        try {
            const data = JSON.parse(localStorage.getItem("skillbarsettings") || "{}");
            return Object.keys(data);
        } catch { return []; }
    }

    function mentionEscapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function mentionHighlightLine(line, playSound) {
        if (!settings.mentionHighlight) return;

        const names = mentionGetPlayerNames();
        if (!names.length) return;

        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        for (const node of textNodes) {
            if (node.parentElement && node.parentElement.classList.contains(HIGHLIGHT_CLASS)) continue;

            let text = node.nodeValue;
            let changed = false;
            const frag = document.createDocumentFragment();

            while (text.length) {
                let earliest = Infinity;
                let matchedName = null;
                let matchedText = null;

                for (const name of names) {
                    const regex = new RegExp(`@${mentionEscapeRegExp(name)}(?=$|\\s|[!?,.:;()\\[\\]{}"'<>])`);
                    const match = regex.exec(text);
                    if (match && match.index < earliest) {
                        earliest = match.index;
                        matchedName = name;
                        matchedText = match[0];
                    }
                }

                if (!matchedName) {
                    frag.appendChild(document.createTextNode(text));
                    break;
                }

                if (earliest > 0)
                    frag.appendChild(document.createTextNode(text.slice(0, earliest)));

                const span = document.createElement("span");
                span.className = HIGHLIGHT_CLASS;
                span.textContent = matchedText;
                frag.appendChild(span);

                if (playSound) mentionPlayPing();

                text = text.slice(earliest + matchedText.length);
                changed = true;
            }

            if (changed) node.replaceWith(frag);
        }
    }

    function mentionHighlighter() {
        if (!document.getElementById("bell-mention-style")) {
            const style = document.createElement("style");
            style.id = "bell-mention-style";
            style.textContent = `
                .${HIGHLIGHT_CLASS} {
                    color: #ffac38 !important;
                }
            `;
            document.head.appendChild(style);
        }

        const chat = document.querySelector("#chat");
        if (!chat) return;

        if (chat.dataset.bellMentionObserved) return;
        chat.dataset.bellMentionObserved = "1";

        chat.querySelectorAll("article").forEach(line => {
            if (line.dataset.bellMentionDone) return;
            line.dataset.bellMentionDone = "1";
            mentionHighlightLine(line, false);
        });

        const observer = new MutationObserver(mutations => {
            if (!settings.mentionHighlight) return;
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => {
                    if (!(node instanceof HTMLElement)) return;
                    if (node.tagName === 'ARTICLE' || node.matches("article")) {
                        if (node.dataset.bellMentionDone) return;
                        node.dataset.bellMentionDone = "1";
                        mentionHighlightLine(node, true);
                    }
                    node.querySelectorAll?.("article").forEach(line => {
                        if (line.dataset.bellMentionDone) return;
                        line.dataset.bellMentionDone = "1";
                        mentionHighlightLine(line, true);
                    });
                });
            }
        });

        observer.observe(chat, { childList: true, subtree: true });
    }

    // ==========================================
    // 5. NATIVE SETTINGS MENU INTEGRATION
    // ==========================================

    var borderStyleRule = document.createElement('style');
    var ccStyleRule = document.createElement('style');
    var classColorsStyleRule = document.createElement('style');
    var yellChatStyleRule = document.createElement('style');
    var debugBarStyleRule = document.createElement('style');

    function checkAndSyncBuffs() {
        const nativeState = localStorage.getItem("buffsHideIrrelevant") === "true";
        if (nativeState !== settings.ownBuffsOnly) {
            syncNativeBuffsState = true;
            const settingsPanel = [...document.querySelectorAll(".window-pos")].find(el => {
                const title = el.querySelector(".title");
                return title && title.textContent.toLowerCase().startsWith("settings");
            });

            if (settingsPanel) {
                executeNativeBuffClick(settingsPanel);
            } else {
                const cog = document.querySelector("#syscog");
                if (cog) cog.click();
            }
        }
    }

    function executeNativeBuffClick(settingsPanel) {
        try {
            const container = settingsPanel?.children?.[0]?.children?.[1]?.children?.[0];
            if (!container) return;
            container.children?.[0]?.children?.[0]?.click();
            const buffSetting = container.children?.[1]?.children?.[1]?.children?.[61];
            if (buffSetting) buffSetting.click();
            const cog = document.querySelector("#syscog");
            if (cog) cog.click();
        } catch (err) {
            console.error("Buff Toggler Error:", err);
        }
        syncNativeBuffsState = false;
    }

    function addRndmsSettings() {
        if (!document.getElementById('rndms-desc-style')) {
            const style = document.createElement('style');
            style.id = 'rndms-desc-style';
            style.textContent = `
                .rndms-label-container {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .rndms-desc {
                    display: block;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.6);
                    font-weight: normal;
                    margin-top: 2px;
                    line-height: 1.2;
                }
            `;
            document.head.appendChild(style);
        }

        const settingsRoot = document.querySelector('.divide.svelte-13nnce4');
        if (!settingsRoot) return;

        const choices = settingsRoot.children[0];
        if (!choices) return;

        const existingButton = document.querySelector('#rndms-settings-button');
        if (existingButton) {
            const existingContent = document.getElementById('rndms-settings-panel');
            if (existingContent && !existingButton.classList.contains('active')) {
                existingContent.style.display = 'none';
            }
            return;
        }

        // Add tab button
        const button = document.createElement('div');
        button.className = 'choice';
        button.id = 'rndms-settings-button';
        button.textContent = 'Random Mods';
        choices.appendChild(button);

        const menu = settingsRoot.querySelector('.menu.panel-black');
        if (!menu) return;

        // Add content container
        const content = document.createElement('div');
        content.id = 'rndms-settings-panel';
        content.style.display = 'none';
        content.style.height = "100%";
        content.style.flexDirection = "column";
        content.style.position = "relative";
        content.style.overflowY = "auto";

        const sections = [
            {
                title: "General",
                items: [
                    { key: "fullscreen", id: "rndms-fullscreen", label: "Auto Fullscreen", desc: "Automatically goes into fullscreen and mutes fullscreen notification" },
                    { key: "rareMobRadar", id: "rndms-radar", label: "Rare Mob Radar", desc: "Gives a notification through chat and plays a sound when a rare mob has been found" },
                    { key: "gearSetManager", id: "rndms-gearset", label: "Gear Set Manager", desc: "Gear presets (access through character sheet)" },
                    { key: "autoOpen", id: "rndms-autoopen", label: "Auto Open NPCs", desc: "" }
                ]
            },
            {
                title: "Chat",
                items: [
                    { key: "yellChat", id: "rndms-yell", label: "Global Chat", desc: "Changes Yell chat colour to the OG global chat colour" },
                    { key: "moveableChat", id: "rndms-chatdrag", label: "Movable Chat", desc: "Able to drag the chat wherever you want (enable to edit position of the chat)" },
                    { key: "chatRemake", id: "rndms-chatremake", label: "Clean Chat", desc: "" },
                    { key: "killMsgFormat", id: "rndms-killmsg", label: "Kill Msg Format", desc: "" },
                    { key: "mentionHighlight", id: "rndms-mention", label: "Mention Ping", desc: "Plays a ping sound when your name is mentioned (eg. @rndms)" }
                ]
            },
            {
                title: "Combat",
                items: [
                    { key: "ccIndicator", id: "rndms-cc", label: "CC Indicator", desc: "" },
                    { key: "ownBuffsOnly", id: "rndms-ownbuffs", label: "Show Own Buffs Only", desc: "" }
                ]
            },
            {
                title: "Interface",
                items: [
                    { key: "classColors", id: "rndms-classcolors", label: "Class Colours", desc: "" },
                    { key: "blackBorders", id: "rndms-borders", label: "Black Borders", desc: "" },
                    { key: "partyTransition", id: "rndms-partyanim", label: "Party Animation", desc: "" },
                    { key: "removeLevelBar", id: "rndms-levelbar", label: "Hide XP Bar", desc: "" },
                    { key: "removeEntityPanel", id: "rndms-entitypanel", label: "Hide Entity Panel", desc: "" },
                    { key: "removeInventoryFilter", id: "rndms-invfilter", label: "Hide Inv Filter", desc: "" },
                    { key: "removeUpgradeButton", id: "rndms-upgradebtn", label: "Hide Stash Upgrade", desc: "" },
                    { key: "removeBarTexts", id: "rndms-debugbar", label: "Clean Debug Bar", desc: "" }
                ]
            }
        ];

        content.innerHTML = `
            <h3 class="textprimary">Random Mods settings</h3>

            <div style="display: flex; flex-direction: column; gap: 8px; padding-bottom: 20px;">
                ${sections.map(section => `
                    <div style="font-size: 11px; font-weight: bold; color: rgba(255,255,255,0.7); text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 3px; margin-top: 8px;">
                        ${section.title}
                    </div>
                    <div class="settings svelte-13nnce4" style="flex:0;">
                        ${section.items.map(setting => `
                            <div class="rndms-label-container">
                                <span>${setting.label}</span>
                                ${setting.desc ? `<div class="rndms-desc">${setting.desc}</div>` : ''}
                            </div>
                            <div
                                class="btn checkbox ${settings[setting.key] ? 'active' : ''}"
                                id="${setting.id}">
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;

        menu.appendChild(content);

        // Checkbox listeners
        const allSettingItems = sections.flatMap(s => s.items);

        allSettingItems.forEach(setting => {
            const btn = document.getElementById(setting.id);
            if (!btn) return;

            btn.addEventListener("click", () => {
                settings[setting.key] = !settings[setting.key];
                btn.classList.toggle("active");
                saveSettings();

                if (setting.key === 'blackBorders') borderStyleRule.disabled = !settings.blackBorders;
                if (setting.key === 'ccIndicator') ccStyleRule.disabled = !settings.ccIndicator;
                if (setting.key === 'classColors') classColorsStyleRule.disabled = !settings.classColors;
                if (setting.key === 'yellChat') yellChatStyleRule.disabled = !settings.yellChat;
                if (setting.key === 'removeBarTexts') debugBarStyleRule.disabled = !settings.removeBarTexts;
                if (setting.key === 'ownBuffsOnly') {
                    checkAndSyncBuffs();
                    updateBuffsButtonState();
                }
                if (setting.key === 'gearSetManager') applyGearManagerVisibility();
                if (setting.key === 'moveableChat') applyChatDragState();
            });
        });

        // Open custom menu tab
        button.addEventListener('click', () => {
            choices.querySelectorAll('.choice').forEach(x => x.classList.remove('active'));
            button.classList.add('active');

            menu.querySelectorAll(':scope > *').forEach(x => {
                if (x.id !== 'rndms-settings-panel') {
                    x.style.display = 'none';
                }
            });

            content.style.display = 'flex';
        });

        // Restore standard menu tabs on click
        choices.querySelectorAll('.choice:not(#rndms-settings-button)').forEach(btn => {
            btn.addEventListener('click', () => {
                button.classList.remove('active');
                content.style.display = 'none';

                menu.querySelectorAll(':scope > *').forEach(x => {
                    if (x.id !== 'rndms-settings-panel') {
                        x.style.display = '';
                    }
                });
            });
        });
    }

    function initUI() {
        updateRemovalStyles();

        var bStr = '#skillbar { background-color: black !important; background: black !important; border-color: black !important; } ';
        bStr += '.border.slot.white, .border.slot.purp, .border.slot.grey, .border.slot.blue, .border.slot.green { border-color: black !important; box-shadow: none !important; }';
        borderStyleRule.textContent = bStr;
        document.head.appendChild(borderStyleRule);

        var ccStr = '.bars.svelte-g292qg:has([src*="/14."]), .bars.svelte-g292qg:has([src*="/34."]) { box-shadow: 0px 0px 0px 3px #FFFF00; } ';
        ccStr += '.bars.svelte-g292qg:has([src*="/49."]), .bars.svelte-g292qg:has([src*="/50."]) { box-shadow: 0px 0px 0px 3px #FFA500; } ';
        ccStr += '.bars.svelte-g292qg:has([src*="deepFrozen"]), .bars.svelte-g292qg:has([src*="stunBuff"]), .bars.svelte-g292qg:has([src*="/37."]) { box-shadow: 0px 0px 0px 3px #FF0000; }';
        ccStyleRule.textContent = ccStr;
        document.head.appendChild(ccStyleRule);

        var clStr = '.grid.svelte-g292qg:has(.bgc0) .bghealth { background: linear-gradient(0deg,#C7966F 0%,#A37B5B 49%,#C7966F 50%) } ';
        clStr += '.grid.svelte-g292qg:has(.bgc1) .bghealth { background: linear-gradient(0deg,#21A9E1 0%,#1B8AB8 49%,#21A9E1 50%) } ';
        clStr += '.grid.svelte-g292qg:has(.bgc2) .bghealth { background: linear-gradient(0deg,#98CE64 0%,#6F964D 49%,#98CE64 50%) } ';
        clStr += '.grid.svelte-g292qg:has(.bgc3) .bghealth { background: linear-gradient(0deg,#1C51FF 0%,#1742D1 49%,#1C51FF 50%) } ';
        clStr += '.grid.svelte-g292qg:has(.bgc4) .bghealth { background: linear-gradient(0deg,#A35AC2 0%,#874AA0 49%,#A35AC2 50%) }';
        classColorsStyleRule.textContent = clStr;
        document.head.appendChild(classColorsStyleRule);

        yellChatStyleRule.textContent = '.textyell { color: #FFCB9D; } .btn.textyell { color: #FFCB9D; }';
        document.head.appendChild(yellChatStyleRule);

        debugBarStyleRule.textContent = '.bar.btn.black.grey { background: transparent !important; background-color: transparent !important; border: none !important; box-shadow: none !important; position: fixed !important; top: 257px !important; right: 8px !important; margin: 0 !important; padding: 0 !important; text-align: right !important; z-index: 100 !important; }';
        document.head.appendChild(debugBarStyleRule);

        borderStyleRule.disabled = !settings.blackBorders;
        ccStyleRule.disabled = !settings.ccIndicator;
        classColorsStyleRule.disabled = !settings.classColors;
        yellChatStyleRule.disabled = !settings.yellChat;
        debugBarStyleRule.disabled = !settings.removeBarTexts;

        // Mutation Observer Engine
        var isModifyingDOM = false;

        var globalObserver = new MutationObserver(function() {
            if (isModifyingDOM) return;
            isModifyingDOM = true;

            try {
                applyBlackout();
                applyKillMessageFormat();
                applyChatDragState();
                clickSpecificButton();
                chatremake();
                removeElements();
                partyEntranceTransition();
                mentionHighlighter();
                addRndmsSettings();
                injectBuffsButton();

                let equipSlots = document.getElementById("equipslots");
                if (!equipSlots) {
                    let gRow = document.getElementById("gearSetRow");
                    if (gRow) gRow.style.display = "none";
                    currentPlayerName = null;
                }
                if (equipSlots && equipSlots.parentElement && !document.getElementById("gearSetRow")) {
                    injectGearSetUI(equipSlots.parentElement);
                }

                let _formelements = document.querySelector(".formelements");
                if (!_formelements) {
                    let sRow = document.getElementById("stashGearSetRow");
                    if (sRow) sRow.style.display = "none";
                    stashSlots.clear();
                }
                if (_formelements) {
                    let formelements = document.querySelector(".panel-black.marg-top > .marg-top.formelements");
                    if (formelements && !document.getElementById("stashGearSetRow")) {
                        injectStashUI(formelements);
                    }
                }

                if (syncNativeBuffsState) {
                    const settingsPanel = [...document.querySelectorAll(".window-pos")].find(el => {
                        const title = el.querySelector(".title");
                        return title && title.textContent.toLowerCase().startsWith("settings");
                    });
                    if (settingsPanel) {
                        executeNativeBuffClick(settingsPanel);
                    }
                }
            } catch (err) {
                console.error("Mutation Observer Handled Error:", err);
            } finally {
                isModifyingDOM = false;
            }
        });

        globalObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

    // ==========================================
    // 6. PVP KILL LOG FORMAT FEATURE
    // ==========================================
    function applyKillMessageFormat() {
        if (!settings.killMsgFormat) return;

        let cb = document.getElementById('chat') || document.querySelector('.chat, [class*="chat-container"]');
        if (!cb) return;

        let articles = cb.querySelectorAll('article');
        articles.forEach(article => {
            if (article.querySelector('.textpvp') || article.textContent.includes(' killed ') || article.textContent.includes(' > ')) {
                let walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while (node = walker.nextNode()) {
                    if (node.nodeValue.includes(' killed ')) {
                        node.nodeValue = node.nodeValue.replace(/ killed /g, ' > ');
                    }
                    if (node.nodeValue.includes(' for ')) {
                        node.nodeValue = node.nodeValue.replace(/ for /g, ' | ');
                    }
                }
            }
        });
    }

    // ==========================================
    // 7. LOCKABLE & PROPORTIONAL MOVEABLE CHAT
    // ==========================================
    function getChatContainer() {
        const chatLog = document.getElementById('chat') || document.querySelector('.chat');
        if (!chatLog) return null;

        let cur = chatLog.parentElement;
        for (let i = 0; i < 3 && cur && cur !== document.body; i++) {
            if (cur.querySelector('.channelselect') || cur.querySelector('#chatinput') || cur.querySelector('.inputcontainer')) {
                return cur;
            }
            cur = cur.parentElement;
        }
        return chatLog;
    }

    let isChatDragInitialized = false;

    function applyChatDragState() {
        const container = getChatContainer();
        if (!container) return;

        var cWidth = container.offsetWidth || 450;
        var cHeight = container.offsetHeight || 250;

        var posX, posY;

        if (settings.chatPos.xRatio !== null && settings.chatPos.xRatio !== undefined) {
            posX = Math.round(settings.chatPos.xRatio * window.innerWidth);
            posY = Math.round(settings.chatPos.yRatio * window.innerHeight);
        } else if (settings.chatPos.x !== null && settings.chatPos.y !== null) {
            settings.chatPos.xRatio = settings.chatPos.x / window.innerWidth;
            settings.chatPos.yRatio = settings.chatPos.y / window.innerHeight;
            saveSettings();
            posX = settings.chatPos.x;
            posY = settings.chatPos.y;
        }

        if (posX !== undefined && posY !== undefined) {
            var maxLeft = Math.max(0, window.innerWidth - cWidth);
            var maxTop = Math.max(0, window.innerHeight - cHeight);
            posX = Math.max(0, Math.min(posX, maxLeft));
            posY = Math.max(0, Math.min(posY, maxTop));

            container.style.setProperty('position', 'fixed', 'important');
            container.style.setProperty('z-index', '9999', 'important');
            container.style.setProperty('width', '450px', 'important');
            container.style.setProperty('left', posX + 'px', 'important');
            container.style.setProperty('top', posY + 'px', 'important');
            container.style.setProperty('bottom', 'auto', 'important');
            container.style.setProperty('right', 'auto', 'important');
            container.style.setProperty('pointer-events', 'auto', 'important');
        }

        if (settings.moveableChat) {
            container.style.setProperty('cursor', 'move', 'important');

            if (!isChatDragInitialized) {
                isChatDragInitialized = true;
                var isDragging = false;
                var offsetX = 0;
                var offsetY = 0;

                container.addEventListener('mousedown', function(e) {
                    if (!settings.moveableChat) return;
                    if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName) || e.target.closest('button') || e.target.closest('input')) {
                        return;
                    }
                    isDragging = true;
                    var rect = container.getBoundingClientRect();
                    offsetX = e.clientX - rect.left;
                    offsetY = e.clientY - rect.top;
                    e.preventDefault();
                });

                document.addEventListener('mousemove', function(e) {
                    if (!isDragging || !settings.moveableChat) return;
                    var newX = e.clientX - offsetX;
                    var newY = e.clientY - offsetY;

                    var curWidth = container.offsetWidth || 450;
                    var curHeight = container.offsetHeight || 250;
                    var clampedX = Math.max(0, Math.min(newX, window.innerWidth - curWidth));
                    var clampedY = Math.max(0, Math.min(newY, window.innerHeight - curHeight));

                    container.style.setProperty('left', clampedX + 'px', 'important');
                    container.style.setProperty('top', clampedY + 'px', 'important');
                    container.style.setProperty('bottom', 'auto', 'important');
                    container.style.setProperty('right', 'auto', 'important');

                    settings.chatPos = {
                        x: clampedX,
                        y: clampedY,
                        xRatio: clampedX / window.innerWidth,
                        yRatio: clampedY / window.innerHeight
                    };
                    saveSettings();
                });

                document.addEventListener('mouseup', function() {
                    isDragging = false;
                });
            }
        } else {
            container.style.removeProperty('cursor');

            if (settings.chatPos.xRatio === null && settings.chatPos.x === null) {
                container.style.removeProperty('position');
                container.style.removeProperty('z-index');
                container.style.removeProperty('left');
                container.style.removeProperty('top');
                container.style.removeProperty('bottom');
                container.style.removeProperty('right');
                container.style.removeProperty('width');
                container.style.removeProperty('pointer-events');
            }
        }
    }

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange', 'resize'].forEach(function(evt) {
        window.addEventListener(evt, function() {
            applyChatDragState();
        });
    });

    // ==========================================
    // 8. CORE SYSTEM UTILITIES BLOCKS
    // ==========================================
    function isFullscreen() {
        return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    }
    function openFullscreen(elem) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.msVisualFullscreen) elem.msVisualFullscreen();
    }
    window.addEventListener('click', function() {
        if (settings.fullscreen && !isFullscreen()) {
            openFullscreen(document.documentElement);
        }
    });

    var colorsToRemove = ['white', 'purp', 'grey', 'blue', 'green'];
    var targetColor = 'black';

    function applyBlackout() {
        if (!settings.blackBorders) return;
        var slots = document.querySelectorAll('.border.slot');
        slots.forEach(function(slot) {
            var changed = false;
            colorsToRemove.forEach(function(color) {
                if (slot.classList.contains(color)) {
                    slot.classList.remove(color);
                    changed = true;
                }
            });
            if (changed && !slot.classList.contains(targetColor)) {
                slot.classList.add(targetColor);
            }
        });
    }
})();
