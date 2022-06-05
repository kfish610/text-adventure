/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@tvanc/lineclamp/dist/esm.js":
/*!***************************************************!*\
  !*** ./node_modules/@tvanc/lineclamp/dist/esm.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ LineClamp)
/* harmony export */ });
/**
 * Reduces font size or trims text to make it fit within specified bounds.
 *
 * Supports clamping by number of lines or text height.
 *
 * Known limitations:
 * 1. Characters that distort line heights (emojis, zalgo) may cause
 * unexpected results.
 * 2. Calling {@see hardClamp()} wipes child elements. Future updates may allow
 * inline child elements to be preserved.
 *
 * @todo Split text metrics into own library
 * @todo Test non-LTR text
 */
class LineClamp {
  /**
   * @param {HTMLElement} element
   * The element to clamp.
   *
   * @param {Object} [options]
   * Options to govern clamping behavior.
   *
   * @param {number} [options.maxLines]
   * The maximum number of lines to allow. Defaults to 1.
   * To set a maximum height instead, use {@see options.maxHeight}
   *
   * @param {number} [options.maxHeight]
   * The maximum height (in pixels) of text in an element.
   * This option is undefined by default. Once set, it takes precedence over
   * {@see options.maxLines}. Note that this applies to the height of the text, not
   * the element itself. Restricting the height of the element can be achieved
   * with CSS <code>max-height</code>.
   *
   * @param {boolean} [options.useSoftClamp]
   * If true, reduce font size (soft clamp) to at least {@see options.minFontSize}
   * before resorting to trimming text. Defaults to false.
   *
   * @param {boolean} [options.hardClampAsFallback]
   * If true, resort to hard clamping if soft clamping reaches the minimum font size
   * and still doesn't fit within the max height or number of lines.
   * Defaults to true.
   *
   * @param {string} [options.ellipsis]
   * The character with which to represent clipped trailing text.
   * This option takes effect when "hard" clamping is used.
   *
   * @param {number} [options.minFontSize]
   * The lowest font size, in pixels, to try before resorting to removing
   * trailing text (hard clamping). Defaults to 1.
   *
   * @param {number} [options.maxFontSize]
   * The maximum font size in pixels. We'll start with this font size then
   * reduce until text fits constraints, or font size is equal to
   * {@see options.minFontSize}. Defaults to the element's initial computed font size.
   */
  constructor(
    element,
    {
      maxLines = undefined,
      maxHeight = undefined,
      useSoftClamp = false,
      hardClampAsFallback = true,
      minFontSize = 1,
      maxFontSize = undefined,
      ellipsis = "…",
    } = {}
  ) {
    Object.defineProperty(this, "originalWords", {
      writable: false,
      value: element.textContent.match(/\S+\s*/g) || [],
    });

    Object.defineProperty(this, "updateHandler", {
      writable: false,
      value: () => this.apply(),
    });

    Object.defineProperty(this, "observer", {
      writable: false,
      value: new MutationObserver(this.updateHandler),
    });

    if (undefined === maxFontSize) {
      maxFontSize = parseInt(window.getComputedStyle(element).fontSize, 10);
    }

    this.element = element;
    this.maxLines = maxLines;
    this.maxHeight = maxHeight;
    this.useSoftClamp = useSoftClamp;
    this.hardClampAsFallback = hardClampAsFallback;
    this.minFontSize = minFontSize;
    this.maxFontSize = maxFontSize;
    this.ellipsis = ellipsis;
  }

  /**
   * Gather metrics about the layout of the element's text.
   * This is a somewhat expensive operation - call with care.
   *
   * @returns {TextMetrics}
   * Layout metrics for the clamped element's text.
   */
  calculateTextMetrics() {
    const element = this.element;
    const clone = element.cloneNode(true);
    const style = clone.style;

    // Append, don't replace
    style.cssText += ";min-height:0!important;max-height:none!important";
    element.replaceWith(clone);

    const naturalHeight = clone.offsetHeight;

    // Clear to measure empty height. textContent faster than innerHTML
    clone.textContent = "";

    const naturalHeightWithoutText = clone.offsetHeight;
    const textHeight = naturalHeight - naturalHeightWithoutText;

    // Fill element with single non-breaking space to find height of one line
    clone.textContent = "\xa0";

    // Get height of element with only one line of text
    const naturalHeightWithOneLine = clone.offsetHeight;
    const firstLineHeight = naturalHeightWithOneLine - naturalHeightWithoutText;

    // Add line (<br> + nbsp). appendChild() faster than innerHTML
    clone.appendChild(document.createElement("br"));
    clone.appendChild(document.createTextNode("\xa0"));

    const additionalLineHeight = clone.offsetHeight - naturalHeightWithOneLine;
    const lineCount =
      1 + (naturalHeight - naturalHeightWithOneLine) / additionalLineHeight;

    // Restore original content
    clone.replaceWith(element);

    /**
     * @typedef {Object} TextMetrics
     *
     * @property {textHeight}
     * The vertical space required to display the element's current text.
     * This is <em>not</em> necessarily the same as the height of the element.
     * This number may even be greater than the element's height in cases
     * where the text overflows the element's block axis.
     *
     * @property {naturalHeightWithOneLine}
     * The height of the element with only one line of text and without
     * minimum or maximum heights. This information may be helpful when
     * dealing with inline elements (and potentially other scenarios), where
     * the first line of text does not increase the element's height.
     *
     * @property {firstLineHeight}
     * The height that the first line of text adds to the element, i.e., the
     * difference between the height of the element while empty and the height
     * of the element while it contains one line of text. This number may be
     * zero for inline elements because the first line of text does not
     * increase the height of inline elements.

     * @property {additionalLineHeight}
     * The height that each line of text after the first adds to the element.
     *
     * @property {lineCount}
     * The number of lines of text the element contains.
     */
    return {
      textHeight,
      naturalHeightWithOneLine,
      firstLineHeight,
      additionalLineHeight,
      lineCount,
    }
  }

  /**
   * Watch for changes that may affect layout. Respond by reclamping if
   * necessary.
   */
  watch() {
    if (!this._watching) {
      window.addEventListener("resize", this.updateHandler);

      // Minimum required to detect changes to text nodes,
      // and wholesale replacement via innerHTML
      this.observer.observe(this.element, {
        characterData: true,
        subtree: true,
        childList: true,
        attributes: true,
      });

      this._watching = true;
    }

    return this
  }

  /**
   * Stop watching for layout changes.
   *
   * @returns {LineClamp}
   */
  unwatch() {
    this.observer.disconnect();
    window.removeEventListener("resize", this.updateHandler);

    this._watching = false;

    return this
  }

  /**
   * Conduct either soft clamping or hard clamping, according to the value of
   * property {@see LineClamp.useSoftClamp}.
   */
  apply() {
    if (this.element.offsetHeight) {
      const previouslyWatching = this._watching;

      // Ignore internally started mutations, lest we recurse into oblivion
      this.unwatch();

      this.element.textContent = this.originalWords.join("");

      if (this.useSoftClamp) {
        this.softClamp();
      } else {
        this.hardClamp();
      }

      // Resume observation if previously watching
      if (previouslyWatching) {
        this.watch(false);
      }
    }

    return this
  }

  /**
   * Trims text until it fits within constraints
   * (maximum height or number of lines).
   *
   * @see {LineClamp.maxLines}
   * @see {LineClamp.maxHeight}
   */
  hardClamp(skipCheck = true) {
    if (skipCheck || this.shouldClamp()) {
      let currentText;

      findBoundary(
        1,
        this.originalWords.length,
        (val) => {
          currentText = this.originalWords.slice(0, val).join(" ");
          this.element.textContent = currentText;

          return this.shouldClamp()
        },
        (val, min, max) => {
          // Add one more word if not on max
          if (val > min) {
            currentText = this.originalWords.slice(0, max).join(" ");
          }

          // Then trim letters until it fits
          do {
            currentText = currentText.slice(0, -1);
            this.element.textContent = currentText + this.ellipsis;
          } while (this.shouldClamp())

          // Broadcast more specific hardClamp event first
          emit(this, "lineclamp.hardclamp");
          emit(this, "lineclamp.clamp");
        }
      );
    }

    return this
  }

  /**
   * Reduces font size until text fits within the specified height or number of
   * lines. Resorts to using {@see hardClamp()} if text still exceeds clamp
   * parameters.
   */
  softClamp() {
    const style = this.element.style;
    const startSize = window.getComputedStyle(this.element).fontSize;
    style.fontSize = "";

    let done = false;
    let shouldClamp;

    findBoundary(
      this.minFontSize,
      this.maxFontSize,
      (val) => {
        style.fontSize = val + "px";
        shouldClamp = this.shouldClamp();
        return shouldClamp
      },
      (val, min) => {
        if (val > min) {
          style.fontSize = min + "px";
          shouldClamp = this.shouldClamp();
        }
        done = !shouldClamp;
      }
    );

    const changed = style.fontSize !== startSize;

    // Emit specific softClamp event first
    if (changed) {
      emit(this, "lineclamp.softclamp");
    }

    // Don't emit `lineclamp.clamp` event twice.
    if (!done && this.hardClampAsFallback) {
      this.hardClamp(false);
    } else if (changed) {
      // hardClamp emits `lineclamp.clamp` too. Only emit from here if we're
      // not also hard clamping.
      emit(this, "lineclamp.clamp");
    }

    return this
  }

  /**
   * @returns {boolean}
   * Whether height of text or number of lines exceed constraints.
   *
   * @see LineClamp.maxHeight
   * @see LineClamp.maxLines
   */
  shouldClamp() {
    const { lineCount, textHeight } = this.calculateTextMetrics();

    if (undefined !== this.maxHeight && undefined !== this.maxLines) {
      return textHeight > this.maxHeight || lineCount > this.maxLines
    }

    if (undefined !== this.maxHeight) {
      return textHeight > this.maxHeight
    }

    if (undefined !== this.maxLines) {
      return lineCount > this.maxLines
    }

    throw new Error(
      "maxLines or maxHeight must be set before calling shouldClamp()."
    )
  }
}

/**
 * Performs a binary search for the maximum whole number in a contigous range
 * where a given test callback will go from returning true to returning false.
 *
 * Since this uses a binary-search algorithm this is an O(log n) function,
 * where n = max - min.
 *
 * @param {Number} min
 * The lower boundary of the range.
 *
 * @param {Number} max
 * The upper boundary of the range.
 *
 * @param test
 * A callback that receives the current value in the range and returns a truthy or falsy value.
 *
 * @param done
 * A function to perform when complete. Receives the following parameters
 * - cursor
 * - maxPassingValue
 * - minFailingValue
 */
function findBoundary(min, max, test, done) {
  let cursor = max;
  // start halfway through the range
  while (max > min) {
    if (test(cursor)) {
      max = cursor;
    } else {
      min = cursor;
    }

    if (max - min === 1) {
      done(cursor, min, max);
      break
    }

    cursor = Math.round((min + max) / 2);
  }
}

function emit(instance, type) {
  instance.element.dispatchEvent(new CustomEvent(type));
}




/***/ }),

/***/ "./src/story.cson":
/*!************************!*\
  !*** ./src/story.cson ***!
  \************************/
/***/ ((module) => {

module.exports = {"begin":{"text":"[delay 500]Connecting[delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750]\n[sound alarm.wav]<em>Beep</em> [delay 1000]<em>Beep</em> [delay 1000]<em>Beep</em>[delay 1000]\n[sound click.wav]You wake up slowly to the sound of your alarm.\nIt drones on and on until you wake up enough to turn it off.\nWhat do you do?","options":[{"icon":"newspaper","text":"Check the news","next":"checkNews"},{"icon":"arrow-up-from-bracket","text":"Get out of bed","next":"getUp"}]},"checkNews":{"text":"You grab your Augmented Reality glasses from your nightstand and put them on.\nAs you scroll somewhat absentmindedly through the news, one story catches your eye.\nAn image of a flooded town off of the Missisippi River.\nMurky brown water everywhere, past waist height.\nCars, buildings, and trees barely above the surface.\n[image https://images.foxtv.com/static.fox7austin.com/www.fox7austin.com/content/uploads/2020/02/932/524/Flooding-in-MIssissippi-.jpg?ve=1&tl=1]\nNature is a cruel mistress, you think.\nBut then again, we've always had to deal with natural disasters, right?\nWell, thats enough of the news for today. That stuff is always just depressing.","loop":"begin"},"getUp":{"text":"You get up and get ready for the day.\nWhen you come back out of the bathroom, you notice two things:\n1. It's freezing in here\n2. Your room is a mess","options":[{"icon":"fan","text":"Turn off the A/C","next":"turnOff"},{"icon":"folder","text":"Check out the mess","next":"mess","return":"continue"},{"icon":"arrow-up-from-bracket","text":"Leave","next":"leave"}]},"turnOff":{"text":"As you go over to turn off the air conditioning, you take a look out the window. Just as you expected, its cloudy and rainy. The A/C must have been making the temperature even colder than it already was outside.\nYou've had it turned all the way up for the past few days due to the heatwave. You'd been worried that it wasn't going to end: you had never seen a heatwave go for that long or that hot in your life. Clearly it's over now, though, if the temperature is anything to go by.\nYou adjust the A/C's settings in its app on your AR glasses. On to more important things.","loop":"getUp"},"mess":{"text":"You spend so much time at work nowadays that your room is pretty messy. In theory, all of your materials would be contained in the folder on your desk, but you spend so much time reorganizing and adjusting that it all ends up strewn about. You'd probably be better off using virtual documents, but something about feeling the papers in your hand still appeals to you more than just seeing them.\nYou pick up what few papers remain the folder and flick through them. They're the three studies you've based your presentation on. You stare at them for a little, pensively. You'd always wanted to be the one doing the research. That's why you took this job; presenting research seemed like a good way to get some connections, not to mention you needed the money. But at some point you lost track of that goal, and even though you can probably afford to go back to school now, being a researcher feels like someone else's dream. The kind of thing a kid tells themself before they've been exposed to the real world.\nThis job is fine. It pays well. <b>It's fine</b>.\nAnyway, you have three studies in the folder.\nDo you want to review any of them before the big hearing later?","options":[{"icon":"industry","text":"CCS Study","next":"ccs"},{"icon":"fire-flame-simple","text":"Efficiency Study","next":"efficiency"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"lca"},{"icon":"arrow-up-from-bracket","text":"Continue","next":"continue"}]},"ccs":{"text":"This study is about CCS, Carbon Capture and Storage. It's a technology that significantly reduces the carbon emissions of coal and natural gas power plants, by up to 90%. So of course, the fossil fuels corporation you work for is pretty interested in it as a way to keep their business... up to date with the times. This study is an overview of past and current research into CCS technologies, some of which promise to reduce emissions by up to 95% or even more. It also has some low level explanations of how the technology works, such as some diagrams of possible processes.\n[image https://ars.els-cdn.com/content/image/1-s2.0-S0048969720367346-gr1.jpg]\nOf course, the extra work needed to capture and store the carbon dioxide does make the cost of electricity for CCS plants higher, and the technology can never reduce emissions to near zero like renewables. The study does note that, but your supervisor said not to focus on that part so much. After all, how much harm could just a little more carbon dioxide really do?","loop":"mess"},"efficiency":{"text":"This study is an analysis of the cost efficiency of various fossil fuel energy sources compared to renewable sources. The study found that all together, renewables cost about 6-8 cents per kilowatt-hour (kWh), while fossil fuel sources like coal and natural gas cost about 4-5 cents per kWh, depending on the source. Your supervisor was very insistent you highlight that while a 2 or 3 cent difference may not seem like much, if you multiply it over the whole power grid, it starts to add up. And you suppose that makes sense; if the government is going to be subsidizing energy, it might as well get the most out of each dollar.\nThe study, being funded by the company you work for, neglects to mention the cost increases from the use of CCS, which you've been told raise it up to about the same levels as renewables, if not more. But you've been assured that your company is working hard to make CCS cheaper, and once they do that they'll be sure to switch over. So that makes you feel a little better... you think. Until then though the company is still intending to focus on non-CCS plants. You won't be mentioning that either.","loop":"mess"},"lca":{"text":"This study you're not supposed to have. Your supervisor had been making a big fuss about some new lifecycle analysis that would show fossil fuels weren't as bad as everyone thought, but a couple of months later they had just stopped talking about it. So you did a little digging, found the researchers who did the study, and asked them for a copy. \nOnce they sent it to you, you quickly realized why you hadn't heard any more about it. Rather than find evidence that fossil fuels weren't as destructive as people thought, they actually found evidence that certain aspects of the process were more destructive than initially thought.\nYou're not sure why you kept the study. You certainly aren't going to use it at today's hearing, that would be... bad for your job security, to say the least. But something about it keeps nagging at you. Maybe it's the enormity of it all. You know about climate change—it's hard to ignore it with all the protests that have been going on recently—but as far as you can tell, everything seems to be fine. Sure, there's been a lot of floods in some other states recently, and there's definitely been a lot of heatwaves here in Texas, but none of it seems that bad. But seeing the sheer amount of carbon being emitted, together with references to the direct and indirect effects, even in a fossil fuel funded study; it makes you uncomfortable, to say the least.\nYou put the study back in the folder. You shouldn't be distracting yourself with that today. This is possibly the biggest hearing of your career. If you mess this up, it'll mean the majority of fossil fuel subsidies will be diverted to renewable energy, and less money for your employer means less money for you. No mistakes today.","loop":"mess"},"continue":{"text":"You turn your attention to the rest of the room.","loop":"getUp"}}

/***/ }),

