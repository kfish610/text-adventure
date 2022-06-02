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

module.exports = {"begin":{"text":"[delay 500]Connecting[delay 500][normal .][delay 500][normal .][delay 500][normal .]\n<em>Beep</em> [delay 500]<em>Beep</em> [delay 500]<em>Beep</em>\nYou wake up slowly to the sound of your alarm.\nIt drones on and on until you wake up enough to turn it off. \nWhat do you do?","options":[{"icon":"mobile","text":"Check phone","next":"checkPhone"},{"icon":"arrow-up-from-bracket","text":"Get out of bed","next":"getUp"}]},"checkPhone":{"text":"You scroll somewhat absentmindedly through your newsfeed as you wake up. \nOne story catches your eye. An image of a flooded town off of the Missisippi River.\nPieces of driftwood and debris scattered in the water.\nCars drowned in the deep water.\nNature is a cruel mistress, you think. \nBut then again, we've always had to deal with this stuff, right?\nWell, thats enough of the news for today. That stuff is always just depressing.","loop":"begin"},"getUp":{"text":"You get up and get ready for the day. \nWhen you come back out of the bathroom, you notice two things:\n1. It's freezing in here\n2. Your room is a mess","options":[{"icon":"fan","text":"Turn off the A/C","next":"turnOff"},{"icon":"folder","text":"Check out the mess","next":"mess","return":"continue"},{"icon":"arrow-up-from-bracket","text":"Leave","next":"leave"}]},"turnOff":{"text":"As you go over to turn off the air conditioning, you take a look out the window.\nJust as you expected, its cloudy and rainy. \nThe A/C must have been making the temperature even colder than it already was outside.\nYou've had it turned all the way up for the past few days due to the heatwave, but clearly that's over now.\nYou grab your Augmented Reality glasses from your desk and put them on.\nAt least all you have to do is open the A/C app and adjust the virtual knob.\nThis stuff was much more annoying when you had to find the physical controls.","loop":"getUp"},"mess":{"text":"You spend so much time at work nowadays that your room is pretty messy. \nIn theory, all of your materials would be contained in the folder on your desk,\nbut you spend so much time reorganizing and adjusting that it all ends up strewn about.\nYou pick up what few papers remain the folder and flick through them. \nThey're the three studies you've based your presentation on.\nYou stare at them for a little, pensively. You'd always wanted to be the one doing the research. \nThat's why you took this job; presenting research seemed like a good way to get some connections,\nand you needed the money. But at some point you lost track of that goal, \nand even though you can probably afford to go back to school now, \nbeing a researcher feels like someone else's dream. \nThe kind of thing a kid tells themself before they've been exposed to the real world. \nThis job is fine. It pays well. <b>It's fine</b>.\nYou have three studies in the folder. Do you want to review any of them before the big hearing later?","options":[{"icon":"industry","text":"CCS Study","next":"ccs"},{"icon":"fire-flame-simple","text":"Efficiency Study","next":"efficiency"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"lca"},{"icon":"arrow-up-from-bracket","text":"Continue","next":"continue"}]},"ccs":{"text":"CCS Study","loop":"mess"},"efficiency":{"text":"Efficiency Study","loop":"mess"},"lca":{"text":"Lifecycle Analysis","loop":"mess"},"continue":{"text":"You turn your attention to the rest of the room.","loop":"getUp"}}

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
        this.ctx.scale(dpr, dpr);
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
        _this.textTimer = -1;
        _this.buttons = new _buttons__WEBPACK_IMPORTED_MODULE_1__["default"](document.getElementById("buttons"));
        return _this;
    }
    PlayingState.prototype.init = function (term) {
        this.remainingText = story[this.scene].text;
    };
    PlayingState.prototype.update = function (dt, term) {
        if (this.buttons.enabled)
            return;
        if (this.buttons.selected != null) {
            term.writeLine(this.buttons.text);
            this.scene = this.buttons.selected;
            this.buttons.selected = null;
            this.remainingText = story[this.scene].text;
        }
        if (this.remainingText.length == 0) {
            term.write("<br/>");
            term.writeLine("");
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
            this.textDecoded = 0;
            this.textPosition = term.getPosition();
            this.textTimer = 0;
        }
        if (this.textDecoded == 0) {
            if (this.textTimer > 10) {
                this.textDecoded = 1;
                this.textTimer = 0;
            }
            else {
                this.textTimer += dt;
                term.write(term.randomCharacters(len), this.textPosition);
                return;
            }
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
                var command = this.remainingText.slice(1, endCommandPos);
                var spacePos = command.indexOf(" ");
                switch (command.slice(0, spacePos)) {
                    case "delay":
                        this.delay = parseInt(command.slice(spacePos + 1));
                        break;
                    case "normal":
                        term.write(command.slice(spacePos + 1));
                        break;
                    case "sep":
                        break;
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
        this.content = "> ";
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
        this.content += text + "<br />> ";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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RyxJQUFJLEdBQUcsUUFBUSxDQUFDO1FBRXpCLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUNuQjtJQUVELFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDaEIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3pDLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL25vZGVfbW9kdWxlcy9AdHZhbmMvbGluZWNsYW1wL2Rpc3QvZXNtLmpzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0b3J5LmNzb24iLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnViYmxlcy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9idXR0b25zLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2dhbWUudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGUudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGVfbWFuYWdlci50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdGF0ZXMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvdGVybWluYWwudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlZHVjZXMgZm9udCBzaXplIG9yIHRyaW1zIHRleHQgdG8gbWFrZSBpdCBmaXQgd2l0aGluIHNwZWNpZmllZCBib3VuZHMuXG4gKlxuICogU3VwcG9ydHMgY2xhbXBpbmcgYnkgbnVtYmVyIG9mIGxpbmVzIG9yIHRleHQgaGVpZ2h0LlxuICpcbiAqIEtub3duIGxpbWl0YXRpb25zOlxuICogMS4gQ2hhcmFjdGVycyB0aGF0IGRpc3RvcnQgbGluZSBoZWlnaHRzIChlbW9qaXMsIHphbGdvKSBtYXkgY2F1c2VcbiAqIHVuZXhwZWN0ZWQgcmVzdWx0cy5cbiAqIDIuIENhbGxpbmcge0BzZWUgaGFyZENsYW1wKCl9IHdpcGVzIGNoaWxkIGVsZW1lbnRzLiBGdXR1cmUgdXBkYXRlcyBtYXkgYWxsb3dcbiAqIGlubGluZSBjaGlsZCBlbGVtZW50cyB0byBiZSBwcmVzZXJ2ZWQuXG4gKlxuICogQHRvZG8gU3BsaXQgdGV4dCBtZXRyaWNzIGludG8gb3duIGxpYnJhcnlcbiAqIEB0b2RvIFRlc3Qgbm9uLUxUUiB0ZXh0XG4gKi9cbmNsYXNzIExpbmVDbGFtcCB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtZW50XG4gICAqIFRoZSBlbGVtZW50IHRvIGNsYW1wLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIE9wdGlvbnMgdG8gZ292ZXJuIGNsYW1waW5nIGJlaGF2aW9yLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4TGluZXNdXG4gICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBsaW5lcyB0byBhbGxvdy4gRGVmYXVsdHMgdG8gMS5cbiAgICogVG8gc2V0IGEgbWF4aW11bSBoZWlnaHQgaW5zdGVhZCwgdXNlIHtAc2VlIG9wdGlvbnMubWF4SGVpZ2h0fVxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4SGVpZ2h0XVxuICAgKiBUaGUgbWF4aW11bSBoZWlnaHQgKGluIHBpeGVscykgb2YgdGV4dCBpbiBhbiBlbGVtZW50LlxuICAgKiBUaGlzIG9wdGlvbiBpcyB1bmRlZmluZWQgYnkgZGVmYXVsdC4gT25jZSBzZXQsIGl0IHRha2VzIHByZWNlZGVuY2Ugb3ZlclxuICAgKiB7QHNlZSBvcHRpb25zLm1heExpbmVzfS4gTm90ZSB0aGF0IHRoaXMgYXBwbGllcyB0byB0aGUgaGVpZ2h0IG9mIHRoZSB0ZXh0LCBub3RcbiAgICogdGhlIGVsZW1lbnQgaXRzZWxmLiBSZXN0cmljdGluZyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IGNhbiBiZSBhY2hpZXZlZFxuICAgKiB3aXRoIENTUyA8Y29kZT5tYXgtaGVpZ2h0PC9jb2RlPi5cbiAgICpcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy51c2VTb2Z0Q2xhbXBdXG4gICAqIElmIHRydWUsIHJlZHVjZSBmb250IHNpemUgKHNvZnQgY2xhbXApIHRvIGF0IGxlYXN0IHtAc2VlIG9wdGlvbnMubWluRm9udFNpemV9XG4gICAqIGJlZm9yZSByZXNvcnRpbmcgdG8gdHJpbW1pbmcgdGV4dC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaGFyZENsYW1wQXNGYWxsYmFja11cbiAgICogSWYgdHJ1ZSwgcmVzb3J0IHRvIGhhcmQgY2xhbXBpbmcgaWYgc29mdCBjbGFtcGluZyByZWFjaGVzIHRoZSBtaW5pbXVtIGZvbnQgc2l6ZVxuICAgKiBhbmQgc3RpbGwgZG9lc24ndCBmaXQgd2l0aGluIHRoZSBtYXggaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcy5cbiAgICogRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmVsbGlwc2lzXVxuICAgKiBUaGUgY2hhcmFjdGVyIHdpdGggd2hpY2ggdG8gcmVwcmVzZW50IGNsaXBwZWQgdHJhaWxpbmcgdGV4dC5cbiAgICogVGhpcyBvcHRpb24gdGFrZXMgZWZmZWN0IHdoZW4gXCJoYXJkXCIgY2xhbXBpbmcgaXMgdXNlZC5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1pbkZvbnRTaXplXVxuICAgKiBUaGUgbG93ZXN0IGZvbnQgc2l6ZSwgaW4gcGl4ZWxzLCB0byB0cnkgYmVmb3JlIHJlc29ydGluZyB0byByZW1vdmluZ1xuICAgKiB0cmFpbGluZyB0ZXh0IChoYXJkIGNsYW1waW5nKS4gRGVmYXVsdHMgdG8gMS5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEZvbnRTaXplXVxuICAgKiBUaGUgbWF4aW11bSBmb250IHNpemUgaW4gcGl4ZWxzLiBXZSdsbCBzdGFydCB3aXRoIHRoaXMgZm9udCBzaXplIHRoZW5cbiAgICogcmVkdWNlIHVudGlsIHRleHQgZml0cyBjb25zdHJhaW50cywgb3IgZm9udCBzaXplIGlzIGVxdWFsIHRvXG4gICAqIHtAc2VlIG9wdGlvbnMubWluRm9udFNpemV9LiBEZWZhdWx0cyB0byB0aGUgZWxlbWVudCdzIGluaXRpYWwgY29tcHV0ZWQgZm9udCBzaXplLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgZWxlbWVudCxcbiAgICB7XG4gICAgICBtYXhMaW5lcyA9IHVuZGVmaW5lZCxcbiAgICAgIG1heEhlaWdodCA9IHVuZGVmaW5lZCxcbiAgICAgIHVzZVNvZnRDbGFtcCA9IGZhbHNlLFxuICAgICAgaGFyZENsYW1wQXNGYWxsYmFjayA9IHRydWUsXG4gICAgICBtaW5Gb250U2l6ZSA9IDEsXG4gICAgICBtYXhGb250U2l6ZSA9IHVuZGVmaW5lZCxcbiAgICAgIGVsbGlwc2lzID0gXCLigKZcIixcbiAgICB9ID0ge31cbiAgKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib3JpZ2luYWxXb3Jkc1wiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogZWxlbWVudC50ZXh0Q29udGVudC5tYXRjaCgvXFxTK1xccyovZykgfHwgW10sXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJ1cGRhdGVIYW5kbGVyXCIsIHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmFwcGx5KCksXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJvYnNlcnZlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogbmV3IE11dGF0aW9uT2JzZXJ2ZXIodGhpcy51cGRhdGVIYW5kbGVyKSxcbiAgICB9KTtcblxuICAgIGlmICh1bmRlZmluZWQgPT09IG1heEZvbnRTaXplKSB7XG4gICAgICBtYXhGb250U2l6ZSA9IHBhcnNlSW50KHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpLmZvbnRTaXplLCAxMCk7XG4gICAgfVxuXG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgICB0aGlzLm1heExpbmVzID0gbWF4TGluZXM7XG4gICAgdGhpcy5tYXhIZWlnaHQgPSBtYXhIZWlnaHQ7XG4gICAgdGhpcy51c2VTb2Z0Q2xhbXAgPSB1c2VTb2Z0Q2xhbXA7XG4gICAgdGhpcy5oYXJkQ2xhbXBBc0ZhbGxiYWNrID0gaGFyZENsYW1wQXNGYWxsYmFjaztcbiAgICB0aGlzLm1pbkZvbnRTaXplID0gbWluRm9udFNpemU7XG4gICAgdGhpcy5tYXhGb250U2l6ZSA9IG1heEZvbnRTaXplO1xuICAgIHRoaXMuZWxsaXBzaXMgPSBlbGxpcHNpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBHYXRoZXIgbWV0cmljcyBhYm91dCB0aGUgbGF5b3V0IG9mIHRoZSBlbGVtZW50J3MgdGV4dC5cbiAgICogVGhpcyBpcyBhIHNvbWV3aGF0IGV4cGVuc2l2ZSBvcGVyYXRpb24gLSBjYWxsIHdpdGggY2FyZS5cbiAgICpcbiAgICogQHJldHVybnMge1RleHRNZXRyaWNzfVxuICAgKiBMYXlvdXQgbWV0cmljcyBmb3IgdGhlIGNsYW1wZWQgZWxlbWVudCdzIHRleHQuXG4gICAqL1xuICBjYWxjdWxhdGVUZXh0TWV0cmljcygpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50O1xuICAgIGNvbnN0IGNsb25lID0gZWxlbWVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgY29uc3Qgc3R5bGUgPSBjbG9uZS5zdHlsZTtcblxuICAgIC8vIEFwcGVuZCwgZG9uJ3QgcmVwbGFjZVxuICAgIHN0eWxlLmNzc1RleHQgKz0gXCI7bWluLWhlaWdodDowIWltcG9ydGFudDttYXgtaGVpZ2h0Om5vbmUhaW1wb3J0YW50XCI7XG4gICAgZWxlbWVudC5yZXBsYWNlV2l0aChjbG9uZSk7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0ID0gY2xvbmUub2Zmc2V0SGVpZ2h0O1xuXG4gICAgLy8gQ2xlYXIgdG8gbWVhc3VyZSBlbXB0eSBoZWlnaHQuIHRleHRDb250ZW50IGZhc3RlciB0aGFuIGlubmVySFRNTFxuICAgIGNsb25lLnRleHRDb250ZW50ID0gXCJcIjtcblxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dCA9IGNsb25lLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCB0ZXh0SGVpZ2h0ID0gbmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dDtcblxuICAgIC8vIEZpbGwgZWxlbWVudCB3aXRoIHNpbmdsZSBub24tYnJlYWtpbmcgc3BhY2UgdG8gZmluZCBoZWlnaHQgb2Ygb25lIGxpbmVcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXFx4YTBcIjtcblxuICAgIC8vIEdldCBoZWlnaHQgb2YgZWxlbWVudCB3aXRoIG9ubHkgb25lIGxpbmUgb2YgdGV4dFxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSA9IGNsb25lLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCBmaXJzdExpbmVIZWlnaHQgPSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBBZGQgbGluZSAoPGJyPiArIG5ic3ApLiBhcHBlbmRDaGlsZCgpIGZhc3RlciB0aGFuIGlubmVySFRNTFxuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJiclwiKSk7XG4gICAgY2xvbmUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcXHhhMFwiKSk7XG5cbiAgICBjb25zdCBhZGRpdGlvbmFsTGluZUhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZTtcbiAgICBjb25zdCBsaW5lQ291bnQgPVxuICAgICAgMSArIChuYXR1cmFsSGVpZ2h0IC0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lKSAvIGFkZGl0aW9uYWxMaW5lSGVpZ2h0O1xuXG4gICAgLy8gUmVzdG9yZSBvcmlnaW5hbCBjb250ZW50XG4gICAgY2xvbmUucmVwbGFjZVdpdGgoZWxlbWVudCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZWRlZiB7T2JqZWN0fSBUZXh0TWV0cmljc1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHt0ZXh0SGVpZ2h0fVxuICAgICAqIFRoZSB2ZXJ0aWNhbCBzcGFjZSByZXF1aXJlZCB0byBkaXNwbGF5IHRoZSBlbGVtZW50J3MgY3VycmVudCB0ZXh0LlxuICAgICAqIFRoaXMgaXMgPGVtPm5vdDwvZW0+IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIGFzIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQuXG4gICAgICogVGhpcyBudW1iZXIgbWF5IGV2ZW4gYmUgZ3JlYXRlciB0aGFuIHRoZSBlbGVtZW50J3MgaGVpZ2h0IGluIGNhc2VzXG4gICAgICogd2hlcmUgdGhlIHRleHQgb3ZlcmZsb3dzIHRoZSBlbGVtZW50J3MgYmxvY2sgYXhpcy5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7bmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lfVxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHQgYW5kIHdpdGhvdXRcbiAgICAgKiBtaW5pbXVtIG9yIG1heGltdW0gaGVpZ2h0cy4gVGhpcyBpbmZvcm1hdGlvbiBtYXkgYmUgaGVscGZ1bCB3aGVuXG4gICAgICogZGVhbGluZyB3aXRoIGlubGluZSBlbGVtZW50cyAoYW5kIHBvdGVudGlhbGx5IG90aGVyIHNjZW5hcmlvcyksIHdoZXJlXG4gICAgICogdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBkb2VzIG5vdCBpbmNyZWFzZSB0aGUgZWxlbWVudCdzIGhlaWdodC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7Zmlyc3RMaW5lSGVpZ2h0fVxuICAgICAqIFRoZSBoZWlnaHQgdGhhdCB0aGUgZmlyc3QgbGluZSBvZiB0ZXh0IGFkZHMgdG8gdGhlIGVsZW1lbnQsIGkuZS4sIHRoZVxuICAgICAqIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdoaWxlIGVtcHR5IGFuZCB0aGUgaGVpZ2h0XG4gICAgICogb2YgdGhlIGVsZW1lbnQgd2hpbGUgaXQgY29udGFpbnMgb25lIGxpbmUgb2YgdGV4dC4gVGhpcyBudW1iZXIgbWF5IGJlXG4gICAgICogemVybyBmb3IgaW5saW5lIGVsZW1lbnRzIGJlY2F1c2UgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBkb2VzIG5vdFxuICAgICAqIGluY3JlYXNlIHRoZSBoZWlnaHQgb2YgaW5saW5lIGVsZW1lbnRzLlxuXG4gICAgICogQHByb3BlcnR5IHthZGRpdGlvbmFsTGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgZWFjaCBsaW5lIG9mIHRleHQgYWZ0ZXIgdGhlIGZpcnN0IGFkZHMgdG8gdGhlIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2xpbmVDb3VudH1cbiAgICAgKiBUaGUgbnVtYmVyIG9mIGxpbmVzIG9mIHRleHQgdGhlIGVsZW1lbnQgY29udGFpbnMuXG4gICAgICovXG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHRIZWlnaHQsXG4gICAgICBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUsXG4gICAgICBmaXJzdExpbmVIZWlnaHQsXG4gICAgICBhZGRpdGlvbmFsTGluZUhlaWdodCxcbiAgICAgIGxpbmVDb3VudCxcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIGNoYW5nZXMgdGhhdCBtYXkgYWZmZWN0IGxheW91dC4gUmVzcG9uZCBieSByZWNsYW1waW5nIGlmXG4gICAqIG5lY2Vzc2FyeS5cbiAgICovXG4gIHdhdGNoKCkge1xuICAgIGlmICghdGhpcy5fd2F0Y2hpbmcpIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMudXBkYXRlSGFuZGxlcik7XG5cbiAgICAgIC8vIE1pbmltdW0gcmVxdWlyZWQgdG8gZGV0ZWN0IGNoYW5nZXMgdG8gdGV4dCBub2RlcyxcbiAgICAgIC8vIGFuZCB3aG9sZXNhbGUgcmVwbGFjZW1lbnQgdmlhIGlubmVySFRNTFxuICAgICAgdGhpcy5vYnNlcnZlci5vYnNlcnZlKHRoaXMuZWxlbWVudCwge1xuICAgICAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlLFxuICAgICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fd2F0Y2hpbmcgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogU3RvcCB3YXRjaGluZyBmb3IgbGF5b3V0IGNoYW5nZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHtMaW5lQ2xhbXB9XG4gICAqL1xuICB1bndhdGNoKCkge1xuICAgIHRoaXMub2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMudXBkYXRlSGFuZGxlcik7XG5cbiAgICB0aGlzLl93YXRjaGluZyA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25kdWN0IGVpdGhlciBzb2Z0IGNsYW1waW5nIG9yIGhhcmQgY2xhbXBpbmcsIGFjY29yZGluZyB0byB0aGUgdmFsdWUgb2ZcbiAgICogcHJvcGVydHkge0BzZWUgTGluZUNsYW1wLnVzZVNvZnRDbGFtcH0uXG4gICAqL1xuICBhcHBseSgpIHtcbiAgICBpZiAodGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCkge1xuICAgICAgY29uc3QgcHJldmlvdXNseVdhdGNoaW5nID0gdGhpcy5fd2F0Y2hpbmc7XG5cbiAgICAgIC8vIElnbm9yZSBpbnRlcm5hbGx5IHN0YXJ0ZWQgbXV0YXRpb25zLCBsZXN0IHdlIHJlY3Vyc2UgaW50byBvYmxpdmlvblxuICAgICAgdGhpcy51bndhdGNoKCk7XG5cbiAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5qb2luKFwiXCIpO1xuXG4gICAgICBpZiAodGhpcy51c2VTb2Z0Q2xhbXApIHtcbiAgICAgICAgdGhpcy5zb2Z0Q2xhbXAoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaGFyZENsYW1wKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc3VtZSBvYnNlcnZhdGlvbiBpZiBwcmV2aW91c2x5IHdhdGNoaW5nXG4gICAgICBpZiAocHJldmlvdXNseVdhdGNoaW5nKSB7XG4gICAgICAgIHRoaXMud2F0Y2goZmFsc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogVHJpbXMgdGV4dCB1bnRpbCBpdCBmaXRzIHdpdGhpbiBjb25zdHJhaW50c1xuICAgKiAobWF4aW11bSBoZWlnaHQgb3IgbnVtYmVyIG9mIGxpbmVzKS5cbiAgICpcbiAgICogQHNlZSB7TGluZUNsYW1wLm1heExpbmVzfVxuICAgKiBAc2VlIHtMaW5lQ2xhbXAubWF4SGVpZ2h0fVxuICAgKi9cbiAgaGFyZENsYW1wKHNraXBDaGVjayA9IHRydWUpIHtcbiAgICBpZiAoc2tpcENoZWNrIHx8IHRoaXMuc2hvdWxkQ2xhbXAoKSkge1xuICAgICAgbGV0IGN1cnJlbnRUZXh0O1xuXG4gICAgICBmaW5kQm91bmRhcnkoXG4gICAgICAgIDEsXG4gICAgICAgIHRoaXMub3JpZ2luYWxXb3Jkcy5sZW5ndGgsXG4gICAgICAgICh2YWwpID0+IHtcbiAgICAgICAgICBjdXJyZW50VGV4dCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5zbGljZSgwLCB2YWwpLmpvaW4oXCIgXCIpO1xuICAgICAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IGN1cnJlbnRUZXh0O1xuXG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2hvdWxkQ2xhbXAoKVxuICAgICAgICB9LFxuICAgICAgICAodmFsLCBtaW4sIG1heCkgPT4ge1xuICAgICAgICAgIC8vIEFkZCBvbmUgbW9yZSB3b3JkIGlmIG5vdCBvbiBtYXhcbiAgICAgICAgICBpZiAodmFsID4gbWluKSB7XG4gICAgICAgICAgICBjdXJyZW50VGV4dCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5zbGljZSgwLCBtYXgpLmpvaW4oXCIgXCIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRoZW4gdHJpbSBsZXR0ZXJzIHVudGlsIGl0IGZpdHNcbiAgICAgICAgICBkbyB7XG4gICAgICAgICAgICBjdXJyZW50VGV4dCA9IGN1cnJlbnRUZXh0LnNsaWNlKDAsIC0xKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IGN1cnJlbnRUZXh0ICsgdGhpcy5lbGxpcHNpcztcbiAgICAgICAgICB9IHdoaWxlICh0aGlzLnNob3VsZENsYW1wKCkpXG5cbiAgICAgICAgICAvLyBCcm9hZGNhc3QgbW9yZSBzcGVjaWZpYyBoYXJkQ2xhbXAgZXZlbnQgZmlyc3RcbiAgICAgICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmhhcmRjbGFtcFwiKTtcbiAgICAgICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmNsYW1wXCIpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogUmVkdWNlcyBmb250IHNpemUgdW50aWwgdGV4dCBmaXRzIHdpdGhpbiB0aGUgc3BlY2lmaWVkIGhlaWdodCBvciBudW1iZXIgb2ZcbiAgICogbGluZXMuIFJlc29ydHMgdG8gdXNpbmcge0BzZWUgaGFyZENsYW1wKCl9IGlmIHRleHQgc3RpbGwgZXhjZWVkcyBjbGFtcFxuICAgKiBwYXJhbWV0ZXJzLlxuICAgKi9cbiAgc29mdENsYW1wKCkge1xuICAgIGNvbnN0IHN0eWxlID0gdGhpcy5lbGVtZW50LnN0eWxlO1xuICAgIGNvbnN0IHN0YXJ0U2l6ZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemU7XG4gICAgc3R5bGUuZm9udFNpemUgPSBcIlwiO1xuXG4gICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICBsZXQgc2hvdWxkQ2xhbXA7XG5cbiAgICBmaW5kQm91bmRhcnkoXG4gICAgICB0aGlzLm1pbkZvbnRTaXplLFxuICAgICAgdGhpcy5tYXhGb250U2l6ZSxcbiAgICAgICh2YWwpID0+IHtcbiAgICAgICAgc3R5bGUuZm9udFNpemUgPSB2YWwgKyBcInB4XCI7XG4gICAgICAgIHNob3VsZENsYW1wID0gdGhpcy5zaG91bGRDbGFtcCgpO1xuICAgICAgICByZXR1cm4gc2hvdWxkQ2xhbXBcbiAgICAgIH0sXG4gICAgICAodmFsLCBtaW4pID0+IHtcbiAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgIHN0eWxlLmZvbnRTaXplID0gbWluICsgXCJweFwiO1xuICAgICAgICAgIHNob3VsZENsYW1wID0gdGhpcy5zaG91bGRDbGFtcCgpO1xuICAgICAgICB9XG4gICAgICAgIGRvbmUgPSAhc2hvdWxkQ2xhbXA7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGNoYW5nZWQgPSBzdHlsZS5mb250U2l6ZSAhPT0gc3RhcnRTaXplO1xuXG4gICAgLy8gRW1pdCBzcGVjaWZpYyBzb2Z0Q2xhbXAgZXZlbnQgZmlyc3RcbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5zb2Z0Y2xhbXBcIik7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3QgZW1pdCBgbGluZWNsYW1wLmNsYW1wYCBldmVudCB0d2ljZS5cbiAgICBpZiAoIWRvbmUgJiYgdGhpcy5oYXJkQ2xhbXBBc0ZhbGxiYWNrKSB7XG4gICAgICB0aGlzLmhhcmRDbGFtcChmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChjaGFuZ2VkKSB7XG4gICAgICAvLyBoYXJkQ2xhbXAgZW1pdHMgYGxpbmVjbGFtcC5jbGFtcGAgdG9vLiBPbmx5IGVtaXQgZnJvbSBoZXJlIGlmIHdlJ3JlXG4gICAgICAvLyBub3QgYWxzbyBoYXJkIGNsYW1waW5nLlxuICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKiBXaGV0aGVyIGhlaWdodCBvZiB0ZXh0IG9yIG51bWJlciBvZiBsaW5lcyBleGNlZWQgY29uc3RyYWludHMuXG4gICAqXG4gICAqIEBzZWUgTGluZUNsYW1wLm1heEhlaWdodFxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhMaW5lc1xuICAgKi9cbiAgc2hvdWxkQ2xhbXAoKSB7XG4gICAgY29uc3QgeyBsaW5lQ291bnQsIHRleHRIZWlnaHQgfSA9IHRoaXMuY2FsY3VsYXRlVGV4dE1ldHJpY3MoKTtcblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0ICYmIHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIHRleHRIZWlnaHQgPiB0aGlzLm1heEhlaWdodCB8fCBsaW5lQ291bnQgPiB0aGlzLm1heExpbmVzXG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhIZWlnaHQpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHRcbiAgICB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heExpbmVzKSB7XG4gICAgICByZXR1cm4gbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwibWF4TGluZXMgb3IgbWF4SGVpZ2h0IG11c3QgYmUgc2V0IGJlZm9yZSBjYWxsaW5nIHNob3VsZENsYW1wKCkuXCJcbiAgICApXG4gIH1cbn1cblxuLyoqXG4gKiBQZXJmb3JtcyBhIGJpbmFyeSBzZWFyY2ggZm9yIHRoZSBtYXhpbXVtIHdob2xlIG51bWJlciBpbiBhIGNvbnRpZ291cyByYW5nZVxuICogd2hlcmUgYSBnaXZlbiB0ZXN0IGNhbGxiYWNrIHdpbGwgZ28gZnJvbSByZXR1cm5pbmcgdHJ1ZSB0byByZXR1cm5pbmcgZmFsc2UuXG4gKlxuICogU2luY2UgdGhpcyB1c2VzIGEgYmluYXJ5LXNlYXJjaCBhbGdvcml0aG0gdGhpcyBpcyBhbiBPKGxvZyBuKSBmdW5jdGlvbixcbiAqIHdoZXJlIG4gPSBtYXggLSBtaW4uXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1pblxuICogVGhlIGxvd2VyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbWF4XG4gKiBUaGUgdXBwZXIgYm91bmRhcnkgb2YgdGhlIHJhbmdlLlxuICpcbiAqIEBwYXJhbSB0ZXN0XG4gKiBBIGNhbGxiYWNrIHRoYXQgcmVjZWl2ZXMgdGhlIGN1cnJlbnQgdmFsdWUgaW4gdGhlIHJhbmdlIGFuZCByZXR1cm5zIGEgdHJ1dGh5IG9yIGZhbHN5IHZhbHVlLlxuICpcbiAqIEBwYXJhbSBkb25lXG4gKiBBIGZ1bmN0aW9uIHRvIHBlcmZvcm0gd2hlbiBjb21wbGV0ZS4gUmVjZWl2ZXMgdGhlIGZvbGxvd2luZyBwYXJhbWV0ZXJzXG4gKiAtIGN1cnNvclxuICogLSBtYXhQYXNzaW5nVmFsdWVcbiAqIC0gbWluRmFpbGluZ1ZhbHVlXG4gKi9cbmZ1bmN0aW9uIGZpbmRCb3VuZGFyeShtaW4sIG1heCwgdGVzdCwgZG9uZSkge1xuICBsZXQgY3Vyc29yID0gbWF4O1xuICAvLyBzdGFydCBoYWxmd2F5IHRocm91Z2ggdGhlIHJhbmdlXG4gIHdoaWxlIChtYXggPiBtaW4pIHtcbiAgICBpZiAodGVzdChjdXJzb3IpKSB7XG4gICAgICBtYXggPSBjdXJzb3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1pbiA9IGN1cnNvcjtcbiAgICB9XG5cbiAgICBpZiAobWF4IC0gbWluID09PSAxKSB7XG4gICAgICBkb25lKGN1cnNvciwgbWluLCBtYXgpO1xuICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBjdXJzb3IgPSBNYXRoLnJvdW5kKChtaW4gKyBtYXgpIC8gMik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW1pdChpbnN0YW5jZSwgdHlwZSkge1xuICBpbnN0YW5jZS5lbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KHR5cGUpKTtcbn1cblxuZXhwb3J0IHsgTGluZUNsYW1wIGFzIGRlZmF1bHQgfTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1wiYmVnaW5cIjp7XCJ0ZXh0XCI6XCJbZGVsYXkgNTAwXUNvbm5lY3RpbmdbZGVsYXkgNTAwXVtub3JtYWwgLl1bZGVsYXkgNTAwXVtub3JtYWwgLl1bZGVsYXkgNTAwXVtub3JtYWwgLl1cXG48ZW0+QmVlcDwvZW0+IFtkZWxheSA1MDBdPGVtPkJlZXA8L2VtPiBbZGVsYXkgNTAwXTxlbT5CZWVwPC9lbT5cXG5Zb3Ugd2FrZSB1cCBzbG93bHkgdG8gdGhlIHNvdW5kIG9mIHlvdXIgYWxhcm0uXFxuSXQgZHJvbmVzIG9uIGFuZCBvbiB1bnRpbCB5b3Ugd2FrZSB1cCBlbm91Z2ggdG8gdHVybiBpdCBvZmYuIFxcbldoYXQgZG8geW91IGRvP1wiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJtb2JpbGVcIixcInRleHRcIjpcIkNoZWNrIHBob25lXCIsXCJuZXh0XCI6XCJjaGVja1Bob25lXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiR2V0IG91dCBvZiBiZWRcIixcIm5leHRcIjpcImdldFVwXCJ9XX0sXCJjaGVja1Bob25lXCI6e1widGV4dFwiOlwiWW91IHNjcm9sbCBzb21ld2hhdCBhYnNlbnRtaW5kZWRseSB0aHJvdWdoIHlvdXIgbmV3c2ZlZWQgYXMgeW91IHdha2UgdXAuIFxcbk9uZSBzdG9yeSBjYXRjaGVzIHlvdXIgZXllLiBBbiBpbWFnZSBvZiBhIGZsb29kZWQgdG93biBvZmYgb2YgdGhlIE1pc3Npc2lwcGkgUml2ZXIuXFxuUGllY2VzIG9mIGRyaWZ0d29vZCBhbmQgZGVicmlzIHNjYXR0ZXJlZCBpbiB0aGUgd2F0ZXIuXFxuQ2FycyBkcm93bmVkIGluIHRoZSBkZWVwIHdhdGVyLlxcbk5hdHVyZSBpcyBhIGNydWVsIG1pc3RyZXNzLCB5b3UgdGhpbmsuIFxcbkJ1dCB0aGVuIGFnYWluLCB3ZSd2ZSBhbHdheXMgaGFkIHRvIGRlYWwgd2l0aCB0aGlzIHN0dWZmLCByaWdodD9cXG5XZWxsLCB0aGF0cyBlbm91Z2ggb2YgdGhlIG5ld3MgZm9yIHRvZGF5LiBUaGF0IHN0dWZmIGlzIGFsd2F5cyBqdXN0IGRlcHJlc3NpbmcuXCIsXCJsb29wXCI6XCJiZWdpblwifSxcImdldFVwXCI6e1widGV4dFwiOlwiWW91IGdldCB1cCBhbmQgZ2V0IHJlYWR5IGZvciB0aGUgZGF5LiBcXG5XaGVuIHlvdSBjb21lIGJhY2sgb3V0IG9mIHRoZSBiYXRocm9vbSwgeW91IG5vdGljZSB0d28gdGhpbmdzOlxcbjEuIEl0J3MgZnJlZXppbmcgaW4gaGVyZVxcbjIuIFlvdXIgcm9vbSBpcyBhIG1lc3NcIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiZmFuXCIsXCJ0ZXh0XCI6XCJUdXJuIG9mZiB0aGUgQS9DXCIsXCJuZXh0XCI6XCJ0dXJuT2ZmXCJ9LHtcImljb25cIjpcImZvbGRlclwiLFwidGV4dFwiOlwiQ2hlY2sgb3V0IHRoZSBtZXNzXCIsXCJuZXh0XCI6XCJtZXNzXCIsXCJyZXR1cm5cIjpcImNvbnRpbnVlXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiTGVhdmVcIixcIm5leHRcIjpcImxlYXZlXCJ9XX0sXCJ0dXJuT2ZmXCI6e1widGV4dFwiOlwiQXMgeW91IGdvIG92ZXIgdG8gdHVybiBvZmYgdGhlIGFpciBjb25kaXRpb25pbmcsIHlvdSB0YWtlIGEgbG9vayBvdXQgdGhlIHdpbmRvdy5cXG5KdXN0IGFzIHlvdSBleHBlY3RlZCwgaXRzIGNsb3VkeSBhbmQgcmFpbnkuIFxcblRoZSBBL0MgbXVzdCBoYXZlIGJlZW4gbWFraW5nIHRoZSB0ZW1wZXJhdHVyZSBldmVuIGNvbGRlciB0aGFuIGl0IGFscmVhZHkgd2FzIG91dHNpZGUuXFxuWW91J3ZlIGhhZCBpdCB0dXJuZWQgYWxsIHRoZSB3YXkgdXAgZm9yIHRoZSBwYXN0IGZldyBkYXlzIGR1ZSB0byB0aGUgaGVhdHdhdmUsIGJ1dCBjbGVhcmx5IHRoYXQncyBvdmVyIG5vdy5cXG5Zb3UgZ3JhYiB5b3VyIEF1Z21lbnRlZCBSZWFsaXR5IGdsYXNzZXMgZnJvbSB5b3VyIGRlc2sgYW5kIHB1dCB0aGVtIG9uLlxcbkF0IGxlYXN0IGFsbCB5b3UgaGF2ZSB0byBkbyBpcyBvcGVuIHRoZSBBL0MgYXBwIGFuZCBhZGp1c3QgdGhlIHZpcnR1YWwga25vYi5cXG5UaGlzIHN0dWZmIHdhcyBtdWNoIG1vcmUgYW5ub3lpbmcgd2hlbiB5b3UgaGFkIHRvIGZpbmQgdGhlIHBoeXNpY2FsIGNvbnRyb2xzLlwiLFwibG9vcFwiOlwiZ2V0VXBcIn0sXCJtZXNzXCI6e1widGV4dFwiOlwiWW91IHNwZW5kIHNvIG11Y2ggdGltZSBhdCB3b3JrIG5vd2FkYXlzIHRoYXQgeW91ciByb29tIGlzIHByZXR0eSBtZXNzeS4gXFxuSW4gdGhlb3J5LCBhbGwgb2YgeW91ciBtYXRlcmlhbHMgd291bGQgYmUgY29udGFpbmVkIGluIHRoZSBmb2xkZXIgb24geW91ciBkZXNrLFxcbmJ1dCB5b3Ugc3BlbmQgc28gbXVjaCB0aW1lIHJlb3JnYW5pemluZyBhbmQgYWRqdXN0aW5nIHRoYXQgaXQgYWxsIGVuZHMgdXAgc3RyZXduIGFib3V0LlxcbllvdSBwaWNrIHVwIHdoYXQgZmV3IHBhcGVycyByZW1haW4gdGhlIGZvbGRlciBhbmQgZmxpY2sgdGhyb3VnaCB0aGVtLiBcXG5UaGV5J3JlIHRoZSB0aHJlZSBzdHVkaWVzIHlvdSd2ZSBiYXNlZCB5b3VyIHByZXNlbnRhdGlvbiBvbi5cXG5Zb3Ugc3RhcmUgYXQgdGhlbSBmb3IgYSBsaXR0bGUsIHBlbnNpdmVseS4gWW91J2QgYWx3YXlzIHdhbnRlZCB0byBiZSB0aGUgb25lIGRvaW5nIHRoZSByZXNlYXJjaC4gXFxuVGhhdCdzIHdoeSB5b3UgdG9vayB0aGlzIGpvYjsgcHJlc2VudGluZyByZXNlYXJjaCBzZWVtZWQgbGlrZSBhIGdvb2Qgd2F5IHRvIGdldCBzb21lIGNvbm5lY3Rpb25zLFxcbmFuZCB5b3UgbmVlZGVkIHRoZSBtb25leS4gQnV0IGF0IHNvbWUgcG9pbnQgeW91IGxvc3QgdHJhY2sgb2YgdGhhdCBnb2FsLCBcXG5hbmQgZXZlbiB0aG91Z2ggeW91IGNhbiBwcm9iYWJseSBhZmZvcmQgdG8gZ28gYmFjayB0byBzY2hvb2wgbm93LCBcXG5iZWluZyBhIHJlc2VhcmNoZXIgZmVlbHMgbGlrZSBzb21lb25lIGVsc2UncyBkcmVhbS4gXFxuVGhlIGtpbmQgb2YgdGhpbmcgYSBraWQgdGVsbHMgdGhlbXNlbGYgYmVmb3JlIHRoZXkndmUgYmVlbiBleHBvc2VkIHRvIHRoZSByZWFsIHdvcmxkLiBcXG5UaGlzIGpvYiBpcyBmaW5lLiBJdCBwYXlzIHdlbGwuIDxiPkl0J3MgZmluZTwvYj4uXFxuWW91IGhhdmUgdGhyZWUgc3R1ZGllcyBpbiB0aGUgZm9sZGVyLiBEbyB5b3Ugd2FudCB0byByZXZpZXcgYW55IG9mIHRoZW0gYmVmb3JlIHRoZSBiaWcgaGVhcmluZyBsYXRlcj9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiaW5kdXN0cnlcIixcInRleHRcIjpcIkNDUyBTdHVkeVwiLFwibmV4dFwiOlwiY2NzXCJ9LHtcImljb25cIjpcImZpcmUtZmxhbWUtc2ltcGxlXCIsXCJ0ZXh0XCI6XCJFZmZpY2llbmN5IFN0dWR5XCIsXCJuZXh0XCI6XCJlZmZpY2llbmN5XCJ9LHtcImljb25cIjpcImFycm93cy1yb3RhdGVcIixcInRleHRcIjpcIkxpZmVjeWNsZSBBbmFseXNpc1wiLFwibmV4dFwiOlwibGNhXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiQ29udGludWVcIixcIm5leHRcIjpcImNvbnRpbnVlXCJ9XX0sXCJjY3NcIjp7XCJ0ZXh0XCI6XCJDQ1MgU3R1ZHlcIixcImxvb3BcIjpcIm1lc3NcIn0sXCJlZmZpY2llbmN5XCI6e1widGV4dFwiOlwiRWZmaWNpZW5jeSBTdHVkeVwiLFwibG9vcFwiOlwibWVzc1wifSxcImxjYVwiOntcInRleHRcIjpcIkxpZmVjeWNsZSBBbmFseXNpc1wiLFwibG9vcFwiOlwibWVzc1wifSxcImNvbnRpbnVlXCI6e1widGV4dFwiOlwiWW91IHR1cm4geW91ciBhdHRlbnRpb24gdG8gdGhlIHJlc3Qgb2YgdGhlIHJvb20uXCIsXCJsb29wXCI6XCJnZXRVcFwifX0iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBCdWJibGVzIHtcbiAgICBjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRDtcbiAgICBidWJibGVzOiBBcnJheTxCdWJibGU+ID0gW107XG5cbiAgICBjb25zdHJ1Y3RvcihjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKSE7XG4gICAgICAgIHRoaXMucmVzaXplKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxMDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmJ1YmJsZXMucHVzaChuZXcgQnViYmxlKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMuY3R4LmNhbnZhcy53aWR0aCwgdGhpcy5jdHguY2FudmFzLmhlaWdodCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmJ1YmJsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJ1YmJsZXNbaV0uc3BlZWQgPiAwICYmIHRoaXMuYnViYmxlc1tpXS5saWZldGltZSA8PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLnNwZWVkICo9IC0xO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0udXBkYXRlKGR0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLmJ1YmJsZXNbaV0uc2l6ZSA8PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldID0gbmV3IEJ1YmJsZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0uZHJhdyh0aGlzLmN0eCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXNpemUoKSB7XG4gICAgICAgIHZhciBkcHIgPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyB8fCAxO1xuICAgICAgICB2YXIgcmVjdCA9IHRoaXMuY3R4LmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgICAgICB0aGlzLmN0eC5jYW52YXMud2lkdGggPSByZWN0LndpZHRoICogZHByO1xuICAgICAgICB0aGlzLmN0eC5jYW52YXMuaGVpZ2h0ID0gcmVjdC5oZWlnaHQgKiBkcHI7XG5cbiAgICAgICAgdGhpcy5jdHguc2NhbGUoZHByLCBkcHIpO1xuXG4gICAgICAgIHRoaXMuY3R4LmZpbHRlciA9IFwiYmx1cig1MHB4KVwiO1xuICAgIH1cbn1cblxuY2xhc3MgQnViYmxlIHtcbiAgICBzcGVlZDogbnVtYmVyO1xuICAgIHg6IG51bWJlcjtcbiAgICB5OiBudW1iZXI7XG4gICAgc2l6ZTogbnVtYmVyO1xuICAgIGNvbG9yOiBzdHJpbmc7XG4gICAgbGlmZXRpbWU6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLnNwZWVkID0gMC4wMjtcblxuICAgICAgICB0aGlzLnggPSBNYXRoLnJhbmRvbSgpICogd2luZG93LmlubmVyV2lkdGg7XG4gICAgICAgIHRoaXMueSA9IE1hdGgucmFuZG9tKCkgKiB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cbiAgICAgICAgdGhpcy5zaXplID0gMTA7XG5cbiAgICAgICAgbGV0IHYgPSBNYXRoLnJhbmRvbSgpO1xuICAgICAgICBsZXQgaHVlID0gdiA8IDAuNSA/IDE1MCA6IDIzMDtcbiAgICAgICAgbGV0IHNhdCA9IHYgPCAwLjUgPyA1MCA6IDg1O1xuICAgICAgICBsZXQgbGlnaHQgPSB2IDwgMC41ID8gMjUgOiA0MDtcbiAgICAgICAgdGhpcy5jb2xvciA9IFwiaHNsYShcIiArIGh1ZSArIFwiLCBcIiArIHNhdCArIFwiJSwgXCIgKyBsaWdodCArIFwiJSwgMjAlKVwiO1xuXG4gICAgICAgIHRoaXMubGlmZXRpbWUgPSBNYXRoLnJhbmRvbSgpICoqIDUgKiAxNjAwMCArIDIwMDA7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zaXplICs9IHRoaXMuc3BlZWQgKiBkdDtcbiAgICAgICAgdGhpcy5saWZldGltZSAtPSBkdDtcbiAgICB9XG5cbiAgICBkcmF3KGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEKSB7XG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmNvbG9yO1xuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGN0eC5hcmModGhpcy54LCB0aGlzLnksIHRoaXMuc2l6ZSwgMCwgTWF0aC5QSSAqIDIpO1xuICAgICAgICBjdHguZmlsbCgpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFN0b3J5LCBPcHRpb24gfSBmcm9tICcuL3N0b3J5JztcblxubGV0IHN0b3J5OiBTdG9yeSA9IHJlcXVpcmUoXCIuL3N0b3J5LmNzb25cIik7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1dHRvbnMge1xuICAgIGVsZW06IEhUTUxFbGVtZW50O1xuICAgIHNlbGVjdGVkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICB0ZXh0OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBlbmFibGVkID0gZmFsc2U7XG4gICAgYnV0dG9uczogSFRNTEJ1dHRvbkVsZW1lbnRbXSA9IFtdO1xuXG4gICAgY29uc3RydWN0b3IoZWxlbTogSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5lbGVtID0gZWxlbTtcbiAgICB9XG5cbiAgICBlbmFibGUoc2NlbmU6IHN0cmluZykge1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgbGV0IG9wdGlvbnM6IE9wdGlvbltdO1xuICAgICAgICBpZiAoc3Rvcnlbc2NlbmVdLm9wdGlvbnMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gc3Rvcnlbc3Rvcnlbc2NlbmVdLmxvb3AhXS5vcHRpb25zITtcbiAgICAgICAgICAgIGxldCBsb29wZWRPcHQgPSBvcHRpb25zLmZpbmRJbmRleChvID0+IG8ucmV0dXJuICE9IHVuZGVmaW5lZCA/IG8ucmV0dXJuID09IHNjZW5lIDogby5uZXh0ID09IHNjZW5lKTtcbiAgICAgICAgICAgIG9wdGlvbnMuc3BsaWNlKGxvb3BlZE9wdCwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0gc3Rvcnlbc2NlbmVdLm9wdGlvbnMhO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHN0ZXAgPSBvcHRpb25zLmxlbmd0aCA9PSA0ID8gNiA6IDEyL29wdGlvbnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbiA9IG9wdGlvbnNbaV07XG4gICAgICAgICAgICBsZXQgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc05hbWUgPSBcIm92ZXJsYXlcIjtcbiAgICAgICAgICAgIGJ1dHRvbi5pbm5lckhUTUwgPSAgXCI+IDxpIGNsYXNzPVxcXCJmYS1zb2xpZCBmYS1cIisgb3B0aW9uLmljb24gK1wiXFxcIj48L2k+IFwiICsgb3B0aW9uLnRleHQ7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gXCI0IC8gMTBcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5sZW5ndGggPT0gNCkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gaSA8IDIgPyAoaSpzdGVwICsgMSkudG9TdHJpbmcoKSArIFwiIC8gXCIgKyAoKGkrMSkqc3RlcCArIDEpLnRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAoKGktMikqc3RlcCArIDEpLnRvU3RyaW5nKCkgKyBcIiAvIFwiICsgKChpLTEpKnN0ZXAgKyAxKS50b1N0cmluZygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IChpKnN0ZXAgKyAxKS50b1N0cmluZygpICsgXCIgLyBcIiArICgoaSsxKSpzdGVwICsgMSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJ1dHRvbi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBvcHRpb24ubmV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHQgPSBcIjxpIGNsYXNzPVxcXCJmYS1zb2xpZCBmYS1cIisgb3B0aW9uLmljb24gK1wiXFxcIj48L2k+IFwiICsgb3B0aW9uLnRleHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtLmNsYXNzTmFtZSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtLmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5idXR0b25zID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5lbGVtLmFwcGVuZENoaWxkKGJ1dHRvbik7XG4gICAgICAgICAgICB0aGlzLmJ1dHRvbnMucHVzaChidXR0b24pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZWxlbS5jbGFzc05hbWUgPSBcIm91dFwiO1xuICAgIH1cbn0iLCJpbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcbmltcG9ydCBTdGF0ZU1hbmFnZXIgZnJvbSBcIi4vc3RhdGVfbWFuYWdlclwiO1xuaW1wb3J0IHsgQmVnaW5TdGF0ZSB9IGZyb20gXCIuL3N0YXRlc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBHYW1lIHtcbiAgICB0ZXJtOiBUZXJtaW5hbDtcbiAgICBtYW5hZ2VyOiBTdGF0ZU1hbmFnZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZXJtaW5hbDogSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy50ZXJtID0gbmV3IFRlcm1pbmFsKHRlcm1pbmFsKTtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbmV3IFN0YXRlTWFuYWdlcihCZWdpblN0YXRlKTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIudXBkYXRlKGR0LCB0aGlzLnRlcm0pO1xuXG4gICAgICAgIHRoaXMudGVybS51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdGhpcy50ZXJtLnJlc2l6ZSgpO1xuICAgIH1cblxuICAgIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGVNYW5hZ2VyIGZyb20gXCIuL3N0YXRlX21hbmFnZXJcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhYnN0cmFjdCBjbGFzcyBTdGF0ZSB7XG4gICAgcHJvdGVjdGVkIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFN0YXRlTWFuYWdlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIGluaXQodGVybTogVGVybWluYWwpIHt9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHt9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHt9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTdGF0ZU1hbmFnZXIge1xuICAgIHN0YXRlOiBTdGF0ZTtcbiAgICBuZWVkc0luaXQgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICB9XG5cbiAgICBzZXRTdGF0ZShzOiBuZXcgKG06IFN0YXRlTWFuYWdlcikgPT4gU3RhdGUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5ldyBzKHRoaXMpO1xuICAgICAgICB0aGlzLm5lZWRzSW5pdCA9IHRydWU7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLm5lZWRzSW5pdCkge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZS5pbml0KHRlcm0pO1xuICAgICAgICAgICAgdGhpcy5uZWVkc0luaXQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUudXBkYXRlKGR0LCB0ZXJtKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5rZXlkb3duKGUpO1xuICAgIH1cbn1cbiIsImltcG9ydCBTdGF0ZSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuL3Rlcm1pbmFsXCI7XG5pbXBvcnQgQnV0dG9ucyBmcm9tIFwiLi9idXR0b25zXCI7XG5pbXBvcnQgeyBTdG9yeSB9IGZyb20gJy4vc3RvcnknO1xuXG5sZXQgc3Rvcnk6IFN0b3J5ID0gcmVxdWlyZShcIi4vc3RvcnkuY3NvblwiKTtcblxuZXhwb3J0IGNsYXNzIEJlZ2luU3RhdGUgZXh0ZW5kcyBTdGF0ZSB7XG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICB0ZXJtLndyaXRlTGluZShcIlByZXNzIGFueSBrZXkgdG8gYmVnaW4uLi5cIik7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIHRoaXMubWFuYWdlci5zZXRTdGF0ZShXaXBlU3RhdGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdpcGVTdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBwcml2YXRlIHdpcGVUaW1lciA9IDA7XG4gICAgcHJpdmF0ZSB3aXBlVGlja3MgPSAwO1xuICAgIHByaXZhdGUgd2lwZUxpbmVzOiBudW1iZXI7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5vdmVyZmxvdyA9IFwiaGlkZGVuXCI7XG4gICAgICAgIHRoaXMud2lwZUxpbmVzID0gdGVybS5tYXhMaW5lcztcbiAgICB9XG5cbiAgICBvdmVycmlkZSB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgaWYgKHRoaXMud2lwZVRpbWVyID4gNTApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndpcGVUaWNrcyA+IDUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVMaW5lcy0tO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVUaWNrcysrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0ZXJtLmZpbGxSYW5kb20odGhpcy53aXBlTGluZXMpO1xuXG4gICAgICAgICAgICB0aGlzLndpcGVUaW1lciA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53aXBlTGluZXMgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgKz0gZHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0ZXJtLnJlc2V0KCk7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcIlwiO1xuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLnNldFN0YXRlKFBsYXlpbmdTdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQbGF5aW5nU3RhdGUgZXh0ZW5kcyBTdGF0ZSB7XG4gICAgc2NlbmUgPSBcImJlZ2luXCI7XG5cbiAgICByZW1haW5pbmdUZXh0ID0gXCJcIjtcblxuICAgIGRlbGF5ID0gMDtcblxuICAgIHRleHREZWNvZGVkID0gLTE7XG4gICAgdGV4dFBvc2l0aW9uID0gLTE7XG4gICAgdGV4dFRpbWVyID0gLTE7XG5cbiAgICBidXR0b25zID0gbmV3IEJ1dHRvbnMoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJidXR0b25zXCIpISk7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLmJ1dHRvbnMuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGVybS53cml0ZUxpbmUodGhpcy5idXR0b25zLnRleHQhKTtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUgPSB0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQ7XG4gICAgICAgICAgICB0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gc3RvcnlbdGhpcy5zY2VuZV0udGV4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlbWFpbmluZ1RleHQubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRlcm0ud3JpdGUoXCI8YnIvPlwiKTtcbiAgICAgICAgICAgIHRlcm0ud3JpdGVMaW5lKFwiXCIpO1xuICAgICAgICAgICAgdGhpcy5idXR0b25zLmVuYWJsZSh0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmRlbGF5IDw9IDApIHtcbiAgICAgICAgICAgIGxldCBbcG9zLCBpbmRleF0gPSB0aGlzLmluZGV4T2ZNYW55KHRoaXMucmVtYWluaW5nVGV4dCwgXCI8WyBcXG5cIik7XG4gICAgICAgICAgICBpZihwb3MgPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlU3BlY2lhbChpbmRleCwgdGVybSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVUZXh0KHBvcywgdGVybSwgZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWxheSAtPSBkdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaW5kZXhPZk1hbnkoc3RyOiBzdHJpbmcsIGNoYXJzOiBzdHJpbmcpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBjID0gY2hhcnMuaW5kZXhPZihzdHJbaV0pO1xuICAgICAgICAgICAgaWYgKGMgIT0gLTEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2ksIGNdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbLTEsIC0xXTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHdyaXRlVGV4dChsZW46IG51bWJlciwgdGVybTogVGVybWluYWwsIGR0OiBudW1iZXIpIHtcbiAgICAgICAgaWYgKGxlbiA9PSAtMSkge1xuICAgICAgICAgICAgbGVuID0gdGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLnRleHREZWNvZGVkID0gMDtcbiAgICAgICAgICAgIHRoaXMudGV4dFBvc2l0aW9uID0gdGVybS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgdGhpcy50ZXh0VGltZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudGV4dERlY29kZWQgPT0gMCkge1xuICAgICAgICAgICAgaWYgKHRoaXMudGV4dFRpbWVyID4gMTApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHREZWNvZGVkID0gMTtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHRUaW1lciA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dFRpbWVyICs9IGR0O1xuICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUodGVybS5yYW5kb21DaGFyYWN0ZXJzKGxlbiksIHRoaXMudGV4dFBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdGV4dCA9XG4gICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMCwgdGhpcy50ZXh0RGVjb2RlZCkgK1xuICAgICAgICAgICAgdGVybS5yYW5kb21DaGFyYWN0ZXJzKGxlbiAtIHRoaXMudGV4dERlY29kZWQpO1xuXG4gICAgICAgIHRlcm0ud3JpdGUodGV4dCwgdGhpcy50ZXh0UG9zaXRpb24pO1xuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IGxlbikge1xuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGxlbik7XG4gICAgICAgICAgICB0aGlzLnRleHREZWNvZGVkID0gLTE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRleHREZWNvZGVkKys7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVTcGVjaWFsKGluZGV4OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHN3aXRjaCAoaW5kZXgpIHtcbiAgICAgICAgICAgIGNhc2UgMDogLy8gPFxuICAgICAgICAgICAgICAgIGxldCBlbmRUYWdQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIj5cIik7XG4gICAgICAgICAgICAgICAgdGVybS53cml0ZSh0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMCwgZW5kVGFnUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShlbmRUYWdQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMTogLy8gW1xuICAgICAgICAgICAgICAgIGxldCBlbmRDb21tYW5kUG9zID0gdGhpcy5yZW1haW5pbmdUZXh0LmluZGV4T2YoXCJdXCIpO1xuICAgICAgICAgICAgICAgIGxldCBjb21tYW5kID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEsIGVuZENvbW1hbmRQb3MpO1xuICAgICAgICAgICAgICAgIGxldCBzcGFjZVBvcyA9IGNvbW1hbmQuaW5kZXhPZihcIiBcIik7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChjb21tYW5kLnNsaWNlKDAsIHNwYWNlUG9zKSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZGVsYXlcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVsYXkgPSBwYXJzZUludChjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJub3JtYWxcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUoY29tbWFuZC5zbGljZShzcGFjZVBvcyArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwic2VwXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGVuZENvbW1hbmRQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMjogLy8gPHNwYWNlPlxuICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUoXCIgXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMzogLy8gXFxuXG4gICAgICAgICAgICAgICAgdGVybS53cml0ZUxpbmUoXCJcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWxheSA9IDUwMDtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiSW52YWxpZCBjaGFyIGluZGV4IFwiICsgaW5kZXgpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IExpbmVDbGFtcCBmcm9tIFwiQHR2YW5jL2xpbmVjbGFtcFwiO1xyXG5cclxuY29uc3QgQ1VSU09SX0JMSU5LX0lOVEVSVkFMID0gNTAwO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGVybWluYWwge1xyXG4gICAgZWxlbWVudDogSFRNTEVsZW1lbnQ7XHJcblxyXG4gICAgZm9udFNpemU6IG51bWJlcjtcclxuICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICBoZWlnaHQ6IG51bWJlcjtcclxuICAgIGxpbmVIZWlnaHQ6IG51bWJlcjtcclxuXHJcbiAgICBtYXhMaW5lczogbnVtYmVyO1xyXG4gICAgY2hhcnNQZXJMaW5lOiBudW1iZXI7XHJcblxyXG4gICAgY29udGVudCA9IFwiPiBcIjtcclxuXHJcbiAgICBwcml2YXRlIGN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBjdXJzb3JFbmFibGVkID0gdHJ1ZTtcclxuICAgIHByaXZhdGUgY3Vyc29yVGlja3MgPSAwO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbTtcclxuXHJcbiAgICAgICAgdGhpcy5mb250U2l6ZSA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemUuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLndpZHRoID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS53aWR0aC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5oZWlnaHQuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xyXG4gICAgICAgIGNvbnN0IGNsYW1wID0gbmV3IExpbmVDbGFtcCh0aGlzLmVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMubGluZUhlaWdodCA9IGNsYW1wLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCkuYWRkaXRpb25hbExpbmVIZWlnaHQ7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJcIjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXhMaW5lcyA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgLyB0aGlzLmxpbmVIZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2hhcnNQZXJMaW5lID0gTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gKHRoaXMuZm9udFNpemUgKiAwLjYpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXNpemUoKSB7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkud2lkdGguc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuaGVpZ2h0LnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMubWF4TGluZXMgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0IC8gdGhpcy5saW5lSGVpZ2h0KTtcclxuICAgICAgICB0aGlzLmNoYXJzUGVyTGluZSA9IE1hdGguZmxvb3IodGhpcy53aWR0aCAvICh0aGlzLmZvbnRTaXplICogMC42KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclRpY2tzID49IENVUlNPUl9CTElOS19JTlRFUlZBTCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJzb3JUaWNrcyA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsaXBDdXJzb3IoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Vyc29yVGlja3MgKz0gZHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc2hvdygpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuaW5uZXJIVE1MID0gdGhpcy5jb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyKCkge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ID0gXCJcIjtcclxuICAgIH1cclxuXHJcbiAgICBnZXRQb3NpdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb250ZW50Lmxlbmd0aCAtICh0aGlzLmN1cnNvclZpc2libGUgPyAwIDogMSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHV0KHRleHQ6IHN0cmluZywgcG9zPzogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIHBvcyAhPSB1bmRlZmluZWQgJiZcclxuICAgICAgICAgICAgcG9zID49IDAgJiZcclxuICAgICAgICAgICAgcG9zIDw9IHRoaXMuY29udGVudC5sZW5ndGggLSB0ZXh0Lmxlbmd0aFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgPVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50LnNsaWNlKDAsIHBvcykgK1xyXG4gICAgICAgICAgICAgICAgdGV4dCArXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQuc2xpY2UocG9zICsgdGV4dC5sZW5ndGgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCArPSB0ZXh0O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwdXRMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQgKyBcIjxiciAvPj4gXCI7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzZXQoKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMucHV0KFwiPiBcIik7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHdyaXRlKHRleHQ6IHN0cmluZywgcG9zPzogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5wdXQodGV4dCwgcG9zKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGVMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMucHV0TGluZSh0ZXh0KTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmFuZG9tQ2hhcmFjdGVycyhjb3VudDogbnVtYmVyKSB7XHJcbiAgICAgICAgbGV0IHZhbHVlcyA9IG5ldyBVaW50OEFycmF5KGNvdW50KTtcclxuICAgICAgICB3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyh2YWx1ZXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZFZhbHVlcyA9IHZhbHVlcy5tYXAoKHgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgYWRqID0geCAlIDM2O1xyXG4gICAgICAgICAgICByZXR1cm4gYWRqIDwgMjYgPyBhZGogKyA2NSA6IGFkaiAtIDI2ICsgNDg7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG1hcHBlZFZhbHVlcyk7XHJcbiAgICB9XHJcblxyXG4gICAgZmlsbFJhbmRvbShsaW5lczogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXM7IGkrKykge1xyXG4gICAgICAgICAgICB0aGlzLnB1dCh0aGlzLnJhbmRvbUNoYXJhY3RlcnModGhpcy5jaGFyc1BlckxpbmUpKTtcclxuICAgICAgICAgICAgdGhpcy5wdXQoXCI8YnIgLz5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldEN1cnNvckVuYWJsZWQodmFsdWU6IGJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLmN1cnNvckVuYWJsZWQgPSB2YWx1ZTtcclxuICAgICAgICAvLyBpZiB0aGUgY3Vyc29yIG5lZWRlZCB0byBiZSB0dXJuZWQgb2ZmLCBmaXggaXRcclxuICAgICAgICBpZiAoIXRoaXMuY3Vyc29yRW5hYmxlZCAmJiAhdGhpcy5jdXJzb3JWaXNpYmxlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgICAgICB0aGlzLmN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGZsaXBDdXJzb3IoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3Vyc29yRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJzb3JWaXNpYmxlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgKz0gXCJfXCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgPSB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9ICF0aGlzLmN1cnNvclZpc2libGU7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCBCdWJibGVzIGZyb20gXCIuL2J1YmJsZXNcIjtcbmltcG9ydCBHYW1lIGZyb20gXCIuL2dhbWVcIjtcblxubGV0IGdhbWU6IEdhbWU7XG5cbmxldCBidWJibGVzOiBCdWJibGVzO1xuXG5sZXQgbGFzdFRpbWU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG53aW5kb3cub25sb2FkID0gKCkgPT4ge1xuICAgIGJ1YmJsZXMgPSBuZXcgQnViYmxlcyhcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJiYWNrZ3JvdW5kXCIpIGFzIEhUTUxDYW52YXNFbGVtZW50XG4gICAgKTtcbiAgICBnYW1lID0gbmV3IEdhbWUoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0ZXJtaW5hbFwiKSEpO1xuXG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xufTtcblxud2luZG93Lm9ucmVzaXplID0gKCkgPT4ge1xuICAgIGJ1YmJsZXMucmVzaXplKCk7XG4gICAgZ2FtZS5yZXNpemUoKTtcbn07XG5cbmRvY3VtZW50Lm9ua2V5ZG93biA9IChlKSA9PiB7XG4gICAgZ2FtZS5rZXlkb3duKGUpO1xufTtcblxuZG9jdW1lbnQub252aXNpYmlsaXR5Y2hhbmdlID0gKCkgPT4ge1xuICAgIGlmIChkb2N1bWVudC52aXNpYmlsaXR5U3RhdGUgPT0gXCJ2aXNpYmxlXCIpIHtcbiAgICAgICAgbGFzdFRpbWUgPSBudWxsO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAvLyBUaGlzIHJlYWxseSBzaG91bGRuJ3QgYmUgbmVlZGVkIGlmIGJyb3dzZXJzIGFyZSBmb2xsb3dpbmcgY29udmVudGlvbixcbiAgICAvLyBidXQgYmV0dGVyIHNhZmUgdGhhbiBzb3JyeVxuICAgIGlmIChkb2N1bWVudC5oaWRkZW4pIHtcbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGxhc3RUaW1lICE9IG51bGwpIHtcbiAgICAgICAgbGV0IGR0ID0gdGltZSAtIGxhc3RUaW1lO1xuXG4gICAgICAgIGJ1YmJsZXMudXBkYXRlKGR0KTtcbiAgICAgICAgZ2FtZS51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIGxhc3RUaW1lID0gdGltZTtcbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=