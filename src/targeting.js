// ============================================================
// PokeSurvivor AutoBot
// File: src/targeting.js
// ============================================================

import {
    STATE,
    debugLog
} from "./state.js";

import {
    CONFIG
} from "./config.js";


// ============================================================
// TARGET TYPES
// ============================================================

export const TARGET_TYPES = {
    ENEMY: "enemy",
    PICKUP: "pickup",
    POSITION: "position"
};


// ============================================================
// INTERNAL TARGET LIST
// ============================================================

const targets = new Map();


// ============================================================
// DISTANCE
// ============================================================

function getDistance(x1, y1, x2, y2) {

    return Math.hypot(
        x2 - x1,
        y2 - y1
    );
}


// ============================================================
// ADD TARGET
// ============================================================

export function addTarget(target) {

    if (!target) {
        return false;
    }

    if (
        target.id === null ||
        target.id === undefined
    ) {
        return false;
    }

    if (
        target.x === undefined ||
        target.y === undefined
    ) {
        return false;
    }

    const normalized = {

        id: target.id,

        type:
            target.type ??
            TARGET_TYPES.ENEMY,

        x: Number(target.x) || 0,
        y: Number(target.y) || 0,

        hp:
            target.hp ??
            null,

        active:
            target.active !== false,

        priority:
            Number(target.priority) || 0
    };


    targets.set(
        normalized.id,
        normalized
    );


    return true;
}


// ============================================================
// REMOVE TARGET
// ============================================================

export function removeTarget(id) {

    return targets.delete(id);
}


// ============================================================
// CLEAR TARGETS
// ============================================================

export function clearTargets() {

    targets.clear();

    STATE.target.id = null;
    STATE.target.x = null;
    STATE.target.y = null;
    STATE.target.distance = Infinity;
}


// ============================================================
// GET ALL TARGETS
// ============================================================

export function getTargets() {

    return [...targets.values()];
}


// ============================================================
// GET PLAYER POSITION
// ============================================================

function getPlayerPosition() {

    return {

        x:
            Number(STATE.position.x) || 0,

        y:
            Number(STATE.position.y) || 0
    };
}


// ============================================================
// CALCULATE TARGET DISTANCE
// ============================================================

function calculateDistance(target) {

    const player =
        getPlayerPosition();

    return getDistance(
        player.x,
        player.y,
        target.x,
        target.y
    );
}


// ============================================================
// FILTER TARGETS
// ============================================================

function getValidTargets() {

    const maxRange =
        CONFIG.movement.targetRange;


    return getTargets().filter(
        target => {

            if (!target.active) {
                return false;
            }

            const distance =
                calculateDistance(target);

            return (
                distance <= maxRange
            );
        }
    );
}


// ============================================================
// TARGET SCORE
// ============================================================

function getTargetScore(target) {

    const distance =
        calculateDistance(target);


    /*
     * Điểm càng cao càng ưu tiên.
     *
     * Ưu tiên:
     * 1. priority của mục tiêu
     * 2. mục tiêu gần
     */

    const distanceScore =
        Math.max(
            0,
            CONFIG.movement.targetRange -
            distance
        );


    return (
        target.priority * 1000 +
        distanceScore
    );
}


// ============================================================
// FIND BEST TARGET
// ============================================================

export function findBestTarget() {

    const validTargets =
        getValidTargets();


    if (
        validTargets.length === 0
    ) {

        return null;
    }


    let best = null;
    let bestScore = -Infinity;


    for (
        const target
        of validTargets
    ) {

        const score =
            getTargetScore(target);


        if (
            score > bestScore
        ) {

            bestScore = score;
            best = target;
        }
    }


    return best;
}


// ============================================================
// SELECT TARGET
// ============================================================

export function selectTarget(
    target
) {

    if (!target) {

        STATE.target.id = null;
        STATE.target.x = null;
        STATE.target.y = null;
        STATE.target.distance = Infinity;

        return false;
    }


    const player =
        getPlayerPosition();


    STATE.target.id =
        target.id;

    STATE.target.x =
        target.x;

    STATE.target.y =
        target.y;

    STATE.target.distance =
        getDistance(
            player.x,
            player.y,
            target.x,
            target.y
        );


    debugLog(
        "Target selected:",
        target
    );


    return true;
}


// ============================================================
// AUTO SELECT
// ============================================================

export function updateTarget() {

    if (!STATE.running) {
        return null;
    }

    if (STATE.paused) {
        return null;
    }

    if (STATE.dead) {
        return null;
    }


    const target =
        findBestTarget();


    selectTarget(target);


    return target;
}


// ============================================================
// GET CURRENT TARGET
// ============================================================

export function getCurrentTarget() {

    if (
        STATE.target.id === null
    ) {
        return null;
    }


    return {

        id:
            STATE.target.id,

        x:
            STATE.target.x,

        y:
            STATE.target.y,

        distance:
            STATE.target.distance
    };
}


// ============================================================
// DEBUG
// ============================================================

export function debugTargets() {

    console.table(
        getTargets()
    );

    debugLog(
        "Current target:",
        getCurrentTarget()
    );
}
