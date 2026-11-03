// ============================================================
// PokeSurvivor AutoBot
// File: src/game-discovery.js
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
    setGameHandle,
    setPlayerId
} from "./game-bridge.js";


// ============================================================
// DISCOVERY STATE
// ============================================================

const discoveryState = {

    running: false,

    timer: null,

    attempts: 0,

    lastSuccess: 0
};


// ============================================================
// OBJECT SCANNER
// ============================================================

function scanObject(
    object,
    depth = 0,
    visited = new WeakSet()
) {

    if (!object) {
        return null;
    }

    if (
        typeof object !== "object" &&
        typeof object !== "function"
    ) {
        return null;
    }

    if (depth > 3) {
        return null;
    }

    if (visited.has(object)) {
        return null;
    }

    try {
        visited.add(object);
    } catch {
        return null;
    }


    // --------------------------------------------------------
    // GAME-LIKE OBJECT
    // --------------------------------------------------------

    if (
        object.gameHandle !== undefined &&
        object.playerId !== undefined
    ) {

        return {

            gameHandle:
                object.gameHandle,

            playerId:
                object.playerId
        };
    }


    // --------------------------------------------------------
    // CONNECTION OBJECT
    // --------------------------------------------------------

    if (
        object.conn &&
        object.game
    ) {

        const result =
            scanObject(
                object.conn,
                depth + 1,
                visited
            );

        if (result) {
            return result;
        }
    }


    // --------------------------------------------------------
    // GAME OBJECT
    // --------------------------------------------------------

    if (
        object.game &&
        typeof object.game ===
        "object"
    ) {

        const result =
            scanObject(
                object.game,
                depth + 1,
                visited
            );

        if (result) {
            return result;
        }
    }


    return null;
}


// ============================================================
// WINDOW SCAN
// ============================================================

function scanWindow() {

    if (
        typeof window ===
        "undefined"
    ) {
        return null;
    }


    const keys =
        Object.keys(window);


    for (
        const key
        of keys
    ) {

        let value;

        try {

            value =
                window[key];

        } catch {

            continue;
        }


        const result =
            scanObject(
                value
            );


        if (result) {

            debugLog(
                "Game object discovered through window:",
                key
            );

            return result;
        }
    }


    return null;
}


// ============================================================
// DISCOVER
// ============================================================

export function discoverGame() {

    discoveryState.attempts++;


    if (!isWasmReady()) {
        return false;
    }


    // --------------------------------------------------------
    // Nếu đã có handle thì không cần tìm lại
    // --------------------------------------------------------

    if (
        STATE.gameHandle !== null
    ) {

        return true;
    }


    const result =
        scanWindow();


    if (!result) {
        return false;
    }


    if (
        result.gameHandle !==
        undefined
    ) {

        setGameHandle(
            result.gameHandle
        );
    }


    if (
        result.playerId !==
        undefined
    ) {

        setPlayerId(
            result.playerId
        );
    }


    if (
        STATE.gameHandle !== null
    ) {

        discoveryState.lastSuccess =
            performance.now();

        debugLog(
            "Game discovered.",
            {
                gameHandle:
                    STATE.gameHandle,

                playerId:
                    STATE.playerId
            }
        );

        return true;
    }


    return false;
}


// ============================================================
// START
// ============================================================

export function startDiscovery() {

    if (
        discoveryState.running
    ) {
        return;
    }


    discoveryState.running =
        true;


    discoveryState.timer =
        setInterval(
            () => {

                if (
                    STATE.gameHandle !==
                    null
                ) {
                    return;
                }

                discoverGame();

            },
            500
        );


    debugLog(
        "Game discovery started."
    );
}


// ============================================================
// STOP
// ============================================================

export function stopDiscovery() {

    if (
        discoveryState.timer
    ) {

        clearInterval(
            discoveryState.timer
        );

        discoveryState.timer =
            null;
    }


    discoveryState.running =
        false;


    debugLog(
        "Game discovery stopped."
    );
}


// ============================================================
// STATUS
// ============================================================

export function getDiscoveryStatus() {

    return {

        running:
            discoveryState.running,

        attempts:
            discoveryState.attempts,

        lastSuccess:
            discoveryState.lastSuccess,

        gameHandle:
            STATE.gameHandle,

        playerId:
            STATE.playerId,

        wasm:
            isWasmReady()
    };
}


// ============================================================
// DEBUG
// ============================================================

export function debugDiscovery() {

    debugLog(
        "Discovery:",
        getDiscoveryStatus()
    );
}
