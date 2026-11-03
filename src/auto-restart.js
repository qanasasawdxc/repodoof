// ============================================================
// PokeSurvivor AutoBot
// File: src/auto-restart.js
// ============================================================

import {
    STATE,
    debugLog,
    setError
} from "./state.js";

import {
    CONFIG
} from "./config.js";

import {
    isGameEnded
} from "./game-state.js";


// ============================================================
// RESTART STATE
// ============================================================

const restartState = {

    enabled: false,

    restarting: false,

    timer: null,

    lastRestart: 0,

    restartCount: 0
};


// ============================================================
// CHECK GAME END
// ============================================================

export function checkGameEnded() {

    if (!STATE.gameHandle) {
        return false;
    }

    try {

        return isGameEnded();

    } catch (error) {

        setError(error);

        return false;
    }
}


// ============================================================
// MARK DEAD
// ============================================================

export function markDead() {

    STATE.dead = true;

    STATE.stats.deaths++;

    debugLog(
        "Player marked as dead."
    );
}


// ============================================================
// RESET RESTART TIMER
// ============================================================

function clearRestartTimer() {

    if (
        restartState.timer !== null
    ) {

        clearTimeout(
            restartState.timer
        );

        restartState.timer =
            null;
    }
}


// ============================================================
// FIND RESTART FUNCTION
// ============================================================

function findRestartFunction() {

    /*
     * Không gọi API game chưa xác định.
     *
     * Trước mắt tìm những hàm mà UI/game
     * có thể expose trên window.
     */

    const candidates = [

        window.startGame,

        window.restartGame,

        window.startRun,

        window.newGame

    ];

    for (
        const fn
        of candidates
    ) {

        if (
            typeof fn === "function"
        ) {

            return fn;
        }
    }

    return null;
}


// ============================================================
// RESTART GAME
// ============================================================

export function restartGame() {

    if (
        !CONFIG.restart.enabled
    ) {

        return false;
    }

    if (
        restartState.restarting
    ) {

        return false;
    }


    restartState.restarting =
        true;


    clearRestartTimer();


    const delay =
        Math.max(
            0,
            Number(
                CONFIG.restart.delay
            ) || 0
        );


    restartState.timer =
        setTimeout(
            () => {

                try {

                    const restart =
                        findRestartFunction();


                    if (
                        restart
                    ) {

                        restart();

                        restartState.restartCount++;

                        restartState.lastRestart =
                            performance.now();

                        STATE.stats.games++;

                        STATE.dead =
                            false;

                        restartState.restarting =
                            false;

                        debugLog(
                            "Game restarted."
                        );

                        return;
                    }


                    /*
                     * Chưa tìm thấy API start/restart
                     * thật của game.
                     *
                     * Không tự gọi API giả.
                     */

                    debugLog(
                        "Restart API not found."
                    );


                    restartState.restarting =
                        false;

                } catch (error) {

                    restartState.restarting =
                        false;

                    setError(error);
                }

            },
            delay
        );


    return true;
}


// ============================================================
// UPDATE
// ============================================================

export function updateAutoRestart() {

    if (
        !restartState.enabled
    ) {

        return false;
    }


    if (
        !CONFIG.restart.enabled
    ) {

        return false;
    }


    if (
        STATE.dead
    ) {

        return restartGame();
    }


    if (
        checkGameEnded()
    ) {

        STATE.dead = true;

        return restartGame();
    }


    return false;
}


// ============================================================
// START
// ============================================================

export function startAutoRestart() {

    restartState.enabled =
        true;

    restartState.restarting =
        false;

    debugLog(
        "Auto-restart enabled."
    );
}


// ============================================================
// STOP
// ============================================================

export function stopAutoRestart() {

    restartState.enabled =
        false;

    restartState.restarting =
        false;

    clearRestartTimer();
}


// ============================================================
// STATUS
// ============================================================

export function getRestartStatus() {

    return {

        enabled:
            restartState.enabled,

        restarting:
            restartState.restarting,

        lastRestart:
            restartState.lastRestart,

        restartCount:
            restartState.restartCount,

        dead:
            STATE.dead
    };
}


// ============================================================
// DEBUG
// ============================================================

export function debugRestart() {

    debugLog(
        "Auto-restart:",
        getRestartStatus()
    );
}
