import Bubbles from "./bubbles";
import Game from "./game";

let game: Game;

let bubbles: Bubbles;

let lastTime: number | null = null;

window.onload = () => {
    bubbles = new Bubbles(
        document.getElementById("background") as HTMLCanvasElement
    );
    game = new Game(document.getElementById("terminal")!);

    window.requestAnimationFrame(update);
};

window.onresize = () => {
    bubbles.resize();
    game.resize();
};

document.onkeydown = (e) => {
    game.keydown(e);
};

document.onvisibilitychange = () => {
    if (document.visibilityState == "visible") {
        lastTime = null;
    }
};

function update(time: number) {
    // This really shouldn't be needed if browsers are following convention,
    // but better safe than sorry
    if (document.hidden) {
        window.requestAnimationFrame(update);
        return;
    }

    console.log({time, lastTime, delta: time - lastTime!});

    if (lastTime == null) {
        lastTime = -1;
        window.requestAnimationFrame(update);
        return;
    } else if (lastTime != -1) {
        let dt = time - lastTime;

        bubbles.update(dt);
        game.update(dt);
    }

    lastTime = time;
    window.requestAnimationFrame(update);
}
