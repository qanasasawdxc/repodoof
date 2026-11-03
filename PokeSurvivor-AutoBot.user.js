// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    https://github.com/
// @version      0.4.0
// @description  PokeSurvivor AutoBot - WASM game creation tracer
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const STATE = {
        running: true,

        wasmDetected: false,
        wasmInstance: null,
        wasmExports: null,

        gameHandle: null,

        createCalls: 0,
        createArgs: [],
        createResults: [],

        lastError: null
    };

    function log(...args) {
        console.log("[PSBot]", ...args);
    }

    function err(e) {
        STATE.lastError =
            e instanceof Error ? e.message : String(e);

        console.error("[PSBot]", e);
    }

    function isGameWasm(exports) {
        if (!exports) return false;

        const names = [
            "game_create",
            "game_player",
            "game_set_input",
            "game_state_field",
            "game_submit_intent"
        ];

        let score = 0;

        for (const name of names) {
            if (typeof exports[name] === "function") {
                score++;
            }
        }

        return score >= 2;
    }

    function registerWasm(instance) {
        try {
            const exports = instance?.exports;

            if (!exports || !isGameWasm(exports)) {
                return false;
            }

            STATE.wasmDetected = true;
            STATE.wasmInstance = instance;
            STATE.wasmExports = exports;

            log("Game WASM detected!");

            const names =
                Object.keys(exports)
                    .filter(x => x.startsWith("game_"));

            log("Game WASM exports:", names);

            /*
             * IMPORTANT:
             *
             * Do NOT modify exports.game_create.
             *
             * WebAssembly export properties are read-only.
             */

            inspectExportDescriptor(exports);

            return true;

        } catch (e) {
            err(e);
            return false;
        }
    }

    function inspectExportDescriptor(exports) {
        try {
            const desc =
                Object.getOwnPropertyDescriptor(
                    exports,
                    "game_create"
                );

            log("game_create descriptor:", desc);

            if (desc) {
                log(
                    "game_create writable:",
                    desc.writable
                );

                log(
                    "game_create configurable:",
                    desc.configurable
                );
            }

        } catch (e) {
            err(e);
        }
    }

    let originalInstantiate;
    let originalInstantiateStreaming;

    function processResult(result) {

        if (
            result &&
            typeof result.then === "function"
        ) {
            return result.then(value => {

                try {

                    if (value?.instance) {
                        registerWasm(
                            value.instance
                        );
                    }

                } catch (e) {
                    err(e);
                }

                return value;
            });
        }

        try {

            if (result?.instance) {
                registerWasm(
                    result.instance
                );
            }

        } catch (e) {
            err(e);
        }

        return result;
    }

    function hookWasm() {

        if (
            typeof WebAssembly ===
            "undefined"
        ) {
            err(
                "WebAssembly unavailable"
            );
            return;
        }

        /*
         * instantiate()
         */

        if (
            typeof WebAssembly.instantiate ===
            "function"
        ) {

            originalInstantiate =
                WebAssembly.instantiate;

            try {

                WebAssembly.instantiate =
                    function (...args) {

                        log(
                            "WebAssembly.instantiate()"
                        );

                        const result =
                            originalInstantiate.apply(
                                this,
                                args
                            );

                        return processResult(
                            result
                        );
                    };

                log(
                    "Hooked WebAssembly.instantiate"
                );

            } catch (e) {
                err(e);
            }
        }

        /*
         * instantiateStreaming()
         */

        if (
            typeof WebAssembly
                .instantiateStreaming ===
            "function"
        ) {

            originalInstantiateStreaming =
                WebAssembly.instantiateStreaming;

            try {

                WebAssembly.instantiateStreaming =
                    function (...args) {

                        log(
                            "WebAssembly.instantiateStreaming()"
                        );

                        const result =
                            originalInstantiateStreaming
                                .apply(
                                    this,
                                    args
                                );

                        return processResult(
                            result
                        );
                    };

                log(
                    "Hooked WebAssembly.instantiateStreaming"
                );

            } catch (e) {
                err(e);
            }
        }
    }

    function createPanel() {

        const panel =
            document.createElement("div");

        panel.id =
            "psbot-debug-panel";

        panel.style.cssText = `
            position:fixed;
            top:10px;
            right:10px;
            z-index:2147483647;
            background:rgba(0,0,0,.9);
            color:white;
            padding:10px;
            border-radius:8px;
            font:12px monospace;
            line-height:1.5;
            min-width:260px;
            pointer-events:none;
            white-space:pre-wrap;
        `;

        panel.textContent =
            "PokeSurvivor AutoBot\nLoading...";

        function update() {

            panel.textContent =
`PokeSurvivor AutoBot

WASM:
${STATE.wasmDetected ? "DETECTED" : "WAITING"}

game_create calls:
${STATE.createCalls}

Game Handle:
${STATE.gameHandle ?? "not captured"}

Last error:
${STATE.lastError ?? "none"}`;
        }

        document.documentElement
            ?.appendChild(panel);

        setInterval(update, 500);
    }

    window.PokeSurvivorBot = {

        state: STATE,

        wasmReady() {
            return STATE.wasmDetected;
        },

        wasmInfo() {

            if (!STATE.wasmExports) {
                return null;
            }

            return {
                ready: true,

                exports:
                    Object.keys(
                        STATE.wasmExports
                    ),

                gameExports:
                    Object.keys(
                        STATE.wasmExports
                    ).filter(
                        x => x.startsWith("game_")
                    )
            };
        },

        status() {

            return {
                wasm:
                    STATE.wasmDetected,

                gameHandle:
                    STATE.gameHandle,

                createCalls:
                    STATE.createCalls,

                createArgs:
                    STATE.createArgs,

                createResults:
                    STATE.createResults,

                error:
                    STATE.lastError
            };
        }
    };

    log(
        "PokeSurvivor AutoBot initializing..."
    );

    hookWasm();

    if (document.documentElement) {
        createPanel();
    } else {
        window.addEventListener(
            "DOMContentLoaded",
            createPanel,
            { once: true }
        );
    }

    log(
        "PokeSurvivor AutoBot initialized."
    );

})();