/***/ "./src/audio_manager.ts":
/*!******************************!*\
  !*** ./src/audio_manager.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var AudioManager = /** @class */ (function () {
    function AudioManager() {
        this.element = new Audio();
    }
    AudioManager.prototype.play = function (name, volume) {
        if (volume === void 0) { volume = 1; }
        this.element.src = "https://raw.githubusercontent.com/kfish610/text-adventure/main/assets/".concat(name);
        this.element.volume = volume;
        this.element.currentTime = 0;
        this.element.play();
    };
    AudioManager.prototype.stop = function () {
        this.element.pause();
        this.element.currentTime = 0;
    };
    AudioManager.prototype.pause = function () {
        this.element.pause();
    };
    AudioManager.prototype.resume = function () {
        this.element.play();
    };
    AudioManager.prototype.loop = function (shouldLoop) {
        this.element.loop = shouldLoop;
    };
    return AudioManager;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AudioManager);


/***/ }),

/***/ "./src/bubbles.ts":
/*!************************!*\
  !*** ./src/bubbles.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var Bubbles = /** @class */ (function () {
    function Bubbles(canvas) {
        this.bubbles = [];
        this.ctx = canvas.getContext("2d");
        this.resize();
        for (var i = 0; i < 10; i++) {
            this.bubbles.push(new Bubble());
        }
    }
    Bubbles.prototype.update = function (dt) {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        for (var i = 0; i < this.bubbles.length; i++) {
            if (this.bubbles[i].speed > 0 && this.bubbles[i].lifetime <= 0) {
                this.bubbles[i].speed *= -1;
            }
            this.bubbles[i].update(dt);
            if (this.bubbles[i].size <= 0) {
                this.bubbles[i] = new Bubble();
            }
            else {
                this.bubbles[i].draw(this.ctx);
            }
        }
    };
    Bubbles.prototype.resize = function () {
        var dpr = window.devicePixelRatio || 1;
        var rect = this.ctx.canvas.getBoundingClientRect();
        this.ctx.canvas.width = rect.width * dpr;
        this.ctx.canvas.height = rect.height * dpr;
        // this.ctx.scale(dpr, dpr);
        this.ctx.filter = "blur(50px)";
    };
    return Bubbles;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Bubbles);
var Bubble = /** @class */ (function () {
    function Bubble() {
        this.speed = 0.02;
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;
        this.size = 10;
        var v = Math.random();
        var hue = v < 0.5 ? 150 : 230;
        var sat = v < 0.5 ? 50 : 85;
        var light = v < 0.5 ? 25 : 40;
        this.color = "hsla(" + hue + ", " + sat + "%, " + light + "%, 20%)";
        this.lifetime = Math.pow(Math.random(), 5) * 16000 + 2000;
    }
    Bubble.prototype.update = function (dt) {
        this.size += this.speed * dt;
        this.lifetime -= dt;
    };
    Bubble.prototype.draw = function (ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    };
    return Bubble;
}());


/***/ }),

/***/ "./src/buttons.ts":
/*!************************!*\
  !*** ./src/buttons.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var story = __webpack_require__(/*! ./story.cson */ "./src/story.cson");
var Buttons = /** @class */ (function () {
    function Buttons(elem) {
        this.selected = null;
        this.text = null;
        this.enabled = false;
        this.buttons = [];
        this.firstExit = true;
        this.elem = elem;
    }
    Buttons.prototype.enable = function (scene) {
        var _this = this;
        this.enabled = true;
        var options;
        if (story[scene].options == undefined) {
            options = story[story[scene].loop].options;
            var loopedOpt = options.findIndex(function (o) { return o.return != undefined ? o.return == scene : o.next == scene; });
            options.splice(loopedOpt, 1);
        }
        else {
            options = story[scene].options;
        }
        var step = options.length == 4 ? 6 : 12 / options.length;
        var _loop_1 = function (i) {
            var option = options[i];
            var button = document.createElement("button");
            button.className = "overlay";
            button.innerHTML = "> <i class=\"fa-solid fa-" + option.icon + "\"></i> " + option.text;
            if (options.length == 1) {
                button.style.gridColumn = "4 / 10";
            }
            else if (options.length == 4) {
                button.style.gridColumn = i < 2 ? (i * step + 1).toString() + " / " + ((i + 1) * step + 1).toString()
                    : ((i - 2) * step + 1).toString() + " / " + ((i - 1) * step + 1).toString();
            }
            else {
                button.style.gridColumn = (i * step + 1).toString() + " / " + ((i + 1) * step + 1).toString();
            }
            button.onclick = function () {
                if (_this.firstExit && option.icon == "arrow-up-from-bracket") {
                    _this.firstExit = false;
                    document.onvisibilitychange(new Event("visibilitychange"));
                    if (!confirm("Options with this icon (the exiting arrow) leave a scene permanently. \
This means that if there's any other options you haven't tried yet, \
after clicking this option you won't be able to read them without restarting the game. \
Are you sure you want to continue?"))
                        return;
                }
                _this.selected = option.next;
                _this.text = "<i class=\"fa-solid fa-" + option.icon + "\"></i> " + option.text;
                _this.elem.className = "";
                _this.elem.innerHTML = "";
                _this.buttons = [];
                _this.enabled = false;
            };
            this_1.elem.appendChild(button);
            this_1.buttons.push(button);
        };
        var this_1 = this;
        for (var i = 0; i < options.length; i++) {
            _loop_1(i);
        }
        this.elem.className = "out";
    };
    return Buttons;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Buttons);


/***/ }),

/***/ "./src/game.ts":
/*!*********************!*\
  !*** ./src/game.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _terminal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./terminal */ "./src/terminal.ts");
/* harmony import */ var _state_manager__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./state_manager */ "./src/state_manager.ts");
/* harmony import */ var _states__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./states */ "./src/states.ts");



var Game = /** @class */ (function () {
    function Game(terminal) {
        terminal.style.lineHeight = "1.2rem";
        this.term = new _terminal__WEBPACK_IMPORTED_MODULE_0__["default"](terminal);
        this.manager = new _state_manager__WEBPACK_IMPORTED_MODULE_1__["default"](_states__WEBPACK_IMPORTED_MODULE_2__.BeginState);
    }
    Game.prototype.update = function (dt) {
        this.manager.update(dt, this.term);
        this.term.update(dt);
    };
    Game.prototype.resize = function () {
        this.term.resize();
    };
    Game.prototype.keydown = function (e) {
        this.manager.keydown(e);
    };
    return Game;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Game);


/***/ }),

/***/ "./src/state.ts":
/*!**********************!*\
  !*** ./src/state.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var State = /** @class */ (function () {
    function State(manager) {
        this.manager = manager;
    }
    State.prototype.init = function (term) { };
    State.prototype.update = function (dt, term) { };
    State.prototype.keydown = function (e) { };
    return State;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (State);


/***/ }),

/***/ "./src/state_manager.ts":
/*!******************************!*\
  !*** ./src/state_manager.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var StateManager = /** @class */ (function () {
    function StateManager(s) {
        this.needsInit = true;
        this.state = new s(this);
    }
    StateManager.prototype.setState = function (s) {
        this.state = new s(this);
        this.needsInit = true;
    };
    StateManager.prototype.update = function (dt, term) {
        if (this.needsInit) {
            this.state.init(term);
            this.needsInit = false;
        }
        this.state.update(dt, term);
    };
    StateManager.prototype.keydown = function (e) {
        this.state.keydown(e);
    };
    return StateManager;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StateManager);


/***/ }),

/***/ "./src/states.ts":
/*!***********************!*\
  !*** ./src/states.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BeginState": () => (/* binding */ BeginState),
/* harmony export */   "PlayingState": () => (/* binding */ PlayingState),
/* harmony export */   "WipeState": () => (/* binding */ WipeState)
/* harmony export */ });
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./state */ "./src/state.ts");
/* harmony import */ var _buttons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./buttons */ "./src/buttons.ts");
/* harmony import */ var _audio_manager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./audio_manager */ "./src/audio_manager.ts");
var __extends = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();



var story = __webpack_require__(/*! ./story.cson */ "./src/story.cson");
var BeginState = /** @class */ (function (_super) {
    __extends(BeginState, _super);
    function BeginState() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BeginState.prototype.init = function (term) {
        term.writeLine("Press any key to begin...");
    };
    BeginState.prototype.keydown = function (e) {
        this.manager.setState(WipeState);
    };
    return BeginState;
}(_state__WEBPACK_IMPORTED_MODULE_0__["default"]));

var WipeState = /** @class */ (function (_super) {
    __extends(WipeState, _super);
    function WipeState() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.wipeTimer = 0;
        _this.wipeTicks = 0;
        return _this;
    }
    WipeState.prototype.init = function (term) {
        term.element.style.overflow = "hidden";
        term.element.style.scrollSnapType = "unset";
        term.element.style.paddingLeft = "1.6rem";
        term.element.style.paddingRight = "1.6rem";
        term.element.style.textIndent = "unset";
        this.wipeLines = term.maxLines;
    };
    WipeState.prototype.update = function (dt, term) {
        if (this.wipeTimer > 50) {
            if (this.wipeTicks > 5) {
                this.wipeLines--;
            }
            else {
                this.wipeTicks++;
            }
            term.fillRandom(this.wipeLines);
            this.wipeTimer = 0;
        }
        if (this.wipeLines >= 0) {
            this.wipeTimer += dt;
        }
        else {
            term.reset();
            term.element.style.overflow = "";
            term.element.style.scrollSnapType = "";
            term.element.style.lineHeight = "";
            term.element.style.paddingLeft = "";
            term.element.style.paddingRight = "";
            term.element.style.textIndent = "";
            this.manager.setState(PlayingState);
        }
    };
    return WipeState;
}(_state__WEBPACK_IMPORTED_MODULE_0__["default"]));

var PlayingState = /** @class */ (function (_super) {
    __extends(PlayingState, _super);
    function PlayingState() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.scene = "begin";
        _this.remainingText = "";
        _this.delay = 0;
        _this.textDecoded = -1;
        _this.textPosition = -1;
        _this.buttons = new _buttons__WEBPACK_IMPORTED_MODULE_1__["default"](document.getElementById("buttons"));
        _this.audio = new _audio_manager__WEBPACK_IMPORTED_MODULE_2__["default"]();
        _this.background = new _audio_manager__WEBPACK_IMPORTED_MODULE_2__["default"]();
        _this.currSound = "click.wav";
        _this.lock = false;
        return _this;
    }
    PlayingState.prototype.init = function (term) {
        var _this = this;
        this.audio.loop(false);
        this.remainingText = story[this.scene].text;
        document.getElementById('image-close').onclick = function (e) {
            _this.lock = false;
            document.getElementById('image-container').className = "";
        };
    };
    PlayingState.prototype.update = function (dt, term) {
        if (this.lock)
            return;
        if (this.buttons.enabled)
            return;
        if (this.buttons.selected != null) {
            term.writeLine(this.buttons.text);
            this.scene = this.buttons.selected;
            this.buttons.selected = null;
            this.remainingText = story[this.scene].text;
        }
        if (this.remainingText.length == 0) {
            this.audio.stop();
            term.break();
            this.buttons.enable(this.scene);
            return;
        }
        if (this.delay <= 0) {
            var _a = this.indexOfMany(this.remainingText, "<[ \n"), pos = _a[0], index = _a[1];
            if (pos == 0) {
                this.handleSpecial(index, term);
            }
            else {
                this.writeText(pos, term, dt);
            }
        }
        else {
            this.delay -= dt;
        }
    };
    PlayingState.prototype.indexOfMany = function (str, chars) {
        for (var i = 0; i < str.length; i++) {
            var c = chars.indexOf(str[i]);
            if (c != -1) {
                return [i, c];
            }
        }
        return [-1, -1];
    };
    PlayingState.prototype.writeText = function (len, term, dt) {
        if (len == -1) {
            len = this.remainingText.length;
        }
        if (this.textDecoded == -1) {
            this.audio.play(this.currSound);
            this.textDecoded = 0;
            this.textPosition = term.getPosition();
        }
        var text = this.remainingText.slice(0, this.textDecoded) +
            term.randomCharacters(len - this.textDecoded);
        term.write(text, this.textPosition);
        if (this.textDecoded == len) {
            this.remainingText = this.remainingText.slice(len);
            this.textDecoded = -1;
            return;
        }
        this.textDecoded++;
    };
    PlayingState.prototype.handleSpecial = function (index, term) {
        switch (index) {
            case 0: // <
                var endTagPos = this.remainingText.indexOf(">");
                term.write(this.remainingText.slice(0, endTagPos + 1));
                this.remainingText = this.remainingText.slice(endTagPos + 1);
                break;
            case 1: // [
                var endCommandPos = this.remainingText.indexOf("]");
                var command_1 = this.remainingText.slice(1, endCommandPos);
                var spacePos_1 = command_1.indexOf(" ");
                switch (spacePos_1 == -1 ? command_1 : command_1.slice(0, spacePos_1)) {
                    case "delay":
                        this.delay = parseInt(command_1.slice(spacePos_1 + 1));
                        break;
                    case "normal":
                        this.audio.play(this.currSound);
                        term.write(command_1.slice(spacePos_1 + 1));
                        break;
                    case "sep":
                        break;
                    case "sound":
                        this.currSound = command_1.slice(spacePos_1 + 1);
                        break;
                    case "background":
                        if (spacePos_1 == -1) {
                            this.background.stop();
                        }
                        else {
                            this.background.play(command_1.slice(spacePos_1 + 1), 0.1);
                        }
                        break;
                    case "image":
                        term.write("<a onclick='imgClick()'>Click to view image</a>");
                        this.lock = true;
                        window.imgClick = function () {
                            document.getElementById('image').src = command_1.slice(spacePos_1 + 1);
                            document.getElementById('image-container').className = "show";
                        };
                }
                this.remainingText = this.remainingText.slice(endCommandPos + 1);
                break;
            case 2: // <space>
                term.write(" ");
                this.remainingText = this.remainingText.slice(1);
                break;
            case 3: // \n
                term.writeLine("");
                this.delay = 500;
                this.remainingText = this.remainingText.slice(1);
                break;
            default:
                throw new RangeError("Invalid char index " + index);
        }
    };
    return PlayingState;
}(_state__WEBPACK_IMPORTED_MODULE_0__["default"]));



