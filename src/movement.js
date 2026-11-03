// ============================================================
// PokeSurvivor AutoBot
// File: src/movement.js
// ============================================================

import {
    STATE,
    debugLog
} from "./state.js";

import {
    setMovement,
    stopMovement,
    sendInput
} from "./input.js";

import {
    CONFIG
} from "./config.js";


// ============================================================
// MOVEMENT CONTROLLER
// ============================================================

const movementController = {

    timer: null,

    running: false,

    lastUpdate: 0
};


// ============================================================
// DISTANCE
// ============================================================

function distance(
    x1,
    y1,
    x2,
    y2
) {

    return Math.hypot(
        x2 - x1,
        y2 - y1
    );
}


// ============================================================
// DIRECTION TO TARGET
// ============================================================

function directionTo(
    fromX,
    fromY,
    targetX,
    targetY
) {

    const dx =
        targetX - fromX;

    const dy =
        targetY - fromY;

    const length =
        Math.hypot(dx, dy);

    if (length === 0) {

        return {
            x: 0,
            y: 0
        };
    }

    return {
        x: dx / length,
        y: dy / length
    };
}


// ============================================================
// GET PLAYER POSITION
// ============================================================

function getPlayerPosition() {

    return {
        x: Number(STATE.position.x) || 0,
        y: Number(STATE.position.y) || 0
    };
}


// ============================================================
// GET TARGET POSITION
// ============================================================

function getTargetPosition() {

    if (
        STATE.target.x === null ||
        STATE.target.y === null
    ) {
        return null;
    }

    return {
        x: Number(STATE.target.x),
        y: Number(STATE.target.y)
    };
}


// ============================================================
// MOVE TOWARDS TARGET
// ============================================================

export function moveTowardsTarget() {

    const player =
        getPlayerPosition();

    const target =
        getTargetPosition();


    // Không có mục tiêu
    if (!target) {

        stopMovement();

        return false;
    }


    const dist =
        distance(
            player.x,
            player.y,
            target.x,
            target.y
        );


    STATE.target.distance =
        dist;


    // Đã đủ gần mục tiêu
    if (
        dist <=
        CONFIG.movement.dangerRange
    ) {

        stopMovement();

        return false;
    }


    const direction =
        directionTo(
            player.x,
            player.y,
            target.x,
            target.y
        );


    setMovement(
        direction.x,
        direction.y
    );


    sendInput();


    return true;
}


// ============================================================
// MOVE TO POSITION
// ============================================================

export function moveTo(
    x,
    y
) {

    const player =
        getPlayerPosition();


    const direction =
        directionTo(
            player.x,
            player.y,
            x,
            y
        );


    setMovement(
        direction.x,
        direction.y
    );


    STATE.movement.targetX =
        x;

    STATE.movement.targetY =
        y;


    sendInput();


    return true;
}


// ============================================================
// STOP
// ============================================================

export function stop() {

    stopMovement();

    STATE.movement.targetX =
        null;

    STATE.movement.targetY =
        null;
}


// ============================================================
// UPDATE
// ============================================================

export function updateMovement() {

    if (
        !CONFIG.movement.enabled
    ) {
        stop();
        return;
    }


    if (!STATE.running) {
        stop();
        return;
    }


    if (STATE.paused) {
        stop();
        return;
    }


    if (STATE.dead) {
        stop();
        return;
    }


    movementController.lastUpdate =
        performance.now();


    moveTowardsTarget();
}


// ============================================================
// START
// ============================================================

export function startMovement() {

    if (
        movementController.running
    ) {
        return;
    }


    movementController.running =
        true;


    const interval =
        Math.max(
            10,
            CONFIG.movement.updateInterval
        );


    movementController.timer =
        setInterval(
            updateMovement,
            interval
        );


    debugLog(
        "Movement controller started."
    );
}


// ============================================================
// STOP CONTROLLER
// ============================================================

export function stopMovementController() {

    if (
        movementController.timer
    ) {

        clearInterval(
            movementController.timer
        );

        movementController.timer =
            null;
    }


    movementController.running =
        false;


    stop();


    debugLog(
        "Movement controller stopped."
    );
}


// ============================================================
// GET STATUS
// ============================================================

export function getMovementStatus() {

    return {

        running:
            movementController.running,

        lastUpdate:
            movementController.lastUpdate,

        player:
            getPlayerPosition(),

        target:
            getTargetPosition(),

        targetDistance:
            STATE.target.distance,

        movement: {
            x: STATE.movement.x,
            y: STATE.movement.y
        }
    };
}
