export default class AudioManager {
    element = new Audio();

    constructor() {
        this.element.loop = true;
    }
    
    play(name: String, volume: number = 1) {
        this.element.src = `../assets/${name}.mp3`;
        this.element.volume = volume;
        this.element.play();
    }

    stop() {
        this.element.pause();
        this.element.currentTime = 0;
    }
}