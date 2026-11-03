
// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    PSBot
// @version      1.2.0
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(() => {
    "use strict";

    const W = typeof unsafeWindow !== "undefined"
        ? unsafeWindow
        : window;

    const VERSION = "1.2.0";

    // =========================================================
    // MAIN WORLD CODE
    // =========================================================

    const MAIN = 
(() => {
    if (window.__PSBOT_MAIN_120__) return;
    window.__PSBOT_MAIN_120__ = true;

    console.log("[PSBot] MAIN 1.2.0 installed");

    const state = {
        workers: [],
        messagesOut: [],
        messagesIn: [],
        workerErrors: [],
        wasmInstances: [],
        wasmCalls: [],
        workerSource: null,
        seq: 0
    };

    window.__PSBOT_STATE__ = state;

    // ---------------------------------------------------------
    // Find Worker source
    // ---------------------------------------------------------

    fetch("/assets/worker-CfUXqYFh.js")
        .then(r => r.text())
        .then(src => {
            state.workerSource = src;

            console.log(
                "[PSBot] worker source:",
                src.length,
                "bytes"
            );
        })
        .catch(e => {
            console.warn("[PSBot] worker source error", e);
        });

    // ---------------------------------------------------------
    // Worker hook
    // ---------------------------------------------------------

    const NativeWorker = window.Worker;

    class PSBotWorker extends NativeWorker {

        constructor(url, options) {

            console.log("[PSBot] NEW WORKER:", String(url));

            super(url, options);

            const index = state.workers.length;

            state.workers.push({
                index,
                worker: this,
                url: String(url),
                created: performance.now()
            });

            window.__PSBOT_WORKER__ = this;
            window.__PSBOT_WORKER_INDEX__ = index;

            console.log(
                "[PSBot] WORKER SAVED #",
                index,
                this
            );

            // -------------------------------------------------
            // Capture outgoing messages
            // -------------------------------------------------

            const nativePostMessage =
                this.postMessage.bind(this);

            this.postMessage = function(data, transfer) {

                try {
                    state.messagesOut.push({
                        time: performance.now(),
                        data: structuredClone
                            ? structuredClone(data)
                            : data
                    });

                    if (state.messagesOut.length > 500)
                        state.messagesOut.shift();

                    if (data && data.type === "input") {
                        console.log(
                            "[PSBot] GAME INPUT",
                            data
                        );
                    }

                } catch (e) {}

                return nativePostMessage(data, transfer);
            };

            // -------------------------------------------------
            // Incoming messages
            // -------------------------------------------------

            this.addEventListener("message", e => {

                try {

                    const data = e.data;

                    state.messagesIn.push({
                        time: performance.now(),
                        data: structuredClone
                            ? structuredClone(data)
                            : data
                    });

                    if (state.messagesIn.length > 500)
                        state.messagesIn.shift();

                    if (data && data.type) {
                        console.log(
                            "[PSBot] GAME MESSAGE",
                            data.type,
                            data
                        );
                    }

                } catch (err) {}
            });

            this.addEventListener("error", e => {
                state.workerErrors.push({
                    time: performance.now(),
                    message: e.message || String(e)
                });

                console.error("[PSBot] WORKER ERROR", e);
            });
        }
    }

    window.Worker = PSBotWorker;

    // ---------------------------------------------------------
    // Direct input API
    // ---------------------------------------------------------

    window.__PSBOT_INPUT__ = function(
        moveX = 0,
        moveY = 0,
        slot = null,
        aim = null,
        fire = false
    ) {

        const worker = window.__PSBOT_WORKER__;

        if (!worker) {
            console.warn("[PSBot] No game worker");
            return false;
        }

        const msg = {
            type: "input",
            seq: ++state.seq,
            moveX: Number(moveX) || 0,
            moveY: Number(moveY) || 0,
            slot: slot == null ? null : slot,
            aim: aim == null ? null : aim,
            fire: !!fire
        };

        worker.postMessage(msg);

        return msg;
    };

    // ---------------------------------------------------------
    // Stop movement
    // ---------------------------------------------------------

    window.__PSBOT_STOP__ = function() {

        return window.__PSBOT_INPUT__(
            0,
            0,
            null,
            null,
            false
        );
    };

    // ---------------------------------------------------------
    // Hold direction continuously
    // ---------------------------------------------------------

    let movementTimer = null;

    window.__PSBOT_MOVE__ = function(
        moveX,
        moveY
    ) {

        if (movementTimer)
            clearInterval(movementTimer);

        const send = () => {

            window.__PSBOT_INPUT__(
                moveX,
                moveY,
                null,
                null,
                false
            );
        };

        send();

        movementTimer = setInterval(
            send,
            30
        );

        return true;
    };

    window.__PSBOT_STOP_MOVE__ = function() {

        if (movementTimer) {
            clearInterval(movementTimer);
            movementTimer = null;
        }

        return window.__PSBOT_STOP__();
    };

    // ---------------------------------------------------------
    // Debug
    // ---------------------------------------------------------

    window.__PSBOT_DUMP__ = function() {

        console.log(
            "[PSBot] workers:",
            state.workers
        );

        console.log(
            "[PSBot] OUT:",
            state.messagesOut
        );

        console.log(
            "[PSBot] IN:",
            state.messagesIn
        );

        console.log(
            "[PSBot] WASM:",
            state.wasmInstances
        );

        console.log(
            "[PSBot] errors:",
            state.workerErrors
        );

        return state;
    };

    console.log("[PSBot] MAIN WORLD READY");
})();
;

    // =========================================================
    // Inject MAIN WORLD
    // =========================================================

    function inject() {

        const script = document.createElement("script");

        script.textContent = MAIN;

        (
            document.documentElement ||
            document.head ||
            document.body
        ).appendChild(script);

        script.remove();

        console.log(
            "[PSBot] Userscript bridge injected"
        );
    }

    // document-start may happen before <html>
    if (document.documentElement) {
        inject();
    } else {
        new MutationObserver(() => {

            if (document.documentElement) {
                inject();
                return;
            }

        }).observe(document, {
            childList: true,
            subtree: true
        });
    }

    // =========================================================
    // Userscript API
    // =========================================================

    W.PokeSurvivorBot = {

        version: VERSION,

        state: {

            get main() {
                return W.__PSBOT_STATE__;
            }

        },

        dump() {

            const s = W.__PSBOT_STATE__;

            if (!s) {
                console.warn(
                    "[PSBot] MAIN state not ready"
                );
                return;
            }

            console.log(
                "[PSBot] MAIN WORLD"
            );

            console.log(
                "workers:",
                s.workers
            );

            console.log(
                "wasm:",
                s.wasmInstances
            );

            console.log(
                "OUT:",
                s.messagesOut
            );

            console.log(
                "IN:",
                s.messagesIn
            );

            console.log(
                "errors:",
                s.workerErrors
            );

            return s;
        },

        input(
            moveX = 0,
            moveY = 0,
            slot = null,
            aim = null,
            fire = false
        ) {

            if (!W.__PSBOT_INPUT__) {
                console.warn(
                    "[PSBot] input API not ready"
                );
                return;
            }

            return W.__PSBOT_INPUT__(
                moveX,
                moveY,
                slot,
                aim,
                fire
            );
        },

        move(moveX, moveY) {

            if (!W.__PSBOT_MOVE__) {
                console.warn(
                    "[PSBot] move API not ready"
                );
                return;
            }

            return W.__PSBOT_MOVE__(
                moveX,
                moveY
            );
        },

        stop() {

            if (W.__PSBOT_STOP_MOVE__)
                return W.__PSBOT_STOP_MOVE__();

        }
    };

    console.log(
        "[PSBot] PokeSurvivor AutoBot",
        VERSION,
        "loaded"
    );

})();
