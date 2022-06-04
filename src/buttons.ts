import { Story, Option } from './story';

let story: Story = require("./story.cson");

export default class Buttons {
    elem: HTMLElement;
    selected: string | null = null;
    text: string | null = null;
    enabled = false;
    buttons: HTMLButtonElement[] = [];
    firstExit = true;

    constructor(elem: HTMLElement) {
        this.elem = elem;
    }

    enable(scene: string) {
        this.enabled = true;
        
        let options: Option[];
        if (story[scene].options == undefined) {
            options = story[story[scene].loop!].options!;
            let loopedOpt = options.findIndex(o => o.return != undefined ? o.return == scene : o.next == scene);
            options.splice(loopedOpt, 1);
        } else {
            options = story[scene].options!;
        }

        let step = options.length == 4 ? 6 : 12/options.length;
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            let button = document.createElement("button");
            button.className = "overlay";
            button.innerHTML =  "> <i class=\"fa-solid fa-"+ option.icon +"\"></i> " + option.text;
            if (options.length == 1) {
                button.style.gridColumn = "4 / 10";
            } else if (options.length == 4) {
                button.style.gridColumn = i < 2 ? (i*step + 1).toString() + " / " + ((i+1)*step + 1).toString()
                                                        : ((i-2)*step + 1).toString() + " / " + ((i-1)*step + 1).toString();
            } else {
                button.style.gridColumn = (i*step + 1).toString() + " / " + ((i+1)*step + 1).toString();
            }
            button.onclick = () => {
                if (this.firstExit && option.icon == "arrow-up-from-bracket") {
                    this.firstExit = false;
                    document.onvisibilitychange!(new Event("visibilitychange"));
                    if (!confirm("Options with this icon (the exiting arrow) leave a scene permanently. \
This means that if there's any other options you haven't tried yet, \
after clicking this option you won't be able to read them without restarting the game. \
Are you sure you want to continue?")) return;
                }
                this.selected = option.next;
                this.text = "<i class=\"fa-solid fa-"+ option.icon +"\"></i> " + option.text;
                this.elem.className = "";
                this.elem.innerHTML = "";
                this.buttons = [];
                this.enabled = false;
            };
            this.elem.appendChild(button);
            this.buttons.push(button);
        }
        this.elem.className = "out";
    }
}