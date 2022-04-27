import State from "./state";
import Terminal from "./terminal";

type Option = {
    text: string;
    icon: string;
    next: string;
};

type Scene = {
    text: string;
    options: Option[];
};

let story: Record<string, Scene> = require("./story.cson");

export class BeginState extends State<{}> {
    override init(term: Terminal, options: {}) {
        term.writeLine("Press any key to begin...");
    }

    override keydown(e: KeyboardEvent) {
        this.manager.setState(WipeState, {});
    }
}

export class WipeState extends State<{}> {
    private wipeTimer = 0;
    private wipeTicks = 0;
    private wipeLines: number;

    override init(term: Terminal, options: {}) {
        term.element.style.overflow = "hidden";
        this.wipeLines = term.maxLines;
    }

    override update(dt: number, term: Terminal) {
        if (this.wipeTimer > 50) {
            if (this.wipeTicks > 5) {
                this.wipeLines--;
            } else {
                this.wipeTicks++;
            }

            term.fillRandom(this.wipeLines);

            this.wipeTimer = 0;
        }

        if (this.wipeLines >= 0) {
            this.wipeTimer += dt;
        } else {
            term.reset();
            this.manager.setState(PlayingState, { text: story["begin"].text });
        }
    }
}

export class PlayingState extends State<{ text: string }> {
    curr = "begin";

    remainingText = "";

    delay = 0;

    textDecoded = -1;
    textPosition = -1;
    textTimer = -1;

    override init(term: Terminal, options: { text: string }) {
        this.remainingText = options.text;
    }

    override update(dt: number, term: Terminal) {
        if (this.remainingText.length == 0) return;

        if (this.delay <= 0) {
            let commandPos = this.remainingText.indexOf("[");
            if (commandPos == 0) {
                let command = this.remainingText.slice(
                    1,
                    this.remainingText.indexOf("]")
                );
                let args = command.split(" ");

                this.handleCommand(args, term);

                this.remainingText = this.remainingText.slice(
                    this.remainingText.indexOf("]") + 1
                );
            } else {
                this.writeText(commandPos, term, dt);
            }
        } else {
            this.delay -= dt;
        }
    }

    private writeText(len: number, term: Terminal, dt: number) {
        if (len == -1) {
            len = this.remainingText.length;
        }

        if (this.textDecoded == -1) {
            this.textDecoded = 0;
            this.textPosition = term.getPosition();
            this.textTimer = 0;
        }

        if (this.textDecoded == 0) {
            if (this.textTimer > 100) {
                this.textDecoded = 1;
                this.textTimer = 0;
            } else {
                this.textTimer += dt;
                term.write(term.randomCharacters(len), this.textPosition);
                return;
            }
        }

        let text =
            this.remainingText.slice(0, this.textDecoded) +
            term.randomCharacters(len - this.textDecoded);

        term.write(text, this.textPosition);

        if (this.textDecoded == len) {
            this.remainingText = this.remainingText.slice(len);
            this.textDecoded = -1;
            return;
        }

        if (this.textTimer > 50) {
            this.textDecoded++;
            this.textTimer = 0;
        }
        this.textTimer += dt;
    }

    private handleCommand(args: Array<string>, term: Terminal) {
        switch (args[0]) {
            case "delay":
                this.delay = parseInt(args[1]);
                break;
            case "normal":
                term.write(args[1]);
                break;
            case "newline":
                term.writeLine("");
                break;
        }
    }
}
