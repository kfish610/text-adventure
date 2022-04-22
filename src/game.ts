import Terminal from "./terminal";

export default class Game {
    term: Terminal;

    private begin = false;
    private wipeTimer = 0;
    private wipeTicks = 0;
    private wipeLines = 0;

    constructor(terminal: HTMLElement) {
        this.term = new Terminal(terminal);
        this.wipeLines = this.term.maxLines;

        this.term.element.style.overflow = "hidden";
        this.term.writeLine("Press any key to begin...");
    }

    update(dt: number) {
        this.term.update(dt);

        if (!this.begin) return;

        if (this.wipeLines >= 0) {
            if (this.wipeTimer > 50) {
                this.wipeTimer = 0;
                this.wipeTicks++;

                if (this.wipeTicks >= 20) {
                    this.wipeLines--;
                }

                this.term.fillRandom(this.wipeLines);
            }

            if (this.wipeLines >= 0) {
                this.wipeTimer += dt;
            } else {
                this.term.reset();
            }
        }
    }

    resize() {
        this.term.resize();
    }

    keydown(e: KeyboardEvent) {
        if (!this.begin) {
            this.begin = true;
        }
    }
}
