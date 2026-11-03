// ============================================================
// PokeSurvivor AutoBot
// File: src/level-up.js
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
    CONFIG
} from "./config.js";


// ============================================================
// LEVEL-UP STATE
// ============================================================

const levelUpState = {

    active: false,

    options: [],

    selected: null,

    lastLevel: 0,

    selections: 0,

    lastSelection: 0
};


// ============================================================
// PRIORITY TABLE
// ============================================================
//
// Có thể sửa bảng này sau.
// Ví dụ:
//
//   "weapon"  → ưu tiên vũ khí
//   "passive" → ưu tiên passive
//
// Chưa gắn với ID thật của game.
// ============================================================

const PRIORITY = {

    weapon: 100,

    evolution: 200,

    passive: 50,

    utility: 10,

    unknown: 0
};


// ============================================================
// GET PRIORITY
// ============================================================

function getPriority(option) {

    if (!option) {
        return 0;
    }


    const type =
        String(
            option.type ??
            "unknown"
        ).toLowerCase();


    return (
        Number(
            option.priority
        ) ||
        PRIORITY[type] ||
        PRIORITY.unknown
    );
}


// ============================================================
// SORT OPTIONS
// ============================================================

export function sortOptions(
    options = []
) {

    return [...options].sort(
        (a, b) => {

            return (
                getPriority(b) -
                getPriority(a)
            );
        }
    );
}


// ============================================================
// CHOOSE BEST OPTION
// ============================================================

export function chooseBestOption(
    options = []
) {

    if (
        !Array.isArray(options) ||
        options.length === 0
    ) {
        return null;
    }


    const sorted =
        sortOptions(options);


    return sorted[0] ?? null;
}


// ============================================================
// SET OPTIONS
// ============================================================

export function setLevelUpOptions(
    options
) {

    if (
        !Array.isArray(options)
    ) {

        levelUpState.options =
            [];

        return;
    }


    levelUpState.options =
        [...options];


    levelUpState.active =
        levelUpState.options.length >
        0;


    debugLog(
        "Level-up options:",
        levelUpState.options
    );
}


// ============================================================
// GET OPTIONS
// ============================================================

export function getLevelUpOptions() {

    return [
        ...levelUpState.options
    ];
}


// ============================================================
// SUBMIT CHOICE
// ============================================================
//
// Chưa gọi game_submit_intent() trực tiếp.
// Cần xác định format lựa chọn thật của game.
// ============================================================

export function submitChoice(
    option
) {

    if (!option) {
        return false;
    }


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
        STATE.gameHandle === null
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
     *     intent,
     *     value1,
     *     value2
     * )
     *
     * Không đoán format.
     */


    levelUpState.selected =
        option;

    levelUpState.selections++;

    levelUpState.lastSelection =
        performance.now();


    levelUpState.active =
        false;


    debugLog(
        "Selected level-up:",
        option
    );


    return true;
}


// ============================================================
// AUTO SELECT
// ============================================================

export function autoSelect() {

    if (
        !CONFIG.levelUp.enabled ||
        !CONFIG.levelUp.autoSelect
    ) {
        return null;
    }


    if (
        !levelUpState.active
    ) {
        return null;
    }


    const option =
        chooseBestOption(
            levelUpState.options
        );


    if (!option) {
        return null;
    }


    submitChoice(
        option
    );


    return option;
}


// ============================================================
// LEVEL CHANGE
// ============================================================

export function updateLevel(
    level
) {

    const newLevel =
        Number(level) || 0;


    if (
        newLevel >
        levelUpState.lastLevel
    ) {

        STATE.stats.levels +=
            newLevel -
            levelUpState.lastLevel;
    }


    levelUpState.lastLevel =
        newLevel;

    STATE.level =
        newLevel;
}


// ============================================================
// START
// ============================================================

export function startLevelUp() {

    levelUpState.active =
        false;

    levelUpState.options =
        [];

    levelUpState.selected =
        null;

    debugLog(
        "Level-up system started."
    );
}


// ============================================================
// STOP
// ============================================================

export function stopLevelUp() {

    levelUpState.active =
        false;

    levelUpState.options =
        [];

    levelUpState.selected =
        null;
}


// ============================================================
// STATUS
// ============================================================

export function getLevelUpStatus() {

    return {

        active:
            levelUpState.active,

        options:
            getLevelUpOptions(),

        selected:
            levelUpState.selected,

        lastLevel:
            levelUpState.lastLevel,

        selections:
            levelUpState.selections,

        lastSelection:
            levelUpState.lastSelection
    };
}


// ============================================================
// DEBUG
// ============================================================

export function debugLevelUp() {

    debugLog(
        "Level-up:",
        getLevelUpStatus()
    );
}
