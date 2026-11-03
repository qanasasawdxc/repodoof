// ============================================================
// PokeSurvivor AutoBot
// File: src/wasm-hook.js
// ============================================================

import {
    STATE,
    debugLog,
    setError
} from "./state.js";


// ============================================================
// REQUIRED EXPORTS
// ============================================================

const REQUIRED_EXPORTS = [
    "game_create",
    "game_player",
    "game_set_input",
    "game_state_field",
    "game_submit_intent"
];


// ============================================================
// INTERNAL STATE
// ============================================================

let wasmInstance = null;

let wasmExports = null;

let hookInstalled = false;


// ============================================================
// CHECK GAME WASM
// ============================================================

function isGameWasm(exports) {

    if (!exports) {
        return false;
    }


    let score = 0;


    for (
        const name
        of REQUIRED_EXPORTS
    ) {

        if (
            typeof exports[name] ===
            "function"
        ) {

            score++;
        }
    }


    // Chỉ cần có một nhóm export game đặc trưng.
    return score >= 2;
}


// ============================================================
// REGISTER
// ============================================================

function registerWasm(
    instance
) {

    if (!instance) {
        return false;
    }


    const exports =
        instance.exports;


    if (!exports) {
        return false;
    }


    if (
        !isGameWasm(exports)
    ) {

        return false;
    }


    wasmInstance =
        instance;


    wasmExports =
        exports;


    STATE.wasm.detected =
        true;


    STATE.wasm.exports =
        exports;


    STATE.wasm.gameSetInput =
        typeof exports.game_set_input ===
        "function"
            ? exports.game_set_input
            : null;


    STATE.wasm.gamePlayer =
        typeof exports.game_player ===
        "function"
            ? exports.game_player
            : null;


    STATE.wasm.gameStateField =
        typeof exports.game_state_field ===
        "function"
            ? exports.game_state_field
            : null;


    STATE.wasm.gameSubmitIntent =
        typeof exports.game_submit_intent ===
        "function"
            ? exports.game_submit_intent
            : null;


    debugLog(
        "Game WASM detected."
    );


    debugLog(
        "WASM exports:",
        Object.keys(exports)
            .filter(
                key =>
                    key.startsWith("game_")
            )
    );


    return true;
}


// ============================================================
// EXTRACT INSTANCE
// ============================================================

function inspectInstantiateResult(
    result
) {

    if (!result) {
        return result;
    }


    // Promise<Instance>
    if (
        typeof result.then ===
        "function"
    ) {

        return result.then(
            value => {

                if (
                    value &&
                    value.instance
                ) {

                    registerWasm(
                        value.instance
                    );

                } else if (
                    value &&
                    value.exports
                ) {

                    registerWasm(
                        value
                    );
                }


                return value;
            }
        );
    }


    // Result object:
    // { instance, module }

    if (
        result.instance
    ) {

        registerWasm(
            result.instance
        );

    } else if (
        result.exports
    ) {

        registerWasm(
            result
        );
    }


    return result;
}


// ============================================================
// INSTANTIATE HOOK
// ============================================================

function installInstantiateHook() {

    if (
        typeof WebAssembly ===
        "undefined"
    ) {

        return;
    }


    if (
        typeof WebAssembly.instantiate !==
        "function"
    ) {

        return;
    }


    if (
        WebAssembly
            .__PSBOT_INSTANTIATE_HOOK__
    ) {

        return;
    }


    const original =
        WebAssembly.instantiate;


    const wrapped =
        function (...args) {

            const result =
                original.apply(
                    this,
                    args
                );


            return inspectInstantiateResult(
                result
            );
        };


    try {

        Object.defineProperty(
            wrapped,
            "__PSBOT_WRAPPER__",
            {
                value: true
            }
        );


        WebAssembly.instantiate =
            wrapped;


        Object.defineProperty(
            WebAssembly,
            "__PSBOT_INSTANTIATE_HOOK__",
            {
                value: true,
                configurable: true
            }
        );


        debugLog(
            "Hooked WebAssembly.instantiate."
        );

    } catch (error) {

        setError(error);
    }
}


// ============================================================
// STREAMING HOOK
// ============================================================

function installStreamingHook() {

    if (
        typeof WebAssembly ===
        "undefined"
    ) {

        return;
    }


    if (
        typeof WebAssembly.instantiateStreaming !==
        "function"
    ) {

        return;
    }


    if (
        WebAssembly
            .__PSBOT_STREAMING_HOOK__
    ) {

        return;
    }


    const original =
        WebAssembly.instantiateStreaming;


    const wrapped =
        function (...args) {

            const result =
                original.apply(
                    this,
                    args
                );


            return inspectInstantiateResult(
                result
            );
        };


    try {

        WebAssembly.instantiateStreaming =
            wrapped;


        Object.defineProperty(
            WebAssembly,
            "__PSBOT_STREAMING_HOOK__",
            {
                value: true,
                configurable: true
            }
        );


        debugLog(
            "Hooked WebAssembly.instantiateStreaming."
        );

    } catch (error) {

        setError(error);
    }
}


// ============================================================
// INITIALIZE
// ============================================================

export function initWasmHook() {

    if (hookInstalled) {
        return;
    }


    hookInstalled =
        true;


    try {

        installInstantiateHook();

        installStreamingHook();


        debugLog(
            "WASM hooks initialized."
        );

    } catch (error) {

        setError(error);
    }
}


// ============================================================
// GET INSTANCE
// ============================================================

export function getWasmInstance() {

    return wasmInstance;
}


// ============================================================
// GET EXPORTS
// ============================================================

export function getWasm() {

    return wasmExports;
}


// ============================================================
// READY
// ============================================================

export function isWasmReady() {

    return (
        wasmExports !== null &&
        STATE.wasm.detected === true
    );
}


// ============================================================
// GET EXPORT
// ============================================================

export function getWasmExport(
    name
) {

    if (
        !wasmExports
    ) {

        return null;
    }


    const fn =
        wasmExports[name];


    return typeof fn ===
        "function"
        ? fn
        : null;
}


// ============================================================
// LIST EXPORTS
// ============================================================

export function getWasmExports() {

    if (!wasmExports) {
        return [];
    }


    return Object.keys(
        wasmExports
    );
}


// ============================================================
// DEBUG
// ============================================================

export function debugWasm() {

    console.log(
        "[PSBot] WASM status:",
        {
            ready:
                isWasmReady(),

            instance:
                wasmInstance,

            exports:
                getWasmExports()
        }
    );
}
