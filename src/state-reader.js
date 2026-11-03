// ============================================================
// PokeSurvivor AutoBot
// File: src/state-reader.js
// ============================================================

import {
    STATE,
    debugLog
} from "./state.js";

import {
    getField,
    hasField
} from "./wasm-fields.js";

import {
    gameStateField
} from "./game-bridge.js";


// ============================================================
// READ FIELD
// ============================================================

export function readNamedField(
    name
) {

    if (!hasField(name)) {
        return null;
    }

    const fieldId =
        getField(name);

    return gameStateField(
        fieldId,
        STATE.playerId
    );
}


// ============================================================
// READ POSITION
// ============================================================

export function readPosition() {

    const x =
        readNamedField("X");

    const y =
        readNamedField("Y");


    if (
        x !== null &&
        Number.isFinite(
            Number(x)
        )
    ) {

        STATE.position.x =
            Number(x);
    }


    if (
        y !== null &&
        Number.isFinite(
            Number(y)
        )
    ) {

        STATE.position.y =
            Number(y);
    }


    return {
        x:
            STATE.position.x,

        y:
            STATE.position.y
    };
}


// ============================================================
// READ MOVEMENT
// ============================================================

export function readMovement() {

    const x =
        readNamedField(
            "MOVE_X"
        );

    const y =
        readNamedField(
            "MOVE_Y"
        );

    const angle =
        readNamedField(
            "MOVE_ANGLE"
        );


    if (x !== null) {

        STATE.movement.x =
            Number(x) || 0;
    }


    if (y !== null) {

        STATE.movement.y =
            Number(y) || 0;
    }


    if (angle !== null) {

        STATE.movement.angle =
            Number(angle) || 0;
    }


    return {
        x:
            STATE.movement.x,

        y:
            STATE.movement.y,

        angle:
            STATE.movement.angle
    };
}


// ============================================================
// READ HP
// ============================================================

export function readHealth() {

    const hp =
        readNamedField("HP");

    const maxHp =
        readNamedField("MAX_HP");


    if (hp !== null) {

        STATE.hp =
            Number(hp) || 0;
    }


    if (maxHp !== null) {

        STATE.maxHp =
            Number(maxHp) || 0;
    }


    return {
        hp:
            STATE.hp,

        maxHp:
            STATE.maxHp
    };
}


// ============================================================
// READ XP
// ============================================================

export function readExperience() {

    const xp =
        readNamedField("XP");

    const xpNext =
        readNamedField("XP_NEXT");


    if (xp !== null) {

        STATE.xp =
            Number(xp) || 0;
    }


    if (xpNext !== null) {

        STATE.xpNext =
            Number(xpNext) || 0;
    }


    return {
        xp:
            STATE.xp,

        xpNext:
            STATE.xpNext
    };
}


// ============================================================
// READ LEVEL
// ============================================================

export function readLevel() {

    const level =
        readNamedField(
            "LEVEL"
        );


    if (level !== null) {

        STATE.level =
            Number(level) || 0;
    }


    return STATE.level;
}


// ============================================================
// READ ALL PLAYER STATE
// ============================================================

export function readPlayerState() {

    if (
        STATE.playerId === null
    ) {

        return null;
    }


    const previousX =
        STATE.position.x;

    const previousY =
        STATE.position.y;


    readPosition();

    readMovement();

    readHealth();

    readExperience();

    readLevel();


    STATE.previousPosition.x =
        previousX;

    STATE.previousPosition.y =
        previousY;


    STATE.debug.lastUpdate =
        performance.now();


    return {

        level:
            STATE.level,

        xp:
            STATE.xp,

        xpNext:
            STATE.xpNext,

        hp:
            STATE.hp,

        maxHp:
            STATE.maxHp,

        position: {
            x:
                STATE.position.x,

            y:
                STATE.position.y
        },

        movement: {
            x:
                STATE.movement.x,

            y:
                STATE.movement.y,

            angle:
                STATE.movement.angle
        }
    };
}


// ============================================================
// CHECK MOVING
// ============================================================

export function isMoving() {

    const x =
        STATE.position.x;

    const y =
        STATE.position.y;

    const px =
        STATE.previousPosition.x;

    const py =
        STATE.previousPosition.y;


    return (
        Math.abs(x - px) > 0.01 ||
        Math.abs(y - py) > 0.01
    );
}


// ============================================================
// CHECK DEAD
// ============================================================

export function isPlayerDead() {

    if (
        STATE.maxHp > 0 &&
        STATE.hp <= 0
    ) {

        return true;
    }


    return false;
}


// ============================================================
// UPDATE
// ============================================================

export function updateStateReader() {

    if (
        STATE.gameHandle === null
    ) {

        return null;
    }


    if (
        STATE.playerId === null
    ) {

        return null;
    }


    const state =
        readPlayerState();


    if (
        state &&
        isPlayerDead()
    ) {

        STATE.dead = true;
    }


    return state;
}


// ============================================================
// DEBUG
// ============================================================

export function debugStateReader() {

    const state =
        readPlayerState();


    debugLog(
        "Player state:",
        state
    );
}
