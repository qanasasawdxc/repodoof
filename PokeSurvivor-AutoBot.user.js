// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    psbot
// @version      0.6.0
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    const S = {
        wasm: false,
        instance: null,
        exports: null,
        handle: null,
        createCalls: 0,
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
                createCalls: S.createCalls,
                inputCalls: S.inputCalls.slice(-20),
                players: S.players,
                counts: S.counts,
                error: S.error
            };
        },

        players() {
            return S.players;
        }
    };

    const log = (...x) =>
        console.log("%c[PSBot]", "color:#00e5ff;font-weight:bold", ...x);

    const err = (...x) =>
        console.error("[PSBot]", ...x);

    function decodeMemory(ptr, len) {
        try {
            if (!S.exports?.memory)
                return null;

            if (!Number.isInteger(ptr) || !Number.isInteger(len))
                return null;

            if (ptr < 0 || len < 0)
                return null;

            const bytes = new Uint8Array(
                S.exports.memory.buffer,
                ptr,
                len
            );

            return new TextDecoder().decode(bytes);
        } catch (e) {
            return null;
        }
    }

    function getReturnString(length) {
        try {
            if (!S.exports?.ret_ptr)
                return null;

            const ptr = S.exports.ret_ptr();

            return decodeMemory(ptr, length);
        } catch {
            return null;
        }
    }

    function tryJSON(text) {
        if (typeof text !== "string")
            return null;

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    function inspectPlayers() {
        if (S.handle == null || !S.exports?.game_player)
            return;

        const found = [];

        // Thử một số index đầu tiên.
        for (let i = 0; i < 32; i++) {
            try {
                const len = S.exports.game_player(S.handle, i);

                if (!len)
                    continue;

                const text = getReturnString(len);

                if (!text)
                    continue;

                const value = tryJSON(text);

                found.push({
                    index: i,
                    value
                });
            } catch {
                break;
            }
        }

        S.players = found;

        if (found.length) {
            log("Players:", found);
        }
    }

    function inspectCounts() {
        if (S.handle == null || !S.exports?.game_counts)
            return;

        try {
            const len = S.exports.game_counts(S.handle);
            const text = getReturnString(len);

            if (text) {
                S.counts = tryJSON(text);
                log("Counts:", S.counts);
            }
        } catch (e) {
            S.error = String(e);
        }
    }

    function wrapExports(originalExports) {
        return new Proxy(originalExports, {
            get(target, prop, receiver) {
                const original =
                    Reflect.get(target, prop, receiver);

                if (typeof original !== "function")
                    return original;

                if (prop === "game_create") {
                    return function (...args) {
                        const result =
                            Reflect.apply(original, target, args);

                        S.createCalls++;
                        S.handle = result;
                        S.wasm = true;

                        log("game_create -> HANDLE =", result);

                        setTimeout(() => {
                            inspectCounts();
                            inspectPlayers();
                        }, 0);

                        return result;
                    };
                }

                if (prop === "game_set_input") {
                    return function (...args) {
                        /*
                         * Signature:
                         *
                         * game_set_input(
                         *   handle,
                         *   player_ptr,
                         *   player_len,
                         *   moveX,
                         *   moveY,
                         *   hasSlot,
                         *   slot,
                         *   hasAim,
                         *   aim,
                         *   fire
                         * )
                         */

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

                        S.inputCalls.push(data);

                        if (S.inputCalls.length > 100)
                            S.inputCalls.shift();

                        log("INPUT:", data);

                        return Reflect.apply(
                            original,
                            target,
                            args
                        );
                    };
                }

                if (prop === "game_player") {
                    return function (...args) {
                        const result =
                            Reflect.apply(original, target, args);

                        const text =
                            getReturnString(result);

                        if (text) {
                            log(
                                "game_player",
                                args,
                                tryJSON(text)
                            );
                        }

                        return result;
                    };
                }

                if (prop === "game_counts") {
                    return function (...args) {
                        const result =
                            Reflect.apply(original, target, args);

                        const text =
                            getReturnString(result);

                        if (text) {
                            const value = tryJSON(text);
                            S.counts = value;
                            log("game_counts:", value);
                        }

                        return result;
                    };
                }

                return function (...args) {
                    return Reflect.apply(
                        original,
                        target,
                        args
                    );
                };
            }
        });
    }

    function installResult(result, type) {
        try {
            if (!result)
                return result;

            const instance = result.instance;

            if (!instance?.exports)
                return result;

            const originalExports = instance.exports;

            const wrappedExports =
                wrapExports(originalExports);

            /*
             * df() trong game chỉ cần instance.exports.
             * Không Proxy trực tiếp WebAssembly.Instance.
             */
            const wrappedInstance = {
                exports: wrappedExports
            };

            S.instance = instance;
            S.exports = wrappedExports;
            S.wasm = true;

            log("Game WASM detected:", type);
            log(
                "Exports:",
                Object.keys(originalExports)
            );

            return {
                module: result.module,
                instance: wrappedInstance
            };
        } catch (e) {
            S.error = String(e);
            err("installResult error:", e);
            return result;
        }
    }

    const originalInstantiate =
        WebAssembly.instantiate;

    WebAssembly.instantiate = async function (...args) {
        log("WebAssembly.instantiate()");

        const result =
            await originalInstantiate.apply(this, args);

        return installResult(
            result,
            "instantiate"
        );
    };

    const originalStreaming =
        WebAssembly.instantiateStreaming;

    WebAssembly.instantiateStreaming =
        async function (...args) {
            log("WebAssembly.instantiateStreaming()");

            const result =
                await originalStreaming.apply(
                    this,
                    args
                );

            return installResult(
                result,
                "streaming"
            );
        };

    log("PokeSurvivor AutoBot 0.6.0 loaded");
})();
