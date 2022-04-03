import Terminal from "./terminal.js";

export default class Game {
    /** @type {Terminal} */
    term;
    history;

    #begin = false;
    #wipeTimer = 0;
    #wipeTicks = 0;
    #wipeLines;

    constructor(terminal) {
        this.term = new Terminal(terminal);
        this.history = document.getElementById("history");
        this.#wipeLines = this.term.maxLines;

        this.term.element.style.overflow = "hidden";
        this.term.writeLine("Press any key to begin...");
    }

    update(dt) {
        this.term.update(dt);

        if (!this.#begin) return;

        if (this.#wipeLines >= 0) {
            if (this.#wipeTimer > 50) {
                this.#wipeTimer = 0;
                this.#wipeTicks++;

                if (this.#wipeTicks >= 20) {
                    this.#wipeLines--;
                }

                this.term.fillRandom(this.#wipeLines);
            }

            if (this.#wipeLines >= 0) {
                this.#wipeTimer += dt;
            } else {
                this.term.reset();
                this.history.classList.add("out");
            }
        }
    }

    resize() {
        this.term.resize();
    }

    keydown(e) {
        if (!this.#begin) {
            this.#begin = true;
        }
    }
}
