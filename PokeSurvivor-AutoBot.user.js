// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    psbot
// @version      0.7.0
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
        originalExports: null,

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

    function log(...args) {
        console.log(
            "%c[PSBot]",
            "color:#00e5ff;font-weight:bold",
            ...args
        );
    }

    function error(...args) {
        console.error("[PSBot]", ...args);
    }

    /*
     * Đọc UTF-8 trực tiếp từ WASM memory.
     */
    function decodeMemory(ptr, len) {
        try {
            if (!S.originalExports)
                return null;

            const memory = S.originalExports.memory;

            if (!memory)
                return null;

            if (!Number.isInteger(ptr) ||
                !Number.isInteger(len))
                return null;

            if (ptr < 0 || len < 0)
                return null;

            if (ptr + len > memory.buffer.byteLength)
                return null;

            const bytes = new Uint8Array(
                memory.buffer,
                ptr,
                len
            );

            return new TextDecoder().decode(bytes);

        } catch (e) {
            return null;
        }
    }

    /*
     * Các hàm game_* trả về độ dài chuỗi.
     * ret_ptr() cho biết vị trí chuỗi trong WASM memory.
     */
    function readReturnedString(length) {
        try {
            if (!S.originalExports)
                return null;

            const retPtr = S.originalExports.ret_ptr;

            if (typeof retPtr !== "function")
                return null;

            const ptr = retPtr();

            return decodeMemory(ptr, length);

        } catch {
            return null;
        }
    }

    function parseJSON(text) {
        if (typeof text !== "string")
            return text;

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    /*
     * Lấy danh sách player.
     */
    function inspectPlayers() {
        if (
            S.handle == null ||
            !S.originalExports?.game_player
        ) {
            return;
        }

        const found = [];

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
                    readReturnedString(len);

                if (!text)
                    continue;

                found.push({
                    index: i,
                    value: parseJSON(text)
                });

            } catch {
                break;
            }
        }

        S.players = found;

        if (found.length) {
            log("PLAYERS:", found);
        }
    }

    /*
     * Lấy counts của game.
     */
    function inspectCounts() {
        if (
            S.handle == null ||
            !S.originalExports?.game_counts
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
                readReturnedString(len);

            if (!text)
                return;

            S.counts = parseJSON(text);

            log("COUNTS:", S.counts);

        } catch (e) {
            S.error = String(e);
        }
    }

    /*
     * Tạo một EXPORT OBJECT mới.
     *
     * QUAN TRỌNG:
     * Không Proxy WebAssembly.Exports.
     */
    function createWrappedExports(originalExports) {
        const wrapped = {};

        for (const prop of Reflect.ownKeys(originalExports)) {

            const original = originalExports[prop];

            if (typeof original !== "function") {
                wrapped[prop] = original;
                continue;
            }

            /*
             * game_create
             */
            if (prop === "game_create") {

                wrapped[prop] = function (...args) {

                    const result =
                        Reflect.apply(
                            original,
                            originalExports,
                            args
                        );

                    S.createCalls++;

                    S.handle = result;
                    S.wasm = true;

                    log(
                        "GAME HANDLE:",
                        result
                    );

                    /*
                     * Đợi game JS hoàn thành phần
                     * khởi tạo rồi mới đọc player.
                     */
                    setTimeout(() => {
                        inspectCounts();
                        inspectPlayers();
                    }, 50);

                    return result;
                };

                continue;
            }

            /*
             * game_set_input
             *
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

                        const input = {
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

                        S.inputCalls.push(input);

                        if (S.inputCalls.length > 100) {
                            S.inputCalls.shift();
                        }

                        log("INPUT:", input);

                        return Reflect.apply(
                            original,
                            originalExports,
                            args
                        );
                    };

                continue;
            }

            /*
             * game_player
             */
            if (prop === "game_player") {

                wrapped[prop] =
                    function (...args) {

                        const result =
                            Reflect.apply(
                                original,
                                originalExports,
                                args
                            );

                        try {
                            const text =
                                readReturnedString(
                                    result
                                );

                            if (text) {
                                log(
                                    "game_player:",
                                    args,
                                    parseJSON(text)
                                );
                            }
                        } catch {}

                        return result;
                    };

                continue;
            }

            /*
             * game_counts
             */
            if (prop === "game_counts") {

                wrapped[prop] =
                    function (...args) {

                        const result =
                            Reflect.apply(
                                original,
                                originalExports,
                                args
                            );

                        try {
                            const text =
                                readReturnedString(
                                    result
                                );

                            if (text) {
                                S.counts =
                                    parseJSON(text);

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
             * Các export còn lại:
             * giữ nguyên chức năng.
             */
            wrapped[prop] =
                function (...args) {
                    return Reflect.apply(
                        original,
                        originalExports,
                        args
                    );
                };
        }

        return wrapped;
    }

    /*
     * Xử lý instance WASM.
     */
    function interceptResult(result, source) {

        try {

            if (!result?.instance?.exports) {
                return result;
            }

            const instance =
                result.instance;

            const originalExports =
                instance.exports;

            S.instance = instance;
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

            /*
             * Chỉ trả về object mới.
             *
             * Game loader của PokeSurvivor
             * chỉ cần result.module và
             * result.instance.exports.
             */
            return {
                module: result.module,
                instance: {
                    exports: S.exports
                }
            };

        } catch (e) {

            S.error = String(e);

            error(
                "WASM interception error:",
                e
            );

            return result;
        }
    }

    /*
     * Hook instantiate().
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

            return interceptResult(
                result,
                "instantiate"
            );
        };

    /*
     * Hook instantiateStreaming().
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

            return interceptResult(
                result,
                "streaming"
            );
        };

    log(
        "PokeSurvivor AutoBot 0.7.0 loaded"
    );

})();
