// ============================================================
// PokeSurvivor AutoBot
// File: src/game-state.js
// ============================================================

import {
    STATE,
    debugLog,
    setError
} from "./state.js";

import {
    getWasm,
    isWasmReady
} from "./wasm-hook.js";

import {
    getField,
    hasField
} from "./wasm-fields.js";


// ============================================================
// GAME STATE
// ============================================================

export function getGameState() {

    if (!isWasmReady()) {
        return null;
    }

    const wasm = getWasm();

    if (!wasm) {
        return null;
    }

    return {
        wasm,
        playerId: STATE.playerId,
        gameHandle: STATE.gameHandle
    };
}


// ============================================================
// PLAYER
// ============================================================

export function getPlayer(playerId = STATE.playerId) {

    if (!isWasmReady()) {
        return null;
    }

    const wasm = getWasm();

    if (
        typeof wasm.game_player !== "function"
    ) {
        return null;
    }

    if (
        STATE.gameHandle === null ||
        playerId === null
    ) {
        return null;
    }

    try {

        return wasm.game_player(
            STATE.gameHandle,
            playerId
        );

    } catch (error) {

        setError(error);

        return null;
    }
}


// ============================================================
// STATE FIELD
// ============================================================
//
// LƯU Ý:
// Field ID chính xác sẽ được xác định sau khi
// phân tích JS/WASM wrapper của game.
//
// Không hard-code field ID ở đây.
// ============================================================

export function readField(
    fieldId,
    playerId = STATE.playerId
) {

    if (!isWasmReady()) {
        return null;
    }

    const wasm = getWasm();

    if (
        typeof wasm.game_state_field !== "function"
    ) {
        return null;
    }

    if (
        STATE.gameHandle === null ||
        playerId === null
    ) {
        return null;
    }

    try {

        return wasm.game_state_field(
            STATE.gameHandle,
            playerId,
            fieldId
        );

    } catch (error) {

        setError(error);

        return null;
    }
}
// ============================================================
// READ NAMED FIELD
// ============================================================

export function readNamedField(
    name,
    playerId = STATE.playerId
) {

    const fieldId = getField(name);

    if (fieldId === null) {
        return null;
    }

    return readField(
        fieldId,
        playerId
    );
}


// ============================================================
// GAME TIME
// ============================================================

export function getGameTime() {

    if (!isWasmReady()) {
        return null;
    }

    const wasm = getWasm();

    if (
        typeof wasm.game_time !== "function"
    ) {
        return null;
    }

    if (STATE.gameHandle === null) {
        return null;
    }

    try {

        return wasm.game_time(
            STATE.gameHandle
        );

    } catch (error) {

        setError(error);

        return null;
    }
}


// ============================================================
// GAME ENDED
// ============================================================

export function isGameEnded() {

    if (!isWasmReady()) {
        return false;
    }

    const wasm = getWasm();

    if (
        typeof wasm.game_ended !== "function"
    ) {
        return false;
    }

    if (STATE.gameHandle === null) {
        return false;
    }

    try {

        return Boolean(
            wasm.game_ended(
                STATE.gameHandle
            )
        );

    } catch (error) {

        setError(error);

        return false;
    }
}


// ============================================================
// REFRESH PLAYER STATE
// ============================================================

export function refreshPlayerState() {

    if (!STATE.playerId) {
        return false;
    }

    /*
     * Chưa đọc HP / XP / position ở đây.
     *
     * Lý do:
     * game_state_field() cần đúng field ID.
     *
     * Chúng ta sẽ lấy các ID này từ wrapper của game
     * thay vì đoán.
     */

    STATE.debug.lastUpdate =
        performance.now();

    return true;
}


// ============================================================
// DEBUG
// ============================================================

export function debugGameState() {

    debugLog(
        "Game state:",
        {
            wasmReady: isWasmReady(),
            gameHandle: STATE.gameHandle,
            playerId: STATE.playerId,
            gameTime: getGameTime(),
            ended: isGameEnded()
        }
    );
}
