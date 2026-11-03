// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    psbot
// @version      0.8.0
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    const S = {
        wasm: false,
        instance: null,
        originalExports: null,
        exports: null,

        handle: null,

        initCalls: [],
        simCalls: [],
        createCalls: [],
        inputCalls: [],

        players: [],
        counts: null,

        error: null
    };

    window.PokeSurvivorBot = {
        state: S,

        status() {
            return {
                wasm: S.wasm,
                handle: S.handle,
                initCalls: S.initCalls.slice(-10),
                simCalls: S.simCalls.slice(-10),
                createCalls: S.createCalls.slice(-10),
                inputCalls: S.inputCalls.slice(-20),
                players: S.players,
                counts: S.counts,
                error: S.error
            };
        }
    };

    const log = (...args) => {
        console.log(
            "%c[PSBot]",
            "color:#00e5ff;font-weight:bold",
            ...args
        );
    };

    const warn = (...args) => {
        console.warn("[PSBot]", ...args);
    };

    const fail = (...args) => {
        console.error("[PSBot]", ...args);
    };

    /*
     * ---------------------------------------------------------
     * WASM MEMORY
     * ---------------------------------------------------------
     */

    function decodeMemory(ptr, len) {
        try {
            const memory =
                S.originalExports?.memory;

            if (!memory)
                return null;

            if (!Number.isInteger(ptr) ||
                !Number.isInteger(len))
                return null;

            if (ptr < 0 || len < 0)
                return null;

            if (ptr + len > memory.buffer.byteLength)
                return null;

            return new TextDecoder().decode(
                new Uint8Array(
                    memory.buffer,
                    ptr,
                    len
                )
            );

        } catch {
            return null;
        }
    }

    function readReturnString(len) {
        try {
            const retPtr =
                S.originalExports?.ret_ptr;

            if (typeof retPtr !== "function")
                return null;

            const ptr = retPtr();

            return decodeMemory(ptr, len);

        } catch {
            return null;
        }
    }

    function parseValue(text) {
        if (typeof text !== "string")
            return text;

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    /*
     * ---------------------------------------------------------
     * PLAYER / COUNTS
     * ---------------------------------------------------------
     */

    function inspectPlayers() {
        if (
            S.handle == null ||
            typeof S.originalExports?.game_player !==
                "function"
        ) {
            return;
        }

        const result = [];

        for (let i = 0; i < 32; i++) {
            try {
                const len =
                    S.originalExports.game_player(
                        S.handle,
                        i
                    );

                if (!len)
                    continue;

                const text =
                    readReturnString(len);

                if (!text)
                    continue;

                result.push({
                    index: i,
                    value: parseValue(text)
                });

            } catch {
                break;
            }
        }

        S.players = result;

        if (result.length) {
            log("PLAYERS =", result);
        }
    }

    function inspectCounts() {
        if (
            S.handle == null ||
            typeof S.originalExports?.game_counts !==
                "function"
        ) {
            return;
        }

        try {
            const len =
                S.originalExports.game_counts(
                    S.handle
                );

            if (!len)
                return;

            const text =
                readReturnString(len);

            if (!text)
                return;

            S.counts =
                parseValue(text);

            log("COUNTS =", S.counts);

        } catch (e) {
            S.error = String(e);
        }
    }

    function inspectGame() {
        if (S.handle == null)
            return;

        inspectCounts();
        inspectPlayers();
    }

    /*
     * ---------------------------------------------------------
     * WRAP EXPORTS
     * ---------------------------------------------------------
     *
     * Không Proxy WebAssembly.Exports.
     * Tạo object mới để tránh lỗi read-only/non-configurable.
     */

    function createWrappedExports(original) {
        const wrapped = {};

        for (const prop of Reflect.ownKeys(original)) {

            const fn = original[prop];

            /*
             * Memory / globals / constants
             */
            if (typeof fn !== "function") {
                wrapped[prop] = fn;
                continue;
            }

            /*
             * -------------------------------------------------
             * init
             * -------------------------------------------------
             */

            if (prop === "init") {
                wrapped[prop] =
                    function (...args) {

                        log(
                            "WASM init()",
                            args
                        );

                        const start =
                            performance.now();

                        let result;

                        try {
                            result =
                                Reflect.apply(
                                    fn,
                                    original,
                                    args
                                );

                            const record = {
                                args,
                                result,
                                time:
                                    performance.now()
                                    - start
                            };

                            S.initCalls.push(
                                record
                            );

                            log(
                                "WASM init RESULT =",
                                result
                            );

                        } catch (e) {
                            S.error = String(e);
                            fail(
                                "init error:",
                                e
                            );
                            throw e;
                        }

                        return result;
                    };

                continue;
            }

            /*
             * -------------------------------------------------
             * sim_call
             * -------------------------------------------------
             */

            if (prop === "sim_call") {
                wrapped[prop] =
                    function (...args) {

                        const start =
                            performance.now();

                        let result;

                        try {

                            result =
                                Reflect.apply(
                                    fn,
                                    original,
                                    args
                                );

                            const record = {
                                args,
                                result,
                                time:
                                    performance.now()
                                    - start
                            };

                            S.simCalls.push(
                                record
                            );

                            if (
                                S.simCalls.length >
                                50
                            ) {
                                S.simCalls.shift();
                            }

                            log(
                                "sim_call:",
                                record
                            );

                        } catch (e) {
                            S.error = String(e);

                            fail(
                                "sim_call error:",
                                e
                            );

                            throw e;
                        }

                        return result;
                    };

                continue;
            }

            /*
             * -------------------------------------------------
             * game_create
             * -------------------------------------------------
             */

            if (prop === "game_create") {
                wrapped[prop] =
                    function (...args) {

                        log(
                            "game_create ARGS =",
                            args
                        );

                        let result;

                        try {
                            result =
                                Reflect.apply(
                                    fn,
                                    original,
                                    args
                                );

                        } catch (e) {
                            S.error = String(e);
                            fail(
                                "game_create error:",
                                e
                            );
                            throw e;
                        }

                        const record = {
                            args,
                            result,
                            time: performance.now()
                        };

                        S.createCalls.push(
                            record
                        );

                        S.handle = result;
                        S.wasm = true;

                        log(
                            "GAME HANDLE =",
                            result
                        );

                        setTimeout(
                            inspectGame,
                            50
                        );

                        setTimeout(
                            inspectGame,
                            500
                        );

                        return result;
                    };

                continue;
            }

            /*
             * -------------------------------------------------
             * game_set_input
             * -------------------------------------------------
             */

            if (prop === "game_set_input") {
                wrapped[prop] =
                    function (...args) {

                        const [
                            handle,
                            playerPtr,
                            playerLen,
                            moveX,
                            moveY,
                            hasSlot,
                            slot,
                            hasAim,
                            aim,
                            fire
                        ] = args;

                        const player =
                            decodeMemory(
                                playerPtr,
                                playerLen
                            );

                        const data = {
                            handle,
                            player,
                            moveX,
                            moveY,
                            hasSlot,
                            slot,
                            hasAim,
                            aim,
                            fire,
                            time: performance.now()
                        };

                        S.inputCalls.push(
                            data
                        );

                        if (
                            S.inputCalls.length >
                            100
                        ) {
                            S.inputCalls.shift();
                        }

                        log(
                            "INPUT =",
                            data
                        );

                        return Reflect.apply(
                            fn,
                            original,
                            args
                        );
                    };

                continue;
            }

            /*
             * -------------------------------------------------
             * game_player
             * -------------------------------------------------
             */

            if (prop === "game_player") {
                wrapped[prop] =
                    function (...args) {

                        const result =
                            Reflect.apply(
                                fn,
                                original,
                                args
                            );

                        try {
                            const text =
                                readReturnString(
                                    result
                                );

                            if (text) {
                                log(
                                    "game_player:",
                                    args,
                                    parseValue(text)
                                );
                            }
                        } catch {}

                        return result;
                    };

                continue;
            }

            /*
             * -------------------------------------------------
             * game_counts
             * -------------------------------------------------
             */

            if (prop === "game_counts") {
                wrapped[prop] =
                    function (...args) {

                        const result =
                            Reflect.apply(
                                fn,
                                original,
                                args
                            );

                        try {
                            const text =
                                readReturnString(
                                    result
                                );

                            if (text) {
                                S.counts =
                                    parseValue(text);

                                log(
                                    "game_counts:",
                                    S.counts
                                );
                            }
                        } catch {}

                        return result;
                    };

                continue;
            }

            /*
             * Các hàm khác giữ nguyên.
             */
            wrapped[prop] =
                function (...args) {
                    return Reflect.apply(
                        fn,
                        original,
                        args
                    );
                };
        }

        return wrapped;
    }

    /*
     * ---------------------------------------------------------
     * INTERCEPT WASM
     * ---------------------------------------------------------
     */

    function intercept(result, source) {

        try {

            if (
                !result ||
                !result.instance ||
                !result.instance.exports
            ) {
                return result;
            }

            const instance =
                result.instance;

            const originalExports =
                instance.exports;

            S.instance =
                instance;

            S.originalExports =
                originalExports;

            S.exports =
                createWrappedExports(
                    originalExports
                );

            S.wasm = true;

            log(
                "GAME WASM DETECTED:",
                source
            );

            log(
                "EXPORTS:",
                Object.keys(originalExports)
            );

            return {
                module: result.module,

                instance: {
                    exports: S.exports
                }
            };

        } catch (e) {

            S.error = String(e);

            fail(
                "WASM interception error:",
                e
            );

            return result;
        }
    }

    /*
     * ---------------------------------------------------------
     * WebAssembly.instantiate
     * ---------------------------------------------------------
     */

    const nativeInstantiate =
        WebAssembly.instantiate;

    WebAssembly.instantiate =
        async function (...args) {

            log(
                "WebAssembly.instantiate()"
            );

            const result =
                await nativeInstantiate.apply(
                    this,
                    args
                );

            return intercept(
                result,
                "instantiate"
            );
        };

    /*
     * ---------------------------------------------------------
     * WebAssembly.instantiateStreaming
     * ---------------------------------------------------------
     */

    const nativeStreaming =
        WebAssembly.instantiateStreaming;

    WebAssembly.instantiateStreaming =
        async function (...args) {

            log(
                "WebAssembly.instantiateStreaming()"
            );

            const result =
                await nativeStreaming.apply(
                    this,
                    args
                );

            return intercept(
                result,
                "streaming"
            );
        };

    log(
        "PokeSurvivor AutoBot 0.8.0 loaded"
    );

})();
