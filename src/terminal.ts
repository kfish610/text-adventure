import LineClamp from "@tvanc/lineclamp";

const CURSOR_BLINK_INTERVAL = 500;

export default class Terminal {
    element: HTMLElement;

    fontSize: number;
    width: number;
    height: number;
    lineHeight: number;

    maxLines: number;
    charsPerLine: number;

    content = "> ";

    private cursorVisible = true;
    private cursorEnabled = true;
    private cursorTicks = 0;

    constructor(elem: HTMLElement) {
        this.element = elem;

        this.fontSize = parseInt(
            getComputedStyle(this.element).fontSize.slice(0, -2)
        );
        this.width = parseInt(
            getComputedStyle(this.element).width.slice(0, -2)
        );
        this.height = parseInt(
            getComputedStyle(this.element).height.slice(0, -2)
        );

        this.element.style.position = "absolute";
        const clamp = new LineClamp(this.element);
        this.lineHeight = clamp.calculateTextMetrics().additionalLineHeight;
        this.element.style.position = "";

        this.maxLines = Math.floor(this.height / this.lineHeight);
        this.charsPerLine = Math.floor(this.width / (this.fontSize * 0.6));
    }

    resize() {
        this.width = parseInt(
            getComputedStyle(this.element).width.slice(0, -2)
        );
        this.height = parseInt(
            getComputedStyle(this.element).height.slice(0, -2)
        );

        this.maxLines = Math.floor(this.height / this.lineHeight);
        this.charsPerLine = Math.floor(this.width / (this.fontSize * 0.6));
    }

    update(dt: number) {
        if (this.cursorEnabled) {
            if (this.cursorTicks >= CURSOR_BLINK_INTERVAL) {
                this.cursorTicks = 0;
                this.flipCursor();
            } else {
                this.cursorTicks += dt;
            }
        }
    }

    show() {
        this.element.innerText = this.content;
    }

    clear() {
        this.setCursorEnabled(false);
        this.content = "";
    }

    put(text: string) {
        this.setCursorEnabled(false);
        this.content += text;
    }

    putLine(text: string) {
        this.setCursorEnabled(false);
        this.content += text + "\n> ";
    }

    reset() {
        this.clear();
        this.put("> ");
        this.show();
        this.setCursorEnabled(true);
    }

    write(text: string) {
        this.put(text);
        this.show();
        this.setCursorEnabled(true);
    }

    writeLine(text: string) {
        this.putLine(text);
        this.show();
        this.setCursorEnabled(true);
    }

    fillRandom(lines: number) {
        this.clear();
        for (let i = 0; i < lines; i++) {
            this.put(this.randomCharacters(this.charsPerLine));
            this.put("\n");
        }
        this.put(this.randomCharacters(this.charsPerLine));
        this.show();
    }

    setCursorEnabled(value: boolean) {
        this.cursorEnabled = value;
        // if the cursor needed to be turned off, fix it
        if (!this.cursorEnabled && !this.cursorVisible) {
            this.content = this.content.slice(0, -1);
            this.show();
            this.cursorVisible = true;
        }
    }

    private flipCursor() {
        if (this.cursorEnabled) {
            if (this.cursorVisible) {
                this.content += "_";
            } else {
                this.content = this.content.slice(0, -1);
            }
            this.cursorVisible = !this.cursorVisible;
            this.show();
        }
    }

    private randomCharacters(count: number) {
        let values = new Uint8Array(count);
        window.crypto.getRandomValues(values);
        const mappedValues = values.map((x) => {
            const adj = x % 36;
            return adj < 26 ? adj + 65 : adj - 26 + 48;
        });

        return String.fromCharCode.apply(null, mappedValues);
    }
}