export default class AudioManager {
    element = new Audio();
    
    play(name: String, volume: number = 1) {
        this.element.src = `../assets/${name}`;
        this.element.volume = volume;
        this.element.currentTime = 0;
        this.element.play();
    }

    stop() {
        this.element.pause();
        this.element.currentTime = 0;
    }

    pause() {
        this.element.pause();
    }

    resume() {
        this.element.play();
    }

    loop(shouldLoop: boolean) {
        this.element.loop = shouldLoop;
    }
}