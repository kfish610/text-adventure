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
            let tagPos = this.remainingText.indexOf("<");
            let spacePos = this.remainingText.indexOf(" ");
            let newlinePos = this.remainingText.indexOf("\n");
            let commandPos = this.remainingText.indexOf("[");
            if (tagPos == 0) {
                let endTagPos = this.remainingText.indexOf(">");
                term.write(this.remainingText.slice(0, endTagPos + 1));
                this.remainingText = this.remainingText.slice(endTagPos + 1);
            } else if (spacePos == 0) {
                term.write(" ");
                this.remainingText = this.remainingText.slice(1);
            } else if (newlinePos == 0) {
                term.writeLine("");
                this.delay = 500;
                this.remainingText = this.remainingText.slice(1);
            } else if (commandPos == 0) {
                let command = this.remainingText.slice(
                    1,
                    this.remainingText.indexOf("]")
                );
                let args = command.split(" ");

                this.handleCommand(args, term);

                this.remainingText = this.remainingText.slice(
                    this.remainingText.indexOf("]") + 1
                );
            } else if (tagPos != -1 
                    && (spacePos == -1 || tagPos < spacePos)
                    && (newlinePos == -1 || tagPos < newlinePos)
                    && (commandPos == -1 || tagPos < commandPos)) {
                this.writeText(tagPos, term, dt);
            } else if (spacePos != -1
                    && (newlinePos == -1 || spacePos < newlinePos)
                    && (commandPos == -1 || spacePos < commandPos)) {
                this.writeText(spacePos, term, dt);
            } else if (newlinePos != -1 
                    && (commandPos == -1 || newlinePos < commandPos)) {
                this.writeText(newlinePos, term, dt);
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
            if (this.textTimer > 50) {
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

        if (this.textTimer > 25) {
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
            case "sep":
                break;
        }
    }
}
