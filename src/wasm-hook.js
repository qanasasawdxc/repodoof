// ============================================================
// PokeSurvivor AutoBot
// File: src/wasm-hook.js
// ============================================================

import { STATE, debugLog, setError } from "./state.js";


// ============================================================
// CONFIG
// ============================================================

const REQUIRED_EXPORTS = [
    "game_set_input",
    "game_player",
    "game_state_field",
    "game_submit_intent"
];


// ============================================================
// CHECK WASM EXPORTS
// ============================================================

function isGameWasm(exports) {

    if (!exports) return false;

    return REQUIRED_EXPORTS.some(
        name => typeof exports[name] === "function"
    );
}


// ============================================================
// SAVE WASM EXPORTS
// ============================================================

function registerWasm(exports) {

    if (!isGameWasm(exports)) {
        return exports;
    }

    // Không đăng ký lại cùng một WASM
    if (STATE.wasm.exports === exports) {
        return exports;
    }

    STATE.wasm.detected = true;
    STATE.wasm.exports = exports;

    // Các hàm game
    STATE.wasm.gameSetInput =
        typeof exports.game_set_input === "function"
            ? exports.game_set_input
            : null;

    STATE.wasm.gamePlayer =
        typeof exports.game_player === "function"
            ? exports.game_player
            : null;

    STATE.wasm.gameStateField =
        typeof exports.game_state_field === "function"
            ? exports.game_state_field
            : null;

    STATE.wasm.gameSubmitIntent =
        typeof exports.game_submit_intent === "function"
            ? exports.game_submit_intent
            : null;


    debugLog(
        "WASM detected:",
        Object.keys(exports).filter(
            key => key.startsWith("game_")
        )
    );


    return exports;
}


// ============================================================
// HOOK WebAssembly.instantiate
// ============================================================

function installInstantiateHook() {

    if (
        typeof WebAssembly === "undefined" ||
        typeof WebAssembly.instantiate !== "function"
    ) {
        setError("WebAssembly.instantiate không tồn tại.");
        return;
    }


    // Không hook 2 lần
    if (WebAssembly.__PSBOT_HOOKED__) {
        return;
    }

    WebAssembly.__PSBOT_HOOKED__ = true;


    const originalInstantiate =
        WebAssembly.instantiate;


    WebAssembly.instantiate = function (...args) {

        const result =
            originalInstantiate.apply(
                this,
                args
            );


        // Promise
        if (
            result &&
            typeof result.then === "function"
        ) {

            return result.then(instance => {

                if (
                    instance &&
                    instance.instance &&
                    instance.instance.exports
                ) {
                    registerWasm(
                        instance.instance.exports
                    );
                }

                return instance;
            });
        }


        // Synchronous result
        if (
            result &&
            result.instance &&
            result.instance.exports
        ) {
            registerWasm(
                result.instance.exports
            );
        }


        return result;
    };


    debugLog(
        "WebAssembly.instantiate hook installed."
    );
}


// ============================================================
// HOOK WebAssembly.instantiateStreaming
// ============================================================

function installStreamingHook() {

    if (
        typeof WebAssembly === "undefined" ||
        typeof WebAssembly.instantiateStreaming !== "function"
    ) {
        return;
    }


    if (
        WebAssembly
            .instantiateStreaming
            .__PSBOT_WRAPPED__
    ) {
        return;
    }


    const originalStreaming =
        WebAssembly.instantiateStreaming;


    function wrappedStreaming(...args) {

        return originalStreaming
            .apply(this, args)
            .then(instance => {

                if (
                    instance &&
                    instance.instance &&
                    instance.instance.exports
                ) {

                    registerWasm(
                        instance.instance.exports
                    );
                }

                return instance;
            });
    }


    wrappedStreaming.__PSBOT_WRAPPED__ = true;


    WebAssembly.instantiateStreaming =
        wrappedStreaming;


    debugLog(
        "WebAssembly.instantiateStreaming hook installed."
    );
}


// ============================================================
// PUBLIC INIT
// ============================================================

export function initWasmHook() {

    try {

        installInstantiateHook();

        installStreamingHook();

        debugLog(
            "WASM hook initialized."
        );

    } catch (error) {

        setError(error);
    }
}


// ============================================================
// GET WASM EXPORTS
// ============================================================

export function getWasm() {

    return STATE.wasm.exports;
}


// ============================================================
// CHECK STATUS
// ============================================================

export function isWasmReady() {

    return (
        STATE.wasm.detected &&
        STATE.wasm.exports !== null
    );
}
