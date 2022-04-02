import LineClamp from "@tvanc/lineclamp";

export default class Terminal {
    element;
    #cursor = false;
    #waiting = false;
    content = "";

    constructor(elem) {
        this.element = elem;

        this.fontSize = parseInt(getComputedStyle(this.element).fontSize.slice(0, -2));
        this.width = parseInt(getComputedStyle(this.element).width.slice(0, -2));
        this.height = parseInt(getComputedStyle(this.element).height.slice(0, -2));
        
        this.element.style.position = "absolute";
        const clamp = new LineClamp(this.element);
        this.lineHeight = clamp.calculateTextMetrics().additionalLineHeight;
        this.element.style.position = null;

        this.maxLines = Math.floor(this.height/this.lineHeight);
        this.charsPerLine = Math.floor(this.width / (this.fontSize * 0.6));
    }

    init() {
        this.#cursor = true;
        this.#waiting = true;
        this.content = "> ";
        this.#flipCursor();
    }

    resize() {
        this.width = parseInt(getComputedStyle(term.element).width.slice(0, -2));
        this.height = parseInt(getComputedStyle(term.element).height.slice(0, -2));

        this.maxLines = Math.floor(height/lineHeight);
        this.charsPerLine = Math.floor(width / (fontSize * 0.6));
    }

    clear() {
        this.content = "";
    }

    put(text) {
        this.setWaiting(false);
        this.content += text;
    }

    putLine(text) {
        this.setWaiting(false);
        this.content += text + "\n> ";
        this.setWaiting(true);
    }

    write(text) {
        this.put(text);
        this.show();
    }

    writeLine(text) {
        this.putLine(text);
        this.show();
    }

    show() {
        this.element.innerText = this.content;
    }

    setWaiting(waiting) {
        this.#waiting = waiting;
        // if the cursor needed to be turned off, fix it
        if (!this.#waiting && !this.#cursor) {
            this.content = this.content.slice(0, -1);
            this.show();
            this.#cursor = true;
        }
    }

    #flipCursor() {
        if (this.#waiting) {
            if (this.#cursor) {
                this.content += "_";
            } else {
                this.content = this.content.slice(0, -1);
            }
            this.#cursor = !this.#cursor;
            this.show();
        }

        setTimeout(this.#flipCursor.bind(this), 500);
    }
}