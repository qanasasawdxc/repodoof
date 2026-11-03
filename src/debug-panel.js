// ============================================================
// PokeSurvivor AutoBot
// File: src/debug-panel.js
// ============================================================

import {
    STATE
} from "./state.js";

import {
    isWasmReady
} from "./wasm-hook.js";

import {
    getBridgeStatus
} from "./game-bridge.js";

import {
    getDiscoveryStatus
} from "./game-discovery.js";

import {
    getCombatStatus
} from "./combat.js";

import {
    getPickupStatus
} from "./pickup.js";

import {
    getLevelUpStatus
} from "./level-up.js";

import {
    getRestartStatus
} from "./auto-restart.js";


// ============================================================
// PANEL
// ============================================================

let panel = null;

let updateTimer = null;


// ============================================================
// CREATE
// ============================================================

function createPanel() {

    if (panel) {
        return panel;
    }


    panel =
        document.createElement(
            "div"
        );


    panel.id =
        "psbot-debug-panel";


    panel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 2147483647;

        width: 260px;
        padding: 10px;

        background: rgba(0,0,0,0.85);
        color: #fff;

        font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

        font-size: 12px;
        line-height: 1.45;

        border:
            1px solid rgba(255,255,255,0.2);

        border-radius: 8px;

        box-shadow:
            0 4px 20px rgba(0,0,0,0.4);

        pointer-events: none;
    `;


    document.body.appendChild(
        panel
    );


    return panel;
}


// ============================================================
// FORMAT
// ============================================================

function value(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "null";
    }


    if (
        typeof value === "boolean"
    ) {

        return value
            ? "YES"
            : "NO";
    }


    if (
        typeof value === "number"
    ) {

        return Number.isFinite(value)
            ? String(
                Math.round(
                    value * 100
                ) / 100
            )
            : "NaN";
    }


    return String(
        value
    );
}


// ============================================================
// UPDATE
// ============================================================

export function updateDebugPanel() {

    if (!panel) {
        return;
    }


    const bridge =
        getBridgeStatus();


    const discovery =
        getDiscoveryStatus();


    const combat =
        getCombatStatus();


    const pickup =
        getPickupStatus();


    const levelUp =
        getLevelUpStatus();


    const restart =
        getRestartStatus();


    panel.innerHTML = `

        <div style="
            font-weight:700;
            font-size:14px;
            margin-bottom:8px;
        ">
            PokeSurvivor AutoBot
        </div>


        <div>
            Bot:
            <b>${value(STATE.running)}</b>
        </div>

        <div>
            Paused:
            <b>${value(STATE.paused)}</b>
        </div>

        <div>
            Dead:
            <b>${value(STATE.dead)}</b>
        </div>


        <hr style="
            border:0;
            border-top:
                1px solid rgba(255,255,255,0.15);
        ">


        <div>
            WASM:
            <b>${value(isWasmReady())}</b>
        </div>

        <div>
            Bridge:
            <b>${value(bridge.connected)}</b>
        </div>

        <div>
            Game Handle:
            <b>${value(STATE.gameHandle)}</b>
        </div>

        <div>
            Player:
            <b>${value(STATE.playerId)}</b>
        </div>


        <hr style="
            border:0;
            border-top:
                1px solid rgba(255,255,255,0.15);
        ">


        <div>
            Level:
            <b>${value(STATE.level)}</b>
        </div>

        <div>
            HP:
            <b>${value(STATE.hp)}</b>
        </div>

        <div>
            XP:
            <b>${value(STATE.xp)}</b>
        </div>


        <div>
            Position:
            <b>
                ${value(STATE.position.x)},
                ${value(STATE.position.y)}
            </b>
        </div>


        <hr style="
            border:0;
            border-top:
                1px solid rgba(255,255,255,0.15);
        ">


        <div>
            Target:
            <b>${value(STATE.target.id)}</b>
        </div>

        <div>
            Target distance:
            <b>${value(STATE.target.distance)}</b>
        </div>


        <div>
            Combat:
            <b>${value(combat.enabled)}</b>
        </div>

        <div>
            Pickups:
            <b>${value(pickup.collected)}</b>
        </div>

        <div>
            Level-ups:
            <b>${value(levelUp.selections)}</b>
        </div>


        <hr style="
            border:0;
            border-top:
                1px solid rgba(255,255,255,0.15);
        ">


        <div>
            Discovery:
            <b>${value(discovery.running)}</b>
        </div>

        <div>
            Discovery attempts:
            <b>${value(discovery.attempts)}</b>
        </div>

        <div>
            Restarts:
            <b>${value(restart.restartCount)}</b>
        </div>

    `;
}


// ============================================================
// START
// ============================================================

export function startDebugPanel() {

    if (updateTimer) {
        return;
    }


    createPanel();


    updateDebugPanel();


    updateTimer =
        setInterval(
            updateDebugPanel,
            250
        );
}


// ============================================================
// STOP
// ============================================================

export function stopDebugPanel() {

    if (updateTimer) {

        clearInterval(
            updateTimer
        );

        updateTimer =
            null;
    }


    if (panel) {

        panel.remove();

        panel =
            null;
    }
}


// ============================================================
// TOGGLE
// ============================================================

export function toggleDebugPanel() {

    if (panel) {

        stopDebugPanel();

    } else {

        startDebugPanel();
    }
}
