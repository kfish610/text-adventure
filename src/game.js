import Terminal from "./terminal.js";

export default class Game {
    #firstKey = true;

    load() {
        this.term = new Terminal(document.getElementById("terminal"));
        this.term.element.style.overflow = "hidden";

        this.term.init();
        this.term.writeLine("Press any key to begin...");
    }

    resize() {
        
    }

    keydown(e) {
        if(this.#firstKey) {
            this.#firstKey = false;
            this.term.setWaiting(false);
            setTimeout(this.#wipeTerminal.bind(this, Date.now(), this.term.maxLines), 50);
        }
    }

    #wipeTerminal(startTime, lines) {
        if(startTime < 0 || Date.now() - startTime >= 1000) {
            startTime = -1;
            lines--;
        }

        if(lines < 0) {
            this.term.element.style.overflow = null;
            this.term.clear();
            this.term.put("> ");
            this.term.show();
            this.term.setWaiting(true);
            return;
        }

        this.#showRandomText(lines);

        setTimeout(this.#wipeTerminal.bind(this, startTime, lines), 50);
    }

    #showRandomText(lines) {
        this.term.clear();
        for (let i = 0; i < lines; i++) {
            this.term.put(this.#randomCharacters(this.term.charsPerLine));
            this.term.put("\n");
        }
        this.term.put(this.#randomCharacters(this.term.charsPerLine));
        this.term.show();
    }

    #randomCharacters(count) {
        let values = new Uint8Array(count)
        window.crypto.getRandomValues(values);
        const mappedValues = values.map(x => {
            const adj = x % 36;
            return adj < 26 ? adj + 65 : adj - 26 + 48;
        });

        return String.fromCharCode.apply(null, mappedValues);
    }
}