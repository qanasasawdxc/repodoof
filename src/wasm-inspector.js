// ============================================================
// PokeSurvivor AutoBot
// File: src/wasm-inspector.js
// ============================================================

import {
    STATE,
    debugLog
} from "./state.js";

import {
    getWasm,
    isWasmReady
} from "./wasm-hook.js";

import {
    gameStateField,
    gamePlayer
} from "./game-bridge.js";


// ============================================================
// INSPECTOR STATE
// ============================================================

const inspectorState = {

    lastScan: 0,

    results: [],

    scanning: false
};


// ============================================================
// BASIC WASM INFO
// ============================================================

export function getWasmInfo() {

    if (!isWasmReady()) {

        return {
            ready: false,
            exports: []
        };
    }


    const wasm =
        getWasm();


    if (!wasm) {

        return {
            ready: false,
            exports: []
        };
    }


    return {

        ready: true,

        exports:
            Object.keys(wasm)
    };
}


// ============================================================
// TEST FIELD
// ============================================================

export function testField(
    fieldId
) {

    if (
        STATE.gameHandle === null ||
        STATE.playerId === null
    ) {

        return {
            fieldId,
            value: null,
            error: "game/player chưa có"
        };
    }


    try {

        const value =
            gameStateField(
                fieldId,
                STATE.playerId
            );


        return {

            fieldId,

            value,

            valid:
                value !== null &&
                value !== undefined
        };

    } catch (error) {

        return {

            fieldId,

            value: null,

            valid: false,

            error:
                String(error)
        };
    }
}


// ============================================================
// SCAN FIELD RANGE
// ============================================================
//
// Không mặc định đây là field ID thật.
// Chỉ dùng để quan sát các giá trị mà WASM trả về.
//
// ============================================================

export function scanFields(
    start = 0,
    end = 128
) {

    if (
        inspectorState.scanning
    ) {

        return inspectorState.results;
    }


    inspectorState.scanning =
        true;


    const results = [];


    try {

        for (
            let id = start;
            id <= end;
            id++
        ) {

            const result =
                testField(id);


            results.push(
                result
            );
        }


    } finally {

        inspectorState.scanning =
            false;
    }


    inspectorState.results =
        results;

    inspectorState.lastScan =
        performance.now();


    return results;
}


// ============================================================
// PRINT FIELD SCAN
// ============================================================

export function printFieldScan(
    start = 0,
    end = 128
) {

    const results =
        scanFields(
            start,
            end
        );


    console.table(
        results
    );


    return results;
}


// ============================================================
// GET PLAYER RAW VALUE
// ============================================================

export function inspectPlayer() {

    if (
        STATE.gameHandle === null ||
        STATE.playerId === null
    ) {

        return null;
    }


    const value =
        gamePlayer(
            STATE.playerId
        );


    debugLog(
        "Raw game_player result:",
        value
    );


    return value;
}


// ============================================================
// FIND NUMERIC FIELDS
// ============================================================

export function findNumericFields(
    start = 0,
    end = 128
) {

    const results =
        scanFields(
            start,
            end
        );


    return results.filter(
        result => {

            return (
                result.valid &&
                typeof result.value ===
                "number" &&
                Number.isFinite(
                    result.value
                )
            );
        }
    );
}


// ============================================================
// DEBUG SUMMARY
// ============================================================

export function debugInspector() {

    const info =
        getWasmInfo();


    console.log(
        "[PSBot] WASM inspector",
        info
    );


    console.table(
        inspectorState.results
    );


    return {

        wasm:
            info,

        lastScan:
            inspectorState.lastScan,

        results:
            inspectorState.results
    };
}
