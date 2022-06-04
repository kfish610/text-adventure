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

module.exports = {"begin":{"text":"[delay 500]Connecting[delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750]\n[sound alarm.wav]<em>Beep</em> [delay 1000]<em>Beep</em> [delay 1000]<em>Beep</em>[delay 1000]\n[sound click.wav]You wake up slowly to the sound of your alarm.\nIt drones on and on until you wake up enough to turn it off.\nWhat do you do?","options":[{"icon":"newspaper","text":"Check the news","next":"checkNews"},{"icon":"arrow-up-from-bracket","text":"Get out of bed","next":"getUp"}]},"checkNews":{"text":"You grab your Augmented Reality glasses from your nightstand and put them on.\nAs you scroll somewhat absentmindedly through the news, one story catches your eye.\nAn image of a flooded town off of the Missisippi River.\nMurky brown water everywhere, past waist height.\nCars, buildings, and trees barely above the surface.[delay 1000][image https://images.foxtv.com/static.fox7austin.com/www.fox7austin.com/content/uploads/2020/02/932/524/Flooding-in-MIssissippi-.jpg?ve=1&tl=1]\nNature is a cruel mistress, you think.\nBut then again, we've always had to deal with natural disasters, right?\nWell, thats enough of the news for today. That stuff is always just depressing.","loop":"begin"},"getUp":{"text":"You get up and get ready for the day.\nWhen you come back out of the bathroom, you notice two things:\n1. It's freezing in here\n2. Your room is a mess","options":[{"icon":"fan","text":"Turn off the A/C","next":"turnOff"},{"icon":"folder","text":"Check out the mess","next":"mess","return":"continue"},{"icon":"arrow-up-from-bracket","text":"Leave","next":"leave"}]},"turnOff":{"text":"As you go over to turn off the air conditioning, you take a look out the window. Just as you expected, its cloudy and rainy. The A/C must have been making the temperature even colder than it already was outside.\nYou've had it turned all the way up for the past few days due to the heatwave. You'd been worried that it wasn't going to end: you had never seen a heatwave go for that long or that hot in your life. Clearly it's over now, though, if the temperature is anything to go by.\nYou adjust the A/C's settings in its app on your AR glasses. On to more important things.","loop":"getUp"},"mess":{"text":"You spend so much time at work nowadays that your room is pretty messy. In theory, all of your materials would be contained in the folder on your desk, but you spend so much time reorganizing and adjusting that it all ends up strewn about. You'd probably be better off using virtual documents, but something about feeling the papers in your hand still appeals to you more than just seeing them.\nYou pick up what few papers remain the folder and flick through them. They're the three studies you've based your presentation on. You stare at them for a little, pensively. You'd always wanted to be the one doing the research. That's why you took this job; presenting research seemed like a good way to get some connections, not to mention you needed the money. But at some point you lost track of that goal, and even though you can probably afford to go back to school now, being a researcher feels like someone else's dream. The kind of thing a kid tells themself before they've been exposed to the real world.\nThis job is fine. It pays well. <b>It's fine</b>.\nAnyway, you have three studies in the folder.\nDo you want to review any of them before the big hearing later?","options":[{"icon":"industry","text":"CCS Study","next":"ccs"},{"icon":"fire-flame-simple","text":"Efficiency Study","next":"efficiency"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"lca"},{"icon":"arrow-up-from-bracket","text":"Continue","next":"continue"}]},"ccs":{"text":"CCS Study","loop":"mess"},"efficiency":{"text":"Efficiency Study","loop":"mess"},"lca":{"text":"Lifecycle Analysis","loop":"mess"},"continue":{"text":"You turn your attention to the rest of the room.","loop":"getUp"}}

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
        this.audio.loop(false);
        this.remainingText = story[this.scene].text;
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
        var _this = this;
        switch (index) {
            case 0: // <
                var endTagPos = this.remainingText.indexOf(">");
                term.write(this.remainingText.slice(0, endTagPos + 1));
                this.remainingText = this.remainingText.slice(endTagPos + 1);
                break;
            case 1: // [
                var endCommandPos = this.remainingText.indexOf("]");
                var command = this.remainingText.slice(1, endCommandPos);
                var spacePos = command.indexOf(" ");
                switch (spacePos == -1 ? command : command.slice(0, spacePos)) {
                    case "delay":
                        this.delay = parseInt(command.slice(spacePos + 1));
                        break;
                    case "normal":
                        this.audio.play(this.currSound);
                        term.write(command.slice(spacePos + 1));
                        break;
                    case "sep":
                        break;
                    case "sound":
                        this.currSound = command.slice(spacePos + 1);
                        break;
                    case "background":
                        if (spacePos == -1) {
                            this.background.stop();
                        }
                        else {
                            this.background.play(command.slice(spacePos + 1), 0.1);
                        }
                        break;
                    case "image":
                        document.getElementById('image').src = command.slice(spacePos + 1);
                        document.getElementById('image-container').className = "show";
                        this.lock = true;
                        document.getElementById('image-close').onclick = function () {
                            _this.lock = false;
                            document.getElementById('image-container').className = "";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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cy9AdHZhbmMvbGluZWNsYW1wL2Rpc3QvZXNtLmpzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0b3J5LmNzb24iLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYXVkaW9fbWFuYWdlci50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9idWJibGVzLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2J1dHRvbnMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvZ2FtZS50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdGF0ZS50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdGF0ZV9tYW5hZ2VyLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlcy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy90ZXJtaW5hbC50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVkdWNlcyBmb250IHNpemUgb3IgdHJpbXMgdGV4dCB0byBtYWtlIGl0IGZpdCB3aXRoaW4gc3BlY2lmaWVkIGJvdW5kcy5cbiAqXG4gKiBTdXBwb3J0cyBjbGFtcGluZyBieSBudW1iZXIgb2YgbGluZXMgb3IgdGV4dCBoZWlnaHQuXG4gKlxuICogS25vd24gbGltaXRhdGlvbnM6XG4gKiAxLiBDaGFyYWN0ZXJzIHRoYXQgZGlzdG9ydCBsaW5lIGhlaWdodHMgKGVtb2ppcywgemFsZ28pIG1heSBjYXVzZVxuICogdW5leHBlY3RlZCByZXN1bHRzLlxuICogMi4gQ2FsbGluZyB7QHNlZSBoYXJkQ2xhbXAoKX0gd2lwZXMgY2hpbGQgZWxlbWVudHMuIEZ1dHVyZSB1cGRhdGVzIG1heSBhbGxvd1xuICogaW5saW5lIGNoaWxkIGVsZW1lbnRzIHRvIGJlIHByZXNlcnZlZC5cbiAqXG4gKiBAdG9kbyBTcGxpdCB0ZXh0IG1ldHJpY3MgaW50byBvd24gbGlicmFyeVxuICogQHRvZG8gVGVzdCBub24tTFRSIHRleHRcbiAqL1xuY2xhc3MgTGluZUNsYW1wIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnRcbiAgICogVGhlIGVsZW1lbnQgdG8gY2xhbXAuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogT3B0aW9ucyB0byBnb3Zlcm4gY2xhbXBpbmcgYmVoYXZpb3IuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhMaW5lc11cbiAgICogVGhlIG1heGltdW0gbnVtYmVyIG9mIGxpbmVzIHRvIGFsbG93LiBEZWZhdWx0cyB0byAxLlxuICAgKiBUbyBzZXQgYSBtYXhpbXVtIGhlaWdodCBpbnN0ZWFkLCB1c2Uge0BzZWUgb3B0aW9ucy5tYXhIZWlnaHR9XG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhIZWlnaHRdXG4gICAqIFRoZSBtYXhpbXVtIGhlaWdodCAoaW4gcGl4ZWxzKSBvZiB0ZXh0IGluIGFuIGVsZW1lbnQuXG4gICAqIFRoaXMgb3B0aW9uIGlzIHVuZGVmaW5lZCBieSBkZWZhdWx0LiBPbmNlIHNldCwgaXQgdGFrZXMgcHJlY2VkZW5jZSBvdmVyXG4gICAqIHtAc2VlIG9wdGlvbnMubWF4TGluZXN9LiBOb3RlIHRoYXQgdGhpcyBhcHBsaWVzIHRvIHRoZSBoZWlnaHQgb2YgdGhlIHRleHQsIG5vdFxuICAgKiB0aGUgZWxlbWVudCBpdHNlbGYuIFJlc3RyaWN0aW5nIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgY2FuIGJlIGFjaGlldmVkXG4gICAqIHdpdGggQ1NTIDxjb2RlPm1heC1oZWlnaHQ8L2NvZGU+LlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnVzZVNvZnRDbGFtcF1cbiAgICogSWYgdHJ1ZSwgcmVkdWNlIGZvbnQgc2l6ZSAoc29mdCBjbGFtcCkgdG8gYXQgbGVhc3Qge0BzZWUgb3B0aW9ucy5taW5Gb250U2l6ZX1cbiAgICogYmVmb3JlIHJlc29ydGluZyB0byB0cmltbWluZyB0ZXh0LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICpcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5oYXJkQ2xhbXBBc0ZhbGxiYWNrXVxuICAgKiBJZiB0cnVlLCByZXNvcnQgdG8gaGFyZCBjbGFtcGluZyBpZiBzb2Z0IGNsYW1waW5nIHJlYWNoZXMgdGhlIG1pbmltdW0gZm9udCBzaXplXG4gICAqIGFuZCBzdGlsbCBkb2Vzbid0IGZpdCB3aXRoaW4gdGhlIG1heCBoZWlnaHQgb3IgbnVtYmVyIG9mIGxpbmVzLlxuICAgKiBEZWZhdWx0cyB0byB0cnVlLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZWxsaXBzaXNdXG4gICAqIFRoZSBjaGFyYWN0ZXIgd2l0aCB3aGljaCB0byByZXByZXNlbnQgY2xpcHBlZCB0cmFpbGluZyB0ZXh0LlxuICAgKiBUaGlzIG9wdGlvbiB0YWtlcyBlZmZlY3Qgd2hlbiBcImhhcmRcIiBjbGFtcGluZyBpcyB1c2VkLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWluRm9udFNpemVdXG4gICAqIFRoZSBsb3dlc3QgZm9udCBzaXplLCBpbiBwaXhlbHMsIHRvIHRyeSBiZWZvcmUgcmVzb3J0aW5nIHRvIHJlbW92aW5nXG4gICAqIHRyYWlsaW5nIHRleHQgKGhhcmQgY2xhbXBpbmcpLiBEZWZhdWx0cyB0byAxLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4Rm9udFNpemVdXG4gICAqIFRoZSBtYXhpbXVtIGZvbnQgc2l6ZSBpbiBwaXhlbHMuIFdlJ2xsIHN0YXJ0IHdpdGggdGhpcyBmb250IHNpemUgdGhlblxuICAgKiByZWR1Y2UgdW50aWwgdGV4dCBmaXRzIGNvbnN0cmFpbnRzLCBvciBmb250IHNpemUgaXMgZXF1YWwgdG9cbiAgICoge0BzZWUgb3B0aW9ucy5taW5Gb250U2l6ZX0uIERlZmF1bHRzIHRvIHRoZSBlbGVtZW50J3MgaW5pdGlhbCBjb21wdXRlZCBmb250IHNpemUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbGVtZW50LFxuICAgIHtcbiAgICAgIG1heExpbmVzID0gdW5kZWZpbmVkLFxuICAgICAgbWF4SGVpZ2h0ID0gdW5kZWZpbmVkLFxuICAgICAgdXNlU29mdENsYW1wID0gZmFsc2UsXG4gICAgICBoYXJkQ2xhbXBBc0ZhbGxiYWNrID0gdHJ1ZSxcbiAgICAgIG1pbkZvbnRTaXplID0gMSxcbiAgICAgIG1heEZvbnRTaXplID0gdW5kZWZpbmVkLFxuICAgICAgZWxsaXBzaXMgPSBcIuKAplwiLFxuICAgIH0gPSB7fVxuICApIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJvcmlnaW5hbFdvcmRzXCIsIHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiBlbGVtZW50LnRleHRDb250ZW50Lm1hdGNoKC9cXFMrXFxzKi9nKSB8fCBbXSxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInVwZGF0ZUhhbmRsZXJcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6ICgpID0+IHRoaXMuYXBwbHkoKSxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm9ic2VydmVyXCIsIHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiBuZXcgTXV0YXRpb25PYnNlcnZlcih0aGlzLnVwZGF0ZUhhbmRsZXIpLFxuICAgIH0pO1xuXG4gICAgaWYgKHVuZGVmaW5lZCA9PT0gbWF4Rm9udFNpemUpIHtcbiAgICAgIG1heEZvbnRTaXplID0gcGFyc2VJbnQod2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkuZm9udFNpemUsIDEwKTtcbiAgICB9XG5cbiAgICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xuICAgIHRoaXMubWF4TGluZXMgPSBtYXhMaW5lcztcbiAgICB0aGlzLm1heEhlaWdodCA9IG1heEhlaWdodDtcbiAgICB0aGlzLnVzZVNvZnRDbGFtcCA9IHVzZVNvZnRDbGFtcDtcbiAgICB0aGlzLmhhcmRDbGFtcEFzRmFsbGJhY2sgPSBoYXJkQ2xhbXBBc0ZhbGxiYWNrO1xuICAgIHRoaXMubWluRm9udFNpemUgPSBtaW5Gb250U2l6ZTtcbiAgICB0aGlzLm1heEZvbnRTaXplID0gbWF4Rm9udFNpemU7XG4gICAgdGhpcy5lbGxpcHNpcyA9IGVsbGlwc2lzO1xuICB9XG5cbiAgLyoqXG4gICAqIEdhdGhlciBtZXRyaWNzIGFib3V0IHRoZSBsYXlvdXQgb2YgdGhlIGVsZW1lbnQncyB0ZXh0LlxuICAgKiBUaGlzIGlzIGEgc29tZXdoYXQgZXhwZW5zaXZlIG9wZXJhdGlvbiAtIGNhbGwgd2l0aCBjYXJlLlxuICAgKlxuICAgKiBAcmV0dXJucyB7VGV4dE1ldHJpY3N9XG4gICAqIExheW91dCBtZXRyaWNzIGZvciB0aGUgY2xhbXBlZCBlbGVtZW50J3MgdGV4dC5cbiAgICovXG4gIGNhbGN1bGF0ZVRleHRNZXRyaWNzKCkge1xuICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmVsZW1lbnQ7XG4gICAgY29uc3QgY2xvbmUgPSBlbGVtZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICBjb25zdCBzdHlsZSA9IGNsb25lLnN0eWxlO1xuXG4gICAgLy8gQXBwZW5kLCBkb24ndCByZXBsYWNlXG4gICAgc3R5bGUuY3NzVGV4dCArPSBcIjttaW4taGVpZ2h0OjAhaW1wb3J0YW50O21heC1oZWlnaHQ6bm9uZSFpbXBvcnRhbnRcIjtcbiAgICBlbGVtZW50LnJlcGxhY2VXaXRoKGNsb25lKTtcblxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG5cbiAgICAvLyBDbGVhciB0byBtZWFzdXJlIGVtcHR5IGhlaWdodC4gdGV4dENvbnRlbnQgZmFzdGVyIHRoYW4gaW5uZXJIVE1MXG4gICAgY2xvbmUudGV4dENvbnRlbnQgPSBcIlwiO1xuXG4gICAgY29uc3QgbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0ID0gY2xvbmUub2Zmc2V0SGVpZ2h0O1xuICAgIGNvbnN0IHRleHRIZWlnaHQgPSBuYXR1cmFsSGVpZ2h0IC0gbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0O1xuXG4gICAgLy8gRmlsbCBlbGVtZW50IHdpdGggc2luZ2xlIG5vbi1icmVha2luZyBzcGFjZSB0byBmaW5kIGhlaWdodCBvZiBvbmUgbGluZVxuICAgIGNsb25lLnRleHRDb250ZW50ID0gXCJcXHhhMFwiO1xuXG4gICAgLy8gR2V0IGhlaWdodCBvZiBlbGVtZW50IHdpdGggb25seSBvbmUgbGluZSBvZiB0ZXh0XG4gICAgY29uc3QgbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lID0gY2xvbmUub2Zmc2V0SGVpZ2h0O1xuICAgIGNvbnN0IGZpcnN0TGluZUhlaWdodCA9IG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSAtIG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dDtcblxuICAgIC8vIEFkZCBsaW5lICg8YnI+ICsgbmJzcCkuIGFwcGVuZENoaWxkKCkgZmFzdGVyIHRoYW4gaW5uZXJIVE1MXG4gICAgY2xvbmUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJyXCIpKTtcbiAgICBjbG9uZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlxceGEwXCIpKTtcblxuICAgIGNvbnN0IGFkZGl0aW9uYWxMaW5lSGVpZ2h0ID0gY2xvbmUub2Zmc2V0SGVpZ2h0IC0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lO1xuICAgIGNvbnN0IGxpbmVDb3VudCA9XG4gICAgICAxICsgKG5hdHVyYWxIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUpIC8gYWRkaXRpb25hbExpbmVIZWlnaHQ7XG5cbiAgICAvLyBSZXN0b3JlIG9yaWdpbmFsIGNvbnRlbnRcbiAgICBjbG9uZS5yZXBsYWNlV2l0aChlbGVtZW50KTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlZGVmIHtPYmplY3R9IFRleHRNZXRyaWNzXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge3RleHRIZWlnaHR9XG4gICAgICogVGhlIHZlcnRpY2FsIHNwYWNlIHJlcXVpcmVkIHRvIGRpc3BsYXkgdGhlIGVsZW1lbnQncyBjdXJyZW50IHRleHQuXG4gICAgICogVGhpcyBpcyA8ZW0+bm90PC9lbT4gbmVjZXNzYXJpbHkgdGhlIHNhbWUgYXMgdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudC5cbiAgICAgKiBUaGlzIG51bWJlciBtYXkgZXZlbiBiZSBncmVhdGVyIHRoYW4gdGhlIGVsZW1lbnQncyBoZWlnaHQgaW4gY2FzZXNcbiAgICAgKiB3aGVyZSB0aGUgdGV4dCBvdmVyZmxvd3MgdGhlIGVsZW1lbnQncyBibG9jayBheGlzLlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmV9XG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCB3aXRoIG9ubHkgb25lIGxpbmUgb2YgdGV4dCBhbmQgd2l0aG91dFxuICAgICAqIG1pbmltdW0gb3IgbWF4aW11bSBoZWlnaHRzLiBUaGlzIGluZm9ybWF0aW9uIG1heSBiZSBoZWxwZnVsIHdoZW5cbiAgICAgKiBkZWFsaW5nIHdpdGggaW5saW5lIGVsZW1lbnRzIChhbmQgcG90ZW50aWFsbHkgb3RoZXIgc2NlbmFyaW9zKSwgd2hlcmVcbiAgICAgKiB0aGUgZmlyc3QgbGluZSBvZiB0ZXh0IGRvZXMgbm90IGluY3JlYXNlIHRoZSBlbGVtZW50J3MgaGVpZ2h0LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtmaXJzdExpbmVIZWlnaHR9XG4gICAgICogVGhlIGhlaWdodCB0aGF0IHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgYWRkcyB0byB0aGUgZWxlbWVudCwgaS5lLiwgdGhlXG4gICAgICogZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgd2hpbGUgZW1wdHkgYW5kIHRoZSBoZWlnaHRcbiAgICAgKiBvZiB0aGUgZWxlbWVudCB3aGlsZSBpdCBjb250YWlucyBvbmUgbGluZSBvZiB0ZXh0LiBUaGlzIG51bWJlciBtYXkgYmVcbiAgICAgKiB6ZXJvIGZvciBpbmxpbmUgZWxlbWVudHMgYmVjYXVzZSB0aGUgZmlyc3QgbGluZSBvZiB0ZXh0IGRvZXMgbm90XG4gICAgICogaW5jcmVhc2UgdGhlIGhlaWdodCBvZiBpbmxpbmUgZWxlbWVudHMuXG5cbiAgICAgKiBAcHJvcGVydHkge2FkZGl0aW9uYWxMaW5lSGVpZ2h0fVxuICAgICAqIFRoZSBoZWlnaHQgdGhhdCBlYWNoIGxpbmUgb2YgdGV4dCBhZnRlciB0aGUgZmlyc3QgYWRkcyB0byB0aGUgZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7bGluZUNvdW50fVxuICAgICAqIFRoZSBudW1iZXIgb2YgbGluZXMgb2YgdGV4dCB0aGUgZWxlbWVudCBjb250YWlucy5cbiAgICAgKi9cbiAgICByZXR1cm4ge1xuICAgICAgdGV4dEhlaWdodCxcbiAgICAgIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSxcbiAgICAgIGZpcnN0TGluZUhlaWdodCxcbiAgICAgIGFkZGl0aW9uYWxMaW5lSGVpZ2h0LFxuICAgICAgbGluZUNvdW50LFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXYXRjaCBmb3IgY2hhbmdlcyB0aGF0IG1heSBhZmZlY3QgbGF5b3V0LiBSZXNwb25kIGJ5IHJlY2xhbXBpbmcgaWZcbiAgICogbmVjZXNzYXJ5LlxuICAgKi9cbiAgd2F0Y2goKSB7XG4gICAgaWYgKCF0aGlzLl93YXRjaGluZykge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy51cGRhdGVIYW5kbGVyKTtcblxuICAgICAgLy8gTWluaW11bSByZXF1aXJlZCB0byBkZXRlY3QgY2hhbmdlcyB0byB0ZXh0IG5vZGVzLFxuICAgICAgLy8gYW5kIHdob2xlc2FsZSByZXBsYWNlbWVudCB2aWEgaW5uZXJIVE1MXG4gICAgICB0aGlzLm9ic2VydmVyLm9ic2VydmUodGhpcy5lbGVtZW50LCB7XG4gICAgICAgIGNoYXJhY3RlckRhdGE6IHRydWUsXG4gICAgICAgIHN1YnRyZWU6IHRydWUsXG4gICAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICAgICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl93YXRjaGluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wIHdhdGNoaW5nIGZvciBsYXlvdXQgY2hhbmdlcy5cbiAgICpcbiAgICogQHJldHVybnMge0xpbmVDbGFtcH1cbiAgICovXG4gIHVud2F0Y2goKSB7XG4gICAgdGhpcy5vYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy51cGRhdGVIYW5kbGVyKTtcblxuICAgIHRoaXMuX3dhdGNoaW5nID0gZmFsc2U7XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIENvbmR1Y3QgZWl0aGVyIHNvZnQgY2xhbXBpbmcgb3IgaGFyZCBjbGFtcGluZywgYWNjb3JkaW5nIHRvIHRoZSB2YWx1ZSBvZlxuICAgKiBwcm9wZXJ0eSB7QHNlZSBMaW5lQ2xhbXAudXNlU29mdENsYW1wfS5cbiAgICovXG4gIGFwcGx5KCkge1xuICAgIGlmICh0aGlzLmVsZW1lbnQub2Zmc2V0SGVpZ2h0KSB7XG4gICAgICBjb25zdCBwcmV2aW91c2x5V2F0Y2hpbmcgPSB0aGlzLl93YXRjaGluZztcblxuICAgICAgLy8gSWdub3JlIGludGVybmFsbHkgc3RhcnRlZCBtdXRhdGlvbnMsIGxlc3Qgd2UgcmVjdXJzZSBpbnRvIG9ibGl2aW9uXG4gICAgICB0aGlzLnVud2F0Y2goKTtcblxuICAgICAgdGhpcy5lbGVtZW50LnRleHRDb250ZW50ID0gdGhpcy5vcmlnaW5hbFdvcmRzLmpvaW4oXCJcIik7XG5cbiAgICAgIGlmICh0aGlzLnVzZVNvZnRDbGFtcCkge1xuICAgICAgICB0aGlzLnNvZnRDbGFtcCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5oYXJkQ2xhbXAoKTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVzdW1lIG9ic2VydmF0aW9uIGlmIHByZXZpb3VzbHkgd2F0Y2hpbmdcbiAgICAgIGlmIChwcmV2aW91c2x5V2F0Y2hpbmcpIHtcbiAgICAgICAgdGhpcy53YXRjaChmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmltcyB0ZXh0IHVudGlsIGl0IGZpdHMgd2l0aGluIGNvbnN0cmFpbnRzXG4gICAqIChtYXhpbXVtIGhlaWdodCBvciBudW1iZXIgb2YgbGluZXMpLlxuICAgKlxuICAgKiBAc2VlIHtMaW5lQ2xhbXAubWF4TGluZXN9XG4gICAqIEBzZWUge0xpbmVDbGFtcC5tYXhIZWlnaHR9XG4gICAqL1xuICBoYXJkQ2xhbXAoc2tpcENoZWNrID0gdHJ1ZSkge1xuICAgIGlmIChza2lwQ2hlY2sgfHwgdGhpcy5zaG91bGRDbGFtcCgpKSB7XG4gICAgICBsZXQgY3VycmVudFRleHQ7XG5cbiAgICAgIGZpbmRCb3VuZGFyeShcbiAgICAgICAgMSxcbiAgICAgICAgdGhpcy5vcmlnaW5hbFdvcmRzLmxlbmd0aCxcbiAgICAgICAgKHZhbCkgPT4ge1xuICAgICAgICAgIGN1cnJlbnRUZXh0ID0gdGhpcy5vcmlnaW5hbFdvcmRzLnNsaWNlKDAsIHZhbCkuam9pbihcIiBcIik7XG4gICAgICAgICAgdGhpcy5lbGVtZW50LnRleHRDb250ZW50ID0gY3VycmVudFRleHQ7XG5cbiAgICAgICAgICByZXR1cm4gdGhpcy5zaG91bGRDbGFtcCgpXG4gICAgICAgIH0sXG4gICAgICAgICh2YWwsIG1pbiwgbWF4KSA9PiB7XG4gICAgICAgICAgLy8gQWRkIG9uZSBtb3JlIHdvcmQgaWYgbm90IG9uIG1heFxuICAgICAgICAgIGlmICh2YWwgPiBtaW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRUZXh0ID0gdGhpcy5vcmlnaW5hbFdvcmRzLnNsaWNlKDAsIG1heCkuam9pbihcIiBcIik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVGhlbiB0cmltIGxldHRlcnMgdW50aWwgaXQgZml0c1xuICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgIGN1cnJlbnRUZXh0ID0gY3VycmVudFRleHQuc2xpY2UoMCwgLTEpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnRleHRDb250ZW50ID0gY3VycmVudFRleHQgKyB0aGlzLmVsbGlwc2lzO1xuICAgICAgICAgIH0gd2hpbGUgKHRoaXMuc2hvdWxkQ2xhbXAoKSlcblxuICAgICAgICAgIC8vIEJyb2FkY2FzdCBtb3JlIHNwZWNpZmljIGhhcmRDbGFtcCBldmVudCBmaXJzdFxuICAgICAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuaGFyZGNsYW1wXCIpO1xuICAgICAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuY2xhbXBcIik7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWR1Y2VzIGZvbnQgc2l6ZSB1bnRpbCB0ZXh0IGZpdHMgd2l0aGluIHRoZSBzcGVjaWZpZWQgaGVpZ2h0IG9yIG51bWJlciBvZlxuICAgKiBsaW5lcy4gUmVzb3J0cyB0byB1c2luZyB7QHNlZSBoYXJkQ2xhbXAoKX0gaWYgdGV4dCBzdGlsbCBleGNlZWRzIGNsYW1wXG4gICAqIHBhcmFtZXRlcnMuXG4gICAqL1xuICBzb2Z0Q2xhbXAoKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB0aGlzLmVsZW1lbnQuc3R5bGU7XG4gICAgY29uc3Qgc3RhcnRTaXplID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5mb250U2l6ZTtcbiAgICBzdHlsZS5mb250U2l6ZSA9IFwiXCI7XG5cbiAgICBsZXQgZG9uZSA9IGZhbHNlO1xuICAgIGxldCBzaG91bGRDbGFtcDtcblxuICAgIGZpbmRCb3VuZGFyeShcbiAgICAgIHRoaXMubWluRm9udFNpemUsXG4gICAgICB0aGlzLm1heEZvbnRTaXplLFxuICAgICAgKHZhbCkgPT4ge1xuICAgICAgICBzdHlsZS5mb250U2l6ZSA9IHZhbCArIFwicHhcIjtcbiAgICAgICAgc2hvdWxkQ2xhbXAgPSB0aGlzLnNob3VsZENsYW1wKCk7XG4gICAgICAgIHJldHVybiBzaG91bGRDbGFtcFxuICAgICAgfSxcbiAgICAgICh2YWwsIG1pbikgPT4ge1xuICAgICAgICBpZiAodmFsID4gbWluKSB7XG4gICAgICAgICAgc3R5bGUuZm9udFNpemUgPSBtaW4gKyBcInB4XCI7XG4gICAgICAgICAgc2hvdWxkQ2xhbXAgPSB0aGlzLnNob3VsZENsYW1wKCk7XG4gICAgICAgIH1cbiAgICAgICAgZG9uZSA9ICFzaG91bGRDbGFtcDtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgY2hhbmdlZCA9IHN0eWxlLmZvbnRTaXplICE9PSBzdGFydFNpemU7XG5cbiAgICAvLyBFbWl0IHNwZWNpZmljIHNvZnRDbGFtcCBldmVudCBmaXJzdFxuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLnNvZnRjbGFtcFwiKTtcbiAgICB9XG5cbiAgICAvLyBEb24ndCBlbWl0IGBsaW5lY2xhbXAuY2xhbXBgIGV2ZW50IHR3aWNlLlxuICAgIGlmICghZG9uZSAmJiB0aGlzLmhhcmRDbGFtcEFzRmFsbGJhY2spIHtcbiAgICAgIHRoaXMuaGFyZENsYW1wKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGNoYW5nZWQpIHtcbiAgICAgIC8vIGhhcmRDbGFtcCBlbWl0cyBgbGluZWNsYW1wLmNsYW1wYCB0b28uIE9ubHkgZW1pdCBmcm9tIGhlcmUgaWYgd2UncmVcbiAgICAgIC8vIG5vdCBhbHNvIGhhcmQgY2xhbXBpbmcuXG4gICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmNsYW1wXCIpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqIFdoZXRoZXIgaGVpZ2h0IG9mIHRleHQgb3IgbnVtYmVyIG9mIGxpbmVzIGV4Y2VlZCBjb25zdHJhaW50cy5cbiAgICpcbiAgICogQHNlZSBMaW5lQ2xhbXAubWF4SGVpZ2h0XG4gICAqIEBzZWUgTGluZUNsYW1wLm1heExpbmVzXG4gICAqL1xuICBzaG91bGRDbGFtcCgpIHtcbiAgICBjb25zdCB7IGxpbmVDb3VudCwgdGV4dEhlaWdodCB9ID0gdGhpcy5jYWxjdWxhdGVUZXh0TWV0cmljcygpO1xuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhIZWlnaHQgJiYgdW5kZWZpbmVkICE9PSB0aGlzLm1heExpbmVzKSB7XG4gICAgICByZXR1cm4gdGV4dEhlaWdodCA+IHRoaXMubWF4SGVpZ2h0IHx8IGxpbmVDb3VudCA+IHRoaXMubWF4TGluZXNcbiAgICB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heEhlaWdodCkge1xuICAgICAgcmV0dXJuIHRleHRIZWlnaHQgPiB0aGlzLm1heEhlaWdodFxuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4TGluZXMpIHtcbiAgICAgIHJldHVybiBsaW5lQ291bnQgPiB0aGlzLm1heExpbmVzXG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJtYXhMaW5lcyBvciBtYXhIZWlnaHQgbXVzdCBiZSBzZXQgYmVmb3JlIGNhbGxpbmcgc2hvdWxkQ2xhbXAoKS5cIlxuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIFBlcmZvcm1zIGEgYmluYXJ5IHNlYXJjaCBmb3IgdGhlIG1heGltdW0gd2hvbGUgbnVtYmVyIGluIGEgY29udGlnb3VzIHJhbmdlXG4gKiB3aGVyZSBhIGdpdmVuIHRlc3QgY2FsbGJhY2sgd2lsbCBnbyBmcm9tIHJldHVybmluZyB0cnVlIHRvIHJldHVybmluZyBmYWxzZS5cbiAqXG4gKiBTaW5jZSB0aGlzIHVzZXMgYSBiaW5hcnktc2VhcmNoIGFsZ29yaXRobSB0aGlzIGlzIGFuIE8obG9nIG4pIGZ1bmN0aW9uLFxuICogd2hlcmUgbiA9IG1heCAtIG1pbi5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbWluXG4gKiBUaGUgbG93ZXIgYm91bmRhcnkgb2YgdGhlIHJhbmdlLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhcbiAqIFRoZSB1cHBlciBib3VuZGFyeSBvZiB0aGUgcmFuZ2UuXG4gKlxuICogQHBhcmFtIHRlc3RcbiAqIEEgY2FsbGJhY2sgdGhhdCByZWNlaXZlcyB0aGUgY3VycmVudCB2YWx1ZSBpbiB0aGUgcmFuZ2UgYW5kIHJldHVybnMgYSB0cnV0aHkgb3IgZmFsc3kgdmFsdWUuXG4gKlxuICogQHBhcmFtIGRvbmVcbiAqIEEgZnVuY3Rpb24gdG8gcGVyZm9ybSB3aGVuIGNvbXBsZXRlLiBSZWNlaXZlcyB0aGUgZm9sbG93aW5nIHBhcmFtZXRlcnNcbiAqIC0gY3Vyc29yXG4gKiAtIG1heFBhc3NpbmdWYWx1ZVxuICogLSBtaW5GYWlsaW5nVmFsdWVcbiAqL1xuZnVuY3Rpb24gZmluZEJvdW5kYXJ5KG1pbiwgbWF4LCB0ZXN0LCBkb25lKSB7XG4gIGxldCBjdXJzb3IgPSBtYXg7XG4gIC8vIHN0YXJ0IGhhbGZ3YXkgdGhyb3VnaCB0aGUgcmFuZ2VcbiAgd2hpbGUgKG1heCA+IG1pbikge1xuICAgIGlmICh0ZXN0KGN1cnNvcikpIHtcbiAgICAgIG1heCA9IGN1cnNvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgbWluID0gY3Vyc29yO1xuICAgIH1cblxuICAgIGlmIChtYXggLSBtaW4gPT09IDEpIHtcbiAgICAgIGRvbmUoY3Vyc29yLCBtaW4sIG1heCk7XG4gICAgICBicmVha1xuICAgIH1cblxuICAgIGN1cnNvciA9IE1hdGgucm91bmQoKG1pbiArIG1heCkgLyAyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbWl0KGluc3RhbmNlLCB0eXBlKSB7XG4gIGluc3RhbmNlLmVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQodHlwZSkpO1xufVxuXG5leHBvcnQgeyBMaW5lQ2xhbXAgYXMgZGVmYXVsdCB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XCJiZWdpblwiOntcInRleHRcIjpcIltkZWxheSA1MDBdQ29ubmVjdGluZ1tkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdXFxuW3NvdW5kIGFsYXJtLndhdl08ZW0+QmVlcDwvZW0+IFtkZWxheSAxMDAwXTxlbT5CZWVwPC9lbT4gW2RlbGF5IDEwMDBdPGVtPkJlZXA8L2VtPltkZWxheSAxMDAwXVxcbltzb3VuZCBjbGljay53YXZdWW91IHdha2UgdXAgc2xvd2x5IHRvIHRoZSBzb3VuZCBvZiB5b3VyIGFsYXJtLlxcbkl0IGRyb25lcyBvbiBhbmQgb24gdW50aWwgeW91IHdha2UgdXAgZW5vdWdoIHRvIHR1cm4gaXQgb2ZmLlxcbldoYXQgZG8geW91IGRvP1wiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJuZXdzcGFwZXJcIixcInRleHRcIjpcIkNoZWNrIHRoZSBuZXdzXCIsXCJuZXh0XCI6XCJjaGVja05ld3NcIn0se1wiaWNvblwiOlwiYXJyb3ctdXAtZnJvbS1icmFja2V0XCIsXCJ0ZXh0XCI6XCJHZXQgb3V0IG9mIGJlZFwiLFwibmV4dFwiOlwiZ2V0VXBcIn1dfSxcImNoZWNrTmV3c1wiOntcInRleHRcIjpcIllvdSBncmFiIHlvdXIgQXVnbWVudGVkIFJlYWxpdHkgZ2xhc3NlcyBmcm9tIHlvdXIgbmlnaHRzdGFuZCBhbmQgcHV0IHRoZW0gb24uXFxuQXMgeW91IHNjcm9sbCBzb21ld2hhdCBhYnNlbnRtaW5kZWRseSB0aHJvdWdoIHRoZSBuZXdzLCBvbmUgc3RvcnkgY2F0Y2hlcyB5b3VyIGV5ZS5cXG5BbiBpbWFnZSBvZiBhIGZsb29kZWQgdG93biBvZmYgb2YgdGhlIE1pc3Npc2lwcGkgUml2ZXIuXFxuTXVya3kgYnJvd24gd2F0ZXIgZXZlcnl3aGVyZSwgcGFzdCB3YWlzdCBoZWlnaHQuXFxuQ2FycywgYnVpbGRpbmdzLCBhbmQgdHJlZXMgYmFyZWx5IGFib3ZlIHRoZSBzdXJmYWNlLltkZWxheSAxMDAwXVtpbWFnZSBodHRwczovL2ltYWdlcy5mb3h0di5jb20vc3RhdGljLmZveDdhdXN0aW4uY29tL3d3dy5mb3g3YXVzdGluLmNvbS9jb250ZW50L3VwbG9hZHMvMjAyMC8wMi85MzIvNTI0L0Zsb29kaW5nLWluLU1Jc3Npc3NpcHBpLS5qcGc/dmU9MSZ0bD0xXVxcbk5hdHVyZSBpcyBhIGNydWVsIG1pc3RyZXNzLCB5b3UgdGhpbmsuXFxuQnV0IHRoZW4gYWdhaW4sIHdlJ3ZlIGFsd2F5cyBoYWQgdG8gZGVhbCB3aXRoIG5hdHVyYWwgZGlzYXN0ZXJzLCByaWdodD9cXG5XZWxsLCB0aGF0cyBlbm91Z2ggb2YgdGhlIG5ld3MgZm9yIHRvZGF5LiBUaGF0IHN0dWZmIGlzIGFsd2F5cyBqdXN0IGRlcHJlc3NpbmcuXCIsXCJsb29wXCI6XCJiZWdpblwifSxcImdldFVwXCI6e1widGV4dFwiOlwiWW91IGdldCB1cCBhbmQgZ2V0IHJlYWR5IGZvciB0aGUgZGF5LlxcbldoZW4geW91IGNvbWUgYmFjayBvdXQgb2YgdGhlIGJhdGhyb29tLCB5b3Ugbm90aWNlIHR3byB0aGluZ3M6XFxuMS4gSXQncyBmcmVlemluZyBpbiBoZXJlXFxuMi4gWW91ciByb29tIGlzIGEgbWVzc1wiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJmYW5cIixcInRleHRcIjpcIlR1cm4gb2ZmIHRoZSBBL0NcIixcIm5leHRcIjpcInR1cm5PZmZcIn0se1wiaWNvblwiOlwiZm9sZGVyXCIsXCJ0ZXh0XCI6XCJDaGVjayBvdXQgdGhlIG1lc3NcIixcIm5leHRcIjpcIm1lc3NcIixcInJldHVyblwiOlwiY29udGludWVcIn0se1wiaWNvblwiOlwiYXJyb3ctdXAtZnJvbS1icmFja2V0XCIsXCJ0ZXh0XCI6XCJMZWF2ZVwiLFwibmV4dFwiOlwibGVhdmVcIn1dfSxcInR1cm5PZmZcIjp7XCJ0ZXh0XCI6XCJBcyB5b3UgZ28gb3ZlciB0byB0dXJuIG9mZiB0aGUgYWlyIGNvbmRpdGlvbmluZywgeW91IHRha2UgYSBsb29rIG91dCB0aGUgd2luZG93LiBKdXN0IGFzIHlvdSBleHBlY3RlZCwgaXRzIGNsb3VkeSBhbmQgcmFpbnkuIFRoZSBBL0MgbXVzdCBoYXZlIGJlZW4gbWFraW5nIHRoZSB0ZW1wZXJhdHVyZSBldmVuIGNvbGRlciB0aGFuIGl0IGFscmVhZHkgd2FzIG91dHNpZGUuXFxuWW91J3ZlIGhhZCBpdCB0dXJuZWQgYWxsIHRoZSB3YXkgdXAgZm9yIHRoZSBwYXN0IGZldyBkYXlzIGR1ZSB0byB0aGUgaGVhdHdhdmUuIFlvdSdkIGJlZW4gd29ycmllZCB0aGF0IGl0IHdhc24ndCBnb2luZyB0byBlbmQ6IHlvdSBoYWQgbmV2ZXIgc2VlbiBhIGhlYXR3YXZlIGdvIGZvciB0aGF0IGxvbmcgb3IgdGhhdCBob3QgaW4geW91ciBsaWZlLiBDbGVhcmx5IGl0J3Mgb3ZlciBub3csIHRob3VnaCwgaWYgdGhlIHRlbXBlcmF0dXJlIGlzIGFueXRoaW5nIHRvIGdvIGJ5LlxcbllvdSBhZGp1c3QgdGhlIEEvQydzIHNldHRpbmdzIGluIGl0cyBhcHAgb24geW91ciBBUiBnbGFzc2VzLiBPbiB0byBtb3JlIGltcG9ydGFudCB0aGluZ3MuXCIsXCJsb29wXCI6XCJnZXRVcFwifSxcIm1lc3NcIjp7XCJ0ZXh0XCI6XCJZb3Ugc3BlbmQgc28gbXVjaCB0aW1lIGF0IHdvcmsgbm93YWRheXMgdGhhdCB5b3VyIHJvb20gaXMgcHJldHR5IG1lc3N5LiBJbiB0aGVvcnksIGFsbCBvZiB5b3VyIG1hdGVyaWFscyB3b3VsZCBiZSBjb250YWluZWQgaW4gdGhlIGZvbGRlciBvbiB5b3VyIGRlc2ssIGJ1dCB5b3Ugc3BlbmQgc28gbXVjaCB0aW1lIHJlb3JnYW5pemluZyBhbmQgYWRqdXN0aW5nIHRoYXQgaXQgYWxsIGVuZHMgdXAgc3RyZXduIGFib3V0LiBZb3UnZCBwcm9iYWJseSBiZSBiZXR0ZXIgb2ZmIHVzaW5nIHZpcnR1YWwgZG9jdW1lbnRzLCBidXQgc29tZXRoaW5nIGFib3V0IGZlZWxpbmcgdGhlIHBhcGVycyBpbiB5b3VyIGhhbmQgc3RpbGwgYXBwZWFscyB0byB5b3UgbW9yZSB0aGFuIGp1c3Qgc2VlaW5nIHRoZW0uXFxuWW91IHBpY2sgdXAgd2hhdCBmZXcgcGFwZXJzIHJlbWFpbiB0aGUgZm9sZGVyIGFuZCBmbGljayB0aHJvdWdoIHRoZW0uIFRoZXkncmUgdGhlIHRocmVlIHN0dWRpZXMgeW91J3ZlIGJhc2VkIHlvdXIgcHJlc2VudGF0aW9uIG9uLiBZb3Ugc3RhcmUgYXQgdGhlbSBmb3IgYSBsaXR0bGUsIHBlbnNpdmVseS4gWW91J2QgYWx3YXlzIHdhbnRlZCB0byBiZSB0aGUgb25lIGRvaW5nIHRoZSByZXNlYXJjaC4gVGhhdCdzIHdoeSB5b3UgdG9vayB0aGlzIGpvYjsgcHJlc2VudGluZyByZXNlYXJjaCBzZWVtZWQgbGlrZSBhIGdvb2Qgd2F5IHRvIGdldCBzb21lIGNvbm5lY3Rpb25zLCBub3QgdG8gbWVudGlvbiB5b3UgbmVlZGVkIHRoZSBtb25leS4gQnV0IGF0IHNvbWUgcG9pbnQgeW91IGxvc3QgdHJhY2sgb2YgdGhhdCBnb2FsLCBhbmQgZXZlbiB0aG91Z2ggeW91IGNhbiBwcm9iYWJseSBhZmZvcmQgdG8gZ28gYmFjayB0byBzY2hvb2wgbm93LCBiZWluZyBhIHJlc2VhcmNoZXIgZmVlbHMgbGlrZSBzb21lb25lIGVsc2UncyBkcmVhbS4gVGhlIGtpbmQgb2YgdGhpbmcgYSBraWQgdGVsbHMgdGhlbXNlbGYgYmVmb3JlIHRoZXkndmUgYmVlbiBleHBvc2VkIHRvIHRoZSByZWFsIHdvcmxkLlxcblRoaXMgam9iIGlzIGZpbmUuIEl0IHBheXMgd2VsbC4gPGI+SXQncyBmaW5lPC9iPi5cXG5Bbnl3YXksIHlvdSBoYXZlIHRocmVlIHN0dWRpZXMgaW4gdGhlIGZvbGRlci5cXG5EbyB5b3Ugd2FudCB0byByZXZpZXcgYW55IG9mIHRoZW0gYmVmb3JlIHRoZSBiaWcgaGVhcmluZyBsYXRlcj9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiaW5kdXN0cnlcIixcInRleHRcIjpcIkNDUyBTdHVkeVwiLFwibmV4dFwiOlwiY2NzXCJ9LHtcImljb25cIjpcImZpcmUtZmxhbWUtc2ltcGxlXCIsXCJ0ZXh0XCI6XCJFZmZpY2llbmN5IFN0dWR5XCIsXCJuZXh0XCI6XCJlZmZpY2llbmN5XCJ9LHtcImljb25cIjpcImFycm93cy1yb3RhdGVcIixcInRleHRcIjpcIkxpZmVjeWNsZSBBbmFseXNpc1wiLFwibmV4dFwiOlwibGNhXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiQ29udGludWVcIixcIm5leHRcIjpcImNvbnRpbnVlXCJ9XX0sXCJjY3NcIjp7XCJ0ZXh0XCI6XCJDQ1MgU3R1ZHlcIixcImxvb3BcIjpcIm1lc3NcIn0sXCJlZmZpY2llbmN5XCI6e1widGV4dFwiOlwiRWZmaWNpZW5jeSBTdHVkeVwiLFwibG9vcFwiOlwibWVzc1wifSxcImxjYVwiOntcInRleHRcIjpcIkxpZmVjeWNsZSBBbmFseXNpc1wiLFwibG9vcFwiOlwibWVzc1wifSxcImNvbnRpbnVlXCI6e1widGV4dFwiOlwiWW91IHR1cm4geW91ciBhdHRlbnRpb24gdG8gdGhlIHJlc3Qgb2YgdGhlIHJvb20uXCIsXCJsb29wXCI6XCJnZXRVcFwifX0iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBBdWRpb01hbmFnZXIge1xuICAgIGVsZW1lbnQgPSBuZXcgQXVkaW8oKTtcbiAgICBcbiAgICBwbGF5KG5hbWU6IFN0cmluZywgdm9sdW1lOiBudW1iZXIgPSAxKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5zcmMgPSBgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2tmaXNoNjEwL3RleHQtYWR2ZW50dXJlL21haW4vYXNzZXRzLyR7bmFtZX1gO1xuICAgICAgICB0aGlzLmVsZW1lbnQudm9sdW1lID0gdm9sdW1lO1xuICAgICAgICB0aGlzLmVsZW1lbnQuY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB0aGlzLmVsZW1lbnQucGxheSgpO1xuICAgIH1cblxuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5wYXVzZSgpO1xuICAgICAgICB0aGlzLmVsZW1lbnQuY3VycmVudFRpbWUgPSAwO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGF1c2UoKTtcbiAgICB9XG5cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5wbGF5KCk7XG4gICAgfVxuXG4gICAgbG9vcChzaG91bGRMb29wOiBib29sZWFuKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5sb29wID0gc2hvdWxkTG9vcDtcbiAgICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnViYmxlcyB7XG4gICAgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gICAgYnViYmxlczogQXJyYXk8QnViYmxlPiA9IFtdO1xuXG4gICAgY29uc3RydWN0b3IoY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCkge1xuICAgICAgICB0aGlzLmN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuICAgICAgICB0aGlzLnJlc2l6ZSgpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTA7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5idWJibGVzLnB1c2gobmV3IEJ1YmJsZSgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuY3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLmN0eC5jYW52YXMud2lkdGgsIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5idWJibGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5idWJibGVzW2ldLnNwZWVkID4gMCAmJiB0aGlzLmJ1YmJsZXNbaV0ubGlmZXRpbWUgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5zcGVlZCAqPSAtMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLnVwZGF0ZShkdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5idWJibGVzW2ldLnNpemUgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXSA9IG5ldyBCdWJibGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLmRyYXcodGhpcy5jdHgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzaXplKCkge1xuICAgICAgICB2YXIgZHByID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICAgICAgdmFyIHJlY3QgPSB0aGlzLmN0eC5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgdGhpcy5jdHguY2FudmFzLndpZHRoID0gcmVjdC53aWR0aCAqIGRwcjtcbiAgICAgICAgdGhpcy5jdHguY2FudmFzLmhlaWdodCA9IHJlY3QuaGVpZ2h0ICogZHByO1xuXG4gICAgICAgIC8vIHRoaXMuY3R4LnNjYWxlKGRwciwgZHByKTtcblxuICAgICAgICB0aGlzLmN0eC5maWx0ZXIgPSBcImJsdXIoNTBweClcIjtcbiAgICB9XG59XG5cbmNsYXNzIEJ1YmJsZSB7XG4gICAgc3BlZWQ6IG51bWJlcjtcbiAgICB4OiBudW1iZXI7XG4gICAgeTogbnVtYmVyO1xuICAgIHNpemU6IG51bWJlcjtcbiAgICBjb2xvcjogc3RyaW5nO1xuICAgIGxpZmV0aW1lOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5zcGVlZCA9IDAuMDI7XG5cbiAgICAgICAgdGhpcy54ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLnJhbmRvbSgpICogd2luZG93LmlubmVySGVpZ2h0O1xuXG4gICAgICAgIHRoaXMuc2l6ZSA9IDEwO1xuXG4gICAgICAgIGxldCB2ID0gTWF0aC5yYW5kb20oKTtcbiAgICAgICAgbGV0IGh1ZSA9IHYgPCAwLjUgPyAxNTAgOiAyMzA7XG4gICAgICAgIGxldCBzYXQgPSB2IDwgMC41ID8gNTAgOiA4NTtcbiAgICAgICAgbGV0IGxpZ2h0ID0gdiA8IDAuNSA/IDI1IDogNDA7XG4gICAgICAgIHRoaXMuY29sb3IgPSBcImhzbGEoXCIgKyBodWUgKyBcIiwgXCIgKyBzYXQgKyBcIiUsIFwiICsgbGlnaHQgKyBcIiUsIDIwJSlcIjtcblxuICAgICAgICB0aGlzLmxpZmV0aW1lID0gTWF0aC5yYW5kb20oKSAqKiA1ICogMTYwMDAgKyAyMDAwO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc2l6ZSArPSB0aGlzLnNwZWVkICogZHQ7XG4gICAgICAgIHRoaXMubGlmZXRpbWUgLT0gZHQ7XG4gICAgfVxuXG4gICAgZHJhdyhjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCkge1xuICAgICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5jb2xvcjtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKHRoaXMueCwgdGhpcy55LCB0aGlzLnNpemUsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGwoKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdG9yeSwgT3B0aW9uIH0gZnJvbSAnLi9zdG9yeSc7XG5cbmxldCBzdG9yeTogU3RvcnkgPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBCdXR0b25zIHtcbiAgICBlbGVtOiBIVE1MRWxlbWVudDtcbiAgICBzZWxlY3RlZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgdGV4dDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgZW5hYmxlZCA9IGZhbHNlO1xuICAgIGJ1dHRvbnM6IEhUTUxCdXR0b25FbGVtZW50W10gPSBbXTtcbiAgICBmaXJzdEV4aXQgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IoZWxlbTogSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5lbGVtID0gZWxlbTtcbiAgICB9XG5cbiAgICBlbmFibGUoc2NlbmU6IHN0cmluZykge1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgbGV0IG9wdGlvbnM6IE9wdGlvbltdO1xuICAgICAgICBpZiAoc3Rvcnlbc2NlbmVdLm9wdGlvbnMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gc3Rvcnlbc3Rvcnlbc2NlbmVdLmxvb3AhXS5vcHRpb25zITtcbiAgICAgICAgICAgIGxldCBsb29wZWRPcHQgPSBvcHRpb25zLmZpbmRJbmRleChvID0+IG8ucmV0dXJuICE9IHVuZGVmaW5lZCA/IG8ucmV0dXJuID09IHNjZW5lIDogby5uZXh0ID09IHNjZW5lKTtcbiAgICAgICAgICAgIG9wdGlvbnMuc3BsaWNlKGxvb3BlZE9wdCwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0gc3Rvcnlbc2NlbmVdLm9wdGlvbnMhO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHN0ZXAgPSBvcHRpb25zLmxlbmd0aCA9PSA0ID8gNiA6IDEyL29wdGlvbnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbiA9IG9wdGlvbnNbaV07XG4gICAgICAgICAgICBsZXQgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc05hbWUgPSBcIm92ZXJsYXlcIjtcbiAgICAgICAgICAgIGJ1dHRvbi5pbm5lckhUTUwgPSAgXCI+IDxpIGNsYXNzPVxcXCJmYS1zb2xpZCBmYS1cIisgb3B0aW9uLmljb24gK1wiXFxcIj48L2k+IFwiICsgb3B0aW9uLnRleHQ7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gXCI0IC8gMTBcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5sZW5ndGggPT0gNCkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gaSA8IDIgPyAoaSpzdGVwICsgMSkudG9TdHJpbmcoKSArIFwiIC8gXCIgKyAoKGkrMSkqc3RlcCArIDEpLnRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAoKGktMikqc3RlcCArIDEpLnRvU3RyaW5nKCkgKyBcIiAvIFwiICsgKChpLTEpKnN0ZXAgKyAxKS50b1N0cmluZygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IChpKnN0ZXAgKyAxKS50b1N0cmluZygpICsgXCIgLyBcIiArICgoaSsxKSpzdGVwICsgMSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJ1dHRvbi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZpcnN0RXhpdCAmJiBvcHRpb24uaWNvbiA9PSBcImFycm93LXVwLWZyb20tYnJhY2tldFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RFeGl0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50Lm9udmlzaWJpbGl0eWNoYW5nZSEobmV3IEV2ZW50KFwidmlzaWJpbGl0eWNoYW5nZVwiKSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY29uZmlybShcIk9wdGlvbnMgd2l0aCB0aGlzIGljb24gKHRoZSBleGl0aW5nIGFycm93KSBsZWF2ZSBhIHNjZW5lIHBlcm1hbmVudGx5LiBcXFxuVGhpcyBtZWFucyB0aGF0IGlmIHRoZXJlJ3MgYW55IG90aGVyIG9wdGlvbnMgeW91IGhhdmVuJ3QgdHJpZWQgeWV0LCBcXFxuYWZ0ZXIgY2xpY2tpbmcgdGhpcyBvcHRpb24geW91IHdvbid0IGJlIGFibGUgdG8gcmVhZCB0aGVtIHdpdGhvdXQgcmVzdGFydGluZyB0aGUgZ2FtZS4gXFxcbkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBjb250aW51ZT9cIikpIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RlZCA9IG9wdGlvbi5uZXh0O1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dCA9IFwiPGkgY2xhc3M9XFxcImZhLXNvbGlkIGZhLVwiKyBvcHRpb24uaWNvbiArXCJcXFwiPjwvaT4gXCIgKyBvcHRpb24udGV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW0uY2xhc3NOYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW0uaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1dHRvbnMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmVsZW0uYXBwZW5kQ2hpbGQoYnV0dG9uKTtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9ucy5wdXNoKGJ1dHRvbik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbGVtLmNsYXNzTmFtZSA9IFwib3V0XCI7XG4gICAgfVxufSIsImltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuaW1wb3J0IFN0YXRlTWFuYWdlciBmcm9tIFwiLi9zdGF0ZV9tYW5hZ2VyXCI7XG5pbXBvcnQgeyBCZWdpblN0YXRlIH0gZnJvbSBcIi4vc3RhdGVzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEdhbWUge1xuICAgIHRlcm06IFRlcm1pbmFsO1xuICAgIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKHRlcm1pbmFsOiBIVE1MRWxlbWVudCkge1xuICAgICAgICB0ZXJtaW5hbC5zdHlsZS5saW5lSGVpZ2h0ID0gXCIxLjJyZW1cIjtcbiAgICAgICAgdGhpcy50ZXJtID0gbmV3IFRlcm1pbmFsKHRlcm1pbmFsKTtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbmV3IFN0YXRlTWFuYWdlcihCZWdpblN0YXRlKTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIudXBkYXRlKGR0LCB0aGlzLnRlcm0pO1xuXG4gICAgICAgIHRoaXMudGVybS51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdGhpcy50ZXJtLnJlc2l6ZSgpO1xuICAgIH1cblxuICAgIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGVNYW5hZ2VyIGZyb20gXCIuL3N0YXRlX21hbmFnZXJcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhYnN0cmFjdCBjbGFzcyBTdGF0ZSB7XG4gICAgcHJvdGVjdGVkIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFN0YXRlTWFuYWdlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIGluaXQodGVybTogVGVybWluYWwpIHt9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHt9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHt9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTdGF0ZU1hbmFnZXIge1xuICAgIHN0YXRlOiBTdGF0ZTtcbiAgICBuZWVkc0luaXQgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICB9XG5cbiAgICBzZXRTdGF0ZShzOiBuZXcgKG06IFN0YXRlTWFuYWdlcikgPT4gU3RhdGUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5ldyBzKHRoaXMpO1xuICAgICAgICB0aGlzLm5lZWRzSW5pdCA9IHRydWU7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLm5lZWRzSW5pdCkge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZS5pbml0KHRlcm0pO1xuICAgICAgICAgICAgdGhpcy5uZWVkc0luaXQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUudXBkYXRlKGR0LCB0ZXJtKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5rZXlkb3duKGUpO1xuICAgIH1cbn1cbiIsImltcG9ydCBTdGF0ZSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuL3Rlcm1pbmFsXCI7XG5pbXBvcnQgQnV0dG9ucyBmcm9tIFwiLi9idXR0b25zXCI7XG5pbXBvcnQgeyBTdG9yeSB9IGZyb20gJy4vc3RvcnknO1xuaW1wb3J0IEF1ZGlvTWFuYWdlciBmcm9tIFwiLi9hdWRpb19tYW5hZ2VyXCI7XG5cbmxldCBzdG9yeTogU3RvcnkgPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5leHBvcnQgY2xhc3MgQmVnaW5TdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRlcm0ud3JpdGVMaW5lKFwiUHJlc3MgYW55IGtleSB0byBiZWdpbi4uLlwiKTtcbiAgICB9XG5cbiAgICBvdmVycmlkZSBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLnNldFN0YXRlKFdpcGVTdGF0ZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2lwZVN0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHByaXZhdGUgd2lwZVRpbWVyID0gMDtcbiAgICBwcml2YXRlIHdpcGVUaWNrcyA9IDA7XG4gICAgcHJpdmF0ZSB3aXBlTGluZXM6IG51bWJlcjtcblxuICAgIG92ZXJyaWRlIGluaXQodGVybTogVGVybWluYWwpIHtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLm92ZXJmbG93ID0gXCJoaWRkZW5cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnNjcm9sbFNuYXBUeXBlID0gXCJ1bnNldFwiO1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSBcIjEuNnJlbVwiO1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gXCIxLjZyZW1cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnRleHRJbmRlbnQgPSBcInVuc2V0XCI7XG4gICAgICAgIHRoaXMud2lwZUxpbmVzID0gdGVybS5tYXhMaW5lcztcbiAgICB9XG5cbiAgICBvdmVycmlkZSB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgaWYgKHRoaXMud2lwZVRpbWVyID4gNTApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndpcGVUaWNrcyA+IDUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVMaW5lcy0tO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVUaWNrcysrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0ZXJtLmZpbGxSYW5kb20odGhpcy53aXBlTGluZXMpO1xuXG4gICAgICAgICAgICB0aGlzLndpcGVUaW1lciA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53aXBlTGluZXMgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgKz0gZHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0ZXJtLnJlc2V0KCk7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcIlwiO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnNjcm9sbFNuYXBUeXBlID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5wYWRkaW5nTGVmdCA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS50ZXh0SW5kZW50ID0gXCJcIjtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5zZXRTdGF0ZShQbGF5aW5nU3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGxheWluZ1N0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHNjZW5lID0gXCJiZWdpblwiO1xuXG4gICAgcmVtYWluaW5nVGV4dCA9IFwiXCI7XG5cbiAgICBkZWxheSA9IDA7XG5cbiAgICB0ZXh0RGVjb2RlZCA9IC0xO1xuICAgIHRleHRQb3NpdGlvbiA9IC0xO1xuXG4gICAgYnV0dG9ucyA9IG5ldyBCdXR0b25zKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYnV0dG9uc1wiKSEpO1xuXG4gICAgYXVkaW8gPSBuZXcgQXVkaW9NYW5hZ2VyKCk7XG4gICAgYmFja2dyb3VuZCA9IG5ldyBBdWRpb01hbmFnZXIoKTtcblxuICAgIGN1cnJTb3VuZCA9IFwiY2xpY2sud2F2XCI7XG5cbiAgICBsb2NrID0gZmFsc2U7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRoaXMuYXVkaW8ubG9vcChmYWxzZSk7XG4gICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLmxvY2spIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5idXR0b25zLmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5idXR0b25zLnNlbGVjdGVkICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRlcm0ud3JpdGVMaW5lKHRoaXMuYnV0dG9ucy50ZXh0ISk7XG4gICAgICAgICAgICB0aGlzLnNjZW5lID0gdGhpcy5idXR0b25zLnNlbGVjdGVkO1xuICAgICAgICAgICAgdGhpcy5idXR0b25zLnNlbGVjdGVkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmF1ZGlvLnN0b3AoKTtcbiAgICAgICAgICAgIHRlcm0uYnJlYWsoKTtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9ucy5lbmFibGUodGhpcy5zY2VuZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5kZWxheSA8PSAwKSB7XG4gICAgICAgICAgICBsZXQgW3BvcywgaW5kZXhdID0gdGhpcy5pbmRleE9mTWFueSh0aGlzLnJlbWFpbmluZ1RleHQsIFwiPFsgXFxuXCIpO1xuICAgICAgICAgICAgaWYocG9zID09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVNwZWNpYWwoaW5kZXgsIHRlcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlVGV4dChwb3MsIHRlcm0sIGR0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkgLT0gZHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGluZGV4T2ZNYW55KHN0cjogc3RyaW5nLCBjaGFyczogc3RyaW5nKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYyA9IGNoYXJzLmluZGV4T2Yoc3RyW2ldKTtcbiAgICAgICAgICAgIGlmIChjICE9IC0xKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtpLCBjXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy0xLCAtMV07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB3cml0ZVRleHQobGVuOiBudW1iZXIsIHRlcm06IFRlcm1pbmFsLCBkdDogbnVtYmVyKSB7XG4gICAgICAgIGlmIChsZW4gPT0gLTEpIHtcbiAgICAgICAgICAgIGxlbiA9IHRoaXMucmVtYWluaW5nVGV4dC5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50ZXh0RGVjb2RlZCA9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5hdWRpby5wbGF5KHRoaXMuY3VyclNvdW5kKTtcbiAgICAgICAgICAgIHRoaXMudGV4dERlY29kZWQgPSAwO1xuICAgICAgICAgICAgdGhpcy50ZXh0UG9zaXRpb24gPSB0ZXJtLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdGV4dCA9XG4gICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMCwgdGhpcy50ZXh0RGVjb2RlZCkgK1xuICAgICAgICAgICAgdGVybS5yYW5kb21DaGFyYWN0ZXJzKGxlbiAtIHRoaXMudGV4dERlY29kZWQpO1xuXG4gICAgICAgIHRlcm0ud3JpdGUodGV4dCwgdGhpcy50ZXh0UG9zaXRpb24pO1xuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IGxlbikge1xuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGxlbik7XG4gICAgICAgICAgICB0aGlzLnRleHREZWNvZGVkID0gLTE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRleHREZWNvZGVkKys7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVTcGVjaWFsKGluZGV4OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHN3aXRjaCAoaW5kZXgpIHtcbiAgICAgICAgICAgIGNhc2UgMDogLy8gPFxuICAgICAgICAgICAgICAgIGxldCBlbmRUYWdQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIj5cIik7XG4gICAgICAgICAgICAgICAgdGVybS53cml0ZSh0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMCwgZW5kVGFnUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShlbmRUYWdQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMTogLy8gW1xuICAgICAgICAgICAgICAgIGxldCBlbmRDb21tYW5kUG9zID0gdGhpcy5yZW1haW5pbmdUZXh0LmluZGV4T2YoXCJdXCIpO1xuICAgICAgICAgICAgICAgIGxldCBjb21tYW5kID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEsIGVuZENvbW1hbmRQb3MpO1xuICAgICAgICAgICAgICAgIGxldCBzcGFjZVBvcyA9IGNvbW1hbmQuaW5kZXhPZihcIiBcIik7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGFjZVBvcyA9PSAtMSA/IGNvbW1hbmQgOiBjb21tYW5kLnNsaWNlKDAsIHNwYWNlUG9zKSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZGVsYXlcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVsYXkgPSBwYXJzZUludChjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJub3JtYWxcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXVkaW8ucGxheSh0aGlzLmN1cnJTb3VuZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInNlcFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzb3VuZFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyU291bmQgPSBjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImJhY2tncm91bmRcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcGFjZVBvcyA9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmFja2dyb3VuZC5zdG9wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmFja2dyb3VuZC5wbGF5KGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSwgMC4xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiaW1hZ2VcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UnKSBhcyBIVE1MSW1hZ2VFbGVtZW50KS5zcmMgPSBjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UtY29udGFpbmVyJykhLmNsYXNzTmFtZSA9IFwic2hvd1wiO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2NrID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jbG9zZScpIS5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubG9jayA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jb250YWluZXInKSEuY2xhc3NOYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShlbmRDb21tYW5kUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDI6IC8vIDxzcGFjZT5cbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKFwiIFwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDM6IC8vIFxcblxuICAgICAgICAgICAgICAgIHRlcm0ud3JpdGVMaW5lKFwiXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVsYXkgPSA1MDA7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkludmFsaWQgY2hhciBpbmRleCBcIiArIGluZGV4KTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCBMaW5lQ2xhbXAgZnJvbSBcIkB0dmFuYy9saW5lY2xhbXBcIjtcclxuXHJcbmNvbnN0IENVUlNPUl9CTElOS19JTlRFUlZBTCA9IDUwMDtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRlcm1pbmFsIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG5cclxuICAgIGZvbnRTaXplOiBudW1iZXI7XHJcbiAgICB3aWR0aDogbnVtYmVyO1xyXG4gICAgaGVpZ2h0OiBudW1iZXI7XHJcbiAgICBsaW5lSGVpZ2h0OiBudW1iZXI7XHJcblxyXG4gICAgbWF4TGluZXM6IG51bWJlcjtcclxuICAgIGNoYXJzUGVyTGluZTogbnVtYmVyO1xyXG5cclxuICAgIGNvbnRlbnQgPSBcIjxkaXY+PiBcIjtcclxuXHJcbiAgICBwcml2YXRlIGN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBjdXJzb3JFbmFibGVkID0gdHJ1ZTtcclxuICAgIHByaXZhdGUgY3Vyc29yVGlja3MgPSAwO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbTtcclxuXHJcbiAgICAgICAgdGhpcy5mb250U2l6ZSA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemUuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLndpZHRoID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS53aWR0aC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5oZWlnaHQuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xyXG4gICAgICAgIGNvbnN0IGNsYW1wID0gbmV3IExpbmVDbGFtcCh0aGlzLmVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMubGluZUhlaWdodCA9IGNsYW1wLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCkuYWRkaXRpb25hbExpbmVIZWlnaHQ7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJcIjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXhMaW5lcyA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgLyB0aGlzLmxpbmVIZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2hhcnNQZXJMaW5lID0gTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gKHRoaXMuZm9udFNpemUgKiAwLjYpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXNpemUoKSB7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkud2lkdGguc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuaGVpZ2h0LnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMubWF4TGluZXMgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0IC8gdGhpcy5saW5lSGVpZ2h0KTtcclxuICAgICAgICB0aGlzLmNoYXJzUGVyTGluZSA9IE1hdGguZmxvb3IodGhpcy53aWR0aCAvICh0aGlzLmZvbnRTaXplICogMC42KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclRpY2tzID49IENVUlNPUl9CTElOS19JTlRFUlZBTCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJzb3JUaWNrcyA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsaXBDdXJzb3IoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Vyc29yVGlja3MgKz0gZHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc2hvdygpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuaW5uZXJIVE1MID0gdGhpcy5jb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyKCkge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ID0gXCJcIjtcclxuICAgIH1cclxuXHJcbiAgICBnZXRQb3NpdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb250ZW50Lmxlbmd0aCAtICh0aGlzLmN1cnNvclZpc2libGUgPyAwIDogMSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHV0KHRleHQ6IHN0cmluZywgcG9zPzogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIHBvcyAhPSB1bmRlZmluZWQgJiZcclxuICAgICAgICAgICAgcG9zID49IDAgJiZcclxuICAgICAgICAgICAgcG9zIDw9IHRoaXMuY29udGVudC5sZW5ndGggLSB0ZXh0Lmxlbmd0aFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgPVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50LnNsaWNlKDAsIHBvcykgK1xyXG4gICAgICAgICAgICAgICAgdGV4dCArXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQuc2xpY2UocG9zICsgdGV4dC5sZW5ndGgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCArPSB0ZXh0O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwdXRMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQgKyBcIjwvZGl2PjxkaXY+PiBcIjtcclxuICAgIH1cclxuXHJcbiAgICByZXNldCgpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5wdXQoXCI+IFwiKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGUodGV4dDogc3RyaW5nLCBwb3M/OiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnB1dCh0ZXh0LCBwb3MpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB3cml0ZUxpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5wdXRMaW5lKHRleHQpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBicmVhaygpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCArPSBcIjwvZGl2Pjxici8+PGRpdj4+IFwiO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICByYW5kb21DaGFyYWN0ZXJzKGNvdW50OiBudW1iZXIpIHtcclxuICAgICAgICBsZXQgdmFsdWVzID0gbmV3IFVpbnQ4QXJyYXkoY291bnQpO1xyXG4gICAgICAgIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKHZhbHVlcyk7XHJcbiAgICAgICAgY29uc3QgbWFwcGVkVmFsdWVzID0gdmFsdWVzLm1hcCgoeCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBhZGogPSB4ICUgMzY7XHJcbiAgICAgICAgICAgIHJldHVybiBhZGogPCAyNiA/IGFkaiArIDY1IDogYWRqIC0gMjYgKyA0ODtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbWFwcGVkVmFsdWVzKTtcclxuICAgIH1cclxuXHJcbiAgICBmaWxsUmFuZG9tKGxpbmVzOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lczsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgICAgICB0aGlzLnB1dChcIjxiciAvPlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5wdXQodGhpcy5yYW5kb21DaGFyYWN0ZXJzKHRoaXMuY2hhcnNQZXJMaW5lKSk7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0Q3Vyc29yRW5hYmxlZCh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuY3Vyc29yRW5hYmxlZCA9IHZhbHVlO1xyXG4gICAgICAgIC8vIGlmIHRoZSBjdXJzb3IgbmVlZGVkIHRvIGJlIHR1cm5lZCBvZmYsIGZpeCBpdFxyXG4gICAgICAgIGlmICghdGhpcy5jdXJzb3JFbmFibGVkICYmICF0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ID0gdGhpcy5jb250ZW50LnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZmxpcEN1cnNvcigpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCArPSBcIl9cIjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5jdXJzb3JWaXNpYmxlID0gIXRoaXMuY3Vyc29yVmlzaWJsZTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IEJ1YmJsZXMgZnJvbSBcIi4vYnViYmxlc1wiO1xuaW1wb3J0IEdhbWUgZnJvbSBcIi4vZ2FtZVwiO1xuXG5sZXQgZ2FtZTogR2FtZTtcblxubGV0IGJ1YmJsZXM6IEJ1YmJsZXM7XG5cbmxldCBsYXN0VGltZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbndpbmRvdy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgYnViYmxlcyA9IG5ldyBCdWJibGVzKFxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJhY2tncm91bmRcIikgYXMgSFRNTENhbnZhc0VsZW1lbnRcbiAgICApO1xuICAgIGdhbWUgPSBuZXcgR2FtZShkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRlcm1pbmFsXCIpISk7XG5cbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG59O1xuXG53aW5kb3cub25yZXNpemUgPSAoKSA9PiB7XG4gICAgYnViYmxlcy5yZXNpemUoKTtcbiAgICBnYW1lLnJlc2l6ZSgpO1xufTtcblxuZG9jdW1lbnQub25rZXlkb3duID0gKGUpID0+IHtcbiAgICBnYW1lLmtleWRvd24oZSk7XG59O1xuXG5kb2N1bWVudC5vbnZpc2liaWxpdHljaGFuZ2UgPSAoKSA9PiB7XG4gICAgaWYgKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSA9PSBcInZpc2libGVcIikge1xuICAgICAgICBsYXN0VGltZSA9IG51bGw7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgIC8vIFRoaXMgcmVhbGx5IHNob3VsZG4ndCBiZSBuZWVkZWQgaWYgYnJvd3NlcnMgYXJlIGZvbGxvd2luZyBjb252ZW50aW9uLFxuICAgIC8vIGJ1dCBiZXR0ZXIgc2FmZSB0aGFuIHNvcnJ5XG4gICAgaWYgKGRvY3VtZW50LmhpZGRlbikge1xuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGFzdFRpbWUgPT0gbnVsbCkge1xuICAgICAgICBsYXN0VGltZSA9IC0xO1xuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGxhc3RUaW1lICE9IC0xKSB7XG4gICAgICAgIGxldCBkdCA9IHRpbWUgLSBsYXN0VGltZTtcblxuICAgICAgICBidWJibGVzLnVwZGF0ZShkdCk7XG4gICAgICAgIGdhbWUudXBkYXRlKGR0KTtcbiAgICB9XG5cbiAgICBsYXN0VGltZSA9IHRpbWU7XG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xufVxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9