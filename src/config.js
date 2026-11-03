// ============================================================
// PokeSurvivor AutoBot
// File: src/config.js
// ============================================================

export const CONFIG = {

    // --------------------------------------------------------
    // BOT
    // --------------------------------------------------------
    bot: {
        enabled: true,

        // Hiện bảng điều khiển trên game
        showUI: true,

        // Ghi log ra Console
        debug: true
    },


    // --------------------------------------------------------
    // MOVEMENT
    // --------------------------------------------------------
    movement: {
        enabled: true,

        // Khoảng thời gian giữa mỗi lần cập nhật hướng
        updateInterval: 50,

        // Khoảng cách tối đa bot tìm mục tiêu
        targetRange: 500,

        // Khoảng cách để bot tránh quái
        dangerRange: 100
    },


    // --------------------------------------------------------
    // PICKUP
    // --------------------------------------------------------
    pickup: {
        enabled: true,

        // Bán kính ưu tiên nhặt XP/item
        radius: 200
    },


    // --------------------------------------------------------
    // COMBAT
    // --------------------------------------------------------
    combat: {
        enabled: true
    },


    // --------------------------------------------------------
    // LEVEL UP
    // --------------------------------------------------------
    levelUp: {
        enabled: true,

        // Sau này sẽ thêm chiến thuật chọn skill
        autoSelect: true
    },


    // --------------------------------------------------------
    // AUTO RESTART
    // --------------------------------------------------------
    restart: {
        enabled: true,

        // Thời gian chờ trước khi chơi lại
        delay: 2000
    }

};
