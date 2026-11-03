// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    PSBot
// @version      1.1.0
// @description  PokeSurvivor main-world Worker/WASM inspector
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const TAG = '[PSBot]';

    /*
     * ============================================================
     * MAIN-WORLD PAYLOAD
     * ============================================================
     *
     * Userscript world != page world on Safari.
     *
     * Therefore all Worker/WASM hooks must be installed inside
     * the page's own JS realm.
     */

    const payload = 
(function () {
    'use strict';

    if (window.__PSBOT_MAIN_HOOK__) {
        console.log('[PSBot] main hook already installed');
        return;
    }

    window.__PSBOT_MAIN_HOOK__ = true;

    const TAG = '[PSBot]';

    const state = {
        workers: [],
        messagesOut: [],
        messagesIn: [],
        workerErrors: [],
        workerSource: null,

        wasmInstances: [],
        wasmCalls: []
    };

    window.__PSBOT_MAIN_STATE__ = state;

    console.log(TAG, 'MAIN WORLD HOOK INSTALLED');

    // ============================================================
    // Worker hook
    // ============================================================

    const NativeWorker = window.Worker;

    function HookedWorker(...args) {
        console.log(TAG, '!!! MAIN WORLD NEW WORKER !!!', args);

        const worker = new NativeWorker(...args);

        const id = state.workers.length;

        const info = {
            id,
            url: args[0],
            options: args[1] || null,
            worker,
            createdAt: performance.now()
        };

        state.workers.push(info);

        console.log(
            TAG,
            'WORKER #' + id,
            'URL =',
            args[0]
        );

        // --------------------------------------------------------
        // Capture postMessage
        // --------------------------------------------------------

        const nativePost =
            worker.postMessage.bind(worker);

        worker.postMessage = function (...msgArgs) {
            const record = {
                worker: id,
                time: performance.now(),
                data: msgArgs[0],
                transfer:
                    msgArgs[1]?.length || 0
            };

            state.messagesOut.push(record);

            if (state.messagesOut.length > 500) {
                state.messagesOut.shift();
            }

            console.log(
                TAG,
                'WORKER #' + id,
                '→',
                record
            );

            return nativePost(...msgArgs);
        };

        // --------------------------------------------------------
        // Capture incoming messages
        // --------------------------------------------------------

        worker.addEventListener(
            'message',
            event => {
                const record = {
                    worker: id,
                    time: performance.now(),
                    data: event.data
                };

                state.messagesIn.push(record);

                if (state.messagesIn.length > 500) {
                    state.messagesIn.shift();
                }

                console.log(
                    TAG,
                    'WORKER #' + id,
                    '←',
                    record
                );
            }
        );

        worker.addEventListener(
            'error',
            event => {
                const record = {
                    worker: id,
                    time: performance.now(),
                    message: event.message,
                    filename: event.filename,
                    line: event.lineno
                };

                state.workerErrors.push(record);

                console.error(
                    TAG,
                    'WORKER ERROR',
                    record
                );
            }
        );

        return worker;
    }

    /*
     * Preserve Worker prototype.
     *
     * Some browsers inspect Worker.prototype when constructing
     * workers.
     */
    try {
        Object.setPrototypeOf(
            HookedWorker,
            NativeWorker
        );

        HookedWorker.prototype =
            NativeWorker.prototype;
    } catch (e) {
        console.warn(
            TAG,
            'could not preserve Worker prototype',
            e
        );
    }

    window.Worker = HookedWorker;

    // ============================================================
    // WASM hooks inside MAIN WORLD
    // ============================================================

    const nativeInstantiate =
        WebAssembly.instantiate;

    const nativeStreaming =
        WebAssembly.instantiateStreaming;

    async function inspectInstance(instance, mode) {
        try {
            if (!instance || !instance.exports) {
                return instance;
            }

            const names =
                Object.keys(instance.exports);

            console.log(
                TAG,
                'MAIN WORLD WASM:',
                mode,
                names
            );

            state.wasmInstances.push({
                mode,
                instance,
                exports: names,
                time: performance.now()
            });

            /*
             * Wrap selected exports.
             *
             * We do NOT replace instance.exports.
             * Instead this is diagnostic only.
             */
            const original = instance.exports;

            for (const name of [
                'game_create',
                'game_restore',
                'game_load',
                'game_set_input',
                'game_tick',
                'game_begin_round',
                'game_set_connected',
                'game_set_focus',
                'game_submit_intent'
            ]) {
                if (typeof original[name] !== 'function') {
                    continue;
                }

                console.log(
                    TAG,
                    'MAIN WASM EXPORT FOUND:',
                    name
                );
            }

        } catch (e) {
            console.error(
                TAG,
                'inspectInstance failed',
                e
            );
        }

        return instance;
    }

    WebAssembly.instantiate = async function (...args) {
        console.log(
            TAG,
            'MAIN WORLD WebAssembly.instantiate'
        );

        const result =
            await nativeInstantiate(...args);

        if (result?.instance) {
            await inspectInstance(
                result.instance,
                'instantiate'
            );
        } else if (result?.exports) {
            await inspectInstance(
                result,
                'instantiate-direct'
            );
        }

        return result;
    };

    WebAssembly.instantiateStreaming =
        async function (...args) {
            console.log(
                TAG,
                'MAIN WORLD WebAssembly.instantiateStreaming'
            );

            const result =
                await nativeStreaming(...args);

            if (result?.instance) {
                await inspectInstance(
                    result.instance,
                    'streaming'
                );
            }

            return result;
        };

    // ============================================================
    // Fetch worker source
    // ============================================================

    fetch('/assets/worker-CfUXqYFh.js')
        .then(r => r.text())
        .then(text => {
            state.workerSource = text;

            console.log(
                TAG,
                'MAIN worker source:',
                text.length,
                'bytes'
            );

            const keys = [
                'game_create',
                'game_restore',
                'game_set_input',
                'game_tick',
                'setInput',
                'postMessage',
                'onmessage',
                'sim_call'
            ];

            for (const key of keys) {
                if (text.includes(key)) {
                    console.log(
                        TAG,
                        'worker contains:',
                        key
                    );
                }
            }
        })
        .catch(e => {
            console.warn(
                TAG,
                'worker source fetch failed',
                e
            );
        });

})();
;

    /*
     * ============================================================
     * Inject into MAIN world
     * ============================================================
     */

    const script = document.createElement('script');

    script.textContent = payload;

    /*
     * CSP may block inline scripts on some sites.
     * PokeSurvivor normally allows this injection path.
     */

    (document.documentElement ||
     document.head ||
     document.body).appendChild(script);

    script.remove();

    console.log(
        TAG,
        'Userscript bridge injected'
    );

    // ============================================================
    // Userscript-side state
    // ============================================================

    window.PokeSurvivorBot = {
        state: {
            get main() {
                return window.__PSBOT_MAIN_STATE__;
            }
        },

        dump() {
            const s =
                window.__PSBOT_MAIN_STATE__;

            if (!s) {
                console.warn(
                    TAG,
                    'MAIN WORLD STATE NOT FOUND'
                );
                return;
            }

            console.group(
                TAG,
                'MAIN WORLD'
            );

            console.log(
                'workers:',
                s.workers.map(w => ({
                    id: w.id,
                    url: w.url,
                    createdAt: w.createdAt
                }))
            );

            console.log(
                'wasm:',
                s.wasmInstances
            );

            console.log(
                'OUT:',
                s.messagesOut.slice(-30)
            );

            console.log(
                'IN:',
                s.messagesIn.slice(-30)
            );

            console.log(
                'errors:',
                s.workerErrors
            );

            console.groupEnd();
        }
    };

})();
