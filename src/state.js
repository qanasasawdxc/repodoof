// ============================================================
// PokeSurvivor AutoBot
// File: src/state.js
// ============================================================

export const STATE = {

    // --------------------------------------------------------
    // BOT STATUS
    // --------------------------------------------------------

    running: false,
    paused: false,
    dead: false,


    // --------------------------------------------------------
    // GAME STATUS
    // --------------------------------------------------------

    game: null,
    gameHandle: null,

    playerId: null,

    level: 0,
    xp: 0,
    xpNext: 0,

    hp: 0,
    maxHp: 0,


    // --------------------------------------------------------
    // PLAYER POSITION
    // --------------------------------------------------------

    position: {
        x: 0,
        y: 0
    },

    previousPosition: {
        x: 0,
        y: 0
    },


    // --------------------------------------------------------
    // MOVEMENT
    // --------------------------------------------------------

    movement: {
        x: 0,
        y: 0,

        angle: 0,

        targetX: null,
        targetY: null
    },


    // --------------------------------------------------------
    // TARGET
    // --------------------------------------------------------

    target: {
        id: null,

        x: null,
        y: null,

        distance: Infinity
    },


    // --------------------------------------------------------
    // STATISTICS
    // --------------------------------------------------------

    stats: {
        kills: 0,
        pickups: 0,

        levels: 0,

        games: 0,
        deaths: 0
    },


    // --------------------------------------------------------
    // WASM
    // --------------------------------------------------------

    wasm: {
        detected: false,

        exports: null,

        gameSetInput: null,
        gamePlayer: null,
        gameStateField: null,
        gameSubmitIntent: null
    },


    // --------------------------------------------------------
    // DEBUG
    // --------------------------------------------------------

    debug: {
        lastError: null,

        lastInput: null,

        lastEvent: null,

        lastUpdate: 0
    }

};


// ============================================================
// RESET GAME STATE
// ============================================================

export function resetGameState() {

    STATE.dead = false;

    STATE.game = null;
    STATE.gameHandle = null;

    STATE.playerId = null;

    STATE.level = 0;
    STATE.xp = 0;
    STATE.xpNext = 0;

    STATE.hp = 0;
    STATE.maxHp = 0;


    STATE.position.x = 0;
    STATE.position.y = 0;

    STATE.previousPosition.x = 0;
    STATE.previousPosition.y = 0;


    STATE.movement.x = 0;
    STATE.movement.y = 0;

    STATE.movement.angle = 0;

    STATE.movement.targetX = null;
    STATE.movement.targetY = null;


    STATE.target.id = null;
    STATE.target.x = null;
    STATE.target.y = null;
    STATE.target.distance = Infinity;
}


// ============================================================
// RESET BOT
// ============================================================

export function resetBotState() {

    resetGameState();

    STATE.running = false;
    STATE.paused = false;
}


// ============================================================
// SET ERROR
// ============================================================

export function setError(error) {

    STATE.debug.lastError =
        error instanceof Error
            ? error.message
            : String(error);

    console.error(
        "[PSBot]",
        STATE.debug.lastError
    );
}


// ============================================================
// DEBUG LOG
// ============================================================

export function debugLog(...args) {

    if (!STATE.debug) return;

    console.log(
        "[PSBot]",
        ...args
    );
}
