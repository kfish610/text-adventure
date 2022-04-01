"use strict";

let bubbles = [];
let ctx;
let lastTime;
let blur = true;

function resize() {
    console.log("test");
    var dpr = window.devicePixelRatio || 1;
    var rect = ctx.canvas.getBoundingClientRect();

    ctx.canvas.width = rect.width * dpr;
    ctx.canvas.height = rect.height * dpr;

    ctx.filter = blur ? "blur(50px)" : "";
}

window.onresize = resize;

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

window.onload = () => {
    let canvas = document.getElementById("background");

    ctx = canvas.getContext("2d");
    resize();

    for (let i = 0; i < 50; i++) {
        bubbles[i] = new Bubble();
    }

    window.requestAnimationFrame(draw);
};

document.onvisibilitychange = () => {
    if (document.visibilityState == "visible") {
        lastTime = null;
    }
};

class Bubble {
    constructor() {
        this.speed = 0.04;

        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;

        this.size = 0;

        let v = Math.random();
        let hue = v * 120 + 100;
        let light = (1 - v) * 10 + 10;
        this.color = "hsla(" + hue + ", 30%, " + light + "%, 50%)";

        this.lifetime = (Math.random() ** 5) * 6000 + 400;
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