// ============================================================
// PokeSurvivor AutoBot
// File: src/combat.js
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
    getCurrentTarget
} from "./targeting.js";

import {
    setAim,
    stopMovement
} from "./input.js";

import {
    CONFIG
} from "./config.js";


// ============================================================
// COMBAT STATE
// ============================================================

const combatState = {

    enabled: false,

    attacking: false,

    targetId: null,

    lastAction: 0,

    actionCount: 0
};


// ============================================================
// GET TARGET
// ============================================================

function getTarget() {

    return getCurrentTarget();
}


// ============================================================
// AIM AT TARGET
// ============================================================

export function aimAtTarget() {

    const target =
        getTarget();


    if (!target) {

        setAim(0, 0);

        return false;
    }


    const playerX =
        Number(STATE.position.x) || 0;

    const playerY =
        Number(STATE.position.y) || 0;


    const dx =
        target.x - playerX;

    const dy =
        target.y - playerY;


    const length =
        Math.hypot(dx, dy);


    if (length === 0) {

        setAim(0, 0);

        return false;
    }


    setAim(
        dx / length,
        dy / length
    );


    combatState.targetId =
        target.id;


    return true;
}


// ============================================================
// SUBMIT INTENT
// ============================================================
//
// game_submit_intent signature:
//
// game_submit_intent(
//     i32,
//     i32,
//     i32,
//     i32,
//     i32
// )
//
// Chưa gọi trực tiếp vì ý nghĩa của 5 tham số
// chưa được xác định chính xác.
// ============================================================

export function submitAttackIntent() {

    if (!isWasmReady()) {
        return false;
    }


    const wasm =
        getWasm();


    if (
        typeof wasm.game_submit_intent !==
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
     * TODO:
     *
     * Xác định chính xác:
     *
     * game_submit_intent(
     *     gameHandle,
     *     playerId,
     *     intentType,
     *     value1,
     *     value2
     * )
     *
     * Không tự đoán tham số.
     */


    combatState.lastAction =
        performance.now();

    combatState.actionCount++;


    return true;
}


// ============================================================
// UPDATE COMBAT
// ============================================================

export function updateCombat() {

    if (
        !CONFIG.combat.enabled
    ) {

        stopCombat();

        return false;
    }


    if (!STATE.running) {

        stopCombat();

        return false;
    }


    if (STATE.paused) {

        stopCombat();

        return false;
    }


    if (STATE.dead) {

        stopCombat();

        return false;
    }


    const target =
        getTarget();


    if (!target) {

        stopCombat();

        return false;
    }


    combatState.enabled =
        true;

    combatState.attacking =
        true;


    aimAtTarget();


    /*
     * Attack intent sẽ được bật
     * sau khi xác định mapping WASM.
     */

    submitAttackIntent();


    return true;
}


// ============================================================
// START COMBAT
// ============================================================

export function startCombat() {

    combatState.enabled =
        true;

    debugLog(
        "Combat enabled."
    );
}


// ============================================================
// STOP COMBAT
// ============================================================

export function stopCombat() {

    combatState.enabled =
        false;

    combatState.attacking =
        false;

    combatState.targetId =
        null;

    setAim(0, 0);
}


// ============================================================
// GET COMBAT STATUS
// ============================================================

export function getCombatStatus() {

    return {

        enabled:
            combatState.enabled,

        attacking:
            combatState.attacking,

        targetId:
            combatState.targetId,

        lastAction:
            combatState.lastAction,

        actionCount:
            combatState.actionCount
    };
}


// ============================================================
// DEBUG
// ============================================================

export function debugCombat() {

    debugLog(
        "Combat:",
        getCombatStatus()
    );
}
