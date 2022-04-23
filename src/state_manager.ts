import State from "./state";
import Terminal from "./terminal";

export default class StateManager {
    state: State;
    needsInit = true;

    constructor(s: new (m: StateManager) => State) {
        this.state = new s(this);
    }

    setState(s: new (m: StateManager) => State) {
        this.state = new s(this);
        this.needsInit = true;
    }

    update(dt: number, term: Terminal) {
        if (this.needsInit) {
            this.state.init(term);
            this.needsInit = false;
        }

        this.state.update(dt, term);
    }

    keydown(e: KeyboardEvent) {
        this.state.keydown(e);
    }
}