/***/ }),

/***/ "./src/terminal.ts":
/*!*************************!*\
  !*** ./src/terminal.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _tvanc_lineclamp__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tvanc/lineclamp */ "./node_modules/@tvanc/lineclamp/dist/esm.js");

var CURSOR_BLINK_INTERVAL = 500;
var Terminal = /** @class */ (function () {
    function Terminal(elem) {
        this.content = "<div>> ";
        this.cursorVisible = true;
        this.cursorEnabled = true;
        this.cursorTicks = 0;
        this.element = elem;
        this.fontSize = parseInt(getComputedStyle(this.element).fontSize.slice(0, -2));
        this.width = parseInt(getComputedStyle(this.element).width.slice(0, -2));
        this.height = parseInt(getComputedStyle(this.element).height.slice(0, -2));
        this.element.style.position = "absolute";
        var clamp = new _tvanc_lineclamp__WEBPACK_IMPORTED_MODULE_0__["default"](this.element);
        this.lineHeight = clamp.calculateTextMetrics().additionalLineHeight;
        this.element.style.position = "";
        this.maxLines = Math.floor(this.height / this.lineHeight);
        this.charsPerLine = Math.floor(this.width / (this.fontSize * 0.6));
    }
    Terminal.prototype.resize = function () {
        this.width = parseInt(getComputedStyle(this.element).width.slice(0, -2));
        this.height = parseInt(getComputedStyle(this.element).height.slice(0, -2));
        this.maxLines = Math.floor(this.height / this.lineHeight);
        this.charsPerLine = Math.floor(this.width / (this.fontSize * 0.6));
    };
    Terminal.prototype.update = function (dt) {
        if (this.cursorEnabled) {
            if (this.cursorTicks >= CURSOR_BLINK_INTERVAL) {
                this.cursorTicks = 0;
                this.flipCursor();
            }
            else {
                this.cursorTicks += dt;
            }
        }
    };
    Terminal.prototype.show = function () {
        this.element.innerHTML = this.content;
    };
    Terminal.prototype.clear = function () {
        this.setCursorEnabled(false);
        this.content = "";
    };
    Terminal.prototype.getPosition = function () {
        return this.content.length - (this.cursorVisible ? 0 : 1);
    };
    Terminal.prototype.put = function (text, pos) {
        this.setCursorEnabled(false);
        if (pos != undefined &&
            pos >= 0 &&
            pos <= this.content.length - text.length) {
            this.content =
                this.content.slice(0, pos) +
                    text +
                    this.content.slice(pos + text.length);
        }
        else {
            this.content += text;
        }
    };
    Terminal.prototype.putLine = function (text) {
        this.setCursorEnabled(false);
        this.content += text + "</div><div>> ";
    };
    Terminal.prototype.reset = function () {
        this.clear();
        this.put("> ");
        this.show();
        this.setCursorEnabled(true);
    };
    Terminal.prototype.write = function (text, pos) {
        this.put(text, pos);
        this.show();
        this.setCursorEnabled(true);
    };
    Terminal.prototype.writeLine = function (text) {
        this.putLine(text);
        this.show();
        this.setCursorEnabled(true);
    };
    Terminal.prototype.break = function () {
        this.setCursorEnabled(false);
        this.content += "</div><br/><div>> ";
        this.show();
        this.setCursorEnabled(true);
    };
    Terminal.prototype.randomCharacters = function (count) {
        var values = new Uint8Array(count);
        window.crypto.getRandomValues(values);
        var mappedValues = values.map(function (x) {
            var adj = x % 36;
            return adj < 26 ? adj + 65 : adj - 26 + 48;
        });
        return String.fromCharCode.apply(null, mappedValues);
    };
    Terminal.prototype.fillRandom = function (lines) {
        this.clear();
        for (var i = 0; i < lines; i++) {
            this.put(this.randomCharacters(this.charsPerLine));
            this.put("<br />");
        }
        this.put(this.randomCharacters(this.charsPerLine));
        this.show();
    };
    Terminal.prototype.setCursorEnabled = function (value) {
        this.cursorEnabled = value;
        // if the cursor needed to be turned off, fix it
        if (!this.cursorEnabled && !this.cursorVisible) {
            this.content = this.content.slice(0, -1);
            this.show();
            this.cursorVisible = true;
        }
    };
    Terminal.prototype.flipCursor = function () {
        if (this.cursorEnabled) {
            if (this.cursorVisible) {
                this.content += "_";
            }
            else {
                this.content = this.content.slice(0, -1);
            }
            this.cursorVisible = !this.cursorVisible;
            this.show();
        }
    };
    return Terminal;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Terminal);


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _bubbles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./bubbles */ "./src/bubbles.ts");
/* harmony import */ var _game__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./game */ "./src/game.ts");


