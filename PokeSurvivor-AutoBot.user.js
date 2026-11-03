
// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    PSBot
// @version      1.2.1
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    console.log("[PSBot] Userscript 1.2.1 loaded");

    const MAIN_CODE = 
(() => {
    if (window.__PSBOT_121__) return;
    window.__PSBOT_121__ = true;

    console.log("[PSBot] MAIN WORLD 1.2.1");

    const state = {
        workers: [],
        messagesOut: [],
        messagesIn: [],
        workerErrors: [],
        workerSource: null,
        seq: 0
    };

    window.__PSBOT_STATE__ = state;

    // -------------------------------------------------------
    // Worker source
    // -------------------------------------------------------

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
        .catch(e => console.warn(
            "[PSBot] worker source error",
            e
        ));

    // -------------------------------------------------------
    // Worker hook
    // -------------------------------------------------------

    const NativeWorker = window.Worker;

    function HookedWorker(url, options) {

        console.log(
            "[PSBot] NEW WORKER",
            String(url)
        );

        const worker =
            new NativeWorker(url, options);

        const index =
            state.workers.length;

        state.workers.push({
            index,
            worker,
            url: String(url),
            created: Date.now()
        });

        // Make the actual Worker accessible.
        window.__PSBOT_WORKER__ = worker;

        // ---------------------------------------------------
        // outgoing messages
        // ---------------------------------------------------

        const nativePost =
            worker.postMessage.bind(worker);

        worker.postMessage = function(data, transfer) {

            try {

                state.messagesOut.push({
                    time: Date.now(),
                    data: data
                });

                if (state.messagesOut.length > 500)
                    state.messagesOut.shift();

            } catch(e) {}

            return nativePost(data, transfer);
        };

        // ---------------------------------------------------
        // incoming messages
        // ---------------------------------------------------

        worker.addEventListener("message", e => {

            try {

                state.messagesIn.push({
                    time: Date.now(),
                    data: e.data
                });

                if (state.messagesIn.length > 500)
                    state.messagesIn.shift();

            } catch(e) {}

        });

        worker.addEventListener("error", e => {

            state.workerErrors.push({
                time: Date.now(),
                message: e.message || String(e)
            });

        });

        console.log(
            "[PSBot] WORKER SAVED",
            index
        );

        return worker;
    }

    HookedWorker.prototype =
        NativeWorker.prototype;

    Object.setPrototypeOf(
        HookedWorker,
        NativeWorker
    );

    window.Worker = HookedWorker;

    // -------------------------------------------------------
    // Direct game input
    // -------------------------------------------------------

    window.__PSBOT_INPUT__ = function(
        moveX,
        moveY,
        slot,
        aim,
        fire
    ) {

        const worker =
            window.__PSBOT_WORKER__;

        if (!worker) {
            console.warn(
                "[PSBot] Worker not found"
            );
            return false;
        }

        const msg = {
            type: "input",

            seq: ++state.seq,

            moveX: Number(moveX) || 0,
            moveY: Number(moveY) || 0,

            slot:
                slot == null
                    ? null
                    : slot,

            aim:
                aim == null
                    ? null
                    : aim,

            fire: !!fire
        };

        worker.postMessage(msg);

        console.log(
            "[PSBot] INPUT",
            msg
        );

        return msg;
    };

    // -------------------------------------------------------
    // Event bridge
    // -------------------------------------------------------

    window.addEventListener(
        "PSBOT_REQUEST",
        e => {

            const d = e.detail;

            if (!d)
                return;

            if (d.action === "dump") {

                document.dispatchEvent(
                    new CustomEvent(
                        "PSBOT_RESPONSE",
                        {
                            detail: {
                                action: "dump",
                                state: {
                                    workers:
                                        state.workers.map(w => ({
                                            index: w.index,
                                            url: w.url
                                        })),

                                    messagesOut:
                                        state.messagesOut,

                                    messagesIn:
                                        state.messagesIn,

                                    workerErrors:
                                        state.workerErrors,

                                    workerReady:
                                        !!window.__PSBOT_WORKER__,

                                    sourceSize:
                                        state.workerSource
                                            ? state.workerSource.length
                                            : 0
                                }
                            }
                        }
                    )
                );
            }

            if (d.action === "input") {

                window.__PSBOT_INPUT__(
                    d.moveX,
                    d.moveY,
                    d.slot,
                    d.aim,
                    d.fire
                );
            }
        }
    );

    console.log(
        "[PSBot] MAIN WORLD READY"
    );
})();
;

    // -------------------------------------------------------
    // Inject into MAIN world
    // -------------------------------------------------------

    function inject() {

        const s =
            document.createElement("script");

        s.textContent = MAIN_CODE;

        (
            document.documentElement ||
            document.head ||
            document.body
        ).appendChild(s);

        s.remove();

        console.log(
            "[PSBot] MAIN WORLD injected"
        );
    }

    if (document.documentElement) {
        inject();
    } else {

        const observer =
            new MutationObserver(() => {

                if (document.documentElement) {
                    observer.disconnect();
                    inject();
                }

            });

        observer.observe(
            document,
            {
                childList: true,
                subtree: true
            }
        );
    }

    // -------------------------------------------------------
    // Userscript API
    // -------------------------------------------------------

    let lastState = null;

    document.addEventListener(
        "PSBOT_RESPONSE",
        e => {

            if (
                e.detail &&
                e.detail.action === "dump"
            ) {

                lastState =
                    e.detail.state;

                console.log(
                    "[PSBot] STATE",
                    lastState
                );
            }
        }
    );

    window.PokeSurvivorBot = {

        version: "1.2.1",

        dump() {

            document.dispatchEvent(
                new CustomEvent(
                    "PSBOT_REQUEST",
                    {
                        detail: {
                            action: "dump"
                        }
                    }
                )
            );

            return lastState;
        },

        input(
            moveX = 0,
            moveY = 0,
            slot = null,
            aim = null,
            fire = false
        ) {

            document.dispatchEvent(
                new CustomEvent(
                    "PSBOT_REQUEST",
                    {
                        detail: {
                            action: "input",

                            moveX,
                            moveY,
                            slot,
                            aim,
                            fire
                        }
                    }
                )
            );
        }
    };

    console.log(
        "[PSBot] API READY"
    );

})();
