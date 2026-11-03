// ============================================================
// PokeSurvivor AutoBot
// File: src/game-bridge.js
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


// ============================================================
// GAME BRIDGE
// ============================================================
//
// Module này là lớp trung gian giữa bot và game.
//
// Các module khác KHÔNG gọi WASM trực tiếp nếu không cần.
// Sau này khi tìm được API thật của game,
// chủ yếu sửa file này.
// ============================================================


const bridgeState = {

    connected: false,

    lastCheck: 0,

    lastError: null
};


// ============================================================
// CHECK WASM
// ============================================================

export function checkWasm() {

    bridgeState.lastCheck =
        performance.now();


    if (!isWasmReady()) {

        bridgeState.connected =
            false;

        return false;
    }


    const wasm =
        getWasm();


    if (!wasm) {

        bridgeState.connected =
            false;

        return false;
    }


    bridgeState.connected =
        true;


    return true;
}


// ============================================================
// GET GAME EXPORT
// ============================================================

export function getGameFunction(
    name
) {

    if (!checkWasm()) {
        return null;
    }


    const wasm =
        getWasm();


    if (
        typeof wasm[name] !==
        "function"
    ) {

        return null;
    }


    return wasm[name];
}


// ============================================================
// SET GAME HANDLE
// ============================================================

export function setGameHandle(
    handle
) {

    if (
        handle === null ||
        handle === undefined
    ) {

        STATE.gameHandle =
            null;

        return false;
    }


    STATE.gameHandle =
        Number(handle);


    debugLog(
        "Game handle:",
        STATE.gameHandle
    );


    return true;
}


// ============================================================
// SET PLAYER ID
// ============================================================

export function setPlayerId(
    playerId
) {

    if (
        playerId === null ||
        playerId === undefined
    ) {

        STATE.playerId =
            null;

        return false;
    }


    STATE.playerId =
        Number(playerId);


    debugLog(
        "Player ID:",
        STATE.playerId
    );


    return true;
}


// ============================================================
// GAME PLAYER
// ============================================================

export function gamePlayer(
    playerId = STATE.playerId
) {

    const fn =
        getGameFunction(
            "game_player"
        );


    if (!fn) {
        return null;
    }


    if (
        STATE.gameHandle === null ||
        playerId === null
    ) {

        return null;
    }


    try {

        return fn(
            STATE.gameHandle,
            playerId
        );

    } catch (error) {

        bridgeState.lastError =
            error;

        setError(error);

        return null;
    }
}


// ============================================================
// STATE FIELD
// ============================================================

export function gameStateField(
    fieldId,
    playerId = STATE.playerId
) {

    const fn =
        getGameFunction(
            "game_state_field"
        );


    if (!fn) {
        return null;
    }


    if (
        STATE.gameHandle === null ||
        playerId === null
    ) {

        return null;
    }


    if (
        fieldId === null ||
        fieldId === undefined
    ) {

        return null;
    }


    try {

        return fn(
            STATE.gameHandle,
            playerId,
            fieldId
        );

    } catch (error) {

        bridgeState.lastError =
            error;

        setError(error);

        return null;
    }
}


// ============================================================
// GAME TIME
// ============================================================

export function gameTime() {

    const fn =
        getGameFunction(
            "game_time"
        );


    if (!fn) {
        return null;
    }


    if (
        STATE.gameHandle === null
    ) {

        return null;
    }


    try {

        return fn(
            STATE.gameHandle
        );

    } catch (error) {

        bridgeState.lastError =
            error;

        setError(error);

        return null;
    }
}


// ============================================================
// GAME ENDED
// ============================================================

export function gameEnded() {

    const fn =
        getGameFunction(
            "game_ended"
        );


    if (!fn) {
        return false;
    }


    if (
        STATE.gameHandle === null
    ) {

        return false;
    }


    try {

        return Boolean(
            fn(
                STATE.gameHandle
            )
        );

    } catch (error) {

        bridgeState.lastError =
            error;

        setError(error);

        return false;
    }
}


// ============================================================
// GAME SET INPUT
// ============================================================
//
// Chưa gọi ở đây vì mapping tham số thật đã biết
// về kiểu dữ liệu nhưng chưa xác định đầy đủ ý nghĩa
// từng argument.
//
// Khi xác định xong, chỉ cần hoàn thiện hàm này.
// ============================================================

export function gameSetInput(
    ...args
) {

    const fn =
        getGameFunction(
            "game_set_input"
        );


    if (!fn) {
        return false;
    }


    try {

        fn(
            ...args
        );

        return true;

    } catch (error) {

        bridgeState.lastError =
            error;

        setError(error);

        return false;
    }
}


// ============================================================
// SUBMIT INTENT
// ============================================================

export function gameSubmitIntent(
    ...args
) {

    const fn =
        getGameFunction(
            "game_submit_intent"
        );


    if (!fn) {
        return null;
    }


    try {

        return fn(
            ...args
        );

    } catch (error) {

        bridgeState.lastError =
            error;

        setError(error);

        return null;
    }
}


// ============================================================
// GAME STATUS
// ============================================================

export function getBridgeStatus() {

    return {

        connected:
            bridgeState.connected,

        wasmReady:
            isWasmReady(),

        gameHandle:
            STATE.gameHandle,

        playerId:
            STATE.playerId,

        lastCheck:
            bridgeState.lastCheck,

        lastError:
            bridgeState.lastError
    };
}


// ============================================================
// DEBUG
// ============================================================

export function debugBridge() {

    debugLog(
        "Game bridge:",
        getBridgeStatus()
    );
}
