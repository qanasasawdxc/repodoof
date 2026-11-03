```javascript
// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    PSBot
// @version      0.9.0
// @description  WASM game lifecycle/input inspector
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const TAG = '[PSBot]';

    const state = {
        wasm: false,
        instance: null,
        originalExports: null,
        exports: null,

        handle: null,

        initCalls: [],
        simCalls: [],
        createCalls: [],
        restoreCalls: [],
        loadCalls: [],
        lifecycleCalls: [],
        inputCalls: [],

        players: [],
        counts: null,

        error: null
    };

    window.PokeSurvivorBot = {
        state
    };

    console.log(TAG, 'PokeSurvivor AutoBot 0.9.0 loaded');

    const td = new TextDecoder();

    function readString(memory, ptr, len) {
        try {
            if (!memory || !ptr || !len) return null;

            const bytes = new Uint8Array(memory.buffer, ptr, len);
            return td.decode(bytes);
        } catch {
            return null;
        }
    }

    function safeJson(text) {
        if (typeof text !== 'string') return text;

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    function logCall(name, args, result) {
        const rec = {
            time: performance.now(),
            args: Array.from(args),
            result
        };

        state.lifecycleCalls.push({
            name,
            ...rec
        });

        if (state.lifecycleCalls.length > 500) {
            state.lifecycleCalls.shift();
        }

        console.log(TAG, name, rec);

        return result;
    }

    function makeWrappedExports(original, memory) {
        const wrapped = {};

        for (const name of Object.keys(original)) {
            const fn = original[name];

            if (typeof fn !== 'function') {
                wrapped[name] = fn;
                continue;
            }

            wrapped[name] = function (...args) {
                let result;

                try {
                    result = fn(...args);
                } catch (e) {
                    console.error(TAG, name, 'ERROR', e);
                    state.error = {
                        name,
                        message: String(e)
                    };
                    throw e;
                }

                // ---- init ----
                if (name === 'init') {
                    state.initCalls.push({
                        args: [...args],
                        result
                    });

                    console.log(TAG, 'WASM init()', args);
                    console.log(TAG, 'WASM init RESULT =', result);
                }

                // ---- sim_call ----
                if (name === 'sim_call') {
                    state.simCalls.push({
                        args: [...args],
                        result,
                        time: performance.now()
                    });

                    console.log(TAG, 'sim_call:', {
                        args: [...args],
                        result,
                        time: performance.now()
                    });
                }

                // ---- game_create ----
                if (name === 'game_create') {
                    state.createCalls.push({
                        args: [...args],
                        result
                    });

                    state.handle = result;

                    console.log(
                        TAG,
                        '!!! game_create !!!',
                        'args =',
                        [...args],
                        'handle =',
                        result
                    );
                }

                // ---- game_restore ----
                if (name === 'game_restore') {
                    state.restoreCalls.push({
                        args: [...args],
                        result
                    });

                    state.handle = result;

                    console.log(
                        TAG,
                        '!!! game_restore !!!',
                        'args =',
                        [...args],
                        'handle =',
                        result
                    );
                }

                // ---- game_load ----
                if (name === 'game_load') {
                    state.loadCalls.push({
                        args: [...args],
                        result
                    });

                    console.log(
                        TAG,
                        '!!! game_load !!!',
                        'args =',
                        [...args],
                        'result =',
                        result
                    );
                }

                // ---- game_set_input ----
                if (name === 'game_set_input') {
                    const rec = {
                        args: [...args],
                        time: performance.now()
                    };

                    state.inputCalls.push(rec);

                    console.log(
                        TAG,
                        '!!! game_set_input !!!',
                        rec
                    );
                }

                // ---- common lifecycle ----
                const interesting = [
                    'game_add_viewer',
                    'game_drop_viewer',
                    'game_reset_viewer',
                    'game_reset_viewer_timeline',
                    'game_set_connected',
                    'game_set_focus',
                    'game_begin_round',
                    'game_after_tick',
                    'game_end_round',
                    'game_hold_for_resume',
                    'game_resume_in',
                    'game_remove_player',
                    'game_enable_choice_afk',
                    'game_submit_intent',
                    'game_note_steering',
                    'game_step',
                    'game_tick',
                    'game_encode',
                    'game_save',
                    'game_state_field',
                    'game_player',
                    'game_counts',
                    'game_summary',
                    'game_results'
                ];

                if (interesting.includes(name)) {
                    logCall(name, args, result);
                }

                // ---- decode common JSON-returning functions ----
                if (
                    name === 'game_player' ||
                    name === 'game_counts' ||
                    name === 'game_summary' ||
                    name === 'game_results' ||
                    name === 'game_state_field' ||
                    name === 'game_submit_intent' ||
                    name === 'game_encode'
                ) {
                    try {
                        if (typeof result === 'number') {
                            console.log(
                                TAG,
                                name,
                                'returned pointer/handle:',
                                result
                            );
                        }
                    } catch {}
                }

                return result;
            };
        }

        return wrapped;
    }

    async function handleInstance(source, instance, mode) {
        try {
            const original = instance.exports;

            state.wasm = true;
            state.instance = instance;
            state.originalExports = original;

            console.log(
                TAG,
                'GAME WASM DETECTED:',
                mode
            );

            console.log(
                TAG,
                'EXPORTS:',
                Object.keys(original)
            );

            const wrapped = makeWrappedExports(
                original,
                original.memory
            );

            state.exports = wrapped;

            /*
             * IMPORTANT:
             *
             * We cannot replace instance.exports because WebAssembly
             * exports are read-only/invariant objects.
             *
             * Instead we temporarily replace the returned instance
             * with an object whose exports point at our wrappers.
             */
            return {
                ...instance,
                exports: wrapped
            };

        } catch (e) {
            console.error(TAG, 'handleInstance failed', e);
            state.error = e;
            return instance;
        }
    }

    // ============================================================
    // WebAssembly.instantiate
    // ============================================================

    const originalInstantiate =
        WebAssembly.instantiate.bind(WebAssembly);

    WebAssembly.instantiate = async function (...args) {
        console.log(TAG, 'WebAssembly.instantiate()');

        const result =
            await originalInstantiate(...args);

        if (
            result &&
            result.instance &&
            result.instance.exports
        ) {
            const patched =
                await handleInstance(
                    args[0],
                    result.instance,
                    'normal'
                );

            return {
                module: result.module,
                instance: patched
            };
        }

        // instantiate(BufferSource) may directly return instance
        if (
            result &&
            result.exports
        ) {
            return await handleInstance(
                args[0],
                result,
                'normal-direct'
            );
        }

        return result;
    };

    // ============================================================
    // WebAssembly.instantiateStreaming
    // ============================================================

    const originalStreaming =
        WebAssembly.instantiateStreaming.bind(WebAssembly);

    WebAssembly.instantiateStreaming = async function (...args) {
        console.log(TAG, 'WebAssembly.instantiateStreaming()');

        const result =
            await originalStreaming(...args);

        if (
            result &&
            result.instance &&
            result.instance.exports
        ) {
            const patched =
                await handleInstance(
                    args[0],
                    result.instance,
                    'streaming'
                );

            return {
                module: result.module,
                instance: patched
            };
        }

        return result;
    };

    // ============================================================
    // Diagnostic helpers
    // ============================================================

    window.PokeSurvivorBot.dump = function () {
        console.group(TAG, 'STATE');

        console.log('wasm =', state.wasm);
        console.log('handle =', state.handle);

        console.log(
            'createCalls =',
            state.createCalls
        );

        console.log(
            'restoreCalls =',
            state.restoreCalls
        );

        console.log(
            'loadCalls =',
            state.loadCalls
        );

        console.log(
            'inputCalls =',
            state.inputCalls.slice(-20)
        );

        console.log(
            'lifecycleCalls =',
            state.lifecycleCalls.slice(-50)
        );

        console.groupEnd();
    };

    window.PokeSurvivorBot.resetLogs = function () {
        state.createCalls.length = 0;
        state.restoreCalls.length = 0;
        state.loadCalls.length = 0;
        state.lifecycleCalls.length = 0;
        state.inputCalls.length = 0;
        state.simCalls.length = 0;

        console.log(TAG, 'logs cleared');
    };

})();
```
