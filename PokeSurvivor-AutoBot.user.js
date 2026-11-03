// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    PSBot
// @version      1.0.0
// @description  PokeSurvivor worker/WASM inspector
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const TAG = '[PSBot]';

    const state = {
        workers: [],
        messagesOut: [],
        messagesIn: [],
        workerErrors: [],
        workerSource: null
    };

    window.PokeSurvivorBot = {
        state
    };

    console.log(TAG, 'PokeSurvivor AutoBot 1.0.0 loaded');

    function safeString(value) {
        try {
            if (typeof value === 'string') {
                return value;
            }

            if (value instanceof ArrayBuffer) {
                return `[ArrayBuffer ${value.byteLength}]`;
            }

            if (ArrayBuffer.isView(value)) {
                return `[${value.constructor.name} ${value.byteLength}]`;
            }

            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    // ============================================================
    // Worker
    // ============================================================

    const OriginalWorker = window.Worker;

    window.Worker = function (...args) {
        console.log(TAG, '!!! NEW WORKER !!!', args);

        let worker;

        try {
            worker = new OriginalWorker(...args);
        } catch (e) {
            console.error(TAG, 'Worker creation failed', e);
            throw e;
        }

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
        // postMessage OUT
        // --------------------------------------------------------

        const originalPostMessage =
            worker.postMessage.bind(worker);

        worker.postMessage = function (...messageArgs) {
            const record = {
                worker: id,
                time: performance.now(),
                data: messageArgs[0],
                transferCount:
                    messageArgs[1]?.length || 0
            };

            state.messagesOut.push(record);

            if (state.messagesOut.length > 300) {
                state.messagesOut.shift();
            }

            console.log(
                TAG,
                'WORKER #' + id,
                '→ postMessage',
                record
            );

            return originalPostMessage(...messageArgs);
        };

        // --------------------------------------------------------
        // message IN
        // --------------------------------------------------------

        worker.addEventListener(
            'message',
            function (event) {
                const record = {
                    worker: id,
                    time: performance.now(),
                    data: event.data
                };

                state.messagesIn.push(record);

                if (state.messagesIn.length > 300) {
                    state.messagesIn.shift();
                }

                console.log(
                    TAG,
                    'WORKER #' + id,
                    '← message',
                    record
                );
            }
        );

        worker.addEventListener(
            'error',
            function (event) {
                const record = {
                    worker: id,
                    time: performance.now(),
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno
                };

                state.workerErrors.push(record);

                console.error(
                    TAG,
                    'WORKER #' + id,
                    'ERROR',
                    record
                );
            }
        );

        return worker;
    };

    // Preserve Worker prototype/static properties
    try {
        Object.setPrototypeOf(
            window.Worker,
            OriginalWorker
        );

        window.Worker.prototype =
            OriginalWorker.prototype;
    } catch {}

    // ============================================================
    // Fetch worker source
    // ============================================================

    fetch('/assets/worker-CfUXqYFh.js')
        .then(r => r.text())
        .then(text => {
            state.workerSource = text;

            console.log(
                TAG,
                'worker-CfUXqYFh.js captured:',
                text.length,
                'bytes'
            );

            // Show useful keywords
            const keywords = [
                'WebAssembly',
                'instantiate',
                'game_create',
                'game_restore',
                'game_set_input',
                'game_tick',
                'postMessage',
                'onmessage',
                'setInput',
                'sim_call'
            ];

            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    console.log(
                        TAG,
                        'worker contains:',
                        keyword
                    );
                }
            }
        })
        .catch(e => {
            console.warn(
                TAG,
                'Could not fetch worker source:',
                e
            );
        });

    // ============================================================
    // Helpers
    // ============================================================

    window.PokeSurvivorBot.dumpWorkers = function () {
        console.group(TAG, 'WORKERS');

        console.log(
            'workers:',
            state.workers.map(w => ({
                id: w.id,
                url: w.url,
                createdAt: w.createdAt
            }))
        );

        console.log(
            'messages OUT:',
            state.messagesOut.slice(-30)
        );

        console.log(
            'messages IN:',
            state.messagesIn.slice(-30)
        );

        console.log(
            'errors:',
            state.workerErrors
        );

        console.groupEnd();
    };

    window.PokeSurvivorBot.clearLogs = function () {
        state.messagesOut.length = 0;
        state.messagesIn.length = 0;
        state.workerErrors.length = 0;

        console.log(TAG, 'worker logs cleared');
    };

})();