var game;
var bubbles;
var lastTime = null;
window.onload = function () {
    bubbles = new _bubbles__WEBPACK_IMPORTED_MODULE_0__["default"](document.getElementById("background"));
    game = new _game__WEBPACK_IMPORTED_MODULE_1__["default"](document.getElementById("terminal"));
    window.requestAnimationFrame(update);
};
window.onresize = function () {
    bubbles.resize();
    game.resize();
};
document.onkeydown = function (e) {
    game.keydown(e);
};
document.onvisibilitychange = function () {
    if (document.visibilityState == "visible") {
        lastTime = null;
    }
};
function update(time) {
    // This really shouldn't be needed if browsers are following convention,
    // but better safe than sorry
    if (document.hidden) {
        window.requestAnimationFrame(update);
        return;
    }
    if (lastTime == null) {
        lastTime = -1;
        window.requestAnimationFrame(update);
        return;
    }
    else if (lastTime != -1) {
        var dt = time - lastTime;
        bubbles.update(dt);
        game.update(dt);
    }
    lastTime = time;
    window.requestAnimationFrame(update);
}

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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SSxDQUFDO0lBQ2hCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9ub2RlX21vZHVsZXMvQHR2YW5jL2xpbmVjbGFtcC9kaXN0L2VzbS5qcyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdG9yeS5jc29uIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2F1ZGlvX21hbmFnZXIudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnViYmxlcy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9idXR0b25zLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2dhbWUudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGUudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGVfbWFuYWdlci50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdGF0ZXMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvdGVybWluYWwudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlZHVjZXMgZm9udCBzaXplIG9yIHRyaW1zIHRleHQgdG8gbWFrZSBpdCBmaXQgd2l0aGluIHNwZWNpZmllZCBib3VuZHMuXG4gKlxuICogU3VwcG9ydHMgY2xhbXBpbmcgYnkgbnVtYmVyIG9mIGxpbmVzIG9yIHRleHQgaGVpZ2h0LlxuICpcbiAqIEtub3duIGxpbWl0YXRpb25zOlxuICogMS4gQ2hhcmFjdGVycyB0aGF0IGRpc3RvcnQgbGluZSBoZWlnaHRzIChlbW9qaXMsIHphbGdvKSBtYXkgY2F1c2VcbiAqIHVuZXhwZWN0ZWQgcmVzdWx0cy5cbiAqIDIuIENhbGxpbmcge0BzZWUgaGFyZENsYW1wKCl9IHdpcGVzIGNoaWxkIGVsZW1lbnRzLiBGdXR1cmUgdXBkYXRlcyBtYXkgYWxsb3dcbiAqIGlubGluZSBjaGlsZCBlbGVtZW50cyB0byBiZSBwcmVzZXJ2ZWQuXG4gKlxuICogQHRvZG8gU3BsaXQgdGV4dCBtZXRyaWNzIGludG8gb3duIGxpYnJhcnlcbiAqIEB0b2RvIFRlc3Qgbm9uLUxUUiB0ZXh0XG4gKi9cbmNsYXNzIExpbmVDbGFtcCB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtZW50XG4gICAqIFRoZSBlbGVtZW50IHRvIGNsYW1wLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIE9wdGlvbnMgdG8gZ292ZXJuIGNsYW1waW5nIGJlaGF2aW9yLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4TGluZXNdXG4gICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBsaW5lcyB0byBhbGxvdy4gRGVmYXVsdHMgdG8gMS5cbiAgICogVG8gc2V0IGEgbWF4aW11bSBoZWlnaHQgaW5zdGVhZCwgdXNlIHtAc2VlIG9wdGlvbnMubWF4SGVpZ2h0fVxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4SGVpZ2h0XVxuICAgKiBUaGUgbWF4aW11bSBoZWlnaHQgKGluIHBpeGVscykgb2YgdGV4dCBpbiBhbiBlbGVtZW50LlxuICAgKiBUaGlzIG9wdGlvbiBpcyB1bmRlZmluZWQgYnkgZGVmYXVsdC4gT25jZSBzZXQsIGl0IHRha2VzIHByZWNlZGVuY2Ugb3ZlclxuICAgKiB7QHNlZSBvcHRpb25zLm1heExpbmVzfS4gTm90ZSB0aGF0IHRoaXMgYXBwbGllcyB0byB0aGUgaGVpZ2h0IG9mIHRoZSB0ZXh0LCBub3RcbiAgICogdGhlIGVsZW1lbnQgaXRzZWxmLiBSZXN0cmljdGluZyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IGNhbiBiZSBhY2hpZXZlZFxuICAgKiB3aXRoIENTUyA8Y29kZT5tYXgtaGVpZ2h0PC9jb2RlPi5cbiAgICpcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy51c2VTb2Z0Q2xhbXBdXG4gICAqIElmIHRydWUsIHJlZHVjZSBmb250IHNpemUgKHNvZnQgY2xhbXApIHRvIGF0IGxlYXN0IHtAc2VlIG9wdGlvbnMubWluRm9udFNpemV9XG4gICAqIGJlZm9yZSByZXNvcnRpbmcgdG8gdHJpbW1pbmcgdGV4dC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaGFyZENsYW1wQXNGYWxsYmFja11cbiAgICogSWYgdHJ1ZSwgcmVzb3J0IHRvIGhhcmQgY2xhbXBpbmcgaWYgc29mdCBjbGFtcGluZyByZWFjaGVzIHRoZSBtaW5pbXVtIGZvbnQgc2l6ZVxuICAgKiBhbmQgc3RpbGwgZG9lc24ndCBmaXQgd2l0aGluIHRoZSBtYXggaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcy5cbiAgICogRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmVsbGlwc2lzXVxuICAgKiBUaGUgY2hhcmFjdGVyIHdpdGggd2hpY2ggdG8gcmVwcmVzZW50IGNsaXBwZWQgdHJhaWxpbmcgdGV4dC5cbiAgICogVGhpcyBvcHRpb24gdGFrZXMgZWZmZWN0IHdoZW4gXCJoYXJkXCIgY2xhbXBpbmcgaXMgdXNlZC5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1pbkZvbnRTaXplXVxuICAgKiBUaGUgbG93ZXN0IGZvbnQgc2l6ZSwgaW4gcGl4ZWxzLCB0byB0cnkgYmVmb3JlIHJlc29ydGluZyB0byByZW1vdmluZ1xuICAgKiB0cmFpbGluZyB0ZXh0IChoYXJkIGNsYW1waW5nKS4gRGVmYXVsdHMgdG8gMS5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEZvbnRTaXplXVxuICAgKiBUaGUgbWF4aW11bSBmb250IHNpemUgaW4gcGl4ZWxzLiBXZSdsbCBzdGFydCB3aXRoIHRoaXMgZm9udCBzaXplIHRoZW5cbiAgICogcmVkdWNlIHVudGlsIHRleHQgZml0cyBjb25zdHJhaW50cywgb3IgZm9udCBzaXplIGlzIGVxdWFsIHRvXG4gICAqIHtAc2VlIG9wdGlvbnMubWluRm9udFNpemV9LiBEZWZhdWx0cyB0byB0aGUgZWxlbWVudCdzIGluaXRpYWwgY29tcHV0ZWQgZm9udCBzaXplLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgZWxlbWVudCxcbiAgICB7XG4gICAgICBtYXhMaW5lcyA9IHVuZGVmaW5lZCxcbiAgICAgIG1heEhlaWdodCA9IHVuZGVmaW5lZCxcbiAgICAgIHVzZVNvZnRDbGFtcCA9IGZhbHNlLFxuICAgICAgaGFyZENsYW1wQXNGYWxsYmFjayA9IHRydWUsXG4gICAgICBtaW5Gb250U2l6ZSA9IDEsXG4gICAgICBtYXhGb250U2l6ZSA9IHVuZGVmaW5lZCxcbiAgICAgIGVsbGlwc2lzID0gXCLigKZcIixcbiAgICB9ID0ge31cbiAgKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib3JpZ2luYWxXb3Jkc1wiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogZWxlbWVudC50ZXh0Q29udGVudC5tYXRjaCgvXFxTK1xccyovZykgfHwgW10sXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJ1cGRhdGVIYW5kbGVyXCIsIHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmFwcGx5KCksXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJvYnNlcnZlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogbmV3IE11dGF0aW9uT2JzZXJ2ZXIodGhpcy51cGRhdGVIYW5kbGVyKSxcbiAgICB9KTtcblxuICAgIGlmICh1bmRlZmluZWQgPT09IG1heEZvbnRTaXplKSB7XG4gICAgICBtYXhGb250U2l6ZSA9IHBhcnNlSW50KHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpLmZvbnRTaXplLCAxMCk7XG4gICAgfVxuXG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgICB0aGlzLm1heExpbmVzID0gbWF4TGluZXM7XG4gICAgdGhpcy5tYXhIZWlnaHQgPSBtYXhIZWlnaHQ7XG4gICAgdGhpcy51c2VTb2Z0Q2xhbXAgPSB1c2VTb2Z0Q2xhbXA7XG4gICAgdGhpcy5oYXJkQ2xhbXBBc0ZhbGxiYWNrID0gaGFyZENsYW1wQXNGYWxsYmFjaztcbiAgICB0aGlzLm1pbkZvbnRTaXplID0gbWluRm9udFNpemU7XG4gICAgdGhpcy5tYXhGb250U2l6ZSA9IG1heEZvbnRTaXplO1xuICAgIHRoaXMuZWxsaXBzaXMgPSBlbGxpcHNpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBHYXRoZXIgbWV0cmljcyBhYm91dCB0aGUgbGF5b3V0IG9mIHRoZSBlbGVtZW50J3MgdGV4dC5cbiAgICogVGhpcyBpcyBhIHNvbWV3aGF0IGV4cGVuc2l2ZSBvcGVyYXRpb24gLSBjYWxsIHdpdGggY2FyZS5cbiAgICpcbiAgICogQHJldHVybnMge1RleHRNZXRyaWNzfVxuICAgKiBMYXlvdXQgbWV0cmljcyBmb3IgdGhlIGNsYW1wZWQgZWxlbWVudCdzIHRleHQuXG4gICAqL1xuICBjYWxjdWxhdGVUZXh0TWV0cmljcygpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50O1xuICAgIGNvbnN0IGNsb25lID0gZWxlbWVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgY29uc3Qgc3R5bGUgPSBjbG9uZS5zdHlsZTtcblxuICAgIC8vIEFwcGVuZCwgZG9uJ3QgcmVwbGFjZVxuICAgIHN0eWxlLmNzc1RleHQgKz0gXCI7bWluLWhlaWdodDowIWltcG9ydGFudDttYXgtaGVpZ2h0Om5vbmUhaW1wb3J0YW50XCI7XG4gICAgZWxlbWVudC5yZXBsYWNlV2l0aChjbG9uZSk7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0ID0gY2xvbmUub2Zmc2V0SGVpZ2h0O1xuXG4gICAgLy8gQ2xlYXIgdG8gbWVhc3VyZSBlbXB0eSBoZWlnaHQuIHRleHRDb250ZW50IGZhc3RlciB0aGFuIGlubmVySFRNTFxuICAgIGNsb25lLnRleHRDb250ZW50ID0gXCJcIjtcblxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dCA9IGNsb25lLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCB0ZXh0SGVpZ2h0ID0gbmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dDtcblxuICAgIC8vIEZpbGwgZWxlbWVudCB3aXRoIHNpbmdsZSBub24tYnJlYWtpbmcgc3BhY2UgdG8gZmluZCBoZWlnaHQgb2Ygb25lIGxpbmVcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXFx4YTBcIjtcblxuICAgIC8vIEdldCBoZWlnaHQgb2YgZWxlbWVudCB3aXRoIG9ubHkgb25lIGxpbmUgb2YgdGV4dFxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSA9IGNsb25lLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCBmaXJzdExpbmVIZWlnaHQgPSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBBZGQgbGluZSAoPGJyPiArIG5ic3ApLiBhcHBlbmRDaGlsZCgpIGZhc3RlciB0aGFuIGlubmVySFRNTFxuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJiclwiKSk7XG4gICAgY2xvbmUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcXHhhMFwiKSk7XG5cbiAgICBjb25zdCBhZGRpdGlvbmFsTGluZUhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZTtcbiAgICBjb25zdCBsaW5lQ291bnQgPVxuICAgICAgMSArIChuYXR1cmFsSGVpZ2h0IC0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lKSAvIGFkZGl0aW9uYWxMaW5lSGVpZ2h0O1xuXG4gICAgLy8gUmVzdG9yZSBvcmlnaW5hbCBjb250ZW50XG4gICAgY2xvbmUucmVwbGFjZVdpdGgoZWxlbWVudCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZWRlZiB7T2JqZWN0fSBUZXh0TWV0cmljc1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHt0ZXh0SGVpZ2h0fVxuICAgICAqIFRoZSB2ZXJ0aWNhbCBzcGFjZSByZXF1aXJlZCB0byBkaXNwbGF5IHRoZSBlbGVtZW50J3MgY3VycmVudCB0ZXh0LlxuICAgICAqIFRoaXMgaXMgPGVtPm5vdDwvZW0+IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIGFzIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQuXG4gICAgICogVGhpcyBudW1iZXIgbWF5IGV2ZW4gYmUgZ3JlYXRlciB0aGFuIHRoZSBlbGVtZW50J3MgaGVpZ2h0IGluIGNhc2VzXG4gICAgICogd2hlcmUgdGhlIHRleHQgb3ZlcmZsb3dzIHRoZSBlbGVtZW50J3MgYmxvY2sgYXhpcy5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7bmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lfVxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHQgYW5kIHdpdGhvdXRcbiAgICAgKiBtaW5pbXVtIG9yIG1heGltdW0gaGVpZ2h0cy4gVGhpcyBpbmZvcm1hdGlvbiBtYXkgYmUgaGVscGZ1bCB3aGVuXG4gICAgICogZGVhbGluZyB3aXRoIGlubGluZSBlbGVtZW50cyAoYW5kIHBvdGVudGlhbGx5IG90aGVyIHNjZW5hcmlvcyksIHdoZXJlXG4gICAgICogdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBkb2VzIG5vdCBpbmNyZWFzZSB0aGUgZWxlbWVudCdzIGhlaWdodC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7Zmlyc3RMaW5lSGVpZ2h0fVxuICAgICAqIFRoZSBoZWlnaHQgdGhhdCB0aGUgZmlyc3QgbGluZSBvZiB0ZXh0IGFkZHMgdG8gdGhlIGVsZW1lbnQsIGkuZS4sIHRoZVxuICAgICAqIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdoaWxlIGVtcHR5IGFuZCB0aGUgaGVpZ2h0XG4gICAgICogb2YgdGhlIGVsZW1lbnQgd2hpbGUgaXQgY29udGFpbnMgb25lIGxpbmUgb2YgdGV4dC4gVGhpcyBudW1iZXIgbWF5IGJlXG4gICAgICogemVybyBmb3IgaW5saW5lIGVsZW1lbnRzIGJlY2F1c2UgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBkb2VzIG5vdFxuICAgICAqIGluY3JlYXNlIHRoZSBoZWlnaHQgb2YgaW5saW5lIGVsZW1lbnRzLlxuXG4gICAgICogQHByb3BlcnR5IHthZGRpdGlvbmFsTGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgZWFjaCBsaW5lIG9mIHRleHQgYWZ0ZXIgdGhlIGZpcnN0IGFkZHMgdG8gdGhlIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2xpbmVDb3VudH1cbiAgICAgKiBUaGUgbnVtYmVyIG9mIGxpbmVzIG9mIHRleHQgdGhlIGVsZW1lbnQgY29udGFpbnMuXG4gICAgICovXG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHRIZWlnaHQsXG4gICAgICBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUsXG4gICAgICBmaXJzdExpbmVIZWlnaHQsXG4gICAgICBhZGRpdGlvbmFsTGluZUhlaWdodCxcbiAgICAgIGxpbmVDb3VudCxcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIGNoYW5nZXMgdGhhdCBtYXkgYWZmZWN0IGxheW91dC4gUmVzcG9uZCBieSByZWNsYW1waW5nIGlmXG4gICAqIG5lY2Vzc2FyeS5cbiAgICovXG4gIHdhdGNoKCkge1xuICAgIGlmICghdGhpcy5fd2F0Y2hpbmcpIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMudXBkYXRlSGFuZGxlcik7XG5cbiAgICAgIC8vIE1pbmltdW0gcmVxdWlyZWQgdG8gZGV0ZWN0IGNoYW5nZXMgdG8gdGV4dCBub2RlcyxcbiAgICAgIC8vIGFuZCB3aG9sZXNhbGUgcmVwbGFjZW1lbnQgdmlhIGlubmVySFRNTFxuICAgICAgdGhpcy5vYnNlcnZlci5vYnNlcnZlKHRoaXMuZWxlbWVudCwge1xuICAgICAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlLFxuICAgICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fd2F0Y2hpbmcgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogU3RvcCB3YXRjaGluZyBmb3IgbGF5b3V0IGNoYW5nZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHtMaW5lQ2xhbXB9XG4gICAqL1xuICB1bndhdGNoKCkge1xuICAgIHRoaXMub2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMudXBkYXRlSGFuZGxlcik7XG5cbiAgICB0aGlzLl93YXRjaGluZyA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25kdWN0IGVpdGhlciBzb2Z0IGNsYW1waW5nIG9yIGhhcmQgY2xhbXBpbmcsIGFjY29yZGluZyB0byB0aGUgdmFsdWUgb2ZcbiAgICogcHJvcGVydHkge0BzZWUgTGluZUNsYW1wLnVzZVNvZnRDbGFtcH0uXG4gICAqL1xuICBhcHBseSgpIHtcbiAgICBpZiAodGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCkge1xuICAgICAgY29uc3QgcHJldmlvdXNseVdhdGNoaW5nID0gdGhpcy5fd2F0Y2hpbmc7XG5cbiAgICAgIC8vIElnbm9yZSBpbnRlcm5hbGx5IHN0YXJ0ZWQgbXV0YXRpb25zLCBsZXN0IHdlIHJlY3Vyc2UgaW50byBvYmxpdmlvblxuICAgICAgdGhpcy51bndhdGNoKCk7XG5cbiAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5qb2luKFwiXCIpO1xuXG4gICAgICBpZiAodGhpcy51c2VTb2Z0Q2xhbXApIHtcbiAgICAgICAgdGhpcy5zb2Z0Q2xhbXAoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaGFyZENsYW1wKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc3VtZSBvYnNlcnZhdGlvbiBpZiBwcmV2aW91c2x5IHdhdGNoaW5nXG4gICAgICBpZiAocHJldmlvdXNseVdhdGNoaW5nKSB7XG4gICAgICAgIHRoaXMud2F0Y2goZmFsc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogVHJpbXMgdGV4dCB1bnRpbCBpdCBmaXRzIHdpdGhpbiBjb25zdHJhaW50c1xuICAgKiAobWF4aW11bSBoZWlnaHQgb3IgbnVtYmVyIG9mIGxpbmVzKS5cbiAgICpcbiAgICogQHNlZSB7TGluZUNsYW1wLm1heExpbmVzfVxuICAgKiBAc2VlIHtMaW5lQ2xhbXAubWF4SGVpZ2h0fVxuICAgKi9cbiAgaGFyZENsYW1wKHNraXBDaGVjayA9IHRydWUpIHtcbiAgICBpZiAoc2tpcENoZWNrIHx8IHRoaXMuc2hvdWxkQ2xhbXAoKSkge1xuICAgICAgbGV0IGN1cnJlbnRUZXh0O1xuXG4gICAgICBmaW5kQm91bmRhcnkoXG4gICAgICAgIDEsXG4gICAgICAgIHRoaXMub3JpZ2luYWxXb3Jkcy5sZW5ndGgsXG4gICAgICAgICh2YWwpID0+IHtcbiAgICAgICAgICBjdXJyZW50VGV4dCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5zbGljZSgwLCB2YWwpLmpvaW4oXCIgXCIpO1xuICAgICAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IGN1cnJlbnRUZXh0O1xuXG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2hvdWxkQ2xhbXAoKVxuICAgICAgICB9LFxuICAgICAgICAodmFsLCBtaW4sIG1heCkgPT4ge1xuICAgICAgICAgIC8vIEFkZCBvbmUgbW9yZSB3b3JkIGlmIG5vdCBvbiBtYXhcbiAgICAgICAgICBpZiAodmFsID4gbWluKSB7XG4gICAgICAgICAgICBjdXJyZW50VGV4dCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5zbGljZSgwLCBtYXgpLmpvaW4oXCIgXCIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRoZW4gdHJpbSBsZXR0ZXJzIHVudGlsIGl0IGZpdHNcbiAgICAgICAgICBkbyB7XG4gICAgICAgICAgICBjdXJyZW50VGV4dCA9IGN1cnJlbnRUZXh0LnNsaWNlKDAsIC0xKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IGN1cnJlbnRUZXh0ICsgdGhpcy5lbGxpcHNpcztcbiAgICAgICAgICB9IHdoaWxlICh0aGlzLnNob3VsZENsYW1wKCkpXG5cbiAgICAgICAgICAvLyBCcm9hZGNhc3QgbW9yZSBzcGVjaWZpYyBoYXJkQ2xhbXAgZXZlbnQgZmlyc3RcbiAgICAgICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmhhcmRjbGFtcFwiKTtcbiAgICAgICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmNsYW1wXCIpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogUmVkdWNlcyBmb250IHNpemUgdW50aWwgdGV4dCBmaXRzIHdpdGhpbiB0aGUgc3BlY2lmaWVkIGhlaWdodCBvciBudW1iZXIgb2ZcbiAgICogbGluZXMuIFJlc29ydHMgdG8gdXNpbmcge0BzZWUgaGFyZENsYW1wKCl9IGlmIHRleHQgc3RpbGwgZXhjZWVkcyBjbGFtcFxuICAgKiBwYXJhbWV0ZXJzLlxuICAgKi9cbiAgc29mdENsYW1wKCkge1xuICAgIGNvbnN0IHN0eWxlID0gdGhpcy5lbGVtZW50LnN0eWxlO1xuICAgIGNvbnN0IHN0YXJ0U2l6ZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemU7XG4gICAgc3R5bGUuZm9udFNpemUgPSBcIlwiO1xuXG4gICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICBsZXQgc2hvdWxkQ2xhbXA7XG5cbiAgICBmaW5kQm91bmRhcnkoXG4gICAgICB0aGlzLm1pbkZvbnRTaXplLFxuICAgICAgdGhpcy5tYXhGb250U2l6ZSxcbiAgICAgICh2YWwpID0+IHtcbiAgICAgICAgc3R5bGUuZm9udFNpemUgPSB2YWwgKyBcInB4XCI7XG4gICAgICAgIHNob3VsZENsYW1wID0gdGhpcy5zaG91bGRDbGFtcCgpO1xuICAgICAgICByZXR1cm4gc2hvdWxkQ2xhbXBcbiAgICAgIH0sXG4gICAgICAodmFsLCBtaW4pID0+IHtcbiAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgIHN0eWxlLmZvbnRTaXplID0gbWluICsgXCJweFwiO1xuICAgICAgICAgIHNob3VsZENsYW1wID0gdGhpcy5zaG91bGRDbGFtcCgpO1xuICAgICAgICB9XG4gICAgICAgIGRvbmUgPSAhc2hvdWxkQ2xhbXA7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGNoYW5nZWQgPSBzdHlsZS5mb250U2l6ZSAhPT0gc3RhcnRTaXplO1xuXG4gICAgLy8gRW1pdCBzcGVjaWZpYyBzb2Z0Q2xhbXAgZXZlbnQgZmlyc3RcbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5zb2Z0Y2xhbXBcIik7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3QgZW1pdCBgbGluZWNsYW1wLmNsYW1wYCBldmVudCB0d2ljZS5cbiAgICBpZiAoIWRvbmUgJiYgdGhpcy5oYXJkQ2xhbXBBc0ZhbGxiYWNrKSB7XG4gICAgICB0aGlzLmhhcmRDbGFtcChmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChjaGFuZ2VkKSB7XG4gICAgICAvLyBoYXJkQ2xhbXAgZW1pdHMgYGxpbmVjbGFtcC5jbGFtcGAgdG9vLiBPbmx5IGVtaXQgZnJvbSBoZXJlIGlmIHdlJ3JlXG4gICAgICAvLyBub3QgYWxzbyBoYXJkIGNsYW1waW5nLlxuICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKiBXaGV0aGVyIGhlaWdodCBvZiB0ZXh0IG9yIG51bWJlciBvZiBsaW5lcyBleGNlZWQgY29uc3RyYWludHMuXG4gICAqXG4gICAqIEBzZWUgTGluZUNsYW1wLm1heEhlaWdodFxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhMaW5lc1xuICAgKi9cbiAgc2hvdWxkQ2xhbXAoKSB7XG4gICAgY29uc3QgeyBsaW5lQ291bnQsIHRleHRIZWlnaHQgfSA9IHRoaXMuY2FsY3VsYXRlVGV4dE1ldHJpY3MoKTtcblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0ICYmIHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIHRleHRIZWlnaHQgPiB0aGlzLm1heEhlaWdodCB8fCBsaW5lQ291bnQgPiB0aGlzLm1heExpbmVzXG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhIZWlnaHQpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHRcbiAgICB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heExpbmVzKSB7XG4gICAgICByZXR1cm4gbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwibWF4TGluZXMgb3IgbWF4SGVpZ2h0IG11c3QgYmUgc2V0IGJlZm9yZSBjYWxsaW5nIHNob3VsZENsYW1wKCkuXCJcbiAgICApXG4gIH1cbn1cblxuLyoqXG4gKiBQZXJmb3JtcyBhIGJpbmFyeSBzZWFyY2ggZm9yIHRoZSBtYXhpbXVtIHdob2xlIG51bWJlciBpbiBhIGNvbnRpZ291cyByYW5nZVxuICogd2hlcmUgYSBnaXZlbiB0ZXN0IGNhbGxiYWNrIHdpbGwgZ28gZnJvbSByZXR1cm5pbmcgdHJ1ZSB0byByZXR1cm5pbmcgZmFsc2UuXG4gKlxuICogU2luY2UgdGhpcyB1c2VzIGEgYmluYXJ5LXNlYXJjaCBhbGdvcml0aG0gdGhpcyBpcyBhbiBPKGxvZyBuKSBmdW5jdGlvbixcbiAqIHdoZXJlIG4gPSBtYXggLSBtaW4uXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1pblxuICogVGhlIGxvd2VyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbWF4XG4gKiBUaGUgdXBwZXIgYm91bmRhcnkgb2YgdGhlIHJhbmdlLlxuICpcbiAqIEBwYXJhbSB0ZXN0XG4gKiBBIGNhbGxiYWNrIHRoYXQgcmVjZWl2ZXMgdGhlIGN1cnJlbnQgdmFsdWUgaW4gdGhlIHJhbmdlIGFuZCByZXR1cm5zIGEgdHJ1dGh5IG9yIGZhbHN5IHZhbHVlLlxuICpcbiAqIEBwYXJhbSBkb25lXG4gKiBBIGZ1bmN0aW9uIHRvIHBlcmZvcm0gd2hlbiBjb21wbGV0ZS4gUmVjZWl2ZXMgdGhlIGZvbGxvd2luZyBwYXJhbWV0ZXJzXG4gKiAtIGN1cnNvclxuICogLSBtYXhQYXNzaW5nVmFsdWVcbiAqIC0gbWluRmFpbGluZ1ZhbHVlXG4gKi9cbmZ1bmN0aW9uIGZpbmRCb3VuZGFyeShtaW4sIG1heCwgdGVzdCwgZG9uZSkge1xuICBsZXQgY3Vyc29yID0gbWF4O1xuICAvLyBzdGFydCBoYWxmd2F5IHRocm91Z2ggdGhlIHJhbmdlXG4gIHdoaWxlIChtYXggPiBtaW4pIHtcbiAgICBpZiAodGVzdChjdXJzb3IpKSB7XG4gICAgICBtYXggPSBjdXJzb3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1pbiA9IGN1cnNvcjtcbiAgICB9XG5cbiAgICBpZiAobWF4IC0gbWluID09PSAxKSB7XG4gICAgICBkb25lKGN1cnNvciwgbWluLCBtYXgpO1xuICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBjdXJzb3IgPSBNYXRoLnJvdW5kKChtaW4gKyBtYXgpIC8gMik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW1pdChpbnN0YW5jZSwgdHlwZSkge1xuICBpbnN0YW5jZS5lbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KHR5cGUpKTtcbn1cblxuZXhwb3J0IHsgTGluZUNsYW1wIGFzIGRlZmF1bHQgfTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1wiYmVnaW5cIjp7XCJ0ZXh0XCI6XCJbZGVsYXkgNTAwXUNvbm5lY3RpbmdbZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVxcbltzb3VuZCBhbGFybS53YXZdPGVtPkJlZXA8L2VtPiBbZGVsYXkgMTAwMF08ZW0+QmVlcDwvZW0+IFtkZWxheSAxMDAwXTxlbT5CZWVwPC9lbT5bZGVsYXkgMTAwMF1cXG5bc291bmQgY2xpY2sud2F2XVlvdSB3YWtlIHVwIHNsb3dseSB0byB0aGUgc291bmQgb2YgeW91ciBhbGFybS5cXG5JdCBkcm9uZXMgb24gYW5kIG9uIHVudGlsIHlvdSB3YWtlIHVwIGVub3VnaCB0byB0dXJuIGl0IG9mZi5cXG5XaGF0IGRvIHlvdSBkbz9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwibmV3c3BhcGVyXCIsXCJ0ZXh0XCI6XCJDaGVjayB0aGUgbmV3c1wiLFwibmV4dFwiOlwiY2hlY2tOZXdzXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiR2V0IG91dCBvZiBiZWRcIixcIm5leHRcIjpcImdldFVwXCJ9XX0sXCJjaGVja05ld3NcIjp7XCJ0ZXh0XCI6XCJZb3UgZ3JhYiB5b3VyIEF1Z21lbnRlZCBSZWFsaXR5IGdsYXNzZXMgZnJvbSB5b3VyIG5pZ2h0c3RhbmQgYW5kIHB1dCB0aGVtIG9uLlxcbkFzIHlvdSBzY3JvbGwgc29tZXdoYXQgYWJzZW50bWluZGVkbHkgdGhyb3VnaCB0aGUgbmV3cywgb25lIHN0b3J5IGNhdGNoZXMgeW91ciBleWUuXFxuQW4gaW1hZ2Ugb2YgYSBmbG9vZGVkIHRvd24gb2ZmIG9mIHRoZSBNaXNzaXNpcHBpIFJpdmVyLlxcbk11cmt5IGJyb3duIHdhdGVyIGV2ZXJ5d2hlcmUsIHBhc3Qgd2Fpc3QgaGVpZ2h0LlxcbkNhcnMsIGJ1aWxkaW5ncywgYW5kIHRyZWVzIGJhcmVseSBhYm92ZSB0aGUgc3VyZmFjZS5cXG5baW1hZ2UgaHR0cHM6Ly9pbWFnZXMuZm94dHYuY29tL3N0YXRpYy5mb3g3YXVzdGluLmNvbS93d3cuZm94N2F1c3Rpbi5jb20vY29udGVudC91cGxvYWRzLzIwMjAvMDIvOTMyLzUyNC9GbG9vZGluZy1pbi1NSXNzaXNzaXBwaS0uanBnP3ZlPTEmdGw9MV1cXG5OYXR1cmUgaXMgYSBjcnVlbCBtaXN0cmVzcywgeW91IHRoaW5rLlxcbkJ1dCB0aGVuIGFnYWluLCB3ZSd2ZSBhbHdheXMgaGFkIHRvIGRlYWwgd2l0aCBuYXR1cmFsIGRpc2FzdGVycywgcmlnaHQ/XFxuV2VsbCwgdGhhdHMgZW5vdWdoIG9mIHRoZSBuZXdzIGZvciB0b2RheS4gVGhhdCBzdHVmZiBpcyBhbHdheXMganVzdCBkZXByZXNzaW5nLlwiLFwibG9vcFwiOlwiYmVnaW5cIn0sXCJnZXRVcFwiOntcInRleHRcIjpcIllvdSBnZXQgdXAgYW5kIGdldCByZWFkeSBmb3IgdGhlIGRheS5cXG5XaGVuIHlvdSBjb21lIGJhY2sgb3V0IG9mIHRoZSBiYXRocm9vbSwgeW91IG5vdGljZSB0d28gdGhpbmdzOlxcbjEuIEl0J3MgZnJlZXppbmcgaW4gaGVyZVxcbjIuIFlvdXIgcm9vbSBpcyBhIG1lc3NcIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiZmFuXCIsXCJ0ZXh0XCI6XCJUdXJuIG9mZiB0aGUgQS9DXCIsXCJuZXh0XCI6XCJ0dXJuT2ZmXCJ9LHtcImljb25cIjpcImZvbGRlclwiLFwidGV4dFwiOlwiQ2hlY2sgb3V0IHRoZSBtZXNzXCIsXCJuZXh0XCI6XCJtZXNzXCIsXCJyZXR1cm5cIjpcImNvbnRpbnVlXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiTGVhdmVcIixcIm5leHRcIjpcImxlYXZlXCJ9XX0sXCJ0dXJuT2ZmXCI6e1widGV4dFwiOlwiQXMgeW91IGdvIG92ZXIgdG8gdHVybiBvZmYgdGhlIGFpciBjb25kaXRpb25pbmcsIHlvdSB0YWtlIGEgbG9vayBvdXQgdGhlIHdpbmRvdy4gSnVzdCBhcyB5b3UgZXhwZWN0ZWQsIGl0cyBjbG91ZHkgYW5kIHJhaW55LiBUaGUgQS9DIG11c3QgaGF2ZSBiZWVuIG1ha2luZyB0aGUgdGVtcGVyYXR1cmUgZXZlbiBjb2xkZXIgdGhhbiBpdCBhbHJlYWR5IHdhcyBvdXRzaWRlLlxcbllvdSd2ZSBoYWQgaXQgdHVybmVkIGFsbCB0aGUgd2F5IHVwIGZvciB0aGUgcGFzdCBmZXcgZGF5cyBkdWUgdG8gdGhlIGhlYXR3YXZlLiBZb3UnZCBiZWVuIHdvcnJpZWQgdGhhdCBpdCB3YXNuJ3QgZ29pbmcgdG8gZW5kOiB5b3UgaGFkIG5ldmVyIHNlZW4gYSBoZWF0d2F2ZSBnbyBmb3IgdGhhdCBsb25nIG9yIHRoYXQgaG90IGluIHlvdXIgbGlmZS4gQ2xlYXJseSBpdCdzIG92ZXIgbm93LCB0aG91Z2gsIGlmIHRoZSB0ZW1wZXJhdHVyZSBpcyBhbnl0aGluZyB0byBnbyBieS5cXG5Zb3UgYWRqdXN0IHRoZSBBL0MncyBzZXR0aW5ncyBpbiBpdHMgYXBwIG9uIHlvdXIgQVIgZ2xhc3Nlcy4gT24gdG8gbW9yZSBpbXBvcnRhbnQgdGhpbmdzLlwiLFwibG9vcFwiOlwiZ2V0VXBcIn0sXCJtZXNzXCI6e1widGV4dFwiOlwiWW91IHNwZW5kIHNvIG11Y2ggdGltZSBhdCB3b3JrIG5vd2FkYXlzIHRoYXQgeW91ciByb29tIGlzIHByZXR0eSBtZXNzeS4gSW4gdGhlb3J5LCBhbGwgb2YgeW91ciBtYXRlcmlhbHMgd291bGQgYmUgY29udGFpbmVkIGluIHRoZSBmb2xkZXIgb24geW91ciBkZXNrLCBidXQgeW91IHNwZW5kIHNvIG11Y2ggdGltZSByZW9yZ2FuaXppbmcgYW5kIGFkanVzdGluZyB0aGF0IGl0IGFsbCBlbmRzIHVwIHN0cmV3biBhYm91dC4gWW91J2QgcHJvYmFibHkgYmUgYmV0dGVyIG9mZiB1c2luZyB2aXJ0dWFsIGRvY3VtZW50cywgYnV0IHNvbWV0aGluZyBhYm91dCBmZWVsaW5nIHRoZSBwYXBlcnMgaW4geW91ciBoYW5kIHN0aWxsIGFwcGVhbHMgdG8geW91IG1vcmUgdGhhbiBqdXN0IHNlZWluZyB0aGVtLlxcbllvdSBwaWNrIHVwIHdoYXQgZmV3IHBhcGVycyByZW1haW4gdGhlIGZvbGRlciBhbmQgZmxpY2sgdGhyb3VnaCB0aGVtLiBUaGV5J3JlIHRoZSB0aHJlZSBzdHVkaWVzIHlvdSd2ZSBiYXNlZCB5b3VyIHByZXNlbnRhdGlvbiBvbi4gWW91IHN0YXJlIGF0IHRoZW0gZm9yIGEgbGl0dGxlLCBwZW5zaXZlbHkuIFlvdSdkIGFsd2F5cyB3YW50ZWQgdG8gYmUgdGhlIG9uZSBkb2luZyB0aGUgcmVzZWFyY2guIFRoYXQncyB3aHkgeW91IHRvb2sgdGhpcyBqb2I7IHByZXNlbnRpbmcgcmVzZWFyY2ggc2VlbWVkIGxpa2UgYSBnb29kIHdheSB0byBnZXQgc29tZSBjb25uZWN0aW9ucywgbm90IHRvIG1lbnRpb24geW91IG5lZWRlZCB0aGUgbW9uZXkuIEJ1dCBhdCBzb21lIHBvaW50IHlvdSBsb3N0IHRyYWNrIG9mIHRoYXQgZ29hbCwgYW5kIGV2ZW4gdGhvdWdoIHlvdSBjYW4gcHJvYmFibHkgYWZmb3JkIHRvIGdvIGJhY2sgdG8gc2Nob29sIG5vdywgYmVpbmcgYSByZXNlYXJjaGVyIGZlZWxzIGxpa2Ugc29tZW9uZSBlbHNlJ3MgZHJlYW0uIFRoZSBraW5kIG9mIHRoaW5nIGEga2lkIHRlbGxzIHRoZW1zZWxmIGJlZm9yZSB0aGV5J3ZlIGJlZW4gZXhwb3NlZCB0byB0aGUgcmVhbCB3b3JsZC5cXG5UaGlzIGpvYiBpcyBmaW5lLiBJdCBwYXlzIHdlbGwuIDxiPkl0J3MgZmluZTwvYj4uXFxuQW55d2F5LCB5b3UgaGF2ZSB0aHJlZSBzdHVkaWVzIGluIHRoZSBmb2xkZXIuXFxuRG8geW91IHdhbnQgdG8gcmV2aWV3IGFueSBvZiB0aGVtIGJlZm9yZSB0aGUgYmlnIGhlYXJpbmcgbGF0ZXI/XCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImluZHVzdHJ5XCIsXCJ0ZXh0XCI6XCJDQ1MgU3R1ZHlcIixcIm5leHRcIjpcImNjc1wifSx7XCJpY29uXCI6XCJmaXJlLWZsYW1lLXNpbXBsZVwiLFwidGV4dFwiOlwiRWZmaWNpZW5jeSBTdHVkeVwiLFwibmV4dFwiOlwiZWZmaWNpZW5jeVwifSx7XCJpY29uXCI6XCJhcnJvd3Mtcm90YXRlXCIsXCJ0ZXh0XCI6XCJMaWZlY3ljbGUgQW5hbHlzaXNcIixcIm5leHRcIjpcImxjYVwifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkNvbnRpbnVlXCIsXCJuZXh0XCI6XCJjb250aW51ZVwifV19LFwiY2NzXCI6e1widGV4dFwiOlwiVGhpcyBzdHVkeSBpcyBhYm91dCBDQ1MsIENhcmJvbiBDYXB0dXJlIGFuZCBTdG9yYWdlLiBJdCdzIGEgdGVjaG5vbG9neSB0aGF0IHNpZ25pZmljYW50bHkgcmVkdWNlcyB0aGUgY2FyYm9uIGVtaXNzaW9ucyBvZiBjb2FsIGFuZCBuYXR1cmFsIGdhcyBwb3dlciBwbGFudHMsIGJ5IHVwIHRvIDkwJS4gU28gb2YgY291cnNlLCB0aGUgZm9zc2lsIGZ1ZWxzIGNvcnBvcmF0aW9uIHlvdSB3b3JrIGZvciBpcyBwcmV0dHkgaW50ZXJlc3RlZCBpbiBpdCBhcyBhIHdheSB0byBrZWVwIHRoZWlyIGJ1c2luZXNzLi4uIHVwIHRvIGRhdGUgd2l0aCB0aGUgdGltZXMuIFRoaXMgc3R1ZHkgaXMgYW4gb3ZlcnZpZXcgb2YgcGFzdCBhbmQgY3VycmVudCByZXNlYXJjaCBpbnRvIENDUyB0ZWNobm9sb2dpZXMsIHNvbWUgb2Ygd2hpY2ggcHJvbWlzZSB0byByZWR1Y2UgZW1pc3Npb25zIGJ5IHVwIHRvIDk1JSBvciBldmVuIG1vcmUuIEl0IGFsc28gaGFzIHNvbWUgbG93IGxldmVsIGV4cGxhbmF0aW9ucyBvZiBob3cgdGhlIHRlY2hub2xvZ3kgd29ya3MsIHN1Y2ggYXMgc29tZSBkaWFncmFtcyBvZiBwb3NzaWJsZSBwcm9jZXNzZXMuXFxuW2ltYWdlIGh0dHBzOi8vYXJzLmVscy1jZG4uY29tL2NvbnRlbnQvaW1hZ2UvMS1zMi4wLVMwMDQ4OTY5NzIwMzY3MzQ2LWdyMS5qcGddXFxuT2YgY291cnNlLCB0aGUgZXh0cmEgd29yayBuZWVkZWQgdG8gY2FwdHVyZSBhbmQgc3RvcmUgdGhlIGNhcmJvbiBkaW94aWRlIGRvZXMgbWFrZSB0aGUgY29zdCBvZiBlbGVjdHJpY2l0eSBmb3IgQ0NTIHBsYW50cyBoaWdoZXIsIGFuZCB0aGUgdGVjaG5vbG9neSBjYW4gbmV2ZXIgcmVkdWNlIGVtaXNzaW9ucyB0byBuZWFyIHplcm8gbGlrZSByZW5ld2FibGVzLiBUaGUgc3R1ZHkgZG9lcyBub3RlIHRoYXQsIGJ1dCB5b3VyIHN1cGVydmlzb3Igc2FpZCBub3QgdG8gZm9jdXMgb24gdGhhdCBwYXJ0IHNvIG11Y2guIEFmdGVyIGFsbCwgaG93IG11Y2ggaGFybSBjb3VsZCBqdXN0IGEgbGl0dGxlIG1vcmUgY2FyYm9uIGRpb3hpZGUgcmVhbGx5IGRvP1wiLFwibG9vcFwiOlwibWVzc1wifSxcImVmZmljaWVuY3lcIjp7XCJ0ZXh0XCI6XCJUaGlzIHN0dWR5IGlzIGFuIGFuYWx5c2lzIG9mIHRoZSBjb3N0IGVmZmljaWVuY3kgb2YgdmFyaW91cyBmb3NzaWwgZnVlbCBlbmVyZ3kgc291cmNlcyBjb21wYXJlZCB0byByZW5ld2FibGUgc291cmNlcy4gVGhlIHN0dWR5IGZvdW5kIHRoYXQgYWxsIHRvZ2V0aGVyLCByZW5ld2FibGVzIGNvc3QgYWJvdXQgNi04IGNlbnRzIHBlciBraWxvd2F0dC1ob3VyIChrV2gpLCB3aGlsZSBmb3NzaWwgZnVlbCBzb3VyY2VzIGxpa2UgY29hbCBhbmQgbmF0dXJhbCBnYXMgY29zdCBhYm91dCA0LTUgY2VudHMgcGVyIGtXaCwgZGVwZW5kaW5nIG9uIHRoZSBzb3VyY2UuIFlvdXIgc3VwZXJ2aXNvciB3YXMgdmVyeSBpbnNpc3RlbnQgeW91IGhpZ2hsaWdodCB0aGF0IHdoaWxlIGEgMiBvciAzIGNlbnQgZGlmZmVyZW5jZSBtYXkgbm90IHNlZW0gbGlrZSBtdWNoLCBpZiB5b3UgbXVsdGlwbHkgaXQgb3ZlciB0aGUgd2hvbGUgcG93ZXIgZ3JpZCwgaXQgc3RhcnRzIHRvIGFkZCB1cC4gQW5kIHlvdSBzdXBwb3NlIHRoYXQgbWFrZXMgc2Vuc2U7IGlmIHRoZSBnb3Zlcm5tZW50IGlzIGdvaW5nIHRvIGJlIHN1YnNpZGl6aW5nIGVuZXJneSwgaXQgbWlnaHQgYXMgd2VsbCBnZXQgdGhlIG1vc3Qgb3V0IG9mIGVhY2ggZG9sbGFyLlxcblRoZSBzdHVkeSwgYmVpbmcgZnVuZGVkIGJ5IHRoZSBjb21wYW55IHlvdSB3b3JrIGZvciwgbmVnbGVjdHMgdG8gbWVudGlvbiB0aGUgY29zdCBpbmNyZWFzZXMgZnJvbSB0aGUgdXNlIG9mIENDUywgd2hpY2ggeW91J3ZlIGJlZW4gdG9sZCByYWlzZSBpdCB1cCB0byBhYm91dCB0aGUgc2FtZSBsZXZlbHMgYXMgcmVuZXdhYmxlcywgaWYgbm90IG1vcmUuIEJ1dCB5b3UndmUgYmVlbiBhc3N1cmVkIHRoYXQgeW91ciBjb21wYW55IGlzIHdvcmtpbmcgaGFyZCB0byBtYWtlIENDUyBjaGVhcGVyLCBhbmQgb25jZSB0aGV5IGRvIHRoYXQgdGhleSdsbCBiZSBzdXJlIHRvIHN3aXRjaCBvdmVyLiBTbyB0aGF0IG1ha2VzIHlvdSBmZWVsIGEgbGl0dGxlIGJldHRlci4uLiB5b3UgdGhpbmsuIFVudGlsIHRoZW4gdGhvdWdoIHRoZSBjb21wYW55IGlzIHN0aWxsIGludGVuZGluZyB0byBmb2N1cyBvbiBub24tQ0NTIHBsYW50cy4gWW91IHdvbid0IGJlIG1lbnRpb25pbmcgdGhhdCBlaXRoZXIuXCIsXCJsb29wXCI6XCJtZXNzXCJ9LFwibGNhXCI6e1widGV4dFwiOlwiVGhpcyBzdHVkeSB5b3UncmUgbm90IHN1cHBvc2VkIHRvIGhhdmUuIFlvdXIgc3VwZXJ2aXNvciBoYWQgYmVlbiBtYWtpbmcgYSBiaWcgZnVzcyBhYm91dCBzb21lIG5ldyBsaWZlY3ljbGUgYW5hbHlzaXMgdGhhdCB3b3VsZCBzaG93IGZvc3NpbCBmdWVscyB3ZXJlbid0IGFzIGJhZCBhcyBldmVyeW9uZSB0aG91Z2h0LCBidXQgYSBjb3VwbGUgb2YgbW9udGhzIGxhdGVyIHRoZXkgaGFkIGp1c3Qgc3RvcHBlZCB0YWxraW5nIGFib3V0IGl0LiBTbyB5b3UgZGlkIGEgbGl0dGxlIGRpZ2dpbmcsIGZvdW5kIHRoZSByZXNlYXJjaGVycyB3aG8gZGlkIHRoZSBzdHVkeSwgYW5kIGFza2VkIHRoZW0gZm9yIGEgY29weS4gXFxuT25jZSB0aGV5IHNlbnQgaXQgdG8geW91LCB5b3UgcXVpY2tseSByZWFsaXplZCB3aHkgeW91IGhhZG4ndCBoZWFyZCBhbnkgbW9yZSBhYm91dCBpdC4gUmF0aGVyIHRoYW4gZmluZCBldmlkZW5jZSB0aGF0IGZvc3NpbCBmdWVscyB3ZXJlbid0IGFzIGRlc3RydWN0aXZlIGFzIHBlb3BsZSB0aG91Z2h0LCB0aGV5IGFjdHVhbGx5IGZvdW5kIGV2aWRlbmNlIHRoYXQgY2VydGFpbiBhc3BlY3RzIG9mIHRoZSBwcm9jZXNzIHdlcmUgbW9yZSBkZXN0cnVjdGl2ZSB0aGFuIGluaXRpYWxseSB0aG91Z2h0LlxcbllvdSdyZSBub3Qgc3VyZSB3aHkgeW91IGtlcHQgdGhlIHN0dWR5LiBZb3UgY2VydGFpbmx5IGFyZW4ndCBnb2luZyB0byB1c2UgaXQgYXQgdG9kYXkncyBoZWFyaW5nLCB0aGF0IHdvdWxkIGJlLi4uIGJhZCBmb3IgeW91ciBqb2Igc2VjdXJpdHksIHRvIHNheSB0aGUgbGVhc3QuIEJ1dCBzb21ldGhpbmcgYWJvdXQgaXQga2VlcHMgbmFnZ2luZyBhdCB5b3UuIE1heWJlIGl0J3MgdGhlIGVub3JtaXR5IG9mIGl0IGFsbC4gWW91IGtub3cgYWJvdXQgY2xpbWF0ZSBjaGFuZ2XigJRpdCdzIGhhcmQgdG8gaWdub3JlIGl0IHdpdGggYWxsIHRoZSBwcm90ZXN0cyB0aGF0IGhhdmUgYmVlbiBnb2luZyBvbiByZWNlbnRseeKAlGJ1dCBhcyBmYXIgYXMgeW91IGNhbiB0ZWxsLCBldmVyeXRoaW5nIHNlZW1zIHRvIGJlIGZpbmUuIFN1cmUsIHRoZXJlJ3MgYmVlbiBhIGxvdCBvZiBmbG9vZHMgaW4gc29tZSBvdGhlciBzdGF0ZXMgcmVjZW50bHksIGFuZCB0aGVyZSdzIGRlZmluaXRlbHkgYmVlbiBhIGxvdCBvZiBoZWF0d2F2ZXMgaGVyZSBpbiBUZXhhcywgYnV0IG5vbmUgb2YgaXQgc2VlbXMgdGhhdCBiYWQuIEJ1dCBzZWVpbmcgdGhlIHNoZWVyIGFtb3VudCBvZiBjYXJib24gYmVpbmcgZW1pdHRlZCwgdG9nZXRoZXIgd2l0aCByZWZlcmVuY2VzIHRvIHRoZSBkaXJlY3QgYW5kIGluZGlyZWN0IGVmZmVjdHMsIGV2ZW4gaW4gYSBmb3NzaWwgZnVlbCBmdW5kZWQgc3R1ZHk7IGl0IG1ha2VzIHlvdSB1bmNvbWZvcnRhYmxlLCB0byBzYXkgdGhlIGxlYXN0LlxcbllvdSBwdXQgdGhlIHN0dWR5IGJhY2sgaW4gdGhlIGZvbGRlci4gWW91IHNob3VsZG4ndCBiZSBkaXN0cmFjdGluZyB5b3Vyc2VsZiB3aXRoIHRoYXQgdG9kYXkuIFRoaXMgaXMgcG9zc2libHkgdGhlIGJpZ2dlc3QgaGVhcmluZyBvZiB5b3VyIGNhcmVlci4gSWYgeW91IG1lc3MgdGhpcyB1cCwgaXQnbGwgbWVhbiB0aGUgbWFqb3JpdHkgb2YgZm9zc2lsIGZ1ZWwgc3Vic2lkaWVzIHdpbGwgYmUgZGl2ZXJ0ZWQgdG8gcmVuZXdhYmxlIGVuZXJneSwgYW5kIGxlc3MgbW9uZXkgZm9yIHlvdXIgZW1wbG95ZXIgbWVhbnMgbGVzcyBtb25leSBmb3IgeW91LiBObyBtaXN0YWtlcyB0b2RheS5cIixcImxvb3BcIjpcIm1lc3NcIn0sXCJjb250aW51ZVwiOntcInRleHRcIjpcIllvdSB0dXJuIHlvdXIgYXR0ZW50aW9uIHRvIHRoZSByZXN0IG9mIHRoZSByb29tLlwiLFwibG9vcFwiOlwiZ2V0VXBcIn19IiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXVkaW9NYW5hZ2VyIHtcbiAgICBlbGVtZW50ID0gbmV3IEF1ZGlvKCk7XG4gICAgXG4gICAgcGxheShuYW1lOiBTdHJpbmcsIHZvbHVtZTogbnVtYmVyID0gMSkge1xuICAgICAgICB0aGlzLmVsZW1lbnQuc3JjID0gYGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9rZmlzaDYxMC90ZXh0LWFkdmVudHVyZS9tYWluL2Fzc2V0cy8ke25hbWV9YDtcbiAgICAgICAgdGhpcy5lbGVtZW50LnZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5lbGVtZW50LnBsYXkoKTtcbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGF1c2UoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5lbGVtZW50LnBhdXNlKCk7XG4gICAgfVxuXG4gICAgcmVzdW1lKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGxheSgpO1xuICAgIH1cblxuICAgIGxvb3Aoc2hvdWxkTG9vcDogYm9vbGVhbikge1xuICAgICAgICB0aGlzLmVsZW1lbnQubG9vcCA9IHNob3VsZExvb3A7XG4gICAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1YmJsZXMge1xuICAgIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuICAgIGJ1YmJsZXM6IEFycmF5PEJ1YmJsZT4gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5jdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcbiAgICAgICAgdGhpcy5yZXNpemUoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYnViYmxlcy5wdXNoKG5ldyBCdWJibGUoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLmN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy5jdHguY2FudmFzLndpZHRoLCB0aGlzLmN0eC5jYW52YXMuaGVpZ2h0KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYnViYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zcGVlZCA+IDAgJiYgdGhpcy5idWJibGVzW2ldLmxpZmV0aW1lIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0uc3BlZWQgKj0gLTE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS51cGRhdGUoZHQpO1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zaXplIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0gPSBuZXcgQnViYmxlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5kcmF3KHRoaXMuY3R4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdmFyIGRwciA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIHx8IDE7XG4gICAgICAgIHZhciByZWN0ID0gdGhpcy5jdHguY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy53aWR0aCA9IHJlY3Qud2lkdGggKiBkcHI7XG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodCAqIGRwcjtcblxuICAgICAgICAvLyB0aGlzLmN0eC5zY2FsZShkcHIsIGRwcik7XG5cbiAgICAgICAgdGhpcy5jdHguZmlsdGVyID0gXCJibHVyKDUwcHgpXCI7XG4gICAgfVxufVxuXG5jbGFzcyBCdWJibGUge1xuICAgIHNwZWVkOiBudW1iZXI7XG4gICAgeDogbnVtYmVyO1xuICAgIHk6IG51bWJlcjtcbiAgICBzaXplOiBudW1iZXI7XG4gICAgY29sb3I6IHN0cmluZztcbiAgICBsaWZldGltZTogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuc3BlZWQgPSAwLjAyO1xuXG4gICAgICAgIHRoaXMueCA9IE1hdGgucmFuZG9tKCkgKiB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lckhlaWdodDtcblxuICAgICAgICB0aGlzLnNpemUgPSAxMDtcblxuICAgICAgICBsZXQgdiA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGxldCBodWUgPSB2IDwgMC41ID8gMTUwIDogMjMwO1xuICAgICAgICBsZXQgc2F0ID0gdiA8IDAuNSA/IDUwIDogODU7XG4gICAgICAgIGxldCBsaWdodCA9IHYgPCAwLjUgPyAyNSA6IDQwO1xuICAgICAgICB0aGlzLmNvbG9yID0gXCJoc2xhKFwiICsgaHVlICsgXCIsIFwiICsgc2F0ICsgXCIlLCBcIiArIGxpZ2h0ICsgXCIlLCAyMCUpXCI7XG5cbiAgICAgICAgdGhpcy5saWZldGltZSA9IE1hdGgucmFuZG9tKCkgKiogNSAqIDE2MDAwICsgMjAwMDtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLnNpemUgKz0gdGhpcy5zcGVlZCAqIGR0O1xuICAgICAgICB0aGlzLmxpZmV0aW1lIC09IGR0O1xuICAgIH1cblxuICAgIGRyYXcoY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQpIHtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuY29sb3I7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4LmFyYyh0aGlzLngsIHRoaXMueSwgdGhpcy5zaXplLCAwLCBNYXRoLlBJICogMik7XG4gICAgICAgIGN0eC5maWxsKCk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RvcnksIE9wdGlvbiB9IGZyb20gJy4vc3RvcnknO1xuXG5sZXQgc3Rvcnk6IFN0b3J5ID0gcmVxdWlyZShcIi4vc3RvcnkuY3NvblwiKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnV0dG9ucyB7XG4gICAgZWxlbTogSFRNTEVsZW1lbnQ7XG4gICAgc2VsZWN0ZWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIHRleHQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGVuYWJsZWQgPSBmYWxzZTtcbiAgICBidXR0b25zOiBIVE1MQnV0dG9uRWxlbWVudFtdID0gW107XG4gICAgZmlyc3RFeGl0ID0gdHJ1ZTtcblxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuZWxlbSA9IGVsZW07XG4gICAgfVxuXG4gICAgZW5hYmxlKHNjZW5lOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIGxldCBvcHRpb25zOiBPcHRpb25bXTtcbiAgICAgICAgaWYgKHN0b3J5W3NjZW5lXS5vcHRpb25zID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHN0b3J5W3N0b3J5W3NjZW5lXS5sb29wIV0ub3B0aW9ucyE7XG4gICAgICAgICAgICBsZXQgbG9vcGVkT3B0ID0gb3B0aW9ucy5maW5kSW5kZXgobyA9PiBvLnJldHVybiAhPSB1bmRlZmluZWQgPyBvLnJldHVybiA9PSBzY2VuZSA6IG8ubmV4dCA9PSBzY2VuZSk7XG4gICAgICAgICAgICBvcHRpb25zLnNwbGljZShsb29wZWRPcHQsIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHN0b3J5W3NjZW5lXS5vcHRpb25zITtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdGVwID0gb3B0aW9ucy5sZW5ndGggPT0gNCA/IDYgOiAxMi9vcHRpb25zLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb24gPSBvcHRpb25zW2ldO1xuICAgICAgICAgICAgbGV0IGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gICAgICAgICAgICBidXR0b24uY2xhc3NOYW1lID0gXCJvdmVybGF5XCI7XG4gICAgICAgICAgICBidXR0b24uaW5uZXJIVE1MID0gIFwiPiA8aSBjbGFzcz1cXFwiZmEtc29saWQgZmEtXCIrIG9wdGlvbi5pY29uICtcIlxcXCI+PC9pPiBcIiArIG9wdGlvbi50ZXh0O1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IFwiNCAvIDEwXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMubGVuZ3RoID09IDQpIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IGkgPCAyID8gKGkqc3RlcCArIDEpLnRvU3RyaW5nKCkgKyBcIiAvIFwiICsgKChpKzEpKnN0ZXAgKyAxKS50b1N0cmluZygpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogKChpLTIpKnN0ZXAgKyAxKS50b1N0cmluZygpICsgXCIgLyBcIiArICgoaS0xKSpzdGVwICsgMSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLnN0eWxlLmdyaWRDb2x1bW4gPSAoaSpzdGVwICsgMSkudG9TdHJpbmcoKSArIFwiIC8gXCIgKyAoKGkrMSkqc3RlcCArIDEpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBidXR0b24ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5maXJzdEV4aXQgJiYgb3B0aW9uLmljb24gPT0gXCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcnN0RXhpdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5vbnZpc2liaWxpdHljaGFuZ2UhKG5ldyBFdmVudChcInZpc2liaWxpdHljaGFuZ2VcIikpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbmZpcm0oXCJPcHRpb25zIHdpdGggdGhpcyBpY29uICh0aGUgZXhpdGluZyBhcnJvdykgbGVhdmUgYSBzY2VuZSBwZXJtYW5lbnRseS4gXFxcblRoaXMgbWVhbnMgdGhhdCBpZiB0aGVyZSdzIGFueSBvdGhlciBvcHRpb25zIHlvdSBoYXZlbid0IHRyaWVkIHlldCwgXFxcbmFmdGVyIGNsaWNraW5nIHRoaXMgb3B0aW9uIHlvdSB3b24ndCBiZSBhYmxlIHRvIHJlYWQgdGhlbSB3aXRob3V0IHJlc3RhcnRpbmcgdGhlIGdhbWUuIFxcXG5BcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gY29udGludWU/XCIpKSByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBvcHRpb24ubmV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHQgPSBcIjxpIGNsYXNzPVxcXCJmYS1zb2xpZCBmYS1cIisgb3B0aW9uLmljb24gK1wiXFxcIj48L2k+IFwiICsgb3B0aW9uLnRleHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtLmNsYXNzTmFtZSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtLmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5idXR0b25zID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5lbGVtLmFwcGVuZENoaWxkKGJ1dHRvbik7XG4gICAgICAgICAgICB0aGlzLmJ1dHRvbnMucHVzaChidXR0b24pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZWxlbS5jbGFzc05hbWUgPSBcIm91dFwiO1xuICAgIH1cbn0iLCJpbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcbmltcG9ydCBTdGF0ZU1hbmFnZXIgZnJvbSBcIi4vc3RhdGVfbWFuYWdlclwiO1xuaW1wb3J0IHsgQmVnaW5TdGF0ZSB9IGZyb20gXCIuL3N0YXRlc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBHYW1lIHtcbiAgICB0ZXJtOiBUZXJtaW5hbDtcbiAgICBtYW5hZ2VyOiBTdGF0ZU1hbmFnZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZXJtaW5hbDogSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGVybWluYWwuc3R5bGUubGluZUhlaWdodCA9IFwiMS4ycmVtXCI7XG4gICAgICAgIHRoaXMudGVybSA9IG5ldyBUZXJtaW5hbCh0ZXJtaW5hbCk7XG4gICAgICAgIHRoaXMubWFuYWdlciA9IG5ldyBTdGF0ZU1hbmFnZXIoQmVnaW5TdGF0ZSk7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLnVwZGF0ZShkdCwgdGhpcy50ZXJtKTtcblxuICAgICAgICB0aGlzLnRlcm0udXBkYXRlKGR0KTtcbiAgICB9XG5cbiAgICByZXNpemUoKSB7XG4gICAgICAgIHRoaXMudGVybS5yZXNpemUoKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLmtleWRvd24oZSk7XG4gICAgfVxufVxuIiwiaW1wb3J0IFN0YXRlTWFuYWdlciBmcm9tIFwiLi9zdGF0ZV9tYW5hZ2VyXCI7XG5pbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcblxuZXhwb3J0IGRlZmF1bHQgYWJzdHJhY3QgY2xhc3MgU3RhdGUge1xuICAgIHByb3RlY3RlZCBtYW5hZ2VyOiBTdGF0ZU1hbmFnZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyOiBTdGF0ZU1hbmFnZXIpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcbiAgICB9XG5cbiAgICBpbml0KHRlcm06IFRlcm1pbmFsKSB7fVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7fVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7fVxufVxuIiwiaW1wb3J0IFN0YXRlIGZyb20gXCIuL3N0YXRlXCI7XG5pbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU3RhdGVNYW5hZ2VyIHtcbiAgICBzdGF0ZTogU3RhdGU7XG4gICAgbmVlZHNJbml0ID0gdHJ1ZTtcblxuICAgIGNvbnN0cnVjdG9yKHM6IG5ldyAobTogU3RhdGVNYW5hZ2VyKSA9PiBTdGF0ZSkge1xuICAgICAgICB0aGlzLnN0YXRlID0gbmV3IHModGhpcyk7XG4gICAgfVxuXG4gICAgc2V0U3RhdGUoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICAgICAgdGhpcy5uZWVkc0luaXQgPSB0cnVlO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBpZiAodGhpcy5uZWVkc0luaXQpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUuaW5pdCh0ZXJtKTtcbiAgICAgICAgICAgIHRoaXMubmVlZHNJbml0ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN0YXRlLnVwZGF0ZShkdCwgdGVybSk7XG4gICAgfVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIHRoaXMuc3RhdGUua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuaW1wb3J0IEJ1dHRvbnMgZnJvbSBcIi4vYnV0dG9uc1wiO1xuaW1wb3J0IHsgU3RvcnkgfSBmcm9tICcuL3N0b3J5JztcbmltcG9ydCBBdWRpb01hbmFnZXIgZnJvbSBcIi4vYXVkaW9fbWFuYWdlclwiO1xuXG5sZXQgc3Rvcnk6IFN0b3J5ID0gcmVxdWlyZShcIi4vc3RvcnkuY3NvblwiKTtcblxuZXhwb3J0IGNsYXNzIEJlZ2luU3RhdGUgZXh0ZW5kcyBTdGF0ZSB7XG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICB0ZXJtLndyaXRlTGluZShcIlByZXNzIGFueSBrZXkgdG8gYmVnaW4uLi5cIik7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIHRoaXMubWFuYWdlci5zZXRTdGF0ZShXaXBlU3RhdGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdpcGVTdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBwcml2YXRlIHdpcGVUaW1lciA9IDA7XG4gICAgcHJpdmF0ZSB3aXBlVGlja3MgPSAwO1xuICAgIHByaXZhdGUgd2lwZUxpbmVzOiBudW1iZXI7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5vdmVyZmxvdyA9IFwiaGlkZGVuXCI7XG4gICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5zY3JvbGxTbmFwVHlwZSA9IFwidW5zZXRcIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnBhZGRpbmdMZWZ0ID0gXCIxLjZyZW1cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnBhZGRpbmdSaWdodCA9IFwiMS42cmVtXCI7XG4gICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS50ZXh0SW5kZW50ID0gXCJ1bnNldFwiO1xuICAgICAgICB0aGlzLndpcGVMaW5lcyA9IHRlcm0ubWF4TGluZXM7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLndpcGVUaW1lciA+IDUwKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53aXBlVGlja3MgPiA1KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlTGluZXMtLTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlVGlja3MrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGVybS5maWxsUmFuZG9tKHRoaXMud2lwZUxpbmVzKTtcblxuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2lwZUxpbmVzID49IDApIHtcbiAgICAgICAgICAgIHRoaXMud2lwZVRpbWVyICs9IGR0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGVybS5yZXNldCgpO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLm92ZXJmbG93ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5zY3JvbGxTbmFwVHlwZSA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSBcIlwiO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnBhZGRpbmdSaWdodCA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUudGV4dEluZGVudCA9IFwiXCI7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuc2V0U3RhdGUoUGxheWluZ1N0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBsYXlpbmdTdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBzY2VuZSA9IFwiYmVnaW5cIjtcblxuICAgIHJlbWFpbmluZ1RleHQgPSBcIlwiO1xuXG4gICAgZGVsYXkgPSAwO1xuXG4gICAgdGV4dERlY29kZWQgPSAtMTtcbiAgICB0ZXh0UG9zaXRpb24gPSAtMTtcblxuICAgIGJ1dHRvbnMgPSBuZXcgQnV0dG9ucyhkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJ1dHRvbnNcIikhKTtcblxuICAgIGF1ZGlvID0gbmV3IEF1ZGlvTWFuYWdlcigpO1xuICAgIGJhY2tncm91bmQgPSBuZXcgQXVkaW9NYW5hZ2VyKCk7XG5cbiAgICBjdXJyU291bmQgPSBcImNsaWNrLndhdlwiO1xuXG4gICAgbG9jayA9IGZhbHNlO1xuXG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICB0aGlzLmF1ZGlvLmxvb3AoZmFsc2UpO1xuICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSBzdG9yeVt0aGlzLnNjZW5lXS50ZXh0O1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UtY2xvc2UnKSEub25jbGljayA9IChlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmxvY2sgPSBmYWxzZTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jb250YWluZXInKSEuY2xhc3NOYW1lID0gXCJcIjtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBvdmVycmlkZSB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgaWYgKHRoaXMubG9jaykgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1dHRvbnMuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGVybS53cml0ZUxpbmUodGhpcy5idXR0b25zLnRleHQhKTtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUgPSB0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQ7XG4gICAgICAgICAgICB0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gc3RvcnlbdGhpcy5zY2VuZV0udGV4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlbWFpbmluZ1RleHQubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRoaXMuYXVkaW8uc3RvcCgpO1xuICAgICAgICAgICAgdGVybS5icmVhaygpO1xuICAgICAgICAgICAgdGhpcy5idXR0b25zLmVuYWJsZSh0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmRlbGF5IDw9IDApIHtcbiAgICAgICAgICAgIGxldCBbcG9zLCBpbmRleF0gPSB0aGlzLmluZGV4T2ZNYW55KHRoaXMucmVtYWluaW5nVGV4dCwgXCI8WyBcXG5cIik7XG4gICAgICAgICAgICBpZihwb3MgPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlU3BlY2lhbChpbmRleCwgdGVybSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVUZXh0KHBvcywgdGVybSwgZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWxheSAtPSBkdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaW5kZXhPZk1hbnkoc3RyOiBzdHJpbmcsIGNoYXJzOiBzdHJpbmcpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBjID0gY2hhcnMuaW5kZXhPZihzdHJbaV0pO1xuICAgICAgICAgICAgaWYgKGMgIT0gLTEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2ksIGNdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbLTEsIC0xXTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHdyaXRlVGV4dChsZW46IG51bWJlciwgdGVybTogVGVybWluYWwsIGR0OiBudW1iZXIpIHtcbiAgICAgICAgaWYgKGxlbiA9PSAtMSkge1xuICAgICAgICAgICAgbGVuID0gdGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmF1ZGlvLnBsYXkodGhpcy5jdXJyU291bmQpO1xuICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCA9IDA7XG4gICAgICAgICAgICB0aGlzLnRleHRQb3NpdGlvbiA9IHRlcm0uZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB0ZXh0ID1cbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgwLCB0aGlzLnRleHREZWNvZGVkKSArXG4gICAgICAgICAgICB0ZXJtLnJhbmRvbUNoYXJhY3RlcnMobGVuIC0gdGhpcy50ZXh0RGVjb2RlZCk7XG5cbiAgICAgICAgdGVybS53cml0ZSh0ZXh0LCB0aGlzLnRleHRQb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMudGV4dERlY29kZWQgPT0gbGVuKSB7XG4gICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UobGVuKTtcbiAgICAgICAgICAgIHRoaXMudGV4dERlY29kZWQgPSAtMTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGV4dERlY29kZWQrKztcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZVNwZWNpYWwoaW5kZXg6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgc3dpdGNoIChpbmRleCkge1xuICAgICAgICAgICAgY2FzZSAwOiAvLyA8XG4gICAgICAgICAgICAgICAgbGV0IGVuZFRhZ1BvcyA9IHRoaXMucmVtYWluaW5nVGV4dC5pbmRleE9mKFwiPlwiKTtcbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgwLCBlbmRUYWdQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGVuZFRhZ1BvcyArIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAxOiAvLyBbXG4gICAgICAgICAgICAgICAgbGV0IGVuZENvbW1hbmRQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIl1cIik7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSwgZW5kQ29tbWFuZFBvcyk7XG4gICAgICAgICAgICAgICAgbGV0IHNwYWNlUG9zID0gY29tbWFuZC5pbmRleE9mKFwiIFwiKTtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwYWNlUG9zID09IC0xID8gY29tbWFuZCA6IGNvbW1hbmQuc2xpY2UoMCwgc3BhY2VQb3MpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJkZWxheVwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxheSA9IHBhcnNlSW50KGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm5vcm1hbFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hdWRpby5wbGF5KHRoaXMuY3VyclNvdW5kKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUoY29tbWFuZC5zbGljZShzcGFjZVBvcyArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwic2VwXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInNvdW5kXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJTb3VuZCA9IGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiYmFja2dyb3VuZFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNwYWNlUG9zID09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnN0b3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnBsYXkoY29tbWFuZC5zbGljZShzcGFjZVBvcyArIDEpLCAwLjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJpbWFnZVwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGVybS53cml0ZShgPGEgb25jbGljaz0naW1nQ2xpY2soKSc+Q2xpY2sgdG8gdmlldyBpbWFnZTwvYT5gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubG9jayA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuaW1nQ2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZScpIGFzIEhUTUxJbWFnZUVsZW1lbnQpLnNyYyA9IGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UtY29udGFpbmVyJykhLmNsYXNzTmFtZSA9IFwic2hvd1wiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGVuZENvbW1hbmRQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMjogLy8gPHNwYWNlPlxuICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUoXCIgXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMzogLy8gXFxuXG4gICAgICAgICAgICAgICAgdGVybS53cml0ZUxpbmUoXCJcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWxheSA9IDUwMDtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiSW52YWxpZCBjaGFyIGluZGV4IFwiICsgaW5kZXgpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5kZWNsYXJlIGdsb2JhbCB7XG4gICAgaW50ZXJmYWNlIFdpbmRvdyB7IGltZ0NsaWNrOiAoKSA9PiB2b2lkOyB9XG59XG4iLCJpbXBvcnQgTGluZUNsYW1wIGZyb20gXCJAdHZhbmMvbGluZWNsYW1wXCI7XHJcblxyXG5jb25zdCBDVVJTT1JfQkxJTktfSU5URVJWQUwgPSA1MDA7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUZXJtaW5hbCB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuXHJcbiAgICBmb250U2l6ZTogbnVtYmVyO1xyXG4gICAgd2lkdGg6IG51bWJlcjtcclxuICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgbGluZUhlaWdodDogbnVtYmVyO1xyXG5cclxuICAgIG1heExpbmVzOiBudW1iZXI7XHJcbiAgICBjaGFyc1BlckxpbmU6IG51bWJlcjtcclxuXHJcbiAgICBjb250ZW50ID0gXCI8ZGl2Pj4gXCI7XHJcblxyXG4gICAgcHJpdmF0ZSBjdXJzb3JWaXNpYmxlID0gdHJ1ZTtcclxuICAgIHByaXZhdGUgY3Vyc29yRW5hYmxlZCA9IHRydWU7XHJcbiAgICBwcml2YXRlIGN1cnNvclRpY2tzID0gMDtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihlbGVtOiBIVE1MRWxlbWVudCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGVsZW07XHJcblxyXG4gICAgICAgIHRoaXMuZm9udFNpemUgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmZvbnRTaXplLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkud2lkdGguc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuaGVpZ2h0LnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcclxuICAgICAgICBjb25zdCBjbGFtcCA9IG5ldyBMaW5lQ2xhbXAodGhpcy5lbGVtZW50KTtcclxuICAgICAgICB0aGlzLmxpbmVIZWlnaHQgPSBjbGFtcC5jYWxjdWxhdGVUZXh0TWV0cmljcygpLmFkZGl0aW9uYWxMaW5lSGVpZ2h0O1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiXCI7XHJcblxyXG4gICAgICAgIHRoaXMubWF4TGluZXMgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0IC8gdGhpcy5saW5lSGVpZ2h0KTtcclxuICAgICAgICB0aGlzLmNoYXJzUGVyTGluZSA9IE1hdGguZmxvb3IodGhpcy53aWR0aCAvICh0aGlzLmZvbnRTaXplICogMC42KSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzaXplKCkge1xyXG4gICAgICAgIHRoaXMud2lkdGggPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLndpZHRoLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmhlaWdodC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICB0aGlzLm1heExpbmVzID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAvIHRoaXMubGluZUhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5jaGFyc1BlckxpbmUgPSBNYXRoLmZsb29yKHRoaXMud2lkdGggLyAodGhpcy5mb250U2l6ZSAqIDAuNikpO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3Vyc29yRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJzb3JUaWNrcyA+PSBDVVJTT1JfQkxJTktfSU5URVJWQUwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Vyc29yVGlja3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ3Vyc29yKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnNvclRpY2tzICs9IGR0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHNob3coKSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmlubmVySFRNTCA9IHRoaXMuY29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICBjbGVhcigpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCA9IFwiXCI7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0UG9zaXRpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGVudC5sZW5ndGggLSAodGhpcy5jdXJzb3JWaXNpYmxlID8gMCA6IDEpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1dCh0ZXh0OiBzdHJpbmcsIHBvcz86IG51bWJlcikge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBwb3MgIT0gdW5kZWZpbmVkICYmXHJcbiAgICAgICAgICAgIHBvcyA+PSAwICYmXHJcbiAgICAgICAgICAgIHBvcyA8PSB0aGlzLmNvbnRlbnQubGVuZ3RoIC0gdGV4dC5sZW5ndGhcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ID1cclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudC5zbGljZSgwLCBwb3MpICtcclxuICAgICAgICAgICAgICAgIHRleHQgK1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50LnNsaWNlKHBvcyArIHRleHQubGVuZ3RoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgKz0gdGV4dDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHV0TGluZSh0ZXh0OiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCArPSB0ZXh0ICsgXCI8L2Rpdj48ZGl2Pj4gXCI7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzZXQoKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMucHV0KFwiPiBcIik7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHdyaXRlKHRleHQ6IHN0cmluZywgcG9zPzogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5wdXQodGV4dCwgcG9zKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGVMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMucHV0TGluZSh0ZXh0KTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgYnJlYWsoKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgKz0gXCI8L2Rpdj48YnIvPjxkaXY+PiBcIjtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmFuZG9tQ2hhcmFjdGVycyhjb3VudDogbnVtYmVyKSB7XHJcbiAgICAgICAgbGV0IHZhbHVlcyA9IG5ldyBVaW50OEFycmF5KGNvdW50KTtcclxuICAgICAgICB3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyh2YWx1ZXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZFZhbHVlcyA9IHZhbHVlcy5tYXAoKHgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgYWRqID0geCAlIDM2O1xyXG4gICAgICAgICAgICByZXR1cm4gYWRqIDwgMjYgPyBhZGogKyA2NSA6IGFkaiAtIDI2ICsgNDg7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG1hcHBlZFZhbHVlcyk7XHJcbiAgICB9XHJcblxyXG4gICAgZmlsbFJhbmRvbShsaW5lczogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXM7IGkrKykge1xyXG4gICAgICAgICAgICB0aGlzLnB1dCh0aGlzLnJhbmRvbUNoYXJhY3RlcnModGhpcy5jaGFyc1BlckxpbmUpKTtcclxuICAgICAgICAgICAgdGhpcy5wdXQoXCI8YnIgLz5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldEN1cnNvckVuYWJsZWQodmFsdWU6IGJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLmN1cnNvckVuYWJsZWQgPSB2YWx1ZTtcclxuICAgICAgICAvLyBpZiB0aGUgY3Vyc29yIG5lZWRlZCB0byBiZSB0dXJuZWQgb2ZmLCBmaXggaXRcclxuICAgICAgICBpZiAoIXRoaXMuY3Vyc29yRW5hYmxlZCAmJiAhdGhpcy5jdXJzb3JWaXNpYmxlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgICAgICB0aGlzLmN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGZsaXBDdXJzb3IoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3Vyc29yRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJzb3JWaXNpYmxlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgKz0gXCJfXCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgPSB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9ICF0aGlzLmN1cnNvclZpc2libGU7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCBCdWJibGVzIGZyb20gXCIuL2J1YmJsZXNcIjtcbmltcG9ydCBHYW1lIGZyb20gXCIuL2dhbWVcIjtcblxubGV0IGdhbWU6IEdhbWU7XG5cbmxldCBidWJibGVzOiBCdWJibGVzO1xuXG5sZXQgbGFzdFRpbWU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG53aW5kb3cub25sb2FkID0gKCkgPT4ge1xuICAgIGJ1YmJsZXMgPSBuZXcgQnViYmxlcyhcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJiYWNrZ3JvdW5kXCIpIGFzIEhUTUxDYW52YXNFbGVtZW50XG4gICAgKTtcbiAgICBnYW1lID0gbmV3IEdhbWUoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0ZXJtaW5hbFwiKSEpO1xuXG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xufTtcblxud2luZG93Lm9ucmVzaXplID0gKCkgPT4ge1xuICAgIGJ1YmJsZXMucmVzaXplKCk7XG4gICAgZ2FtZS5yZXNpemUoKTtcbn07XG5cbmRvY3VtZW50Lm9ua2V5ZG93biA9IChlKSA9PiB7XG4gICAgZ2FtZS5rZXlkb3duKGUpO1xufTtcblxuZG9jdW1lbnQub252aXNpYmlsaXR5Y2hhbmdlID0gKCkgPT4ge1xuICAgIGlmIChkb2N1bWVudC52aXNpYmlsaXR5U3RhdGUgPT0gXCJ2aXNpYmxlXCIpIHtcbiAgICAgICAgbGFzdFRpbWUgPSBudWxsO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAvLyBUaGlzIHJlYWxseSBzaG91bGRuJ3QgYmUgbmVlZGVkIGlmIGJyb3dzZXJzIGFyZSBmb2xsb3dpbmcgY29udmVudGlvbixcbiAgICAvLyBidXQgYmV0dGVyIHNhZmUgdGhhbiBzb3JyeVxuICAgIGlmIChkb2N1bWVudC5oaWRkZW4pIHtcbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGxhc3RUaW1lID09IG51bGwpIHtcbiAgICAgICAgbGFzdFRpbWUgPSAtMTtcbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChsYXN0VGltZSAhPSAtMSkge1xuICAgICAgICBsZXQgZHQgPSB0aW1lIC0gbGFzdFRpbWU7XG5cbiAgICAgICAgYnViYmxlcy51cGRhdGUoZHQpO1xuICAgICAgICBnYW1lLnVwZGF0ZShkdCk7XG4gICAgfVxuXG4gICAgbGFzdFRpbWUgPSB0aW1lO1xuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==