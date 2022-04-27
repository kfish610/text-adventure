import StateManager from "./state_manager";
import Terminal from "./terminal";

export default abstract class State<TOptions extends object> {
    protected manager: StateManager;

    constructor(manager: StateManager) {
        this.manager = manager;
    }

    init(term: Terminal, options: TOptions) {}

    update(dt: number, term: Terminal) {}

    keydown(e: KeyboardEvent) {}
}
