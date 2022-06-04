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
        this.element.src = "../assets/".concat(name);
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
    if (lastTime != null) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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a0IsR0FBRztJQUMxQixJQUFJLFFBQVEsQ0FBQyxlQUFlLElBQUksU0FBUyxFQUFFO1FBQ3ZDLFFBQVEsR0FBRyxJQUFJLENBQUM7S0FDbkI7QUFDTCxDQUFDLENBQUM7QUFFRixTQUFTLE1BQU0sQ0FBQyxJQUFZO0lBQ3hCLHdFQUF3RTtJQUN4RSw2QkFBNkI7SUFDN0IsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQ2pCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyQyxPQUFPO0tBQ1Y7SUFFRCxJQUFJLFFBQVEsSUFBSSxJQUFJLEVBQUU7UUFDbEIsSUFBSSxFQUFFLEdBQUcsSUFBSSxHQUFHLFFBQVEsQ0FBQztRQUV6QixPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDbkI7SUFFRCxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ2hCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9ub2RlX21vZHVsZXMvQHR2YW5jL2xpbmVjbGFtcC9kaXN0L2VzbS5qcyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdG9yeS5jc29uIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2F1ZGlvX21hbmFnZXIudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnViYmxlcy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9idXR0b25zLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2dhbWUudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGUudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGVfbWFuYWdlci50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdGF0ZXMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvdGVybWluYWwudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlZHVjZXMgZm9udCBzaXplIG9yIHRyaW1zIHRleHQgdG8gbWFrZSBpdCBmaXQgd2l0aGluIHNwZWNpZmllZCBib3VuZHMuXG4gKlxuICogU3VwcG9ydHMgY2xhbXBpbmcgYnkgbnVtYmVyIG9mIGxpbmVzIG9yIHRleHQgaGVpZ2h0LlxuICpcbiAqIEtub3duIGxpbWl0YXRpb25zOlxuICogMS4gQ2hhcmFjdGVycyB0aGF0IGRpc3RvcnQgbGluZSBoZWlnaHRzIChlbW9qaXMsIHphbGdvKSBtYXkgY2F1c2VcbiAqIHVuZXhwZWN0ZWQgcmVzdWx0cy5cbiAqIDIuIENhbGxpbmcge0BzZWUgaGFyZENsYW1wKCl9IHdpcGVzIGNoaWxkIGVsZW1lbnRzLiBGdXR1cmUgdXBkYXRlcyBtYXkgYWxsb3dcbiAqIGlubGluZSBjaGlsZCBlbGVtZW50cyB0byBiZSBwcmVzZXJ2ZWQuXG4gKlxuICogQHRvZG8gU3BsaXQgdGV4dCBtZXRyaWNzIGludG8gb3duIGxpYnJhcnlcbiAqIEB0b2RvIFRlc3Qgbm9uLUxUUiB0ZXh0XG4gKi9cbmNsYXNzIExpbmVDbGFtcCB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtZW50XG4gICAqIFRoZSBlbGVtZW50IHRvIGNsYW1wLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIE9wdGlvbnMgdG8gZ292ZXJuIGNsYW1waW5nIGJlaGF2aW9yLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4TGluZXNdXG4gICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBsaW5lcyB0byBhbGxvdy4gRGVmYXVsdHMgdG8gMS5cbiAgICogVG8gc2V0IGEgbWF4aW11bSBoZWlnaHQgaW5zdGVhZCwgdXNlIHtAc2VlIG9wdGlvbnMubWF4SGVpZ2h0fVxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4SGVpZ2h0XVxuICAgKiBUaGUgbWF4aW11bSBoZWlnaHQgKGluIHBpeGVscykgb2YgdGV4dCBpbiBhbiBlbGVtZW50LlxuICAgKiBUaGlzIG9wdGlvbiBpcyB1bmRlZmluZWQgYnkgZGVmYXVsdC4gT25jZSBzZXQsIGl0IHRha2VzIHByZWNlZGVuY2Ugb3ZlclxuICAgKiB7QHNlZSBvcHRpb25zLm1heExpbmVzfS4gTm90ZSB0aGF0IHRoaXMgYXBwbGllcyB0byB0aGUgaGVpZ2h0IG9mIHRoZSB0ZXh0LCBub3RcbiAgICogdGhlIGVsZW1lbnQgaXRzZWxmLiBSZXN0cmljdGluZyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IGNhbiBiZSBhY2hpZXZlZFxuICAgKiB3aXRoIENTUyA8Y29kZT5tYXgtaGVpZ2h0PC9jb2RlPi5cbiAgICpcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy51c2VTb2Z0Q2xhbXBdXG4gICAqIElmIHRydWUsIHJlZHVjZSBmb250IHNpemUgKHNvZnQgY2xhbXApIHRvIGF0IGxlYXN0IHtAc2VlIG9wdGlvbnMubWluRm9udFNpemV9XG4gICAqIGJlZm9yZSByZXNvcnRpbmcgdG8gdHJpbW1pbmcgdGV4dC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaGFyZENsYW1wQXNGYWxsYmFja11cbiAgICogSWYgdHJ1ZSwgcmVzb3J0IHRvIGhhcmQgY2xhbXBpbmcgaWYgc29mdCBjbGFtcGluZyByZWFjaGVzIHRoZSBtaW5pbXVtIGZvbnQgc2l6ZVxuICAgKiBhbmQgc3RpbGwgZG9lc24ndCBmaXQgd2l0aGluIHRoZSBtYXggaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcy5cbiAgICogRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmVsbGlwc2lzXVxuICAgKiBUaGUgY2hhcmFjdGVyIHdpdGggd2hpY2ggdG8gcmVwcmVzZW50IGNsaXBwZWQgdHJhaWxpbmcgdGV4dC5cbiAgICogVGhpcyBvcHRpb24gdGFrZXMgZWZmZWN0IHdoZW4gXCJoYXJkXCIgY2xhbXBpbmcgaXMgdXNlZC5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1pbkZvbnRTaXplXVxuICAgKiBUaGUgbG93ZXN0IGZvbnQgc2l6ZSwgaW4gcGl4ZWxzLCB0byB0cnkgYmVmb3JlIHJlc29ydGluZyB0byByZW1vdmluZ1xuICAgKiB0cmFpbGluZyB0ZXh0IChoYXJkIGNsYW1waW5nKS4gRGVmYXVsdHMgdG8gMS5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEZvbnRTaXplXVxuICAgKiBUaGUgbWF4aW11bSBmb250IHNpemUgaW4gcGl4ZWxzLiBXZSdsbCBzdGFydCB3aXRoIHRoaXMgZm9udCBzaXplIHRoZW5cbiAgICogcmVkdWNlIHVudGlsIHRleHQgZml0cyBjb25zdHJhaW50cywgb3IgZm9udCBzaXplIGlzIGVxdWFsIHRvXG4gICAqIHtAc2VlIG9wdGlvbnMubWluRm9udFNpemV9LiBEZWZhdWx0cyB0byB0aGUgZWxlbWVudCdzIGluaXRpYWwgY29tcHV0ZWQgZm9udCBzaXplLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgZWxlbWVudCxcbiAgICB7XG4gICAgICBtYXhMaW5lcyA9IHVuZGVmaW5lZCxcbiAgICAgIG1heEhlaWdodCA9IHVuZGVmaW5lZCxcbiAgICAgIHVzZVNvZnRDbGFtcCA9IGZhbHNlLFxuICAgICAgaGFyZENsYW1wQXNGYWxsYmFjayA9IHRydWUsXG4gICAgICBtaW5Gb250U2l6ZSA9IDEsXG4gICAgICBtYXhGb250U2l6ZSA9IHVuZGVmaW5lZCxcbiAgICAgIGVsbGlwc2lzID0gXCLigKZcIixcbiAgICB9ID0ge31cbiAgKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib3JpZ2luYWxXb3Jkc1wiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogZWxlbWVudC50ZXh0Q29udGVudC5tYXRjaCgvXFxTK1xccyovZykgfHwgW10sXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJ1cGRhdGVIYW5kbGVyXCIsIHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmFwcGx5KCksXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJvYnNlcnZlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogbmV3IE11dGF0aW9uT2JzZXJ2ZXIodGhpcy51cGRhdGVIYW5kbGVyKSxcbiAgICB9KTtcblxuICAgIGlmICh1bmRlZmluZWQgPT09IG1heEZvbnRTaXplKSB7XG4gICAgICBtYXhGb250U2l6ZSA9IHBhcnNlSW50KHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpLmZvbnRTaXplLCAxMCk7XG4gICAgfVxuXG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgICB0aGlzLm1heExpbmVzID0gbWF4TGluZXM7XG4gICAgdGhpcy5tYXhIZWlnaHQgPSBtYXhIZWlnaHQ7XG4gICAgdGhpcy51c2VTb2Z0Q2xhbXAgPSB1c2VTb2Z0Q2xhbXA7XG4gICAgdGhpcy5oYXJkQ2xhbXBBc0ZhbGxiYWNrID0gaGFyZENsYW1wQXNGYWxsYmFjaztcbiAgICB0aGlzLm1pbkZvbnRTaXplID0gbWluRm9udFNpemU7XG4gICAgdGhpcy5tYXhGb250U2l6ZSA9IG1heEZvbnRTaXplO1xuICAgIHRoaXMuZWxsaXBzaXMgPSBlbGxpcHNpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBHYXRoZXIgbWV0cmljcyBhYm91dCB0aGUgbGF5b3V0IG9mIHRoZSBlbGVtZW50J3MgdGV4dC5cbiAgICogVGhpcyBpcyBhIHNvbWV3aGF0IGV4cGVuc2l2ZSBvcGVyYXRpb24gLSBjYWxsIHdpdGggY2FyZS5cbiAgICpcbiAgICogQHJldHVybnMge1RleHRNZXRyaWNzfVxuICAgKiBMYXlvdXQgbWV0cmljcyBmb3IgdGhlIGNsYW1wZWQgZWxlbWVudCdzIHRleHQuXG4gICAqL1xuICBjYWxjdWxhdGVUZXh0TWV0cmljcygpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50O1xuICAgIGNvbnN0IGNsb25lID0gZWxlbWVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgY29uc3Qgc3R5bGUgPSBjbG9uZS5zdHlsZTtcblxuICAgIC8vIEFwcGVuZCwgZG9uJ3QgcmVwbGFjZVxuICAgIHN0eWxlLmNzc1RleHQgKz0gXCI7bWluLWhlaWdodDowIWltcG9ydGFudDttYXgtaGVpZ2h0Om5vbmUhaW1wb3J0YW50XCI7XG4gICAgZWxlbWVudC5yZXBsYWNlV2l0aChjbG9uZSk7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0ID0gY2xvbmUub2Zmc2V0SGVpZ2h0O1xuXG4gICAgLy8gQ2xlYXIgdG8gbWVhc3VyZSBlbXB0eSBoZWlnaHQuIHRleHRDb250ZW50IGZhc3RlciB0aGFuIGlubmVySFRNTFxuICAgIGNsb25lLnRleHRDb250ZW50ID0gXCJcIjtcblxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dCA9IGNsb25lLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCB0ZXh0SGVpZ2h0ID0gbmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dDtcblxuICAgIC8vIEZpbGwgZWxlbWVudCB3aXRoIHNpbmdsZSBub24tYnJlYWtpbmcgc3BhY2UgdG8gZmluZCBoZWlnaHQgb2Ygb25lIGxpbmVcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXFx4YTBcIjtcblxuICAgIC8vIEdldCBoZWlnaHQgb2YgZWxlbWVudCB3aXRoIG9ubHkgb25lIGxpbmUgb2YgdGV4dFxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSA9IGNsb25lLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCBmaXJzdExpbmVIZWlnaHQgPSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBBZGQgbGluZSAoPGJyPiArIG5ic3ApLiBhcHBlbmRDaGlsZCgpIGZhc3RlciB0aGFuIGlubmVySFRNTFxuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJiclwiKSk7XG4gICAgY2xvbmUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcXHhhMFwiKSk7XG5cbiAgICBjb25zdCBhZGRpdGlvbmFsTGluZUhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZTtcbiAgICBjb25zdCBsaW5lQ291bnQgPVxuICAgICAgMSArIChuYXR1cmFsSGVpZ2h0IC0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lKSAvIGFkZGl0aW9uYWxMaW5lSGVpZ2h0O1xuXG4gICAgLy8gUmVzdG9yZSBvcmlnaW5hbCBjb250ZW50XG4gICAgY2xvbmUucmVwbGFjZVdpdGgoZWxlbWVudCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZWRlZiB7T2JqZWN0fSBUZXh0TWV0cmljc1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHt0ZXh0SGVpZ2h0fVxuICAgICAqIFRoZSB2ZXJ0aWNhbCBzcGFjZSByZXF1aXJlZCB0byBkaXNwbGF5IHRoZSBlbGVtZW50J3MgY3VycmVudCB0ZXh0LlxuICAgICAqIFRoaXMgaXMgPGVtPm5vdDwvZW0+IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIGFzIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQuXG4gICAgICogVGhpcyBudW1iZXIgbWF5IGV2ZW4gYmUgZ3JlYXRlciB0aGFuIHRoZSBlbGVtZW50J3MgaGVpZ2h0IGluIGNhc2VzXG4gICAgICogd2hlcmUgdGhlIHRleHQgb3ZlcmZsb3dzIHRoZSBlbGVtZW50J3MgYmxvY2sgYXhpcy5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7bmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lfVxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHQgYW5kIHdpdGhvdXRcbiAgICAgKiBtaW5pbXVtIG9yIG1heGltdW0gaGVpZ2h0cy4gVGhpcyBpbmZvcm1hdGlvbiBtYXkgYmUgaGVscGZ1bCB3aGVuXG4gICAgICogZGVhbGluZyB3aXRoIGlubGluZSBlbGVtZW50cyAoYW5kIHBvdGVudGlhbGx5IG90aGVyIHNjZW5hcmlvcyksIHdoZXJlXG4gICAgICogdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBkb2VzIG5vdCBpbmNyZWFzZSB0aGUgZWxlbWVudCdzIGhlaWdodC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7Zmlyc3RMaW5lSGVpZ2h0fVxuICAgICAqIFRoZSBoZWlnaHQgdGhhdCB0aGUgZmlyc3QgbGluZSBvZiB0ZXh0IGFkZHMgdG8gdGhlIGVsZW1lbnQsIGkuZS4sIHRoZVxuICAgICAqIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdoaWxlIGVtcHR5IGFuZCB0aGUgaGVpZ2h0XG4gICAgICogb2YgdGhlIGVsZW1lbnQgd2hpbGUgaXQgY29udGFpbnMgb25lIGxpbmUgb2YgdGV4dC4gVGhpcyBudW1iZXIgbWF5IGJlXG4gICAgICogemVybyBmb3IgaW5saW5lIGVsZW1lbnRzIGJlY2F1c2UgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBkb2VzIG5vdFxuICAgICAqIGluY3JlYXNlIHRoZSBoZWlnaHQgb2YgaW5saW5lIGVsZW1lbnRzLlxuXG4gICAgICogQHByb3BlcnR5IHthZGRpdGlvbmFsTGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgZWFjaCBsaW5lIG9mIHRleHQgYWZ0ZXIgdGhlIGZpcnN0IGFkZHMgdG8gdGhlIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2xpbmVDb3VudH1cbiAgICAgKiBUaGUgbnVtYmVyIG9mIGxpbmVzIG9mIHRleHQgdGhlIGVsZW1lbnQgY29udGFpbnMuXG4gICAgICovXG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHRIZWlnaHQsXG4gICAgICBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUsXG4gICAgICBmaXJzdExpbmVIZWlnaHQsXG4gICAgICBhZGRpdGlvbmFsTGluZUhlaWdodCxcbiAgICAgIGxpbmVDb3VudCxcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIGNoYW5nZXMgdGhhdCBtYXkgYWZmZWN0IGxheW91dC4gUmVzcG9uZCBieSByZWNsYW1waW5nIGlmXG4gICAqIG5lY2Vzc2FyeS5cbiAgICovXG4gIHdhdGNoKCkge1xuICAgIGlmICghdGhpcy5fd2F0Y2hpbmcpIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMudXBkYXRlSGFuZGxlcik7XG5cbiAgICAgIC8vIE1pbmltdW0gcmVxdWlyZWQgdG8gZGV0ZWN0IGNoYW5nZXMgdG8gdGV4dCBub2RlcyxcbiAgICAgIC8vIGFuZCB3aG9sZXNhbGUgcmVwbGFjZW1lbnQgdmlhIGlubmVySFRNTFxuICAgICAgdGhpcy5vYnNlcnZlci5vYnNlcnZlKHRoaXMuZWxlbWVudCwge1xuICAgICAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlLFxuICAgICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fd2F0Y2hpbmcgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogU3RvcCB3YXRjaGluZyBmb3IgbGF5b3V0IGNoYW5nZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHtMaW5lQ2xhbXB9XG4gICAqL1xuICB1bndhdGNoKCkge1xuICAgIHRoaXMub2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMudXBkYXRlSGFuZGxlcik7XG5cbiAgICB0aGlzLl93YXRjaGluZyA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25kdWN0IGVpdGhlciBzb2Z0IGNsYW1waW5nIG9yIGhhcmQgY2xhbXBpbmcsIGFjY29yZGluZyB0byB0aGUgdmFsdWUgb2ZcbiAgICogcHJvcGVydHkge0BzZWUgTGluZUNsYW1wLnVzZVNvZnRDbGFtcH0uXG4gICAqL1xuICBhcHBseSgpIHtcbiAgICBpZiAodGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCkge1xuICAgICAgY29uc3QgcHJldmlvdXNseVdhdGNoaW5nID0gdGhpcy5fd2F0Y2hpbmc7XG5cbiAgICAgIC8vIElnbm9yZSBpbnRlcm5hbGx5IHN0YXJ0ZWQgbXV0YXRpb25zLCBsZXN0IHdlIHJlY3Vyc2UgaW50byBvYmxpdmlvblxuICAgICAgdGhpcy51bndhdGNoKCk7XG5cbiAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5qb2luKFwiXCIpO1xuXG4gICAgICBpZiAodGhpcy51c2VTb2Z0Q2xhbXApIHtcbiAgICAgICAgdGhpcy5zb2Z0Q2xhbXAoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaGFyZENsYW1wKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc3VtZSBvYnNlcnZhdGlvbiBpZiBwcmV2aW91c2x5IHdhdGNoaW5nXG4gICAgICBpZiAocHJldmlvdXNseVdhdGNoaW5nKSB7XG4gICAgICAgIHRoaXMud2F0Y2goZmFsc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogVHJpbXMgdGV4dCB1bnRpbCBpdCBmaXRzIHdpdGhpbiBjb25zdHJhaW50c1xuICAgKiAobWF4aW11bSBoZWlnaHQgb3IgbnVtYmVyIG9mIGxpbmVzKS5cbiAgICpcbiAgICogQHNlZSB7TGluZUNsYW1wLm1heExpbmVzfVxuICAgKiBAc2VlIHtMaW5lQ2xhbXAubWF4SGVpZ2h0fVxuICAgKi9cbiAgaGFyZENsYW1wKHNraXBDaGVjayA9IHRydWUpIHtcbiAgICBpZiAoc2tpcENoZWNrIHx8IHRoaXMuc2hvdWxkQ2xhbXAoKSkge1xuICAgICAgbGV0IGN1cnJlbnRUZXh0O1xuXG4gICAgICBmaW5kQm91bmRhcnkoXG4gICAgICAgIDEsXG4gICAgICAgIHRoaXMub3JpZ2luYWxXb3Jkcy5sZW5ndGgsXG4gICAgICAgICh2YWwpID0+IHtcbiAgICAgICAgICBjdXJyZW50VGV4dCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5zbGljZSgwLCB2YWwpLmpvaW4oXCIgXCIpO1xuICAgICAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IGN1cnJlbnRUZXh0O1xuXG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2hvdWxkQ2xhbXAoKVxuICAgICAgICB9LFxuICAgICAgICAodmFsLCBtaW4sIG1heCkgPT4ge1xuICAgICAgICAgIC8vIEFkZCBvbmUgbW9yZSB3b3JkIGlmIG5vdCBvbiBtYXhcbiAgICAgICAgICBpZiAodmFsID4gbWluKSB7XG4gICAgICAgICAgICBjdXJyZW50VGV4dCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5zbGljZSgwLCBtYXgpLmpvaW4oXCIgXCIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRoZW4gdHJpbSBsZXR0ZXJzIHVudGlsIGl0IGZpdHNcbiAgICAgICAgICBkbyB7XG4gICAgICAgICAgICBjdXJyZW50VGV4dCA9IGN1cnJlbnRUZXh0LnNsaWNlKDAsIC0xKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IGN1cnJlbnRUZXh0ICsgdGhpcy5lbGxpcHNpcztcbiAgICAgICAgICB9IHdoaWxlICh0aGlzLnNob3VsZENsYW1wKCkpXG5cbiAgICAgICAgICAvLyBCcm9hZGNhc3QgbW9yZSBzcGVjaWZpYyBoYXJkQ2xhbXAgZXZlbnQgZmlyc3RcbiAgICAgICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmhhcmRjbGFtcFwiKTtcbiAgICAgICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmNsYW1wXCIpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogUmVkdWNlcyBmb250IHNpemUgdW50aWwgdGV4dCBmaXRzIHdpdGhpbiB0aGUgc3BlY2lmaWVkIGhlaWdodCBvciBudW1iZXIgb2ZcbiAgICogbGluZXMuIFJlc29ydHMgdG8gdXNpbmcge0BzZWUgaGFyZENsYW1wKCl9IGlmIHRleHQgc3RpbGwgZXhjZWVkcyBjbGFtcFxuICAgKiBwYXJhbWV0ZXJzLlxuICAgKi9cbiAgc29mdENsYW1wKCkge1xuICAgIGNvbnN0IHN0eWxlID0gdGhpcy5lbGVtZW50LnN0eWxlO1xuICAgIGNvbnN0IHN0YXJ0U2l6ZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemU7XG4gICAgc3R5bGUuZm9udFNpemUgPSBcIlwiO1xuXG4gICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICBsZXQgc2hvdWxkQ2xhbXA7XG5cbiAgICBmaW5kQm91bmRhcnkoXG4gICAgICB0aGlzLm1pbkZvbnRTaXplLFxuICAgICAgdGhpcy5tYXhGb250U2l6ZSxcbiAgICAgICh2YWwpID0+IHtcbiAgICAgICAgc3R5bGUuZm9udFNpemUgPSB2YWwgKyBcInB4XCI7XG4gICAgICAgIHNob3VsZENsYW1wID0gdGhpcy5zaG91bGRDbGFtcCgpO1xuICAgICAgICByZXR1cm4gc2hvdWxkQ2xhbXBcbiAgICAgIH0sXG4gICAgICAodmFsLCBtaW4pID0+IHtcbiAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgIHN0eWxlLmZvbnRTaXplID0gbWluICsgXCJweFwiO1xuICAgICAgICAgIHNob3VsZENsYW1wID0gdGhpcy5zaG91bGRDbGFtcCgpO1xuICAgICAgICB9XG4gICAgICAgIGRvbmUgPSAhc2hvdWxkQ2xhbXA7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGNoYW5nZWQgPSBzdHlsZS5mb250U2l6ZSAhPT0gc3RhcnRTaXplO1xuXG4gICAgLy8gRW1pdCBzcGVjaWZpYyBzb2Z0Q2xhbXAgZXZlbnQgZmlyc3RcbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5zb2Z0Y2xhbXBcIik7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3QgZW1pdCBgbGluZWNsYW1wLmNsYW1wYCBldmVudCB0d2ljZS5cbiAgICBpZiAoIWRvbmUgJiYgdGhpcy5oYXJkQ2xhbXBBc0ZhbGxiYWNrKSB7XG4gICAgICB0aGlzLmhhcmRDbGFtcChmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChjaGFuZ2VkKSB7XG4gICAgICAvLyBoYXJkQ2xhbXAgZW1pdHMgYGxpbmVjbGFtcC5jbGFtcGAgdG9vLiBPbmx5IGVtaXQgZnJvbSBoZXJlIGlmIHdlJ3JlXG4gICAgICAvLyBub3QgYWxzbyBoYXJkIGNsYW1waW5nLlxuICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKiBXaGV0aGVyIGhlaWdodCBvZiB0ZXh0IG9yIG51bWJlciBvZiBsaW5lcyBleGNlZWQgY29uc3RyYWludHMuXG4gICAqXG4gICAqIEBzZWUgTGluZUNsYW1wLm1heEhlaWdodFxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhMaW5lc1xuICAgKi9cbiAgc2hvdWxkQ2xhbXAoKSB7XG4gICAgY29uc3QgeyBsaW5lQ291bnQsIHRleHRIZWlnaHQgfSA9IHRoaXMuY2FsY3VsYXRlVGV4dE1ldHJpY3MoKTtcblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0ICYmIHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIHRleHRIZWlnaHQgPiB0aGlzLm1heEhlaWdodCB8fCBsaW5lQ291bnQgPiB0aGlzLm1heExpbmVzXG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhIZWlnaHQpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHRcbiAgICB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heExpbmVzKSB7XG4gICAgICByZXR1cm4gbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwibWF4TGluZXMgb3IgbWF4SGVpZ2h0IG11c3QgYmUgc2V0IGJlZm9yZSBjYWxsaW5nIHNob3VsZENsYW1wKCkuXCJcbiAgICApXG4gIH1cbn1cblxuLyoqXG4gKiBQZXJmb3JtcyBhIGJpbmFyeSBzZWFyY2ggZm9yIHRoZSBtYXhpbXVtIHdob2xlIG51bWJlciBpbiBhIGNvbnRpZ291cyByYW5nZVxuICogd2hlcmUgYSBnaXZlbiB0ZXN0IGNhbGxiYWNrIHdpbGwgZ28gZnJvbSByZXR1cm5pbmcgdHJ1ZSB0byByZXR1cm5pbmcgZmFsc2UuXG4gKlxuICogU2luY2UgdGhpcyB1c2VzIGEgYmluYXJ5LXNlYXJjaCBhbGdvcml0aG0gdGhpcyBpcyBhbiBPKGxvZyBuKSBmdW5jdGlvbixcbiAqIHdoZXJlIG4gPSBtYXggLSBtaW4uXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1pblxuICogVGhlIGxvd2VyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbWF4XG4gKiBUaGUgdXBwZXIgYm91bmRhcnkgb2YgdGhlIHJhbmdlLlxuICpcbiAqIEBwYXJhbSB0ZXN0XG4gKiBBIGNhbGxiYWNrIHRoYXQgcmVjZWl2ZXMgdGhlIGN1cnJlbnQgdmFsdWUgaW4gdGhlIHJhbmdlIGFuZCByZXR1cm5zIGEgdHJ1dGh5IG9yIGZhbHN5IHZhbHVlLlxuICpcbiAqIEBwYXJhbSBkb25lXG4gKiBBIGZ1bmN0aW9uIHRvIHBlcmZvcm0gd2hlbiBjb21wbGV0ZS4gUmVjZWl2ZXMgdGhlIGZvbGxvd2luZyBwYXJhbWV0ZXJzXG4gKiAtIGN1cnNvclxuICogLSBtYXhQYXNzaW5nVmFsdWVcbiAqIC0gbWluRmFpbGluZ1ZhbHVlXG4gKi9cbmZ1bmN0aW9uIGZpbmRCb3VuZGFyeShtaW4sIG1heCwgdGVzdCwgZG9uZSkge1xuICBsZXQgY3Vyc29yID0gbWF4O1xuICAvLyBzdGFydCBoYWxmd2F5IHRocm91Z2ggdGhlIHJhbmdlXG4gIHdoaWxlIChtYXggPiBtaW4pIHtcbiAgICBpZiAodGVzdChjdXJzb3IpKSB7XG4gICAgICBtYXggPSBjdXJzb3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1pbiA9IGN1cnNvcjtcbiAgICB9XG5cbiAgICBpZiAobWF4IC0gbWluID09PSAxKSB7XG4gICAgICBkb25lKGN1cnNvciwgbWluLCBtYXgpO1xuICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBjdXJzb3IgPSBNYXRoLnJvdW5kKChtaW4gKyBtYXgpIC8gMik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW1pdChpbnN0YW5jZSwgdHlwZSkge1xuICBpbnN0YW5jZS5lbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KHR5cGUpKTtcbn1cblxuZXhwb3J0IHsgTGluZUNsYW1wIGFzIGRlZmF1bHQgfTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1wiYmVnaW5cIjp7XCJ0ZXh0XCI6XCJbZGVsYXkgNTAwXUNvbm5lY3RpbmdbZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVxcbltzb3VuZCBhbGFybS53YXZdPGVtPkJlZXA8L2VtPiBbZGVsYXkgMTAwMF08ZW0+QmVlcDwvZW0+IFtkZWxheSAxMDAwXTxlbT5CZWVwPC9lbT5bZGVsYXkgMTAwMF1cXG5bc291bmQgY2xpY2sud2F2XVlvdSB3YWtlIHVwIHNsb3dseSB0byB0aGUgc291bmQgb2YgeW91ciBhbGFybS5cXG5JdCBkcm9uZXMgb24gYW5kIG9uIHVudGlsIHlvdSB3YWtlIHVwIGVub3VnaCB0byB0dXJuIGl0IG9mZi5cXG5XaGF0IGRvIHlvdSBkbz9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwibmV3c3BhcGVyXCIsXCJ0ZXh0XCI6XCJDaGVjayB0aGUgbmV3c1wiLFwibmV4dFwiOlwiY2hlY2tOZXdzXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiR2V0IG91dCBvZiBiZWRcIixcIm5leHRcIjpcImdldFVwXCJ9XX0sXCJjaGVja05ld3NcIjp7XCJ0ZXh0XCI6XCJZb3UgZ3JhYiB5b3VyIEF1Z21lbnRlZCBSZWFsaXR5IGdsYXNzZXMgZnJvbSB5b3VyIG5pZ2h0c3RhbmQgYW5kIHB1dCB0aGVtIG9uLlxcbkFzIHlvdSBzY3JvbGwgc29tZXdoYXQgYWJzZW50bWluZGVkbHkgdGhyb3VnaCB0aGUgbmV3cywgb25lIHN0b3J5IGNhdGNoZXMgeW91ciBleWUuXFxuQW4gaW1hZ2Ugb2YgYSBmbG9vZGVkIHRvd24gb2ZmIG9mIHRoZSBNaXNzaXNpcHBpIFJpdmVyLlxcbk11cmt5IGJyb3duIHdhdGVyIGV2ZXJ5d2hlcmUsIHBhc3Qgd2Fpc3QgaGVpZ2h0LlxcbkNhcnMsIGJ1aWxkaW5ncywgYW5kIHRyZWVzIGJhcmVseSBhYm92ZSB0aGUgc3VyZmFjZS5bZGVsYXkgMTAwMF1baW1hZ2UgaHR0cHM6Ly9pbWFnZXMuZm94dHYuY29tL3N0YXRpYy5mb3g3YXVzdGluLmNvbS93d3cuZm94N2F1c3Rpbi5jb20vY29udGVudC91cGxvYWRzLzIwMjAvMDIvOTMyLzUyNC9GbG9vZGluZy1pbi1NSXNzaXNzaXBwaS0uanBnP3ZlPTEmdGw9MV1cXG5OYXR1cmUgaXMgYSBjcnVlbCBtaXN0cmVzcywgeW91IHRoaW5rLlxcbkJ1dCB0aGVuIGFnYWluLCB3ZSd2ZSBhbHdheXMgaGFkIHRvIGRlYWwgd2l0aCBuYXR1cmFsIGRpc2FzdGVycywgcmlnaHQ/XFxuV2VsbCwgdGhhdHMgZW5vdWdoIG9mIHRoZSBuZXdzIGZvciB0b2RheS4gVGhhdCBzdHVmZiBpcyBhbHdheXMganVzdCBkZXByZXNzaW5nLlwiLFwibG9vcFwiOlwiYmVnaW5cIn0sXCJnZXRVcFwiOntcInRleHRcIjpcIllvdSBnZXQgdXAgYW5kIGdldCByZWFkeSBmb3IgdGhlIGRheS5cXG5XaGVuIHlvdSBjb21lIGJhY2sgb3V0IG9mIHRoZSBiYXRocm9vbSwgeW91IG5vdGljZSB0d28gdGhpbmdzOlxcbjEuIEl0J3MgZnJlZXppbmcgaW4gaGVyZVxcbjIuIFlvdXIgcm9vbSBpcyBhIG1lc3NcIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiZmFuXCIsXCJ0ZXh0XCI6XCJUdXJuIG9mZiB0aGUgQS9DXCIsXCJuZXh0XCI6XCJ0dXJuT2ZmXCJ9LHtcImljb25cIjpcImZvbGRlclwiLFwidGV4dFwiOlwiQ2hlY2sgb3V0IHRoZSBtZXNzXCIsXCJuZXh0XCI6XCJtZXNzXCIsXCJyZXR1cm5cIjpcImNvbnRpbnVlXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiTGVhdmVcIixcIm5leHRcIjpcImxlYXZlXCJ9XX0sXCJ0dXJuT2ZmXCI6e1widGV4dFwiOlwiQXMgeW91IGdvIG92ZXIgdG8gdHVybiBvZmYgdGhlIGFpciBjb25kaXRpb25pbmcsIHlvdSB0YWtlIGEgbG9vayBvdXQgdGhlIHdpbmRvdy4gSnVzdCBhcyB5b3UgZXhwZWN0ZWQsIGl0cyBjbG91ZHkgYW5kIHJhaW55LiBUaGUgQS9DIG11c3QgaGF2ZSBiZWVuIG1ha2luZyB0aGUgdGVtcGVyYXR1cmUgZXZlbiBjb2xkZXIgdGhhbiBpdCBhbHJlYWR5IHdhcyBvdXRzaWRlLlxcbllvdSd2ZSBoYWQgaXQgdHVybmVkIGFsbCB0aGUgd2F5IHVwIGZvciB0aGUgcGFzdCBmZXcgZGF5cyBkdWUgdG8gdGhlIGhlYXR3YXZlLiBZb3UnZCBiZWVuIHdvcnJpZWQgdGhhdCBpdCB3YXNuJ3QgZ29pbmcgdG8gZW5kOiB5b3UgaGFkIG5ldmVyIHNlZW4gYSBoZWF0d2F2ZSBnbyBmb3IgdGhhdCBsb25nIG9yIHRoYXQgaG90IGluIHlvdXIgbGlmZS4gQ2xlYXJseSBpdCdzIG92ZXIgbm93LCB0aG91Z2gsIGlmIHRoZSB0ZW1wZXJhdHVyZSBpcyBhbnl0aGluZyB0byBnbyBieS5cXG5Zb3UgYWRqdXN0IHRoZSBBL0MncyBzZXR0aW5ncyBpbiBpdHMgYXBwIG9uIHlvdXIgQVIgZ2xhc3Nlcy4gT24gdG8gbW9yZSBpbXBvcnRhbnQgdGhpbmdzLlwiLFwibG9vcFwiOlwiZ2V0VXBcIn0sXCJtZXNzXCI6e1widGV4dFwiOlwiWW91IHNwZW5kIHNvIG11Y2ggdGltZSBhdCB3b3JrIG5vd2FkYXlzIHRoYXQgeW91ciByb29tIGlzIHByZXR0eSBtZXNzeS4gSW4gdGhlb3J5LCBhbGwgb2YgeW91ciBtYXRlcmlhbHMgd291bGQgYmUgY29udGFpbmVkIGluIHRoZSBmb2xkZXIgb24geW91ciBkZXNrLCBidXQgeW91IHNwZW5kIHNvIG11Y2ggdGltZSByZW9yZ2FuaXppbmcgYW5kIGFkanVzdGluZyB0aGF0IGl0IGFsbCBlbmRzIHVwIHN0cmV3biBhYm91dC4gWW91J2QgcHJvYmFibHkgYmUgYmV0dGVyIG9mZiB1c2luZyB2aXJ0dWFsIGRvY3VtZW50cywgYnV0IHNvbWV0aGluZyBhYm91dCBmZWVsaW5nIHRoZSBwYXBlcnMgaW4geW91ciBoYW5kIHN0aWxsIGFwcGVhbHMgdG8geW91IG1vcmUgdGhhbiBqdXN0IHNlZWluZyB0aGVtLlxcbllvdSBwaWNrIHVwIHdoYXQgZmV3IHBhcGVycyByZW1haW4gdGhlIGZvbGRlciBhbmQgZmxpY2sgdGhyb3VnaCB0aGVtLiBUaGV5J3JlIHRoZSB0aHJlZSBzdHVkaWVzIHlvdSd2ZSBiYXNlZCB5b3VyIHByZXNlbnRhdGlvbiBvbi4gWW91IHN0YXJlIGF0IHRoZW0gZm9yIGEgbGl0dGxlLCBwZW5zaXZlbHkuIFlvdSdkIGFsd2F5cyB3YW50ZWQgdG8gYmUgdGhlIG9uZSBkb2luZyB0aGUgcmVzZWFyY2guIFRoYXQncyB3aHkgeW91IHRvb2sgdGhpcyBqb2I7IHByZXNlbnRpbmcgcmVzZWFyY2ggc2VlbWVkIGxpa2UgYSBnb29kIHdheSB0byBnZXQgc29tZSBjb25uZWN0aW9ucywgbm90IHRvIG1lbnRpb24geW91IG5lZWRlZCB0aGUgbW9uZXkuIEJ1dCBhdCBzb21lIHBvaW50IHlvdSBsb3N0IHRyYWNrIG9mIHRoYXQgZ29hbCwgYW5kIGV2ZW4gdGhvdWdoIHlvdSBjYW4gcHJvYmFibHkgYWZmb3JkIHRvIGdvIGJhY2sgdG8gc2Nob29sIG5vdywgYmVpbmcgYSByZXNlYXJjaGVyIGZlZWxzIGxpa2Ugc29tZW9uZSBlbHNlJ3MgZHJlYW0uIFRoZSBraW5kIG9mIHRoaW5nIGEga2lkIHRlbGxzIHRoZW1zZWxmIGJlZm9yZSB0aGV5J3ZlIGJlZW4gZXhwb3NlZCB0byB0aGUgcmVhbCB3b3JsZC5cXG5UaGlzIGpvYiBpcyBmaW5lLiBJdCBwYXlzIHdlbGwuIDxiPkl0J3MgZmluZTwvYj4uXFxuQW55d2F5LCB5b3UgaGF2ZSB0aHJlZSBzdHVkaWVzIGluIHRoZSBmb2xkZXIuXFxuRG8geW91IHdhbnQgdG8gcmV2aWV3IGFueSBvZiB0aGVtIGJlZm9yZSB0aGUgYmlnIGhlYXJpbmcgbGF0ZXI/XCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImluZHVzdHJ5XCIsXCJ0ZXh0XCI6XCJDQ1MgU3R1ZHlcIixcIm5leHRcIjpcImNjc1wifSx7XCJpY29uXCI6XCJmaXJlLWZsYW1lLXNpbXBsZVwiLFwidGV4dFwiOlwiRWZmaWNpZW5jeSBTdHVkeVwiLFwibmV4dFwiOlwiZWZmaWNpZW5jeVwifSx7XCJpY29uXCI6XCJhcnJvd3Mtcm90YXRlXCIsXCJ0ZXh0XCI6XCJMaWZlY3ljbGUgQW5hbHlzaXNcIixcIm5leHRcIjpcImxjYVwifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkNvbnRpbnVlXCIsXCJuZXh0XCI6XCJjb250aW51ZVwifV19LFwiY2NzXCI6e1widGV4dFwiOlwiQ0NTIFN0dWR5XCIsXCJsb29wXCI6XCJtZXNzXCJ9LFwiZWZmaWNpZW5jeVwiOntcInRleHRcIjpcIkVmZmljaWVuY3kgU3R1ZHlcIixcImxvb3BcIjpcIm1lc3NcIn0sXCJsY2FcIjp7XCJ0ZXh0XCI6XCJMaWZlY3ljbGUgQW5hbHlzaXNcIixcImxvb3BcIjpcIm1lc3NcIn0sXCJjb250aW51ZVwiOntcInRleHRcIjpcIllvdSB0dXJuIHlvdXIgYXR0ZW50aW9uIHRvIHRoZSByZXN0IG9mIHRoZSByb29tLlwiLFwibG9vcFwiOlwiZ2V0VXBcIn19IiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXVkaW9NYW5hZ2VyIHtcbiAgICBlbGVtZW50ID0gbmV3IEF1ZGlvKCk7XG4gICAgXG4gICAgcGxheShuYW1lOiBTdHJpbmcsIHZvbHVtZTogbnVtYmVyID0gMSkge1xuICAgICAgICB0aGlzLmVsZW1lbnQuc3JjID0gYC4uL2Fzc2V0cy8ke25hbWV9YDtcbiAgICAgICAgdGhpcy5lbGVtZW50LnZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5lbGVtZW50LnBsYXkoKTtcbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGF1c2UoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5lbGVtZW50LnBhdXNlKCk7XG4gICAgfVxuXG4gICAgcmVzdW1lKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGxheSgpO1xuICAgIH1cblxuICAgIGxvb3Aoc2hvdWxkTG9vcDogYm9vbGVhbikge1xuICAgICAgICB0aGlzLmVsZW1lbnQubG9vcCA9IHNob3VsZExvb3A7XG4gICAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1YmJsZXMge1xuICAgIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuICAgIGJ1YmJsZXM6IEFycmF5PEJ1YmJsZT4gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5jdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcbiAgICAgICAgdGhpcy5yZXNpemUoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYnViYmxlcy5wdXNoKG5ldyBCdWJibGUoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLmN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy5jdHguY2FudmFzLndpZHRoLCB0aGlzLmN0eC5jYW52YXMuaGVpZ2h0KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYnViYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zcGVlZCA+IDAgJiYgdGhpcy5idWJibGVzW2ldLmxpZmV0aW1lIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0uc3BlZWQgKj0gLTE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS51cGRhdGUoZHQpO1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zaXplIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0gPSBuZXcgQnViYmxlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5kcmF3KHRoaXMuY3R4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdmFyIGRwciA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIHx8IDE7XG4gICAgICAgIHZhciByZWN0ID0gdGhpcy5jdHguY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy53aWR0aCA9IHJlY3Qud2lkdGggKiBkcHI7XG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodCAqIGRwcjtcblxuICAgICAgICAvLyB0aGlzLmN0eC5zY2FsZShkcHIsIGRwcik7XG5cbiAgICAgICAgdGhpcy5jdHguZmlsdGVyID0gXCJibHVyKDUwcHgpXCI7XG4gICAgfVxufVxuXG5jbGFzcyBCdWJibGUge1xuICAgIHNwZWVkOiBudW1iZXI7XG4gICAgeDogbnVtYmVyO1xuICAgIHk6IG51bWJlcjtcbiAgICBzaXplOiBudW1iZXI7XG4gICAgY29sb3I6IHN0cmluZztcbiAgICBsaWZldGltZTogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuc3BlZWQgPSAwLjAyO1xuXG4gICAgICAgIHRoaXMueCA9IE1hdGgucmFuZG9tKCkgKiB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lckhlaWdodDtcblxuICAgICAgICB0aGlzLnNpemUgPSAxMDtcblxuICAgICAgICBsZXQgdiA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGxldCBodWUgPSB2IDwgMC41ID8gMTUwIDogMjMwO1xuICAgICAgICBsZXQgc2F0ID0gdiA8IDAuNSA/IDUwIDogODU7XG4gICAgICAgIGxldCBsaWdodCA9IHYgPCAwLjUgPyAyNSA6IDQwO1xuICAgICAgICB0aGlzLmNvbG9yID0gXCJoc2xhKFwiICsgaHVlICsgXCIsIFwiICsgc2F0ICsgXCIlLCBcIiArIGxpZ2h0ICsgXCIlLCAyMCUpXCI7XG5cbiAgICAgICAgdGhpcy5saWZldGltZSA9IE1hdGgucmFuZG9tKCkgKiogNSAqIDE2MDAwICsgMjAwMDtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLnNpemUgKz0gdGhpcy5zcGVlZCAqIGR0O1xuICAgICAgICB0aGlzLmxpZmV0aW1lIC09IGR0O1xuICAgIH1cblxuICAgIGRyYXcoY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQpIHtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuY29sb3I7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4LmFyYyh0aGlzLngsIHRoaXMueSwgdGhpcy5zaXplLCAwLCBNYXRoLlBJICogMik7XG4gICAgICAgIGN0eC5maWxsKCk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RvcnksIE9wdGlvbiB9IGZyb20gJy4vc3RvcnknO1xuXG5sZXQgc3Rvcnk6IFN0b3J5ID0gcmVxdWlyZShcIi4vc3RvcnkuY3NvblwiKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnV0dG9ucyB7XG4gICAgZWxlbTogSFRNTEVsZW1lbnQ7XG4gICAgc2VsZWN0ZWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIHRleHQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGVuYWJsZWQgPSBmYWxzZTtcbiAgICBidXR0b25zOiBIVE1MQnV0dG9uRWxlbWVudFtdID0gW107XG5cbiAgICBjb25zdHJ1Y3RvcihlbGVtOiBIVE1MRWxlbWVudCkge1xuICAgICAgICB0aGlzLmVsZW0gPSBlbGVtO1xuICAgIH1cblxuICAgIGVuYWJsZShzY2VuZTogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gICAgICAgIFxuICAgICAgICBsZXQgb3B0aW9uczogT3B0aW9uW107XG4gICAgICAgIGlmIChzdG9yeVtzY2VuZV0ub3B0aW9ucyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBzdG9yeVtzdG9yeVtzY2VuZV0ubG9vcCFdLm9wdGlvbnMhO1xuICAgICAgICAgICAgbGV0IGxvb3BlZE9wdCA9IG9wdGlvbnMuZmluZEluZGV4KG8gPT4gby5yZXR1cm4gIT0gdW5kZWZpbmVkID8gby5yZXR1cm4gPT0gc2NlbmUgOiBvLm5leHQgPT0gc2NlbmUpO1xuICAgICAgICAgICAgb3B0aW9ucy5zcGxpY2UobG9vcGVkT3B0LCAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBzdG9yeVtzY2VuZV0ub3B0aW9ucyE7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RlcCA9IG9wdGlvbnMubGVuZ3RoID09IDQgPyA2IDogMTIvb3B0aW9ucy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9uID0gb3B0aW9uc1tpXTtcbiAgICAgICAgICAgIGxldCBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICAgICAgICAgICAgYnV0dG9uLmNsYXNzTmFtZSA9IFwib3ZlcmxheVwiO1xuICAgICAgICAgICAgYnV0dG9uLmlubmVySFRNTCA9ICBcIj4gPGkgY2xhc3M9XFxcImZhLXNvbGlkIGZhLVwiKyBvcHRpb24uaWNvbiArXCJcXFwiPjwvaT4gXCIgKyBvcHRpb24udGV4dDtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLnN0eWxlLmdyaWRDb2x1bW4gPSBcIjQgLyAxMFwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmxlbmd0aCA9PSA0KSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLnN0eWxlLmdyaWRDb2x1bW4gPSBpIDwgMiA/IChpKnN0ZXAgKyAxKS50b1N0cmluZygpICsgXCIgLyBcIiArICgoaSsxKSpzdGVwICsgMSkudG9TdHJpbmcoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6ICgoaS0yKSpzdGVwICsgMSkudG9TdHJpbmcoKSArIFwiIC8gXCIgKyAoKGktMSkqc3RlcCArIDEpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gKGkqc3RlcCArIDEpLnRvU3RyaW5nKCkgKyBcIiAvIFwiICsgKChpKzEpKnN0ZXAgKyAxKS50b1N0cmluZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnV0dG9uLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RlZCA9IG9wdGlvbi5uZXh0O1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dCA9IFwiPGkgY2xhc3M9XFxcImZhLXNvbGlkIGZhLVwiKyBvcHRpb24uaWNvbiArXCJcXFwiPjwvaT4gXCIgKyBvcHRpb24udGV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW0uY2xhc3NOYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW0uaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1dHRvbnMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmVsZW0uYXBwZW5kQ2hpbGQoYnV0dG9uKTtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9ucy5wdXNoKGJ1dHRvbik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbGVtLmNsYXNzTmFtZSA9IFwib3V0XCI7XG4gICAgfVxufSIsImltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuaW1wb3J0IFN0YXRlTWFuYWdlciBmcm9tIFwiLi9zdGF0ZV9tYW5hZ2VyXCI7XG5pbXBvcnQgeyBCZWdpblN0YXRlIH0gZnJvbSBcIi4vc3RhdGVzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEdhbWUge1xuICAgIHRlcm06IFRlcm1pbmFsO1xuICAgIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKHRlcm1pbmFsOiBIVE1MRWxlbWVudCkge1xuICAgICAgICB0ZXJtaW5hbC5zdHlsZS5saW5lSGVpZ2h0ID0gXCIxLjJyZW1cIjtcbiAgICAgICAgdGhpcy50ZXJtID0gbmV3IFRlcm1pbmFsKHRlcm1pbmFsKTtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbmV3IFN0YXRlTWFuYWdlcihCZWdpblN0YXRlKTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIudXBkYXRlKGR0LCB0aGlzLnRlcm0pO1xuXG4gICAgICAgIHRoaXMudGVybS51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdGhpcy50ZXJtLnJlc2l6ZSgpO1xuICAgIH1cblxuICAgIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGVNYW5hZ2VyIGZyb20gXCIuL3N0YXRlX21hbmFnZXJcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhYnN0cmFjdCBjbGFzcyBTdGF0ZSB7XG4gICAgcHJvdGVjdGVkIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFN0YXRlTWFuYWdlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIGluaXQodGVybTogVGVybWluYWwpIHt9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHt9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHt9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTdGF0ZU1hbmFnZXIge1xuICAgIHN0YXRlOiBTdGF0ZTtcbiAgICBuZWVkc0luaXQgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICB9XG5cbiAgICBzZXRTdGF0ZShzOiBuZXcgKG06IFN0YXRlTWFuYWdlcikgPT4gU3RhdGUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5ldyBzKHRoaXMpO1xuICAgICAgICB0aGlzLm5lZWRzSW5pdCA9IHRydWU7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLm5lZWRzSW5pdCkge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZS5pbml0KHRlcm0pO1xuICAgICAgICAgICAgdGhpcy5uZWVkc0luaXQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUudXBkYXRlKGR0LCB0ZXJtKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5rZXlkb3duKGUpO1xuICAgIH1cbn1cbiIsImltcG9ydCBTdGF0ZSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuL3Rlcm1pbmFsXCI7XG5pbXBvcnQgQnV0dG9ucyBmcm9tIFwiLi9idXR0b25zXCI7XG5pbXBvcnQgeyBTdG9yeSB9IGZyb20gJy4vc3RvcnknO1xuaW1wb3J0IEF1ZGlvTWFuYWdlciBmcm9tIFwiLi9hdWRpb19tYW5hZ2VyXCI7XG5cbmxldCBzdG9yeTogU3RvcnkgPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5leHBvcnQgY2xhc3MgQmVnaW5TdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRlcm0ud3JpdGVMaW5lKFwiUHJlc3MgYW55IGtleSB0byBiZWdpbi4uLlwiKTtcbiAgICB9XG5cbiAgICBvdmVycmlkZSBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLnNldFN0YXRlKFdpcGVTdGF0ZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2lwZVN0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHByaXZhdGUgd2lwZVRpbWVyID0gMDtcbiAgICBwcml2YXRlIHdpcGVUaWNrcyA9IDA7XG4gICAgcHJpdmF0ZSB3aXBlTGluZXM6IG51bWJlcjtcblxuICAgIG92ZXJyaWRlIGluaXQodGVybTogVGVybWluYWwpIHtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLm92ZXJmbG93ID0gXCJoaWRkZW5cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnNjcm9sbFNuYXBUeXBlID0gXCJ1bnNldFwiO1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSBcIjEuNnJlbVwiO1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gXCIxLjZyZW1cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnRleHRJbmRlbnQgPSBcInVuc2V0XCI7XG4gICAgICAgIHRoaXMud2lwZUxpbmVzID0gdGVybS5tYXhMaW5lcztcbiAgICB9XG5cbiAgICBvdmVycmlkZSB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgaWYgKHRoaXMud2lwZVRpbWVyID4gNTApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndpcGVUaWNrcyA+IDUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVMaW5lcy0tO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVUaWNrcysrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0ZXJtLmZpbGxSYW5kb20odGhpcy53aXBlTGluZXMpO1xuXG4gICAgICAgICAgICB0aGlzLndpcGVUaW1lciA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53aXBlTGluZXMgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgKz0gZHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0ZXJtLnJlc2V0KCk7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcIlwiO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnNjcm9sbFNuYXBUeXBlID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5wYWRkaW5nTGVmdCA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS50ZXh0SW5kZW50ID0gXCJcIjtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5zZXRTdGF0ZShQbGF5aW5nU3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGxheWluZ1N0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHNjZW5lID0gXCJiZWdpblwiO1xuXG4gICAgcmVtYWluaW5nVGV4dCA9IFwiXCI7XG5cbiAgICBkZWxheSA9IDA7XG5cbiAgICB0ZXh0RGVjb2RlZCA9IC0xO1xuICAgIHRleHRQb3NpdGlvbiA9IC0xO1xuXG4gICAgYnV0dG9ucyA9IG5ldyBCdXR0b25zKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYnV0dG9uc1wiKSEpO1xuXG4gICAgYXVkaW8gPSBuZXcgQXVkaW9NYW5hZ2VyKCk7XG4gICAgYmFja2dyb3VuZCA9IG5ldyBBdWRpb01hbmFnZXIoKTtcblxuICAgIGN1cnJTb3VuZCA9IFwiY2xpY2sud2F2XCI7XG5cbiAgICBsb2NrID0gZmFsc2U7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRoaXMuYXVkaW8ubG9vcChmYWxzZSk7XG4gICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLmxvY2spIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5idXR0b25zLmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5idXR0b25zLnNlbGVjdGVkICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRlcm0ud3JpdGVMaW5lKHRoaXMuYnV0dG9ucy50ZXh0ISk7XG4gICAgICAgICAgICB0aGlzLnNjZW5lID0gdGhpcy5idXR0b25zLnNlbGVjdGVkO1xuICAgICAgICAgICAgdGhpcy5idXR0b25zLnNlbGVjdGVkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmF1ZGlvLnN0b3AoKTtcbiAgICAgICAgICAgIHRlcm0uYnJlYWsoKTtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9ucy5lbmFibGUodGhpcy5zY2VuZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5kZWxheSA8PSAwKSB7XG4gICAgICAgICAgICBsZXQgW3BvcywgaW5kZXhdID0gdGhpcy5pbmRleE9mTWFueSh0aGlzLnJlbWFpbmluZ1RleHQsIFwiPFsgXFxuXCIpO1xuICAgICAgICAgICAgaWYocG9zID09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVNwZWNpYWwoaW5kZXgsIHRlcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlVGV4dChwb3MsIHRlcm0sIGR0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkgLT0gZHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGluZGV4T2ZNYW55KHN0cjogc3RyaW5nLCBjaGFyczogc3RyaW5nKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYyA9IGNoYXJzLmluZGV4T2Yoc3RyW2ldKTtcbiAgICAgICAgICAgIGlmIChjICE9IC0xKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtpLCBjXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy0xLCAtMV07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB3cml0ZVRleHQobGVuOiBudW1iZXIsIHRlcm06IFRlcm1pbmFsLCBkdDogbnVtYmVyKSB7XG4gICAgICAgIGlmIChsZW4gPT0gLTEpIHtcbiAgICAgICAgICAgIGxlbiA9IHRoaXMucmVtYWluaW5nVGV4dC5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50ZXh0RGVjb2RlZCA9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5hdWRpby5wbGF5KHRoaXMuY3VyclNvdW5kKTtcbiAgICAgICAgICAgIHRoaXMudGV4dERlY29kZWQgPSAwO1xuICAgICAgICAgICAgdGhpcy50ZXh0UG9zaXRpb24gPSB0ZXJtLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdGV4dCA9XG4gICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMCwgdGhpcy50ZXh0RGVjb2RlZCkgK1xuICAgICAgICAgICAgdGVybS5yYW5kb21DaGFyYWN0ZXJzKGxlbiAtIHRoaXMudGV4dERlY29kZWQpO1xuXG4gICAgICAgIHRlcm0ud3JpdGUodGV4dCwgdGhpcy50ZXh0UG9zaXRpb24pO1xuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IGxlbikge1xuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGxlbik7XG4gICAgICAgICAgICB0aGlzLnRleHREZWNvZGVkID0gLTE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRleHREZWNvZGVkKys7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVTcGVjaWFsKGluZGV4OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHN3aXRjaCAoaW5kZXgpIHtcbiAgICAgICAgICAgIGNhc2UgMDogLy8gPFxuICAgICAgICAgICAgICAgIGxldCBlbmRUYWdQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIj5cIik7XG4gICAgICAgICAgICAgICAgdGVybS53cml0ZSh0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMCwgZW5kVGFnUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShlbmRUYWdQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMTogLy8gW1xuICAgICAgICAgICAgICAgIGxldCBlbmRDb21tYW5kUG9zID0gdGhpcy5yZW1haW5pbmdUZXh0LmluZGV4T2YoXCJdXCIpO1xuICAgICAgICAgICAgICAgIGxldCBjb21tYW5kID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEsIGVuZENvbW1hbmRQb3MpO1xuICAgICAgICAgICAgICAgIGxldCBzcGFjZVBvcyA9IGNvbW1hbmQuaW5kZXhPZihcIiBcIik7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGFjZVBvcyA9PSAtMSA/IGNvbW1hbmQgOiBjb21tYW5kLnNsaWNlKDAsIHNwYWNlUG9zKSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZGVsYXlcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVsYXkgPSBwYXJzZUludChjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJub3JtYWxcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXVkaW8ucGxheSh0aGlzLmN1cnJTb3VuZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInNlcFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzb3VuZFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyU291bmQgPSBjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImJhY2tncm91bmRcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcGFjZVBvcyA9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmFja2dyb3VuZC5zdG9wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmFja2dyb3VuZC5wbGF5KGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSwgMC4xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiaW1hZ2VcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UnKSBhcyBIVE1MSW1hZ2VFbGVtZW50KS5zcmMgPSBjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UtY29udGFpbmVyJykhLmNsYXNzTmFtZSA9IFwic2hvd1wiO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2NrID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jbG9zZScpIS5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubG9jayA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jb250YWluZXInKSEuY2xhc3NOYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShlbmRDb21tYW5kUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDI6IC8vIDxzcGFjZT5cbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKFwiIFwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDM6IC8vIFxcblxuICAgICAgICAgICAgICAgIHRlcm0ud3JpdGVMaW5lKFwiXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVsYXkgPSA1MDA7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkludmFsaWQgY2hhciBpbmRleCBcIiArIGluZGV4KTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCBMaW5lQ2xhbXAgZnJvbSBcIkB0dmFuYy9saW5lY2xhbXBcIjtcclxuXHJcbmNvbnN0IENVUlNPUl9CTElOS19JTlRFUlZBTCA9IDUwMDtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRlcm1pbmFsIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG5cclxuICAgIGZvbnRTaXplOiBudW1iZXI7XHJcbiAgICB3aWR0aDogbnVtYmVyO1xyXG4gICAgaGVpZ2h0OiBudW1iZXI7XHJcbiAgICBsaW5lSGVpZ2h0OiBudW1iZXI7XHJcblxyXG4gICAgbWF4TGluZXM6IG51bWJlcjtcclxuICAgIGNoYXJzUGVyTGluZTogbnVtYmVyO1xyXG5cclxuICAgIGNvbnRlbnQgPSBcIjxkaXY+PiBcIjtcclxuXHJcbiAgICBwcml2YXRlIGN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBjdXJzb3JFbmFibGVkID0gdHJ1ZTtcclxuICAgIHByaXZhdGUgY3Vyc29yVGlja3MgPSAwO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbTtcclxuXHJcbiAgICAgICAgdGhpcy5mb250U2l6ZSA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemUuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLndpZHRoID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS53aWR0aC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5oZWlnaHQuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xyXG4gICAgICAgIGNvbnN0IGNsYW1wID0gbmV3IExpbmVDbGFtcCh0aGlzLmVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMubGluZUhlaWdodCA9IGNsYW1wLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCkuYWRkaXRpb25hbExpbmVIZWlnaHQ7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJcIjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXhMaW5lcyA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgLyB0aGlzLmxpbmVIZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2hhcnNQZXJMaW5lID0gTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gKHRoaXMuZm9udFNpemUgKiAwLjYpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXNpemUoKSB7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkud2lkdGguc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuaGVpZ2h0LnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMubWF4TGluZXMgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0IC8gdGhpcy5saW5lSGVpZ2h0KTtcclxuICAgICAgICB0aGlzLmNoYXJzUGVyTGluZSA9IE1hdGguZmxvb3IodGhpcy53aWR0aCAvICh0aGlzLmZvbnRTaXplICogMC42KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclRpY2tzID49IENVUlNPUl9CTElOS19JTlRFUlZBTCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJzb3JUaWNrcyA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsaXBDdXJzb3IoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Vyc29yVGlja3MgKz0gZHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc2hvdygpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuaW5uZXJIVE1MID0gdGhpcy5jb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyKCkge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ID0gXCJcIjtcclxuICAgIH1cclxuXHJcbiAgICBnZXRQb3NpdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb250ZW50Lmxlbmd0aCAtICh0aGlzLmN1cnNvclZpc2libGUgPyAwIDogMSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHV0KHRleHQ6IHN0cmluZywgcG9zPzogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIHBvcyAhPSB1bmRlZmluZWQgJiZcclxuICAgICAgICAgICAgcG9zID49IDAgJiZcclxuICAgICAgICAgICAgcG9zIDw9IHRoaXMuY29udGVudC5sZW5ndGggLSB0ZXh0Lmxlbmd0aFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgPVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50LnNsaWNlKDAsIHBvcykgK1xyXG4gICAgICAgICAgICAgICAgdGV4dCArXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQuc2xpY2UocG9zICsgdGV4dC5sZW5ndGgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCArPSB0ZXh0O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwdXRMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQgKyBcIjwvZGl2PjxkaXY+PiBcIjtcclxuICAgIH1cclxuXHJcbiAgICByZXNldCgpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5wdXQoXCI+IFwiKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGUodGV4dDogc3RyaW5nLCBwb3M/OiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnB1dCh0ZXh0LCBwb3MpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB3cml0ZUxpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5wdXRMaW5lKHRleHQpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBicmVhaygpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCArPSBcIjwvZGl2Pjxici8+PGRpdj4+IFwiO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICByYW5kb21DaGFyYWN0ZXJzKGNvdW50OiBudW1iZXIpIHtcclxuICAgICAgICBsZXQgdmFsdWVzID0gbmV3IFVpbnQ4QXJyYXkoY291bnQpO1xyXG4gICAgICAgIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKHZhbHVlcyk7XHJcbiAgICAgICAgY29uc3QgbWFwcGVkVmFsdWVzID0gdmFsdWVzLm1hcCgoeCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBhZGogPSB4ICUgMzY7XHJcbiAgICAgICAgICAgIHJldHVybiBhZGogPCAyNiA/IGFkaiArIDY1IDogYWRqIC0gMjYgKyA0ODtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbWFwcGVkVmFsdWVzKTtcclxuICAgIH1cclxuXHJcbiAgICBmaWxsUmFuZG9tKGxpbmVzOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lczsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgICAgICB0aGlzLnB1dChcIjxiciAvPlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5wdXQodGhpcy5yYW5kb21DaGFyYWN0ZXJzKHRoaXMuY2hhcnNQZXJMaW5lKSk7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0Q3Vyc29yRW5hYmxlZCh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuY3Vyc29yRW5hYmxlZCA9IHZhbHVlO1xyXG4gICAgICAgIC8vIGlmIHRoZSBjdXJzb3IgbmVlZGVkIHRvIGJlIHR1cm5lZCBvZmYsIGZpeCBpdFxyXG4gICAgICAgIGlmICghdGhpcy5jdXJzb3JFbmFibGVkICYmICF0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ID0gdGhpcy5jb250ZW50LnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZmxpcEN1cnNvcigpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCArPSBcIl9cIjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5jdXJzb3JWaXNpYmxlID0gIXRoaXMuY3Vyc29yVmlzaWJsZTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IEJ1YmJsZXMgZnJvbSBcIi4vYnViYmxlc1wiO1xuaW1wb3J0IEdhbWUgZnJvbSBcIi4vZ2FtZVwiO1xuXG5sZXQgZ2FtZTogR2FtZTtcblxubGV0IGJ1YmJsZXM6IEJ1YmJsZXM7XG5cbmxldCBsYXN0VGltZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbndpbmRvdy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgYnViYmxlcyA9IG5ldyBCdWJibGVzKFxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJhY2tncm91bmRcIikgYXMgSFRNTENhbnZhc0VsZW1lbnRcbiAgICApO1xuICAgIGdhbWUgPSBuZXcgR2FtZShkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRlcm1pbmFsXCIpISk7XG5cbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG59O1xuXG53aW5kb3cub25yZXNpemUgPSAoKSA9PiB7XG4gICAgYnViYmxlcy5yZXNpemUoKTtcbiAgICBnYW1lLnJlc2l6ZSgpO1xufTtcblxuZG9jdW1lbnQub25rZXlkb3duID0gKGUpID0+IHtcbiAgICBnYW1lLmtleWRvd24oZSk7XG59O1xuXG5kb2N1bWVudC5vbnZpc2liaWxpdHljaGFuZ2UgPSAoKSA9PiB7XG4gICAgaWYgKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSA9PSBcInZpc2libGVcIikge1xuICAgICAgICBsYXN0VGltZSA9IG51bGw7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgIC8vIFRoaXMgcmVhbGx5IHNob3VsZG4ndCBiZSBuZWVkZWQgaWYgYnJvd3NlcnMgYXJlIGZvbGxvd2luZyBjb252ZW50aW9uLFxuICAgIC8vIGJ1dCBiZXR0ZXIgc2FmZSB0aGFuIHNvcnJ5XG4gICAgaWYgKGRvY3VtZW50LmhpZGRlbikge1xuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGFzdFRpbWUgIT0gbnVsbCkge1xuICAgICAgICBsZXQgZHQgPSB0aW1lIC0gbGFzdFRpbWU7XG5cbiAgICAgICAgYnViYmxlcy51cGRhdGUoZHQpO1xuICAgICAgICBnYW1lLnVwZGF0ZShkdCk7XG4gICAgfVxuXG4gICAgbGFzdFRpbWUgPSB0aW1lO1xuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==