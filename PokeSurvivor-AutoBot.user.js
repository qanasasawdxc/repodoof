// ==UserScript==
// @name         PokeSurvivor WASM Inspector
// @namespace    psbot
// @version      0.5.0
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    const S = {
        wasm: false,
        handles: [],
        createCalls: [],
        inputCalls: [],
        lastPlayers: [],
        error: null
    };

    window.PokeSurvivorBot = {
        state: S,

        status() {
            return structuredClone(S);
        },

        players() {
            return S.lastPlayers;
        }
    };

    function isGameWasm(module) {
        return true;
    }

    function wrapExports(exports) {
        return new Proxy(exports, {
            get(target, prop, receiver) {
                const original = Reflect.get(target, prop, receiver);

                if (typeof original !== "function")
                    return original;

                if (prop === "game_create") {
                    return function (...args) {
                        console.log(
                            "%c[PSBOT] game_create",
                            "color:#0f0;font-weight:bold",
                            args
                        );

                        const result = original.apply(target, args);

                        S.createCalls.push({
                            args,
                            result,
                            time: performance.now()
                        });

                        S.handles.push(result);
                        S.wasm = true;

                        console.log(
                            "%c[PSBOT] GAME HANDLE:",
                            "color:#0ff;font-weight:bold",
                            result
                        );

                        return result;
                    };
                }

                if (prop === "game_set_input") {
                    return function (...args) {
                        console.log(
                            "%c[PSBOT] game_set_input",
                            "color:#ff0;font-weight:bold",
                            args
                        );

                        S.inputCalls.push({
                            args,
                            time: performance.now()
                        });

                        return original.apply(target, args);
                    };
                }

                if (prop === "game_player") {
                    return function (...args) {
                        const result =
                            original.apply(target, args);

                        try {
                            console.log(
                                "[PSBOT] game_player",
                                args,
                                result
                            );
                        } catch {}

                        return result;
                    };
                }

                if (prop === "game_counts") {
                    return function (...args) {
                        const result =
                            original.apply(target, args);

                        console.log(
                            "[PSBOT] game_counts",
                            args,
                            result
                        );

                        return result;
                    };
                }

                if (
                    prop === "game_step" ||
                    prop === "game_tick" ||
                    prop === "game_submit_intent" ||
                    prop === "game_state_field"
                ) {
                    return function (...args) {
                        const result =
                            original.apply(target, args);

                        console.log(
                            `[PSBOT] ${String(prop)}`,
                            args,
                            result
                        );

                        return result;
                    };
                }

                return original;
            }
        });
    }

    const originalInstantiate = WebAssembly.instantiate;
    const originalStreaming = WebAssembly.instantiateStreaming;

    WebAssembly.instantiate = async function (...args) {
        const result =
            await originalInstantiate.apply(this, args);

        try {
            if (result?.instance?.exports) {
                result.instance = new Proxy(result.instance, {
                    get(target, prop, receiver) {
                        if (prop === "exports") {
                            return wrapExports(target.exports);
                        }

                        return Reflect.get(target, prop, receiver);
                    }
                });

                console.log(
                    "%c[PSBOT] WASM instance intercepted",
                    "color:#0f0;font-weight:bold"
                );
            }
        } catch (e) {
            console.error("[PSBOT] instantiate proxy error", e);
            S.error = String(e);
        }

        return result;
    };

    WebAssembly.instantiateStreaming = async function (...args) {
        const result =
            await originalStreaming.apply(this, args);

        try {
            if (result?.instance?.exports) {
                result.instance = new Proxy(result.instance, {
                    get(target, prop, receiver) {
                        if (prop === "exports") {
                            return wrapExports(target.exports);
                        }

                        return Reflect.get(target, prop, receiver);
                    }
                });

                console.log(
                    "%c[PSBOT] WASM streaming instance intercepted",
                    "color:#0f0;font-weight:bold"
                );
            }
        } catch (e) {
            console.error("[PSBOT] streaming proxy error", e);
            S.error = String(e);
        }

        return result;
    };

    console.log(
        "%c[PSBOT] Inspector 0.5.0 loaded",
        "color:#0f0;font-size:16px;font-weight:bold"
    );
})();
