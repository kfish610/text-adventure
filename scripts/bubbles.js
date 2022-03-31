"use strict";

let bubbles = [];
let ctx;
let lastTime;
let blur = true;

$(document).ready(() => {
    let canvas = $("#background")[0];

    ctx = canvas.getContext("2d");
    resize();

    for (let i = 0; i < 75; i++) {
        bubbles[i] = new Bubble();
    }

    window.requestAnimationFrame(draw);
});

function resize() {
    var dpr = window.devicePixelRatio || 1;
    var rect = ctx.canvas.getBoundingClientRect();

    ctx.canvas.width = rect.width * dpr;
    ctx.canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.filter = blur ? "blur(50px)" : "";
}

$(window).resize(resize);

// TODO: Remove
$(window).on('click', () => {
    blur = !blur;
    resize();
})

function draw(time) {
    if (lastTime != null) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        let dt = time - lastTime;
        for (let i = 0; i < bubbles.length; i++) {
            if (bubbles[i].speed > 0 && (bubbles[i].size > window.innerHeight / 2 || Math.random() > 0.996)) {
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
    window.requestAnimationFrame(draw);
}

class Bubble {
    constructor() {
        this.speed = 0.05;

        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;

        this.size = 0;

        let v = Math.random();
        let hue = v * 100 + 120;
        let light = (1 - v) * 10 + 10;
        this.color = "hsla(" + hue + ", 30%, " + light + "%, 50%)";
    }

    update(dt) {
        this.size += this.speed * dt;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill();
    }
}