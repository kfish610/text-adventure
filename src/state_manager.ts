import State from "./state";
import Terminal from "./terminal";

export default class StateManager {
    state: State<object>;
    initOptions: object | null = {};

    constructor(s: new (m: StateManager) => State<any>) {
        this.state = new s(this);
    }

    setState<T extends object>(
        s: new (m: StateManager) => State<T>,
        options: T
    ) {
        this.state = new s(this);
        this.initOptions = options;
    }

    update(dt: number, term: Terminal) {
        if (this.initOptions != null) {
            this.state.init(term, this.initOptions);
            this.initOptions = null;
        }

        this.state.update(dt, term);
    }

    keydown(e: KeyboardEvent) {
        this.state.keydown(e);
    }
}
