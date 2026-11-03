// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    https://github.com/
// @version      0.2.0
// @description  PokeSurvivor AutoBot - Safari single file
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // =========================================================
    // CONFIG
    // =========================================================

    const CONFIG = {
        enabled: true,
        debug: true,
        panel: true,

        discoveryInterval: 500,
        statusInterval: 500
    };

    // =========================================================
    // STATE
    // =========================================================

    const STATE = {
        running: false,
        paused: false,

        wasmDetected: false,
        wasmInstance: null,
        wasmExports: null,

        gameHandle: null,
        playerId: null,

        level: 0,
        hp: 0,
        maxHp: 0,
        xp: 0,
        xpNext: 0,

        x: 0,
        y: 0,

        lastError: null,
        lastUpdate: 0
    };

    // =========================================================
    // DEBUG
    // =========================================================

    function log(...args) {
        if (CONFIG.debug) {
            console.log("[PSBot]", ...args);
        }
    }

    function error(err) {
        STATE.lastError =
            err instanceof Error
                ? err.message
                : String(err);

        console.error("[PSBot]", err);
    }

    // =========================================================
    // WASM HOOK
    // =========================================================

    let originalInstantiate = null;
    let originalInstantiateStreaming = null;

    function isGameWasm(exports) {
        if (!exports) return false;

        const required = [
            "game_create",
            "game_player",
            "game_set_input",
            "game_state_field",
            "game_submit_intent"
        ];

        let score = 0;

        for (const name of required) {
            if (typeof exports[name] === "function") {
                score++;
            }
        }

        return score >= 2;
    }

    function registerWasm(instance) {
        if (!instance) return false;

        const exports =
            instance.exports || instance;

        if (!exports) return false;

        if (!isGameWasm(exports)) {
            return false;
        }

        STATE.wasmDetected = true;
        STATE.wasmInstance = instance;
        STATE.wasmExports = exports;

        log("Game WASM detected!");

        const gameExports =
            Object.keys(exports)
                .filter(x => x.startsWith("game_"));

        console.log(
            "[PSBot] Game WASM exports:",
            gameExports
        );

        return true;
    }

    function inspectInstantiateResult(result) {

        if (!result) {
            return result;
        }

        if (
            result &&
            typeof result.then === "function"
        ) {
            return result.then(value => {

                try {

                    if (value?.instance) {
                        registerWasm(value.instance);
                    }
                    else if (value?.exports) {
                        registerWasm(value);
                    }

                } catch (e) {
                    error(e);
                }

                return value;
            });
        }

        try {

            if (result.instance) {
                registerWasm(result.instance);
            }
            else if (result.exports) {
                registerWasm(result);
            }

        } catch (e) {
            error(e);
        }

        return result;
    }

    function installWasmHooks() {

        if (
            typeof WebAssembly === "undefined"
        ) {
            error("WebAssembly unavailable.");
            return;
        }

        // -----------------------------------------------------
        // instantiate
        // -----------------------------------------------------

        if (
            typeof WebAssembly.instantiate === "function" &&
            !WebAssembly.__PSBOT_HOOKED__
        ) {

            originalInstantiate =
                WebAssembly.instantiate;

            const wrappedInstantiate =
                function (...args) {

                    const result =
                        originalInstantiate.apply(
                            this,
                            args
                        );

                    return inspectInstantiateResult(
                        result
                    );
                };

            try {

                WebAssembly.instantiate =
                    wrappedInstantiate;

                Object.defineProperty(
                    WebAssembly,
                    "__PSBOT_HOOKED__",
                    {
                        value: true,
                        configurable: true
                    }
                );

                log(
                    "Hooked WebAssembly.instantiate"
                );

            } catch (e) {
                error(e);
            }
        }

        // -----------------------------------------------------
        // instantiateStreaming
        // -----------------------------------------------------

        if (
            typeof WebAssembly.instantiateStreaming === "function" &&
            !WebAssembly.__PSBOT_STREAMING_HOOKED__
        ) {

            originalInstantiateStreaming =
                WebAssembly.instantiateStreaming;

            const wrappedStreaming =
                function (...args) {

                    const result =
                        originalInstantiateStreaming.apply(
                            this,
                            args
                        );

                    return inspectInstantiateResult(
                        result
                    );
                };

            try {

                WebAssembly.instantiateStreaming =
                    wrappedStreaming;

                Object.defineProperty(
                    WebAssembly,
                    "__PSBOT_STREAMING_HOOKED__",
                    {
                        value: true,
                        configurable: true
                    }
                );

                log(
                    "Hooked WebAssembly.instantiateStreaming"
                );

            } catch (e) {
                error(e);
            }
        }
    }

    // =========================================================
    // WASM HELPERS
    // =========================================================

    function getWasm() {
        return STATE.wasmExports;
    }

    function wasmReady() {
        return (
            STATE.wasmDetected &&
            STATE.wasmExports !== null
        );
    }

    function wasmFunction(name) {

        const wasm = getWasm();

        if (!wasm) {
            return null;
        }

        if (
            typeof wasm[name] !== "function"
        ) {
            return null;
        }

        return wasm[name];
    }

    // =========================================================
    // GAME DISCOVERY
    // =========================================================

    function discoverGame() {

        if (!wasmReady()) {
            return false;
        }

        /*
         * We intentionally do NOT guess gameHandle/playerId.
         *
         * The game object may live inside module closures,
         * therefore blindly scanning window is unreliable.
         */

        return false;
    }

    // =========================================================
    // SAFE WASM INSPECTION
    // =========================================================

    function inspectWasm() {

        if (!wasmReady()) {
            return null;
        }

        const wasm = getWasm();

        const exports =
            Object.keys(wasm);

        const gameExports =
            exports.filter(
                x => x.startsWith("game_")
            );

        return {
            ready: true,
            totalExports: exports.length,
            gameExports
        };
    }

    // =========================================================
    // DEBUG PANEL
    // =========================================================

    let panel = null;

    function createPanel() {

        if (!CONFIG.panel) return;

        if (panel) return;

        panel =
            document.createElement("div");

        panel.id =
            "psbot-debug-panel";

        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 2147483647;
            background: rgba(0,0,0,.85);
            color: #fff;
            padding: 10px;
            border-radius: 8px;
            font: 12px monospace;
            line-height: 1.5;
            min-width: 240px;
            max-width: 360px;
            pointer-events: none;
            white-space: pre-wrap;
        `;

        panel.textContent =
            "PokeSurvivor AutoBot\nStarting...";

        document.documentElement.appendChild(
            panel
        );
    }

    function updatePanel() {

        if (!panel) return;

        const info =
            inspectWasm();

        panel.textContent =
`PokeSurvivor AutoBot

Bot: ${STATE.running ? "ON" : "OFF"}
Paused: ${STATE.paused ? "YES" : "NO"}

WASM: ${
    STATE.wasmDetected
        ? "DETECTED"
        : "WAITING"
}

Game Handle:
${STATE.gameHandle ?? "not found"}

Player:
${STATE.playerId ?? "not found"}

Level:
${STATE.level}

HP:
${STATE.hp}/${STATE.maxHp}

XP:
${STATE.xp}/${STATE.xpNext}

Position:
${STATE.x.toFixed(2)}, ${STATE.y.toFixed(2)}

${
    STATE.lastError
        ? "Error: " + STATE.lastError
        : ""
}`;
    }

    // =========================================================
    // BOT
    // =========================================================

    function startBot() {

        STATE.running = true;
        STATE.paused = false;

        log("Bot started.");
    }

    function stopBot() {

        STATE.running = false;
        STATE.paused = true;

        log("Bot stopped.");
    }

    function pauseBot() {

        STATE.paused = true;

        log("Bot paused.");
    }

    function resumeBot() {

        if (!STATE.running) {
            return;
        }

        STATE.paused = false;

        log("Bot resumed.");
    }

    // =========================================================
    // MAIN LOOP
    // =========================================================

    let statusTimer = null;

    function mainLoop() {

        if (!STATE.running) {
            return;
        }

        if (STATE.paused) {
            return;
        }

        try {

            discoverGame();

            STATE.lastUpdate =
                performance.now();

        } catch (e) {
            error(e);
        }
    }

    function startLoop() {

        if (statusTimer) {
            return;
        }

        statusTimer =
            setInterval(
                () => {

                    mainLoop();
                    updatePanel();

                },
                CONFIG.statusInterval
            );
    }

    // =========================================================
    // PUBLIC API
    // =========================================================

    window.PokeSurvivorBot = {

        start: startBot,
        stop: stopBot,
        pause: pauseBot,
        resume: resumeBot,

        state: STATE,
        config: CONFIG,

        wasmReady() {
            return wasmReady();
        },

        wasmInfo() {
            return inspectWasm();
        },

        exports() {

            if (!wasmReady()) {
                return [];
            }

            return Object.keys(
                STATE.wasmExports
            );
        },

        status() {

            return {

                running: STATE.running,
                paused: STATE.paused,

                wasm: STATE.wasmDetected,

                gameHandle:
                    STATE.gameHandle,

                playerId:
                    STATE.playerId,

                level:
                    STATE.level,

                hp:
                    STATE.hp,

                maxHp:
                    STATE.maxHp,

                xp:
                    STATE.xp,

                xpNext:
                    STATE.xpNext,

                position: {
                    x: STATE.x,
                    y: STATE.y
                },

                error:
                    STATE.lastError
            };
        }
    };

    // =========================================================
    // INITIALIZE
    // =========================================================

    function initialize() {

        log(
            "PokeSurvivor AutoBot initializing..."
        );

        installWasmHooks();

        STATE.running =
            Boolean(CONFIG.enabled);

        createPanel();
        startLoop();

        log(
            "PokeSurvivor AutoBot initialized."
        );
    }

    // =========================================================
    // START
    // =========================================================

    initialize();

})();
