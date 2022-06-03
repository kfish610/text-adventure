import Terminal from "./terminal";
import StateManager from "./state_manager";
import { BeginState } from "./states";

export default class Game {
    term: Terminal;
    manager: StateManager;

    constructor(terminal: HTMLElement) {
        terminal.style.lineHeight = "1.2rem";
        this.term = new Terminal(terminal);
        this.manager = new StateManager(BeginState);
    }

    update(dt: number) {
        this.manager.update(dt, this.term);

        this.term.update(dt);
    }

    resize() {
        this.term.resize();
    }

    keydown(e: KeyboardEvent) {
        this.manager.keydown(e);
    }
}
