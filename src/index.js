"use strict";

import * as bubbles from "./bubbles.js";
import Game from "./game.js";

let game;

window.onload = () => {
    bubbles.load();

    game = new Game();
    game.load();
}

window.onresize = () => {
    bubbles.resize();

    game.resize();
};

document.onkeydown = e => {
    game.keydown(e);
}

document.onvisibilitychange = () => {
    bubbles.visibilityChanged();
}