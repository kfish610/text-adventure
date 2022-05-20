import State from "./state";
import Terminal from "./terminal";
import Buttons from "./buttons";
import { Story } from './story';

let story: Story = require("./story.cson");

export class BeginState extends State {
    override init(term: Terminal) {
        term.writeLine("Press any key to begin...");
    }

    override keydown(e: KeyboardEvent) {
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
            term.element.style.overflow = "";
            this.manager.setState(PlayingState);
        }
    }
}

export class PlayingState extends State {
    scene = "begin";

    remainingText = "";

    delay = 0;

    textDecoded = -1;
    textPosition = -1;
    textTimer = -1;

    buttons = new Buttons(document.getElementById("buttons")!);

    override init(term: Terminal) {
        this.remainingText = story[this.scene].text;
    }

    override update(dt: number, term: Terminal) {
        if (this.buttons.enabled) return;

        if (this.buttons.selected != null) {
            term.writeLine(this.buttons.text!);
            this.scene = this.buttons.selected;
            this.buttons.selected = null;
            this.remainingText = story[this.scene].text;
        }

        if (this.remainingText.length == 0) {
            term.write("<br/>");
            term.writeLine("");
            this.buttons.enable(this.scene);
            setTimeout(() => term.element.scroll(0, term.element.scrollHeight), 500);
            return;
        }

        if (this.delay <= 0) {
            let [pos, index] = this.indexOfMany(this.remainingText, "<[ \n");
            if(pos == 0) {
                this.handleSpecial(index, term);
            } else {
                this.writeText(pos, term, dt);
            }
        } else {
            this.delay -= dt;
        }
    }

    private indexOfMany(str: string, chars: string): [number, number] {
        for (let i = 0; i < str.length; i++) {
            let c = chars.indexOf(str[i]);
            if (c != -1) {
                return [i, c];
            }
        }
        return [-1, -1];
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
            if (this.textTimer > 20) {
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

        if (this.textTimer > 10) {
            this.textDecoded++;
            this.textTimer = 0;
        }
        this.textTimer += dt;
    }

    private handleSpecial(index: number, term: Terminal) {
        switch (index) {
            case 0: // <
                let endTagPos = this.remainingText.indexOf(">");
                term.write(this.remainingText.slice(0, endTagPos + 1));
                this.remainingText = this.remainingText.slice(endTagPos + 1);
                break;
            case 1: // [
                let endCommandPos = this.remainingText.indexOf("]");
                let command = this.remainingText.slice(1, endCommandPos);
                let spacePos = command.indexOf(" ");
                switch (command.slice(0, spacePos)) {
                    case "delay":
                        this.delay = parseInt(command.slice(spacePos + 1));
                        break;
                    case "normal":
                        term.write(command.slice(spacePos + 1));
                        break;
                    case "sep":
                        break;
                }
                this.remainingText = this.remainingText.slice(endCommandPos + 1);
                break;
            case 2: // <space>
                term.write(" ");
                this.remainingText = this.remainingText.slice(1);
                break;
            case 3: // \n
                term.writeLine("");
                this.delay = 500;
                this.remainingText = this.remainingText.slice(1);
                break;
            default:
                throw new RangeError("Invalid char index " + index);
        }
    }
}
