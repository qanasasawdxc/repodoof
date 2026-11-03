// ==UserScript==
// @name         PokeSurvivor AutoBot
// @namespace    https://github.com/
// @version      0.1.0
// @description  PokeSurvivor automation framework
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(async function () {

    "use strict";

    // ========================================================
    // MODULE IMPORTS
    // ========================================================

    const {
        CONFIG
    } = await import(
        "./src/config.js"
    );

    const {
        STATE,
        debugLog,
        setError
    } = await import(
        "./src/state.js"
    );

    const {
        initWasmHook,
        isWasmReady
    } = await import(
        "./src/wasm-hook.js"
    );

    const {
        startMovement,
        stopMovementController
    } = await import(
        "./src/movement.js"
    );

    const {
        startCombat,
        stopCombat,
        updateCombat
    } = await import(
        "./src/combat.js"
    );

    const {
        startPickup,
        stopPickup
    } = await import(
        "./src/pickup.js"
    );

    const {
        startLevelUp,
        stopLevelUp
    } = await import(
        "./src/level-up.js"
    );

    const {
        startAutoRestart,
        stopAutoRestart,
        updateAutoRestart
    } = await import(
        "./src/auto-restart.js"
    );


    // ========================================================
    // BOT STATE
    // ========================================================

    let botTimer = null;

    let initialized = false;


    // ========================================================
    // INITIALIZE
    // ========================================================

    function initialize() {

        if (initialized) {
            return;
        }

        initialized = true;

        debugLog(
            "Initializing PokeSurvivor AutoBot..."
        );


        // ----------------------------------------------------
        // WASM HOOK
        // ----------------------------------------------------

        initWasmHook();


        // ----------------------------------------------------
        // BOT STATE
        // ----------------------------------------------------

        STATE.running =
            Boolean(
                CONFIG.bot.enabled
            );

        STATE.paused =
            false;


        // ----------------------------------------------------
        // MODULES
        // ----------------------------------------------------

        startMovement();

        startCombat();

        startPickup();

        startLevelUp();

        startAutoRestart();


        // ----------------------------------------------------
        // MAIN LOOP
        // ----------------------------------------------------

        startMainLoop();


        debugLog(
            "PokeSurvivor AutoBot initialized."
        );
    }


    // ========================================================
    // MAIN LOOP
    // ========================================================

    function startMainLoop() {

        if (botTimer !== null) {
            return;
        }


        botTimer =
            setInterval(
                botUpdate,
                50
            );


        debugLog(
            "Main bot loop started."
        );
    }


    // ========================================================
    // BOT UPDATE
    // ========================================================

    function botUpdate() {

        if (!STATE.running) {
            return;
        }


        if (STATE.paused) {
            return;
        }


        try {

            // ----------------------------------------------
            // AUTO RESTART
            // ----------------------------------------------

            updateAutoRestart();


            // ----------------------------------------------
            // COMBAT
            // ----------------------------------------------

            updateCombat();


        } catch (error) {

            setError(error);

        }
    }


    // ========================================================
    // START BOT
    // ========================================================

    function startBot() {

        STATE.running = true;

        STATE.paused = false;

        debugLog(
            "Bot started."
        );
    }


    // ========================================================
    // STOP BOT
    // ========================================================

    function stopBot() {

        STATE.running = false;

        STATE.paused = true;


        stopMovementController();

        stopCombat();

        stopPickup();

        stopLevelUp();

        stopAutoRestart();


        debugLog(
            "Bot stopped."
        );
    }


    // ========================================================
    // PAUSE
    // ========================================================

    function pauseBot() {

        STATE.paused = true;

        debugLog(
            "Bot paused."
        );
    }


    // ========================================================
    // RESUME
    // ========================================================

    function resumeBot() {

        if (!STATE.running) {
            return;
        }

        STATE.paused = false;

        debugLog(
            "Bot resumed."
        );
    }


    // ========================================================
    // DEBUG API
    // ========================================================

    window.PokeSurvivorBot = {

        start:
            startBot,

        stop:
            stopBot,

        pause:
            pauseBot,

        resume:
            resumeBot,

        state:
            STATE,

        config:
            CONFIG,

        wasmReady:
            isWasmReady,

        status() {

            return {

                running:
                    STATE.running,

                paused:
                    STATE.paused,

                dead:
                    STATE.dead,

                wasm:
                    isWasmReady(),

                gameHandle:
                    STATE.gameHandle,

                playerId:
                    STATE.playerId,

                level:
                    STATE.level,

                hp:
                    STATE.hp,

                position:
                    {
                        ...STATE.position
                    },

                target:
                    {
                        ...STATE.target
                    }

            };
        }

    };


    // ========================================================
    // WAIT FOR PAGE
    // ========================================================

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }

})();
