import State from "./state";
import Terminal from "./terminal";

export class BeginState extends State {
    override init(term: Terminal) {
        term.writeLine("Press any key to begin...");
    }

    override keydown(e: KeyboardEvent): void {
        this.manager.setState(WipeState);
    }
}

export class WipeState extends State {
    private wipeTimer = 0;
    private wipeTicks = 0;
    private wipeLines: number;

    override init(term: Terminal) {
        term.element.style.overflow = "hidden";
        this.wipeLines = term.maxLines;
    }

    override update(dt: number, term: Terminal): void {
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
            this.manager.setState(PlayingState);
        }
    }
}

type Option = {
    text: string;
    icon: string;
    next: string;
};

type Scene = {
    text: string;
    options: Option[];
};

export class PlayingState extends State {
    story: Record<string, Scene> = require("./story.cson");

    curr = "begin";

    remainingText = this.story["begin"].text;

    delay = 0;

    override update(dt: number, term: Terminal) {
        if (this.remainingText.length == 0) return;

        if (this.delay <= 0) {
            let commandPos = this.remainingText.indexOf("[");
            if (commandPos == 0) {
                let command = this.remainingText.substring(
                    1,
                    this.remainingText.indexOf("]")
                );
                let args = command.split(" ");

                if (args[0] == "delay") {
                    this.delay = parseInt(args[1]);
                    this.remainingText = this.remainingText.substring(
                        this.remainingText.indexOf("]") + 1
                    );
                } else if (args[0] == "enter") {
                    term.writeLine("");
                }
            } else {
                term.write(this.remainingText.substring(0, commandPos));
                this.remainingText = this.remainingText.substring(commandPos);
            }
        } else {
            this.delay -= dt;
        }
    }
}
