// ============================================================
// PokeSurvivor AutoBot
// File: src/wasm-fields.js
// ============================================================

/*
 * Các field của player/game được đọc thông qua:
 *
 * game_state_field(gameHandle, playerId, fieldId)
 *
 * QUAN TRỌNG:
 * Chưa điền ID thật ở thời điểm này.
 *
 * Không tự đoán ID.
 * Khi xác định được từ JS/WASM wrapper,
 * chỉ cần sửa file này.
 */

export const FIELDS = {

    // --------------------------------------------------------
    // PLAYER POSITION
    // --------------------------------------------------------

    X: null,
    Y: null,

    PREV_X: null,
    PREV_Y: null,


    // --------------------------------------------------------
    // MOVEMENT
    // --------------------------------------------------------

    MOVE_X: null,
    MOVE_Y: null,

    MOVE_ANGLE: null,

    WALKING: null,

    TRAVEL_VX: null,
    TRAVEL_VY: null,


    // --------------------------------------------------------
    // HEALTH
    // --------------------------------------------------------

    HP: null,
    MAX_HP: null,


    // --------------------------------------------------------
    // EXPERIENCE
    // --------------------------------------------------------

    XP: null,
    XP_NEXT: null,

    LEVEL: null,


    // --------------------------------------------------------
    // OTHER
    // --------------------------------------------------------

    MAGNET: null
};


// ============================================================
// CHECK FIELD
// ============================================================

export function hasField(name) {

    return (
        Object.prototype.hasOwnProperty.call(
            FIELDS,
            name
        ) &&
        FIELDS[name] !== null
    );
}


// ============================================================
// GET FIELD
// ============================================================

export function getField(name) {

    if (!hasField(name)) {
        return null;
    }

    return FIELDS[name];
}


// ============================================================
// DEBUG
// ============================================================

export function debugFields() {

    console.table(FIELDS);
}
