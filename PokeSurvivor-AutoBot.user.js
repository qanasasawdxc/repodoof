
// ==UserScript==
// @name         PokeSurvivor AutoBot v1
// @namespace    https://github.com/
// @version      1.0.0
// @description  Auto move, auto attack and auto pick cards
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const VERSION = "1.0.0";
  const GLOBAL = "__PSBOT_V1__";

  if (window[GLOBAL]?.stop) window[GLOBAL].stop();

  const CFG = {
    tickMs: 220,
    checkpointMs: 900,
    enemyRepelRadius: 145,
    enemyRepelWeight: 1.65,
    lowHpRatio: 0.25,
    debug: false
  };

  const workers = new Set();
  const workerMeta = new WeakMap();

  let activeWorker = null;
  let latestState = null;
  let running = false;
  let loopTimer = null;
  let checkpointTimer = null;
  let seq = Math.floor(Date.now() / 10);
  let lastCheckpointAt = 0;
  let lastPickAt = 0;
  let panel = null;
  let statusNode = null;

  const log = (...args) => {
    if (CFG.debug) console.log("[PSBot]", ...args);
  };

  function makePanel() {
    if (panel?.isConnected) return;

    panel = document.createElement("div");
    panel.id = "psbot-v1-panel";

    panel.style.cssText = `
      position:fixed;
      z-index:2147483647;
      right:12px;
      top:12px;
      width:210px;
      padding:10px 12px;
      border-radius:10px;
      background:rgba(15,18,25,.94);
      color:white;
      font:12px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;
      box-shadow:0 3px 16px rgba(0,0,0,.35);
    `;

    panel.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px">
        PokeSurvivor AutoBot v${VERSION}
      </div>

      <div id="psbot-v1-status" style="margin-bottom:8px">
        Đang tìm Worker…
      </div>

      <div style="display:flex;gap:6px">
        <button id="psbot-v1-toggle"
          style="flex:1;padding:7px;border:0;border-radius:6px;background:#16834a;color:white">
          Bắt đầu
        </button>

        <button id="psbot-v1-close"
          style="padding:7px 10px;border:0;border-radius:6px;background:#555;color:white">
          ×
        </button>
      </div>

      <div style="opacity:.7;margin-top:6px">
        v1 · Né vật cản cơ bản
      </div>
    `;

    (document.documentElement || document.body).appendChild(panel);

    statusNode = panel.querySelector("#psbot-v1-status");

    panel.querySelector("#psbot-v1-toggle").onclick = () => {
      running ? stop() : start();
    };

    panel.querySelector("#psbot-v1-close").onclick = () => {
      stop();
      panel.remove();
      panel = null;
    };
  }

  function setStatus(text) {
    if (statusNode) statusNode.textContent = text;

    const button = panel?.querySelector("#psbot-v1-toggle");

    if (button) {
      button.textContent = running ? "Dừng bot" : "Bắt đầu";
      button.style.background = running ? "#b33a3a" : "#16834a";
    }
  }

  function attachWorker(worker) {
    if (!worker || workers.has(worker)) return;

    workers.add(worker);

    workerMeta.set(worker, {
      checkpointRequested: 0
    });

    worker.addEventListener("message", event => {
      const data = event.data;

      if (data?.type === "checkpoint" && data.state) {
        activeWorker = worker;
        latestState = data.state;
        lastCheckpointAt = Date.now();

        const player = choosePlayer(latestState);

        if (player) {
          setStatus(
            `Đã kết nối · Lv${latestState.team?.level ?? "?"} · HP ${Math.round(player.hp)}/${Math.round(player.maxHp)}`
          );
        }

        log("Checkpoint:", data.state.tick);
      }
    });
  }

  // Theo dõi Worker mà game tạo ra.
  const NativeWorker = window.Worker;

  if (NativeWorker) {
    const WrappedWorker = new Proxy(NativeWorker, {
      construct(Target, args) {
        const worker = Reflect.construct(Target, args, Target);
        attachWorker(worker);
        return worker;
      }
    });

    try {
      window.Worker = WrappedWorker;
    } catch (error) {
      console.warn("[PSBot] Không thể hook Worker:", error);
    }
  }

  function scanKnownWorkers() {
    const entries = window.__PSBOT_STATE__?.workers || [];

    for (const entry of entries) {
      attachWorker(entry?.worker);
    }
  }

  function requestCheckpoints() {
    scanKnownWorkers();

    const now = Date.now();

    for (const worker of workers) {
      const meta = workerMeta.get(worker);

      if (!meta || now - meta.checkpointRequested < CFG.checkpointMs) {
        continue;
      }

      meta.checkpointRequested = now;

      try {
        worker.postMessage({ type: "checkpoint" });
      } catch (error) {
        log("Checkpoint error:", error);
      }
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
  }

  function normalize(x, y) {
    const length = Math.hypot(x, y);

    if (!length) return { x: 0, y: 0 };

    return {
      x: x / length,
      y: y / length
    };
  }

  function distance(a, b) {
    return Math.hypot(
      (a.x || 0) - (b.x || 0),
      (a.y || 0) - (b.y || 0)
    );
  }

  function choosePlayer(state) {
    return state?.players?.find(
      player => player.connected && !player.left && !player.dead
    ) || state?.players?.find(
      player => player.connected && !player.left
    ) || state?.players?.[0] || null;
  }

  function nearest(list, player) {
    let best = null;
    let bestDistance = Infinity;

    for (const item of list || []) {
      if (
        !item ||
        !Number.isFinite(item.x) ||
        !Number.isFinite(item.y)
      ) continue;

      const d = distance(item, player);

      if (d < bestDistance) {
        bestDistance = d;
        best = item;
      }
    }

    return best;
  }

  function movementFor(state, player) {
    const pickups = (state.pickups || []).filter(
      item => item &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y)
    );

    const enemies = (state.enemies || []).filter(
      enemy => enemy &&
        Number.isFinite(enemy.x) &&
        Number.isFinite(enemy.y) &&
        enemy.hp > 0
    );

    const target = nearest(pickups, player);

    let dx = 0;
    let dy = 0;

    if (target) {
      dx = target.x - player.x;
      dy = target.y - player.y;
    } else {
      const enemy = nearest(enemies, player);

      if (enemy) {
        dx = player.x - enemy.x;
        dy = player.y - enemy.y;
      } else {
        const angle = (state.tick || 0) * 0.013;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
      }
    }

    // Đẩy hướng di chuyển ra xa kẻ địch gần.
    for (const enemy of enemies) {
      const ex = player.x - enemy.x;
      const ey = player.y - enemy.y;
      const d = Math.hypot(ex, ey);

      if (d > 0 && d < CFG.enemyRepelRadius) {
        const strength =
          (CFG.enemyRepelRadius - d) / CFG.enemyRepelRadius;

        dx += ex / d * strength * CFG.enemyRepelWeight;
        dy += ey / d * strength * CFG.enemyRepelWeight;
      }
    }

    // HP thấp thì ưu tiên chạy khỏi đám đông.
    if (
      player.hp / Math.max(1, player.maxHp) < CFG.lowHpRatio &&
      enemies.length
    ) {
      let rx = 0;
      let ry = 0;

      for (const enemy of enemies) {
        const ex = player.x - enemy.x;
        const ey = player.y - enemy.y;
        const d = Math.hypot(ex, ey);

        if (d > 0 && d < 230) {
          const weight = (230 - d) / 230;
          rx += ex / d * weight * 2.2;
          ry += ey / d * weight * 2.2;
        }
      }

      dx = dx * 0.25 + rx;
      dy = dy * 0.25 + ry;
    }

    return normalize(dx, dy);
  }

  const CARD_PRIORITY = {
    "new:psybeam": 110,
    "new:swords-dance": 108,
    "new:thunder-wave": 106,
    "new:psycho-cut": 104,
    "new:rock-tomb": 100,
    "new:harden": 98,
    "new:agility": 94,
    "stat:attack": 90,
    "stat:cooldown": 88,
    "stat:defense": 84,
    "stat:experience": 82,
    "stat:speed": 76,
    "stat:heal": 72
  };

  function cardPriority(card) {
    const id = String(card?.id || "");

    if (id.startsWith("upgrade:")) return 120;

    if (CARD_PRIORITY[id] != null) {
      return CARD_PRIORITY[id];
    }

    if (id.startsWith("new:")) return 80;
    if (id.startsWith("stat:")) return 50;

    return 10;
  }

  function autoPick(state) {
    const choices = state?.pendingChoices;

    if (!Array.isArray(choices) || !choices.length) return;

    if (Date.now() - lastPickAt < 900) return;

    const choice = choices[0];

    const options =
      choice?.options ||
      choice?.cards ||
      choice?.choices ||
      [];

    if (!choice?.id || !Array.isArray(options) || !options.length) {
      return;
    }

    const card = [...options].sort(
      (a, b) => cardPriority(b) - cardPriority(a)
    )[0];

    if (!card?.id) return;

    lastPickAt = Date.now();

    activeWorker.postMessage({
      type: "intent",
      rid: Date.now(),
      intent: {
        type: "pickCard",
        choiceId: choice.id,
        cardId: card.id
      }
    });

    log("Đã chọn:", card.id);
  }

  function sendInput(moveX, moveY, aim, fire) {
    if (!activeWorker) return;

    seq = Math.max(seq + 1, Math.floor(Date.now() / 10));

    activeWorker.postMessage({
      type: "input",
      seq,
      moveX: clamp(moveX, -1, 1),
      moveY: clamp(moveY, -1, 1),
      slot: null,
      aim,
      fire: !!fire
    });
  }

  function botTick() {
    if (!running) return;

    requestCheckpoints();

    const state = latestState;

    if (!activeWorker || !state) {
      setStatus(`Đang tìm Worker… (${workers.size})`);
      return;
    }

    const player = choosePlayer(state);

    if (!player || player.dead || state.ended) {
      sendInput(0, 0, null, false);

      setStatus(
        state.ended ? "Ván đã kết thúc" : "Người chơi đã gục"
      );

      return;
    }

    autoPick(state);

    const enemies = (state.enemies || []).filter(
      enemy => enemy && enemy.hp > 0
    );

    const target = nearest(enemies, player);

    let aim = null;

    if (target) {
      const angle = Math.atan2(
        target.y - player.y,
        target.x - player.x
      );

      aim = Math.round(
        angle / (2 * Math.PI) * 256 + 256
      ) % 256;
    }

    const move = movementFor(state, player);

    sendInput(
      move.x,
      move.y,
      aim,
      enemies.length > 0
    );

    setStatus(
      `Đang chạy · Lv${state.team?.level ?? "?"} · HP ${Math.round(player.hp)}/${Math.round(player.maxHp)} · Địch ${enemies.length}`
    );
  }

  function start() {
    if (running) return;

    running = true;

    makePanel();
    setStatus("Đang tìm Worker…");

    requestCheckpoints();

    loopTimer = setInterval(botTick, CFG.tickMs);
    checkpointTimer = setInterval(
      requestCheckpoints,
      CFG.checkpointMs
    );

    botTick();
  }

  function stop() {
    running = false;

    if (loopTimer) clearInterval(loopTimer);
    if (checkpointTimer) clearInterval(checkpointTimer);

    loopTimer = null;
    checkpointTimer = null;

    if (activeWorker) {
      try {
        sendInput(0, 0, null, false);
      } catch (_) {}
    }

    setStatus("Đã dừng");
  }

  function status() {
    const player = choosePlayer(latestState);

    return {
      version: VERSION,
      running,
      workers: workers.size,
      connected: !!activeWorker,
      tick: latestState?.tick ?? null,
      time: latestState?.time ?? null,
      level: latestState?.team?.level ?? null,
      hp: player?.hp ?? null,
      maxHp: player?.maxHp ?? null
    };
  }

  window[GLOBAL] = {
    start,
    stop,
    status,
    config: CFG
  };

  makePanel();
  setStatus("Đã nạp · Bấm Bắt đầu");

  console.log("[PSBot] AutoBot v1 đã nạp.");
})();
