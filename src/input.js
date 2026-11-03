// ============================================================
// PokeSurvivor AutoBot
// File: src/input.js
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
// INPUT STATE
// ============================================================

const inputState = {
    x: 0,
    y: 0,

    aimX: 0,
    aimY: 0,

    active: false
};


// ============================================================
// CLAMP
// ============================================================

function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


// ============================================================
// NORMALIZE MOVEMENT
// ============================================================

export function normalizeMovement(x, y) {

    x = Number(x) || 0;
    y = Number(y) || 0;

    const length =
        Math.hypot(x, y);

    if (length === 0) {
        return {
            x: 0,
            y: 0
        };
    }

    // Không cho vector vượt quá 1
    if (length > 1) {

        x /= length;
        y /= length;
    }

    return {
        x: clamp(x, -1, 1),
        y: clamp(y, -1, 1)
    };
}


// ============================================================
// SET MOVEMENT
// ============================================================

export function setMovement(x, y) {

    const movement =
        normalizeMovement(x, y);

    inputState.x = movement.x;
    inputState.y = movement.y;

    STATE.movement.x =
        movement.x;

    STATE.movement.y =
        movement.y;

    return movement;
}


// ============================================================
// STOP MOVEMENT
// ============================================================

export function stopMovement() {

    setMovement(0, 0);

    return sendInput();
}


// ============================================================
// SET AIM
// ============================================================

export function setAim(x, y) {

    inputState.aimX =
        Number(x) || 0;

    inputState.aimY =
        Number(y) || 0;
}


// ============================================================
// SEND INPUT
// ============================================================
//
// QUAN TRỌNG:
// Chữ ký game_set_input đã biết:
//
// game_set_input(
//     i32,
//     i32,
//     i32,
//     f64,
//     f64,
//     i32,
//     f64,
//     i32,
//     f64,
//     i32
// )
//
// Nhưng ý nghĩa chính xác của từng tham số
// vẫn chưa được xác nhận hoàn toàn.
//
// Vì vậy tạm thời KHÔNG tự đoán.
// ============================================================

export function sendInput() {

    if (!isWasmReady()) {
        return false;
    }

    const wasm =
        getWasm();

    if (
        typeof wasm.game_set_input !==
        "function"
    ) {
        return false;
    }

    if (
        STATE.gameHandle === null ||
        STATE.playerId === null
    ) {
        return false;
    }


    /*
     * Chưa gọi game_set_input() ở đây.
     *
     * Khi xác định chính xác mapping:
     *
     *   gameHandle
     *   playerId
     *   moveX
     *   moveY
     *   aim
     *   walking
     *   ...
     *
     * chúng ta sẽ đặt lệnh gọi duy nhất ở đây.
     *
     * Như vậy nếu mapping thay đổi,
     * chỉ cần sửa FILE NÀY.
     */


    STATE.debug.lastInput = {
        movementX: inputState.x,
        movementY: inputState.y,
        aimX: inputState.aimX,
        aimY: inputState.aimY
    };

    return true;
}


// ============================================================
// GET CURRENT INPUT
// ============================================================

export function getInput() {

    return {
        x: inputState.x,
        y: inputState.y,

        aimX: inputState.aimX,
        aimY: inputState.aimY,

        active: inputState.active
    };
}


// ============================================================
// ENABLE INPUT
// ============================================================

export function enableInput() {

    inputState.active = true;

    debugLog(
        "Input enabled."
    );
}


// ============================================================
// DISABLE INPUT
// ============================================================

export function disableInput() {

    inputState.active = false;

    stopMovement();

    debugLog(
        "Input disabled."
    );
}


// ============================================================
// DEBUG
// ============================================================

export function debugInput() {

    debugLog(
        "Current input:",
        getInput()
    );
}
