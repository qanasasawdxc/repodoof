// ============================================================
// PokeSurvivor AutoBot
// File: src/pickup.js
// ============================================================

import {
    STATE,
    debugLog
} from "./state.js";

import {
    addTarget,
    removeTarget,
    TARGET_TYPES
} from "./targeting.js";

import {
    CONFIG
} from "./config.js";


// ============================================================
// PICKUP STATE
// ============================================================

const pickupState = {

    enabled: false,

    currentPickup: null,

    collected: 0,

    lastPickup: 0
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
// ADD PICKUP
// ============================================================

export function addPickup(pickup) {

    if (!pickup) {
        return false;
    }

    if (
        pickup.id === null ||
        pickup.id === undefined
    ) {
        return false;
    }


    return addTarget({

        id: `pickup:${pickup.id}`,

        type:
            TARGET_TYPES.PICKUP,

        x:
            Number(pickup.x) || 0,

        y:
            Number(pickup.y) || 0,

        priority:
            pickup.priority ??
            2,

        active:
            pickup.active !== false
    });
}


// ============================================================
// REMOVE PICKUP
// ============================================================

export function removePickup(id) {

    return removeTarget(
        `pickup:${id}`
    );
}


// ============================================================
// FIND NEAREST PICKUP
// ============================================================

export function findNearestPickup(
    pickups = []
) {

    if (
        !Array.isArray(pickups) ||
        pickups.length === 0
    ) {
        return null;
    }


    const playerX =
        Number(STATE.position.x) || 0;

    const playerY =
        Number(STATE.position.y) || 0;


    let nearest = null;
    let nearestDistance = Infinity;


    for (
        const pickup
        of pickups
    ) {

        if (!pickup) {
            continue;
        }


        const x =
            Number(pickup.x) || 0;

        const y =
            Number(pickup.y) || 0;


        const dist =
            distance(
                playerX,
                playerY,
                x,
                y
            );


        if (
            dist <
            nearestDistance
        ) {

            nearest =
                pickup;

            nearestDistance =
                dist;
        }
    }


    return nearest;
}


// ============================================================
// PICKUP IN RANGE
// ============================================================

export function getPickupsInRange(
    pickups = []
) {

    const range =
        CONFIG.pickup.radius;


    const playerX =
        Number(STATE.position.x) || 0;

    const playerY =
        Number(STATE.position.y) || 0;


    return pickups.filter(
        pickup => {

            if (!pickup) {
                return false;
            }


            const x =
                Number(pickup.x) || 0;

            const y =
                Number(pickup.y) || 0;


            return (
                distance(
                    playerX,
                    playerY,
                    x,
                    y
                ) <= range
            );
        }
    );
}


// ============================================================
// SELECT PICKUP
// ============================================================

export function selectPickup(
    pickup
) {

    if (!pickup) {

        pickupState.currentPickup =
            null;

        return false;
    }


    pickupState.currentPickup =
        pickup;


    debugLog(
        "Pickup selected:",
        pickup
    );


    return true;
}


// ============================================================
// CLEAR PICKUP
// ============================================================

export function clearPickup() {

    pickupState.currentPickup =
        null;
}


// ============================================================
// REGISTER COLLECTED
// ============================================================

export function registerCollected(
    pickup = null
) {

    pickupState.collected++;

    pickupState.lastPickup =
        performance.now();


    STATE.stats.pickups++;


    if (pickup?.id !== undefined) {

        removePickup(
            pickup.id
        );
    }
}


// ============================================================
// UPDATE PICKUP
// ============================================================

export function updatePickup(
    pickups = []
) {

    if (
        !CONFIG.pickup.enabled
    ) {

        clearPickup();

        return null;
    }


    if (!STATE.running) {

        clearPickup();

        return null;
    }


    if (
        STATE.paused ||
        STATE.dead
    ) {

        clearPickup();

        return null;
    }


    const nearby =
        getPickupsInRange(
            pickups
        );


    const nearest =
        findNearestPickup(
            nearby
        );


    selectPickup(
        nearest
    );


    return nearest;
}


// ============================================================
// START
// ============================================================

export function startPickup() {

    pickupState.enabled =
        true;

    debugLog(
        "Pickup system enabled."
    );
}


// ============================================================
// STOP
// ============================================================

export function stopPickup() {

    pickupState.enabled =
        false;

    clearPickup();
}


// ============================================================
// STATUS
// ============================================================

export function getPickupStatus() {

    return {

        enabled:
            pickupState.enabled,

        current:
            pickupState.currentPickup,

        collected:
            pickupState.collected,

        lastPickup:
            pickupState.lastPickup
    };
}


// ============================================================
// DEBUG
// ============================================================

export function debugPickup() {

    debugLog(
        "Pickup:",
        getPickupStatus()
    );
}
