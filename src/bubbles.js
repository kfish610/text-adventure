export default class Bubbles {
    ctx;
    bubbles = [];

    constructor(canvas) {
        this.ctx = canvas.getContext("2d");
        this.resize();

        for (let i = 0; i < 60; i++) {
            this.bubbles[i] = new Bubble();
        }
    }

    update(dt) {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        for (let i = 0; i < this.bubbles.length; i++) {
            if (this.bubbles[i].speed > 0 && this.bubbles[i].lifetime <= 0) {
                this.bubbles[i].speed *= -1;
            }

            this.bubbles[i].update(dt);
            if (this.bubbles[i].size <= 0) {
                this.bubbles[i] = new Bubble();
            } else {
                this.bubbles[i].draw(this.ctx);
            }
        }
    }

    resize() {
        var dpr = window.devicePixelRatio || 1;
        var rect = this.ctx.canvas.getBoundingClientRect();

        this.ctx.canvas.width = rect.width * dpr;
        this.ctx.canvas.height = rect.height * dpr;

        this.ctx.filter = "blur(50px)";
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
        this.color = "hsla(" + hue + ", " + sat + "%, " + light + "%, 40%)";

        this.lifetime = Math.random() ** 5 * 7000 + 500;
    }

    update(dt) {
        this.size += this.speed * dt;
        this.lifetime -= dt;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}
