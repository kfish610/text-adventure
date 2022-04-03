"use strict";

import Bubbles from "./bubbles.js";
import Game from "./game.js";

/** @type {Game} */
let game;
/** @type {Bubbles} */
let bubbles;

let lastTime;

window.onload = () => {
    bubbles = new Bubbles(document.getElementById("background"));
    game = new Game(document.getElementById("terminal"));

    window.requestAnimationFrame(update);
};

window.onresize = () => {
    bubbles.resize();
    game.resize();
};

document.onkeydown = (e) => {
    game.keydown(e);
};

document.onvisibilitychange = () => {
    if (document.visibilityState == "visible") {
        lastTime = null;
    }
};

function update(time) {
    // This really shouldn't be needed if browsers are following convention,
    // but better safe than sorry
    if (document.hidden) {
        window.requestAnimationFrame(update);
        return;
    }

    if (lastTime != null) {
        let dt = time - lastTime;

        bubbles.update(dt);
        game.update(dt);
    }

    lastTime = time;
    window.requestAnimationFrame(update);
}
