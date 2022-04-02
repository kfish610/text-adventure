let bubbles = [];
let ctx;
let lastTime;

export function resize() {
    var dpr = window.devicePixelRatio || 1;
    var rect = ctx.canvas.getBoundingClientRect();

    ctx.canvas.width = rect.width * dpr;
    ctx.canvas.height = rect.height * dpr;

    ctx.filter = "blur(50px)";
}

export function visibilityChanged() {
    if (document.visibilityState == "visible") {
        lastTime = null;
    }
};

export function load() {
    let canvas = document.getElementById("background");

    ctx = canvas.getContext("2d");
    resize();

    for (let i = 0; i < 60; i++) {
        bubbles[i] = new Bubble();
    }

    window.requestAnimationFrame(draw);
};

function draw(time) {
    if (lastTime != null) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        let dt = time - lastTime;
        for (let i = 0; i < bubbles.length; i++) {
            if (bubbles[i].speed > 0 && bubbles[i].lifetime <= 0) {
                bubbles[i].speed *= -1;
            }

            bubbles[i].update(dt);
            if (bubbles[i].size <= 0) {
                bubbles[i] = new Bubble();
            } else {
                bubbles[i].draw();
            }
        }
    }

    lastTime = time;
    if (!document.hidden) {
        window.requestAnimationFrame(draw);
    }
}

class Bubble {
    constructor() {
        this.speed = 0.03;

        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;

        this.size = 0;

        let v = Math.random();
        let hue = v < 0.5 ? 150 : 230;
        let sat = v < 0.5 ? 50 : 85;
        let light = v < 0.5 ? 25 : 40;
        this.color = "hsla(" + hue + ", "+ sat +"%, " + light + "%, 40%)";

        this.lifetime = (Math.random() ** 5) * 7000 + 500;
    }

    update(dt) {
        this.size += this.speed * dt;
        this.lifetime -= dt;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill();
    }
}