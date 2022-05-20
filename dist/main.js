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
            setTimeout(function () { return term.element.scroll(0, term.element.scrollHeight); }, 500);
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
            if (this.textTimer > 20) {
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
        if (this.textTimer > 10) {
            this.textDecoded++;
            this.textTimer = 0;
        }
        this.textTimer += dt;
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
        this.element.scroll(0, this.element.scrollHeight);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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O0FBQ3BCLENBQUMsQ0FBQztBQUVGLFFBQVEsQ0FBQyxrQkFBa0IsR0FBRztJQUMxQixJQUFJLFFBQVEsQ0FBQyxlQUFlLElBQUksU0FBUyxFQUFFO1FBQ3ZDLFFBQVEsR0FBRyxJQUFJLENBQUM7S0FDbkI7QUFDTCxDQUFDLENBQUM7QUFFRixTQUFTLE1BQU0sQ0FBQyxJQUFZO0lBQ3hCLHdFQUF3RTtJQUN4RSw2QkFBNkI7SUFDN0IsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQ2pCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyQyxPQUFPO0tBQ1Y7SUFFRCxJQUFJLFFBQVEsSUFBSSxJQUFJLEVBQUU7UUFDbEIsSUFBSSxFQUFFLEdBQUcsSUFBSSxHQUFHLFFBQVEsQ0FBQztRQUV6QixPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDbkI7SUFFRCxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ2hCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9ub2RlX21vZHVsZXMvQHR2YW5jL2xpbmVjbGFtcC9kaXN0L2VzbS5qcyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdG9yeS5jc29uIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2J1YmJsZXMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnV0dG9ucy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9nYW1lLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlX21hbmFnZXIudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGVzLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3Rlcm1pbmFsLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWR1Y2VzIGZvbnQgc2l6ZSBvciB0cmltcyB0ZXh0IHRvIG1ha2UgaXQgZml0IHdpdGhpbiBzcGVjaWZpZWQgYm91bmRzLlxuICpcbiAqIFN1cHBvcnRzIGNsYW1waW5nIGJ5IG51bWJlciBvZiBsaW5lcyBvciB0ZXh0IGhlaWdodC5cbiAqXG4gKiBLbm93biBsaW1pdGF0aW9uczpcbiAqIDEuIENoYXJhY3RlcnMgdGhhdCBkaXN0b3J0IGxpbmUgaGVpZ2h0cyAoZW1vamlzLCB6YWxnbykgbWF5IGNhdXNlXG4gKiB1bmV4cGVjdGVkIHJlc3VsdHMuXG4gKiAyLiBDYWxsaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSB3aXBlcyBjaGlsZCBlbGVtZW50cy4gRnV0dXJlIHVwZGF0ZXMgbWF5IGFsbG93XG4gKiBpbmxpbmUgY2hpbGQgZWxlbWVudHMgdG8gYmUgcHJlc2VydmVkLlxuICpcbiAqIEB0b2RvIFNwbGl0IHRleHQgbWV0cmljcyBpbnRvIG93biBsaWJyYXJ5XG4gKiBAdG9kbyBUZXN0IG5vbi1MVFIgdGV4dFxuICovXG5jbGFzcyBMaW5lQ2xhbXAge1xuICAvKipcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxuICAgKiBUaGUgZWxlbWVudCB0byBjbGFtcC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBPcHRpb25zIHRvIGdvdmVybiBjbGFtcGluZyBiZWhhdmlvci5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heExpbmVzXVxuICAgKiBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdG8gYWxsb3cuIERlZmF1bHRzIHRvIDEuXG4gICAqIFRvIHNldCBhIG1heGltdW0gaGVpZ2h0IGluc3RlYWQsIHVzZSB7QHNlZSBvcHRpb25zLm1heEhlaWdodH1cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEhlaWdodF1cbiAgICogVGhlIG1heGltdW0gaGVpZ2h0IChpbiBwaXhlbHMpIG9mIHRleHQgaW4gYW4gZWxlbWVudC5cbiAgICogVGhpcyBvcHRpb24gaXMgdW5kZWZpbmVkIGJ5IGRlZmF1bHQuIE9uY2Ugc2V0LCBpdCB0YWtlcyBwcmVjZWRlbmNlIG92ZXJcbiAgICoge0BzZWUgb3B0aW9ucy5tYXhMaW5lc30uIE5vdGUgdGhhdCB0aGlzIGFwcGxpZXMgdG8gdGhlIGhlaWdodCBvZiB0aGUgdGV4dCwgbm90XG4gICAqIHRoZSBlbGVtZW50IGl0c2VsZi4gUmVzdHJpY3RpbmcgdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCBjYW4gYmUgYWNoaWV2ZWRcbiAgICogd2l0aCBDU1MgPGNvZGU+bWF4LWhlaWdodDwvY29kZT4uXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlU29mdENsYW1wXVxuICAgKiBJZiB0cnVlLCByZWR1Y2UgZm9udCBzaXplIChzb2Z0IGNsYW1wKSB0byBhdCBsZWFzdCB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfVxuICAgKiBiZWZvcmUgcmVzb3J0aW5nIHRvIHRyaW1taW5nIHRleHQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmhhcmRDbGFtcEFzRmFsbGJhY2tdXG4gICAqIElmIHRydWUsIHJlc29ydCB0byBoYXJkIGNsYW1waW5nIGlmIHNvZnQgY2xhbXBpbmcgcmVhY2hlcyB0aGUgbWluaW11bSBmb250IHNpemVcbiAgICogYW5kIHN0aWxsIGRvZXNuJ3QgZml0IHdpdGhpbiB0aGUgbWF4IGhlaWdodCBvciBudW1iZXIgb2YgbGluZXMuXG4gICAqIERlZmF1bHRzIHRvIHRydWUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5lbGxpcHNpc11cbiAgICogVGhlIGNoYXJhY3RlciB3aXRoIHdoaWNoIHRvIHJlcHJlc2VudCBjbGlwcGVkIHRyYWlsaW5nIHRleHQuXG4gICAqIFRoaXMgb3B0aW9uIHRha2VzIGVmZmVjdCB3aGVuIFwiaGFyZFwiIGNsYW1waW5nIGlzIHVzZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5Gb250U2l6ZV1cbiAgICogVGhlIGxvd2VzdCBmb250IHNpemUsIGluIHBpeGVscywgdG8gdHJ5IGJlZm9yZSByZXNvcnRpbmcgdG8gcmVtb3ZpbmdcbiAgICogdHJhaWxpbmcgdGV4dCAoaGFyZCBjbGFtcGluZykuIERlZmF1bHRzIHRvIDEuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhGb250U2l6ZV1cbiAgICogVGhlIG1heGltdW0gZm9udCBzaXplIGluIHBpeGVscy4gV2UnbGwgc3RhcnQgd2l0aCB0aGlzIGZvbnQgc2l6ZSB0aGVuXG4gICAqIHJlZHVjZSB1bnRpbCB0ZXh0IGZpdHMgY29uc3RyYWludHMsIG9yIGZvbnQgc2l6ZSBpcyBlcXVhbCB0b1xuICAgKiB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfS4gRGVmYXVsdHMgdG8gdGhlIGVsZW1lbnQncyBpbml0aWFsIGNvbXB1dGVkIGZvbnQgc2l6ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGVsZW1lbnQsXG4gICAge1xuICAgICAgbWF4TGluZXMgPSB1bmRlZmluZWQsXG4gICAgICBtYXhIZWlnaHQgPSB1bmRlZmluZWQsXG4gICAgICB1c2VTb2Z0Q2xhbXAgPSBmYWxzZSxcbiAgICAgIGhhcmRDbGFtcEFzRmFsbGJhY2sgPSB0cnVlLFxuICAgICAgbWluRm9udFNpemUgPSAxLFxuICAgICAgbWF4Rm9udFNpemUgPSB1bmRlZmluZWQsXG4gICAgICBlbGxpcHNpcyA9IFwi4oCmXCIsXG4gICAgfSA9IHt9XG4gICkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm9yaWdpbmFsV29yZHNcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IGVsZW1lbnQudGV4dENvbnRlbnQubWF0Y2goL1xcUytcXHMqL2cpIHx8IFtdLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwidXBkYXRlSGFuZGxlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogKCkgPT4gdGhpcy5hcHBseSgpLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib2JzZXJ2ZXJcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMudXBkYXRlSGFuZGxlciksXG4gICAgfSk7XG5cbiAgICBpZiAodW5kZWZpbmVkID09PSBtYXhGb250U2l6ZSkge1xuICAgICAgbWF4Rm9udFNpemUgPSBwYXJzZUludCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS5mb250U2l6ZSwgMTApO1xuICAgIH1cblxuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgdGhpcy5tYXhMaW5lcyA9IG1heExpbmVzO1xuICAgIHRoaXMubWF4SGVpZ2h0ID0gbWF4SGVpZ2h0O1xuICAgIHRoaXMudXNlU29mdENsYW1wID0gdXNlU29mdENsYW1wO1xuICAgIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjayA9IGhhcmRDbGFtcEFzRmFsbGJhY2s7XG4gICAgdGhpcy5taW5Gb250U2l6ZSA9IG1pbkZvbnRTaXplO1xuICAgIHRoaXMubWF4Rm9udFNpemUgPSBtYXhGb250U2l6ZTtcbiAgICB0aGlzLmVsbGlwc2lzID0gZWxsaXBzaXM7XG4gIH1cblxuICAvKipcbiAgICogR2F0aGVyIG1ldHJpY3MgYWJvdXQgdGhlIGxheW91dCBvZiB0aGUgZWxlbWVudCdzIHRleHQuXG4gICAqIFRoaXMgaXMgYSBzb21ld2hhdCBleHBlbnNpdmUgb3BlcmF0aW9uIC0gY2FsbCB3aXRoIGNhcmUuXG4gICAqXG4gICAqIEByZXR1cm5zIHtUZXh0TWV0cmljc31cbiAgICogTGF5b3V0IG1ldHJpY3MgZm9yIHRoZSBjbGFtcGVkIGVsZW1lbnQncyB0ZXh0LlxuICAgKi9cbiAgY2FsY3VsYXRlVGV4dE1ldHJpY3MoKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICBjb25zdCBjbG9uZSA9IGVsZW1lbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgIGNvbnN0IHN0eWxlID0gY2xvbmUuc3R5bGU7XG5cbiAgICAvLyBBcHBlbmQsIGRvbid0IHJlcGxhY2VcbiAgICBzdHlsZS5jc3NUZXh0ICs9IFwiO21pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7bWF4LWhlaWdodDpub25lIWltcG9ydGFudFwiO1xuICAgIGVsZW1lbnQucmVwbGFjZVdpdGgoY2xvbmUpO1xuXG4gICAgY29uc3QgbmF0dXJhbEhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodDtcblxuICAgIC8vIENsZWFyIHRvIG1lYXN1cmUgZW1wdHkgaGVpZ2h0LiB0ZXh0Q29udGVudCBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXCI7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgdGV4dEhlaWdodCA9IG5hdHVyYWxIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBGaWxsIGVsZW1lbnQgd2l0aCBzaW5nbGUgbm9uLWJyZWFraW5nIHNwYWNlIHRvIGZpbmQgaGVpZ2h0IG9mIG9uZSBsaW5lXG4gICAgY2xvbmUudGV4dENvbnRlbnQgPSBcIlxceGEwXCI7XG5cbiAgICAvLyBHZXQgaGVpZ2h0IG9mIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHRcbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgZmlyc3RMaW5lSGVpZ2h0ID0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lIC0gbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0O1xuXG4gICAgLy8gQWRkIGxpbmUgKDxicj4gKyBuYnNwKS4gYXBwZW5kQ2hpbGQoKSBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnJcIikpO1xuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXFx4YTBcIikpO1xuXG4gICAgY29uc3QgYWRkaXRpb25hbExpbmVIZWlnaHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmU7XG4gICAgY29uc3QgbGluZUNvdW50ID1cbiAgICAgIDEgKyAobmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSkgLyBhZGRpdGlvbmFsTGluZUhlaWdodDtcblxuICAgIC8vIFJlc3RvcmUgb3JpZ2luYWwgY29udGVudFxuICAgIGNsb25lLnJlcGxhY2VXaXRoKGVsZW1lbnQpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGVkZWYge09iamVjdH0gVGV4dE1ldHJpY3NcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7dGV4dEhlaWdodH1cbiAgICAgKiBUaGUgdmVydGljYWwgc3BhY2UgcmVxdWlyZWQgdG8gZGlzcGxheSB0aGUgZWxlbWVudCdzIGN1cnJlbnQgdGV4dC5cbiAgICAgKiBUaGlzIGlzIDxlbT5ub3Q8L2VtPiBuZWNlc3NhcmlseSB0aGUgc2FtZSBhcyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50LlxuICAgICAqIFRoaXMgbnVtYmVyIG1heSBldmVuIGJlIGdyZWF0ZXIgdGhhbiB0aGUgZWxlbWVudCdzIGhlaWdodCBpbiBjYXNlc1xuICAgICAqIHdoZXJlIHRoZSB0ZXh0IG92ZXJmbG93cyB0aGUgZWxlbWVudCdzIGJsb2NrIGF4aXMuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge25hdHVyYWxIZWlnaHRXaXRoT25lTGluZX1cbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdpdGggb25seSBvbmUgbGluZSBvZiB0ZXh0IGFuZCB3aXRob3V0XG4gICAgICogbWluaW11bSBvciBtYXhpbXVtIGhlaWdodHMuIFRoaXMgaW5mb3JtYXRpb24gbWF5IGJlIGhlbHBmdWwgd2hlblxuICAgICAqIGRlYWxpbmcgd2l0aCBpbmxpbmUgZWxlbWVudHMgKGFuZCBwb3RlbnRpYWxseSBvdGhlciBzY2VuYXJpb3MpLCB3aGVyZVxuICAgICAqIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3QgaW5jcmVhc2UgdGhlIGVsZW1lbnQncyBoZWlnaHQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2ZpcnN0TGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBhZGRzIHRvIHRoZSBlbGVtZW50LCBpLmUuLCB0aGVcbiAgICAgKiBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCB3aGlsZSBlbXB0eSBhbmQgdGhlIGhlaWdodFxuICAgICAqIG9mIHRoZSBlbGVtZW50IHdoaWxlIGl0IGNvbnRhaW5zIG9uZSBsaW5lIG9mIHRleHQuIFRoaXMgbnVtYmVyIG1heSBiZVxuICAgICAqIHplcm8gZm9yIGlubGluZSBlbGVtZW50cyBiZWNhdXNlIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3RcbiAgICAgKiBpbmNyZWFzZSB0aGUgaGVpZ2h0IG9mIGlubGluZSBlbGVtZW50cy5cblxuICAgICAqIEBwcm9wZXJ0eSB7YWRkaXRpb25hbExpbmVIZWlnaHR9XG4gICAgICogVGhlIGhlaWdodCB0aGF0IGVhY2ggbGluZSBvZiB0ZXh0IGFmdGVyIHRoZSBmaXJzdCBhZGRzIHRvIHRoZSBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtsaW5lQ291bnR9XG4gICAgICogVGhlIG51bWJlciBvZiBsaW5lcyBvZiB0ZXh0IHRoZSBlbGVtZW50IGNvbnRhaW5zLlxuICAgICAqL1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0SGVpZ2h0LFxuICAgICAgbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lLFxuICAgICAgZmlyc3RMaW5lSGVpZ2h0LFxuICAgICAgYWRkaXRpb25hbExpbmVIZWlnaHQsXG4gICAgICBsaW5lQ291bnQsXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBjaGFuZ2VzIHRoYXQgbWF5IGFmZmVjdCBsYXlvdXQuIFJlc3BvbmQgYnkgcmVjbGFtcGluZyBpZlxuICAgKiBuZWNlc3NhcnkuXG4gICAqL1xuICB3YXRjaCgpIHtcbiAgICBpZiAoIXRoaXMuX3dhdGNoaW5nKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgICAvLyBNaW5pbXVtIHJlcXVpcmVkIHRvIGRldGVjdCBjaGFuZ2VzIHRvIHRleHQgbm9kZXMsXG4gICAgICAvLyBhbmQgd2hvbGVzYWxlIHJlcGxhY2VtZW50IHZpYSBpbm5lckhUTUxcbiAgICAgIHRoaXMub2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmVsZW1lbnQsIHtcbiAgICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZSxcbiAgICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3dhdGNoaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3Agd2F0Y2hpbmcgZm9yIGxheW91dCBjaGFuZ2VzLlxuICAgKlxuICAgKiBAcmV0dXJucyB7TGluZUNsYW1wfVxuICAgKi9cbiAgdW53YXRjaCgpIHtcbiAgICB0aGlzLm9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgdGhpcy5fd2F0Y2hpbmcgPSBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ29uZHVjdCBlaXRoZXIgc29mdCBjbGFtcGluZyBvciBoYXJkIGNsYW1waW5nLCBhY2NvcmRpbmcgdG8gdGhlIHZhbHVlIG9mXG4gICAqIHByb3BlcnR5IHtAc2VlIExpbmVDbGFtcC51c2VTb2Z0Q2xhbXB9LlxuICAgKi9cbiAgYXBwbHkoKSB7XG4gICAgaWYgKHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQpIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzbHlXYXRjaGluZyA9IHRoaXMuX3dhdGNoaW5nO1xuXG4gICAgICAvLyBJZ25vcmUgaW50ZXJuYWxseSBzdGFydGVkIG11dGF0aW9ucywgbGVzdCB3ZSByZWN1cnNlIGludG8gb2JsaXZpb25cbiAgICAgIHRoaXMudW53YXRjaCgpO1xuXG4gICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSB0aGlzLm9yaWdpbmFsV29yZHMuam9pbihcIlwiKTtcblxuICAgICAgaWYgKHRoaXMudXNlU29mdENsYW1wKSB7XG4gICAgICAgIHRoaXMuc29mdENsYW1wKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhhcmRDbGFtcCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXN1bWUgb2JzZXJ2YXRpb24gaWYgcHJldmlvdXNseSB3YXRjaGluZ1xuICAgICAgaWYgKHByZXZpb3VzbHlXYXRjaGluZykge1xuICAgICAgICB0aGlzLndhdGNoKGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFRyaW1zIHRleHQgdW50aWwgaXQgZml0cyB3aXRoaW4gY29uc3RyYWludHNcbiAgICogKG1heGltdW0gaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcykuXG4gICAqXG4gICAqIEBzZWUge0xpbmVDbGFtcC5tYXhMaW5lc31cbiAgICogQHNlZSB7TGluZUNsYW1wLm1heEhlaWdodH1cbiAgICovXG4gIGhhcmRDbGFtcChza2lwQ2hlY2sgPSB0cnVlKSB7XG4gICAgaWYgKHNraXBDaGVjayB8fCB0aGlzLnNob3VsZENsYW1wKCkpIHtcbiAgICAgIGxldCBjdXJyZW50VGV4dDtcblxuICAgICAgZmluZEJvdW5kYXJ5KFxuICAgICAgICAxLFxuICAgICAgICB0aGlzLm9yaWdpbmFsV29yZHMubGVuZ3RoLFxuICAgICAgICAodmFsKSA9PiB7XG4gICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgdmFsKS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dDtcblxuICAgICAgICAgIHJldHVybiB0aGlzLnNob3VsZENsYW1wKClcbiAgICAgICAgfSxcbiAgICAgICAgKHZhbCwgbWluLCBtYXgpID0+IHtcbiAgICAgICAgICAvLyBBZGQgb25lIG1vcmUgd29yZCBpZiBub3Qgb24gbWF4XG4gICAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgbWF4KS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGVuIHRyaW0gbGV0dGVycyB1bnRpbCBpdCBmaXRzXG4gICAgICAgICAgZG8ge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSBjdXJyZW50VGV4dC5zbGljZSgwLCAtMSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dCArIHRoaXMuZWxsaXBzaXM7XG4gICAgICAgICAgfSB3aGlsZSAodGhpcy5zaG91bGRDbGFtcCgpKVxuXG4gICAgICAgICAgLy8gQnJvYWRjYXN0IG1vcmUgc3BlY2lmaWMgaGFyZENsYW1wIGV2ZW50IGZpcnN0XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5oYXJkY2xhbXBcIik7XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZHVjZXMgZm9udCBzaXplIHVudGlsIHRleHQgZml0cyB3aXRoaW4gdGhlIHNwZWNpZmllZCBoZWlnaHQgb3IgbnVtYmVyIG9mXG4gICAqIGxpbmVzLiBSZXNvcnRzIHRvIHVzaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSBpZiB0ZXh0IHN0aWxsIGV4Y2VlZHMgY2xhbXBcbiAgICogcGFyYW1ldGVycy5cbiAgICovXG4gIHNvZnRDbGFtcCgpIHtcbiAgICBjb25zdCBzdHlsZSA9IHRoaXMuZWxlbWVudC5zdHlsZTtcbiAgICBjb25zdCBzdGFydFNpemUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmZvbnRTaXplO1xuICAgIHN0eWxlLmZvbnRTaXplID0gXCJcIjtcblxuICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgbGV0IHNob3VsZENsYW1wO1xuXG4gICAgZmluZEJvdW5kYXJ5KFxuICAgICAgdGhpcy5taW5Gb250U2l6ZSxcbiAgICAgIHRoaXMubWF4Rm9udFNpemUsXG4gICAgICAodmFsKSA9PiB7XG4gICAgICAgIHN0eWxlLmZvbnRTaXplID0gdmFsICsgXCJweFwiO1xuICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgcmV0dXJuIHNob3VsZENsYW1wXG4gICAgICB9LFxuICAgICAgKHZhbCwgbWluKSA9PiB7XG4gICAgICAgIGlmICh2YWwgPiBtaW4pIHtcbiAgICAgICAgICBzdHlsZS5mb250U2l6ZSA9IG1pbiArIFwicHhcIjtcbiAgICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgfVxuICAgICAgICBkb25lID0gIXNob3VsZENsYW1wO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBjaGFuZ2VkID0gc3R5bGUuZm9udFNpemUgIT09IHN0YXJ0U2l6ZTtcblxuICAgIC8vIEVtaXQgc3BlY2lmaWMgc29mdENsYW1wIGV2ZW50IGZpcnN0XG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuc29mdGNsYW1wXCIpO1xuICAgIH1cblxuICAgIC8vIERvbid0IGVtaXQgYGxpbmVjbGFtcC5jbGFtcGAgZXZlbnQgdHdpY2UuXG4gICAgaWYgKCFkb25lICYmIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjaykge1xuICAgICAgdGhpcy5oYXJkQ2xhbXAoZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY2hhbmdlZCkge1xuICAgICAgLy8gaGFyZENsYW1wIGVtaXRzIGBsaW5lY2xhbXAuY2xhbXBgIHRvby4gT25seSBlbWl0IGZyb20gaGVyZSBpZiB3ZSdyZVxuICAgICAgLy8gbm90IGFsc28gaGFyZCBjbGFtcGluZy5cbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuY2xhbXBcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICogV2hldGhlciBoZWlnaHQgb2YgdGV4dCBvciBudW1iZXIgb2YgbGluZXMgZXhjZWVkIGNvbnN0cmFpbnRzLlxuICAgKlxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhIZWlnaHRcbiAgICogQHNlZSBMaW5lQ2xhbXAubWF4TGluZXNcbiAgICovXG4gIHNob3VsZENsYW1wKCkge1xuICAgIGNvbnN0IHsgbGluZUNvdW50LCB0ZXh0SGVpZ2h0IH0gPSB0aGlzLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCk7XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heEhlaWdodCAmJiB1bmRlZmluZWQgIT09IHRoaXMubWF4TGluZXMpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHQgfHwgbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0KSB7XG4gICAgICByZXR1cm4gdGV4dEhlaWdodCA+IHRoaXMubWF4SGVpZ2h0XG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIGxpbmVDb3VudCA+IHRoaXMubWF4TGluZXNcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIm1heExpbmVzIG9yIG1heEhlaWdodCBtdXN0IGJlIHNldCBiZWZvcmUgY2FsbGluZyBzaG91bGRDbGFtcCgpLlwiXG4gICAgKVxuICB9XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYSBiaW5hcnkgc2VhcmNoIGZvciB0aGUgbWF4aW11bSB3aG9sZSBudW1iZXIgaW4gYSBjb250aWdvdXMgcmFuZ2VcbiAqIHdoZXJlIGEgZ2l2ZW4gdGVzdCBjYWxsYmFjayB3aWxsIGdvIGZyb20gcmV0dXJuaW5nIHRydWUgdG8gcmV0dXJuaW5nIGZhbHNlLlxuICpcbiAqIFNpbmNlIHRoaXMgdXNlcyBhIGJpbmFyeS1zZWFyY2ggYWxnb3JpdGhtIHRoaXMgaXMgYW4gTyhsb2cgbikgZnVuY3Rpb24sXG4gKiB3aGVyZSBuID0gbWF4IC0gbWluLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIFRoZSBsb3dlciBib3VuZGFyeSBvZiB0aGUgcmFuZ2UuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogVGhlIHVwcGVyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0gdGVzdFxuICogQSBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHRoZSBjdXJyZW50IHZhbHVlIGluIHRoZSByYW5nZSBhbmQgcmV0dXJucyBhIHRydXRoeSBvciBmYWxzeSB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0gZG9uZVxuICogQSBmdW5jdGlvbiB0byBwZXJmb3JtIHdoZW4gY29tcGxldGUuIFJlY2VpdmVzIHRoZSBmb2xsb3dpbmcgcGFyYW1ldGVyc1xuICogLSBjdXJzb3JcbiAqIC0gbWF4UGFzc2luZ1ZhbHVlXG4gKiAtIG1pbkZhaWxpbmdWYWx1ZVxuICovXG5mdW5jdGlvbiBmaW5kQm91bmRhcnkobWluLCBtYXgsIHRlc3QsIGRvbmUpIHtcbiAgbGV0IGN1cnNvciA9IG1heDtcbiAgLy8gc3RhcnQgaGFsZndheSB0aHJvdWdoIHRoZSByYW5nZVxuICB3aGlsZSAobWF4ID4gbWluKSB7XG4gICAgaWYgKHRlc3QoY3Vyc29yKSkge1xuICAgICAgbWF4ID0gY3Vyc29yO1xuICAgIH0gZWxzZSB7XG4gICAgICBtaW4gPSBjdXJzb3I7XG4gICAgfVxuXG4gICAgaWYgKG1heCAtIG1pbiA9PT0gMSkge1xuICAgICAgZG9uZShjdXJzb3IsIG1pbiwgbWF4KTtcbiAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgY3Vyc29yID0gTWF0aC5yb3VuZCgobWluICsgbWF4KSAvIDIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXQoaW5zdGFuY2UsIHR5cGUpIHtcbiAgaW5zdGFuY2UuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCh0eXBlKSk7XG59XG5cbmV4cG9ydCB7IExpbmVDbGFtcCBhcyBkZWZhdWx0IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcImJlZ2luXCI6e1widGV4dFwiOlwiW2RlbGF5IDUwMF1Db25uZWN0aW5nW2RlbGF5IDUwMF1bbm9ybWFsIC5dW2RlbGF5IDUwMF1bbm9ybWFsIC5dW2RlbGF5IDUwMF1bbm9ybWFsIC5dXFxuPGVtPkJlZXA8L2VtPiBbZGVsYXkgNTAwXTxlbT5CZWVwPC9lbT4gW2RlbGF5IDUwMF08ZW0+QmVlcDwvZW0+XFxuWW91IHdha2UgdXAgc2xvd2x5IHRvIHRoZSBzb3VuZCBvZiB5b3VyIGFsYXJtLlxcbkl0IGRyb25lcyBvbiBhbmQgb24gdW50aWwgeW91IHdha2UgdXAgZW5vdWdoIHRvIHR1cm4gaXQgb2ZmLiBcXG5XaGF0IGRvIHlvdSBkbz9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwibW9iaWxlXCIsXCJ0ZXh0XCI6XCJDaGVjayBwaG9uZVwiLFwibmV4dFwiOlwiY2hlY2tQaG9uZVwifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkdldCBvdXQgb2YgYmVkXCIsXCJuZXh0XCI6XCJnZXRVcFwifV19LFwiY2hlY2tQaG9uZVwiOntcInRleHRcIjpcIllvdSBzY3JvbGwgc29tZXdoYXQgYWJzZW50bWluZGVkbHkgdGhyb3VnaCB5b3VyIG5ld3NmZWVkIGFzIHlvdSB3YWtlIHVwLiBcXG5PbmUgc3RvcnkgY2F0Y2hlcyB5b3VyIGV5ZS4gQW4gaW1hZ2Ugb2YgYSBmbG9vZGVkIHRvd24gb2ZmIG9mIHRoZSBNaXNzaXNpcHBpIFJpdmVyLlxcblBpZWNlcyBvZiBkcmlmdHdvb2QgYW5kIGRlYnJpcyBzY2F0dGVyZWQgaW4gdGhlIHdhdGVyLlxcbkNhcnMgZHJvd25lZCBpbiB0aGUgZGVlcCB3YXRlci5cXG5OYXR1cmUgaXMgYSBjcnVlbCBtaXN0cmVzcywgeW91IHRoaW5rLiBcXG5CdXQgdGhlbiBhZ2Fpbiwgd2UndmUgYWx3YXlzIGhhZCB0byBkZWFsIHdpdGggdGhpcyBzdHVmZiwgcmlnaHQ/XFxuV2VsbCwgdGhhdHMgZW5vdWdoIG9mIHRoZSBuZXdzIGZvciB0b2RheS4gVGhhdCBzdHVmZiBpcyBhbHdheXMganVzdCBkZXByZXNzaW5nLlwiLFwibG9vcFwiOlwiYmVnaW5cIn0sXCJnZXRVcFwiOntcInRleHRcIjpcIllvdSBnZXQgdXAgYW5kIGdldCByZWFkeSBmb3IgdGhlIGRheS4gXFxuV2hlbiB5b3UgY29tZSBiYWNrIG91dCBvZiB0aGUgYmF0aHJvb20sIHlvdSBub3RpY2UgdHdvIHRoaW5nczpcXG4xLiBJdCdzIGZyZWV6aW5nIGluIGhlcmVcXG4yLiBZb3VyIHJvb20gaXMgYSBtZXNzXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImZhblwiLFwidGV4dFwiOlwiVHVybiBvZmYgdGhlIEEvQ1wiLFwibmV4dFwiOlwidHVybk9mZlwifSx7XCJpY29uXCI6XCJmb2xkZXJcIixcInRleHRcIjpcIkNoZWNrIG91dCB0aGUgbWVzc1wiLFwibmV4dFwiOlwibWVzc1wiLFwicmV0dXJuXCI6XCJjb250aW51ZVwifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkxlYXZlXCIsXCJuZXh0XCI6XCJsZWF2ZVwifV19LFwidHVybk9mZlwiOntcInRleHRcIjpcIkFzIHlvdSBnbyBvdmVyIHRvIHR1cm4gb2ZmIHRoZSBhaXIgY29uZGl0aW9uaW5nLCB5b3UgdGFrZSBhIGxvb2sgb3V0IHRoZSB3aW5kb3cuXFxuSnVzdCBhcyB5b3UgZXhwZWN0ZWQsIGl0cyBjbG91ZHkgYW5kIHJhaW55LiBcXG5UaGUgQS9DIG11c3QgaGF2ZSBiZWVuIG1ha2luZyB0aGUgdGVtcGVyYXR1cmUgZXZlbiBjb2xkZXIgdGhhbiBpdCBhbHJlYWR5IHdhcyBvdXRzaWRlLlxcbllvdSd2ZSBoYWQgaXQgdHVybmVkIGFsbCB0aGUgd2F5IHVwIGZvciB0aGUgcGFzdCBmZXcgZGF5cyBkdWUgdG8gdGhlIGhlYXR3YXZlLCBidXQgY2xlYXJseSB0aGF0J3Mgb3ZlciBub3cuXFxuWW91IGdyYWIgeW91ciBBdWdtZW50ZWQgUmVhbGl0eSBnbGFzc2VzIGZyb20geW91ciBkZXNrIGFuZCBwdXQgdGhlbSBvbi5cXG5BdCBsZWFzdCBhbGwgeW91IGhhdmUgdG8gZG8gaXMgb3BlbiB0aGUgQS9DIGFwcCBhbmQgYWRqdXN0IHRoZSB2aXJ0dWFsIGtub2IuXFxuVGhpcyBzdHVmZiB3YXMgbXVjaCBtb3JlIGFubm95aW5nIHdoZW4geW91IGhhZCB0byBmaW5kIHRoZSBwaHlzaWNhbCBjb250cm9scy5cIixcImxvb3BcIjpcImdldFVwXCJ9LFwibWVzc1wiOntcInRleHRcIjpcIllvdSBzcGVuZCBzbyBtdWNoIHRpbWUgYXQgd29yayBub3dhZGF5cyB0aGF0IHlvdXIgcm9vbSBpcyBwcmV0dHkgbWVzc3kuIFxcbkluIHRoZW9yeSwgYWxsIG9mIHlvdXIgbWF0ZXJpYWxzIHdvdWxkIGJlIGNvbnRhaW5lZCBpbiB0aGUgZm9sZGVyIG9uIHlvdXIgZGVzayxcXG5idXQgeW91IHNwZW5kIHNvIG11Y2ggdGltZSByZW9yZ2FuaXppbmcgYW5kIGFkanVzdGluZyB0aGF0IGl0IGFsbCBlbmRzIHVwIHN0cmV3biBhYm91dC5cXG5Zb3UgcGljayB1cCB3aGF0IGZldyBwYXBlcnMgcmVtYWluIHRoZSBmb2xkZXIgYW5kIGZsaWNrIHRocm91Z2ggdGhlbS4gXFxuVGhleSdyZSB0aGUgdGhyZWUgc3R1ZGllcyB5b3UndmUgYmFzZWQgeW91ciBwcmVzZW50YXRpb24gb24uXFxuWW91IHN0YXJlIGF0IHRoZW0gZm9yIGEgbGl0dGxlLCBwZW5zaXZlbHkuIFlvdSdkIGFsd2F5cyB3YW50ZWQgdG8gYmUgdGhlIG9uZSBkb2luZyB0aGUgcmVzZWFyY2guIFxcblRoYXQncyB3aHkgeW91IHRvb2sgdGhpcyBqb2I7IHByZXNlbnRpbmcgcmVzZWFyY2ggc2VlbWVkIGxpa2UgYSBnb29kIHdheSB0byBnZXQgc29tZSBjb25uZWN0aW9ucyxcXG5hbmQgeW91IG5lZWRlZCB0aGUgbW9uZXkuIEJ1dCBhdCBzb21lIHBvaW50IHlvdSBsb3N0IHRyYWNrIG9mIHRoYXQgZ29hbCwgXFxuYW5kIGV2ZW4gdGhvdWdoIHlvdSBjYW4gcHJvYmFibHkgYWZmb3JkIHRvIGdvIGJhY2sgdG8gc2Nob29sIG5vdywgXFxuYmVpbmcgYSByZXNlYXJjaGVyIGZlZWxzIGxpa2Ugc29tZW9uZSBlbHNlJ3MgZHJlYW0uIFxcblRoZSBraW5kIG9mIHRoaW5nIGEga2lkIHRlbGxzIHRoZW1zZWxmIGJlZm9yZSB0aGV5J3ZlIGJlZW4gZXhwb3NlZCB0byB0aGUgcmVhbCB3b3JsZC4gXFxuVGhpcyBqb2IgaXMgZmluZS4gSXQgcGF5cyB3ZWxsLiA8Yj5JdCdzIGZpbmU8L2I+LlxcbllvdSBoYXZlIHRocmVlIHN0dWRpZXMgaW4gdGhlIGZvbGRlci4gRG8geW91IHdhbnQgdG8gcmV2aWV3IGFueSBvZiB0aGVtIGJlZm9yZSB0aGUgYmlnIGhlYXJpbmcgbGF0ZXI/XCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImluZHVzdHJ5XCIsXCJ0ZXh0XCI6XCJDQ1MgU3R1ZHlcIixcIm5leHRcIjpcImNjc1wifSx7XCJpY29uXCI6XCJmaXJlLWZsYW1lLXNpbXBsZVwiLFwidGV4dFwiOlwiRWZmaWNpZW5jeSBTdHVkeVwiLFwibmV4dFwiOlwiZWZmaWNpZW5jeVwifSx7XCJpY29uXCI6XCJhcnJvd3Mtcm90YXRlXCIsXCJ0ZXh0XCI6XCJMaWZlY3ljbGUgQW5hbHlzaXNcIixcIm5leHRcIjpcImxjYVwifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkNvbnRpbnVlXCIsXCJuZXh0XCI6XCJjb250aW51ZVwifV19LFwiY2NzXCI6e1widGV4dFwiOlwiQ0NTIFN0dWR5XCIsXCJsb29wXCI6XCJtZXNzXCJ9LFwiZWZmaWNpZW5jeVwiOntcInRleHRcIjpcIkVmZmljaWVuY3kgU3R1ZHlcIixcImxvb3BcIjpcIm1lc3NcIn0sXCJsY2FcIjp7XCJ0ZXh0XCI6XCJMaWZlY3ljbGUgQW5hbHlzaXNcIixcImxvb3BcIjpcIm1lc3NcIn0sXCJjb250aW51ZVwiOntcInRleHRcIjpcIllvdSB0dXJuIHlvdXIgYXR0ZW50aW9uIHRvIHRoZSByZXN0IG9mIHRoZSByb29tLlwiLFwibG9vcFwiOlwiZ2V0VXBcIn19IiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnViYmxlcyB7XG4gICAgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gICAgYnViYmxlczogQXJyYXk8QnViYmxlPiA9IFtdO1xuXG4gICAgY29uc3RydWN0b3IoY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCkge1xuICAgICAgICB0aGlzLmN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuICAgICAgICB0aGlzLnJlc2l6ZSgpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTA7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5idWJibGVzLnB1c2gobmV3IEJ1YmJsZSgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuY3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLmN0eC5jYW52YXMud2lkdGgsIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5idWJibGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5idWJibGVzW2ldLnNwZWVkID4gMCAmJiB0aGlzLmJ1YmJsZXNbaV0ubGlmZXRpbWUgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5zcGVlZCAqPSAtMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLnVwZGF0ZShkdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5idWJibGVzW2ldLnNpemUgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXSA9IG5ldyBCdWJibGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLmRyYXcodGhpcy5jdHgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzaXplKCkge1xuICAgICAgICB2YXIgZHByID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICAgICAgdmFyIHJlY3QgPSB0aGlzLmN0eC5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgdGhpcy5jdHguY2FudmFzLndpZHRoID0gcmVjdC53aWR0aCAqIGRwcjtcbiAgICAgICAgdGhpcy5jdHguY2FudmFzLmhlaWdodCA9IHJlY3QuaGVpZ2h0ICogZHByO1xuXG4gICAgICAgIHRoaXMuY3R4LnNjYWxlKGRwciwgZHByKTtcblxuICAgICAgICB0aGlzLmN0eC5maWx0ZXIgPSBcImJsdXIoNTBweClcIjtcbiAgICB9XG59XG5cbmNsYXNzIEJ1YmJsZSB7XG4gICAgc3BlZWQ6IG51bWJlcjtcbiAgICB4OiBudW1iZXI7XG4gICAgeTogbnVtYmVyO1xuICAgIHNpemU6IG51bWJlcjtcbiAgICBjb2xvcjogc3RyaW5nO1xuICAgIGxpZmV0aW1lOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5zcGVlZCA9IDAuMDI7XG5cbiAgICAgICAgdGhpcy54ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLnJhbmRvbSgpICogd2luZG93LmlubmVySGVpZ2h0O1xuXG4gICAgICAgIHRoaXMuc2l6ZSA9IDEwO1xuXG4gICAgICAgIGxldCB2ID0gTWF0aC5yYW5kb20oKTtcbiAgICAgICAgbGV0IGh1ZSA9IHYgPCAwLjUgPyAxNTAgOiAyMzA7XG4gICAgICAgIGxldCBzYXQgPSB2IDwgMC41ID8gNTAgOiA4NTtcbiAgICAgICAgbGV0IGxpZ2h0ID0gdiA8IDAuNSA/IDI1IDogNDA7XG4gICAgICAgIHRoaXMuY29sb3IgPSBcImhzbGEoXCIgKyBodWUgKyBcIiwgXCIgKyBzYXQgKyBcIiUsIFwiICsgbGlnaHQgKyBcIiUsIDIwJSlcIjtcblxuICAgICAgICB0aGlzLmxpZmV0aW1lID0gTWF0aC5yYW5kb20oKSAqKiA1ICogMTYwMDAgKyAyMDAwO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc2l6ZSArPSB0aGlzLnNwZWVkICogZHQ7XG4gICAgICAgIHRoaXMubGlmZXRpbWUgLT0gZHQ7XG4gICAgfVxuXG4gICAgZHJhdyhjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCkge1xuICAgICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5jb2xvcjtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKHRoaXMueCwgdGhpcy55LCB0aGlzLnNpemUsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGwoKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdG9yeSwgT3B0aW9uIH0gZnJvbSAnLi9zdG9yeSc7XG5cbmxldCBzdG9yeTogU3RvcnkgPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBCdXR0b25zIHtcbiAgICBlbGVtOiBIVE1MRWxlbWVudDtcbiAgICBzZWxlY3RlZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgdGV4dDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgZW5hYmxlZCA9IGZhbHNlO1xuICAgIGJ1dHRvbnM6IEhUTUxCdXR0b25FbGVtZW50W10gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuZWxlbSA9IGVsZW07XG4gICAgfVxuXG4gICAgZW5hYmxlKHNjZW5lOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIGxldCBvcHRpb25zOiBPcHRpb25bXTtcbiAgICAgICAgaWYgKHN0b3J5W3NjZW5lXS5vcHRpb25zID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHN0b3J5W3N0b3J5W3NjZW5lXS5sb29wIV0ub3B0aW9ucyE7XG4gICAgICAgICAgICBsZXQgbG9vcGVkT3B0ID0gb3B0aW9ucy5maW5kSW5kZXgobyA9PiBvLnJldHVybiAhPSB1bmRlZmluZWQgPyBvLnJldHVybiA9PSBzY2VuZSA6IG8ubmV4dCA9PSBzY2VuZSk7XG4gICAgICAgICAgICBvcHRpb25zLnNwbGljZShsb29wZWRPcHQsIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHN0b3J5W3NjZW5lXS5vcHRpb25zITtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdGVwID0gb3B0aW9ucy5sZW5ndGggPT0gNCA/IDYgOiAxMi9vcHRpb25zLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb24gPSBvcHRpb25zW2ldO1xuICAgICAgICAgICAgbGV0IGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gICAgICAgICAgICBidXR0b24uY2xhc3NOYW1lID0gXCJvdmVybGF5XCI7XG4gICAgICAgICAgICBidXR0b24uaW5uZXJIVE1MID0gIFwiPiA8aSBjbGFzcz1cXFwiZmEtc29saWQgZmEtXCIrIG9wdGlvbi5pY29uICtcIlxcXCI+PC9pPiBcIiArIG9wdGlvbi50ZXh0O1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IFwiNCAvIDEwXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMubGVuZ3RoID09IDQpIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IGkgPCAyID8gKGkqc3RlcCArIDEpLnRvU3RyaW5nKCkgKyBcIiAvIFwiICsgKChpKzEpKnN0ZXAgKyAxKS50b1N0cmluZygpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogKChpLTIpKnN0ZXAgKyAxKS50b1N0cmluZygpICsgXCIgLyBcIiArICgoaS0xKSpzdGVwICsgMSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLnN0eWxlLmdyaWRDb2x1bW4gPSAoaSpzdGVwICsgMSkudG9TdHJpbmcoKSArIFwiIC8gXCIgKyAoKGkrMSkqc3RlcCArIDEpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBidXR0b24ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdGVkID0gb3B0aW9uLm5leHQ7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0ID0gXCI8aSBjbGFzcz1cXFwiZmEtc29saWQgZmEtXCIrIG9wdGlvbi5pY29uICtcIlxcXCI+PC9pPiBcIiArIG9wdGlvbi50ZXh0O1xuICAgICAgICAgICAgICAgIHRoaXMuZWxlbS5jbGFzc05hbWUgPSBcIlwiO1xuICAgICAgICAgICAgICAgIHRoaXMuZWxlbS5pbm5lckhUTUwgPSBcIlwiO1xuICAgICAgICAgICAgICAgIHRoaXMuYnV0dG9ucyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMuZWxlbS5hcHBlbmRDaGlsZChidXR0b24pO1xuICAgICAgICAgICAgdGhpcy5idXR0b25zLnB1c2goYnV0dG9uKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVsZW0uY2xhc3NOYW1lID0gXCJvdXRcIjtcbiAgICB9XG59IiwiaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuL3Rlcm1pbmFsXCI7XG5pbXBvcnQgU3RhdGVNYW5hZ2VyIGZyb20gXCIuL3N0YXRlX21hbmFnZXJcIjtcbmltcG9ydCB7IEJlZ2luU3RhdGUgfSBmcm9tIFwiLi9zdGF0ZXNcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgR2FtZSB7XG4gICAgdGVybTogVGVybWluYWw7XG4gICAgbWFuYWdlcjogU3RhdGVNYW5hZ2VyO1xuXG4gICAgY29uc3RydWN0b3IodGVybWluYWw6IEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHRoaXMudGVybSA9IG5ldyBUZXJtaW5hbCh0ZXJtaW5hbCk7XG4gICAgICAgIHRoaXMubWFuYWdlciA9IG5ldyBTdGF0ZU1hbmFnZXIoQmVnaW5TdGF0ZSk7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLnVwZGF0ZShkdCwgdGhpcy50ZXJtKTtcblxuICAgICAgICB0aGlzLnRlcm0udXBkYXRlKGR0KTtcbiAgICB9XG5cbiAgICByZXNpemUoKSB7XG4gICAgICAgIHRoaXMudGVybS5yZXNpemUoKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLmtleWRvd24oZSk7XG4gICAgfVxufVxuIiwiaW1wb3J0IFN0YXRlTWFuYWdlciBmcm9tIFwiLi9zdGF0ZV9tYW5hZ2VyXCI7XG5pbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcblxuZXhwb3J0IGRlZmF1bHQgYWJzdHJhY3QgY2xhc3MgU3RhdGUge1xuICAgIHByb3RlY3RlZCBtYW5hZ2VyOiBTdGF0ZU1hbmFnZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyOiBTdGF0ZU1hbmFnZXIpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcbiAgICB9XG5cbiAgICBpbml0KHRlcm06IFRlcm1pbmFsKSB7fVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7fVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7fVxufVxuIiwiaW1wb3J0IFN0YXRlIGZyb20gXCIuL3N0YXRlXCI7XG5pbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU3RhdGVNYW5hZ2VyIHtcbiAgICBzdGF0ZTogU3RhdGU7XG4gICAgbmVlZHNJbml0ID0gdHJ1ZTtcblxuICAgIGNvbnN0cnVjdG9yKHM6IG5ldyAobTogU3RhdGVNYW5hZ2VyKSA9PiBTdGF0ZSkge1xuICAgICAgICB0aGlzLnN0YXRlID0gbmV3IHModGhpcyk7XG4gICAgfVxuXG4gICAgc2V0U3RhdGUoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICAgICAgdGhpcy5uZWVkc0luaXQgPSB0cnVlO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBpZiAodGhpcy5uZWVkc0luaXQpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUuaW5pdCh0ZXJtKTtcbiAgICAgICAgICAgIHRoaXMubmVlZHNJbml0ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN0YXRlLnVwZGF0ZShkdCwgdGVybSk7XG4gICAgfVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIHRoaXMuc3RhdGUua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuaW1wb3J0IEJ1dHRvbnMgZnJvbSBcIi4vYnV0dG9uc1wiO1xuaW1wb3J0IHsgU3RvcnkgfSBmcm9tICcuL3N0b3J5JztcblxubGV0IHN0b3J5OiBTdG9yeSA9IHJlcXVpcmUoXCIuL3N0b3J5LmNzb25cIik7XG5cbmV4cG9ydCBjbGFzcyBCZWdpblN0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIG92ZXJyaWRlIGluaXQodGVybTogVGVybWluYWwpIHtcbiAgICAgICAgdGVybS53cml0ZUxpbmUoXCJQcmVzcyBhbnkga2V5IHRvIGJlZ2luLi4uXCIpO1xuICAgIH1cblxuICAgIG92ZXJyaWRlIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIuc2V0U3RhdGUoV2lwZVN0YXRlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXaXBlU3RhdGUgZXh0ZW5kcyBTdGF0ZSB7XG4gICAgcHJpdmF0ZSB3aXBlVGltZXIgPSAwO1xuICAgIHByaXZhdGUgd2lwZVRpY2tzID0gMDtcbiAgICBwcml2YXRlIHdpcGVMaW5lczogbnVtYmVyO1xuXG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcImhpZGRlblwiO1xuICAgICAgICB0aGlzLndpcGVMaW5lcyA9IHRlcm0ubWF4TGluZXM7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLndpcGVUaW1lciA+IDUwKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53aXBlVGlja3MgPiA1KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlTGluZXMtLTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlVGlja3MrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGVybS5maWxsUmFuZG9tKHRoaXMud2lwZUxpbmVzKTtcblxuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2lwZUxpbmVzID49IDApIHtcbiAgICAgICAgICAgIHRoaXMud2lwZVRpbWVyICs9IGR0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGVybS5yZXNldCgpO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLm92ZXJmbG93ID0gXCJcIjtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5zZXRTdGF0ZShQbGF5aW5nU3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGxheWluZ1N0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHNjZW5lID0gXCJiZWdpblwiO1xuXG4gICAgcmVtYWluaW5nVGV4dCA9IFwiXCI7XG5cbiAgICBkZWxheSA9IDA7XG5cbiAgICB0ZXh0RGVjb2RlZCA9IC0xO1xuICAgIHRleHRQb3NpdGlvbiA9IC0xO1xuICAgIHRleHRUaW1lciA9IC0xO1xuXG4gICAgYnV0dG9ucyA9IG5ldyBCdXR0b25zKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYnV0dG9uc1wiKSEpO1xuXG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSBzdG9yeVt0aGlzLnNjZW5lXS50ZXh0O1xuICAgIH1cblxuICAgIG92ZXJyaWRlIHVwZGF0ZShkdDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBpZiAodGhpcy5idXR0b25zLmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5idXR0b25zLnNlbGVjdGVkICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRlcm0ud3JpdGVMaW5lKHRoaXMuYnV0dG9ucy50ZXh0ISk7XG4gICAgICAgICAgICB0aGlzLnNjZW5lID0gdGhpcy5idXR0b25zLnNlbGVjdGVkO1xuICAgICAgICAgICAgdGhpcy5idXR0b25zLnNlbGVjdGVkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICB0ZXJtLndyaXRlKFwiPGJyLz5cIik7XG4gICAgICAgICAgICB0ZXJtLndyaXRlTGluZShcIlwiKTtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9ucy5lbmFibGUodGhpcy5zY2VuZSk7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRlcm0uZWxlbWVudC5zY3JvbGwoMCwgdGVybS5lbGVtZW50LnNjcm9sbEhlaWdodCksIDUwMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5kZWxheSA8PSAwKSB7XG4gICAgICAgICAgICBsZXQgW3BvcywgaW5kZXhdID0gdGhpcy5pbmRleE9mTWFueSh0aGlzLnJlbWFpbmluZ1RleHQsIFwiPFsgXFxuXCIpO1xuICAgICAgICAgICAgaWYocG9zID09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVNwZWNpYWwoaW5kZXgsIHRlcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlVGV4dChwb3MsIHRlcm0sIGR0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkgLT0gZHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGluZGV4T2ZNYW55KHN0cjogc3RyaW5nLCBjaGFyczogc3RyaW5nKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYyA9IGNoYXJzLmluZGV4T2Yoc3RyW2ldKTtcbiAgICAgICAgICAgIGlmIChjICE9IC0xKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtpLCBjXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy0xLCAtMV07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB3cml0ZVRleHQobGVuOiBudW1iZXIsIHRlcm06IFRlcm1pbmFsLCBkdDogbnVtYmVyKSB7XG4gICAgICAgIGlmIChsZW4gPT0gLTEpIHtcbiAgICAgICAgICAgIGxlbiA9IHRoaXMucmVtYWluaW5nVGV4dC5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50ZXh0RGVjb2RlZCA9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCA9IDA7XG4gICAgICAgICAgICB0aGlzLnRleHRQb3NpdGlvbiA9IHRlcm0uZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIHRoaXMudGV4dFRpbWVyID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IDApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnRleHRUaW1lciA+IDIwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCA9IDE7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0VGltZXIgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHRUaW1lciArPSBkdDtcbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKHRlcm0ucmFuZG9tQ2hhcmFjdGVycyhsZW4pLCB0aGlzLnRleHRQb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHRleHQgPVxuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDAsIHRoaXMudGV4dERlY29kZWQpICtcbiAgICAgICAgICAgIHRlcm0ucmFuZG9tQ2hhcmFjdGVycyhsZW4gLSB0aGlzLnRleHREZWNvZGVkKTtcblxuICAgICAgICB0ZXJtLndyaXRlKHRleHQsIHRoaXMudGV4dFBvc2l0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy50ZXh0RGVjb2RlZCA9PSBsZW4pIHtcbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShsZW4pO1xuICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCA9IC0xO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudGV4dFRpbWVyID4gMTApIHtcbiAgICAgICAgICAgIHRoaXMudGV4dERlY29kZWQrKztcbiAgICAgICAgICAgIHRoaXMudGV4dFRpbWVyID0gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnRleHRUaW1lciArPSBkdDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZVNwZWNpYWwoaW5kZXg6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgc3dpdGNoIChpbmRleCkge1xuICAgICAgICAgICAgY2FzZSAwOiAvLyA8XG4gICAgICAgICAgICAgICAgbGV0IGVuZFRhZ1BvcyA9IHRoaXMucmVtYWluaW5nVGV4dC5pbmRleE9mKFwiPlwiKTtcbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgwLCBlbmRUYWdQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGVuZFRhZ1BvcyArIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAxOiAvLyBbXG4gICAgICAgICAgICAgICAgbGV0IGVuZENvbW1hbmRQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIl1cIik7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSwgZW5kQ29tbWFuZFBvcyk7XG4gICAgICAgICAgICAgICAgbGV0IHNwYWNlUG9zID0gY29tbWFuZC5pbmRleE9mKFwiIFwiKTtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGNvbW1hbmQuc2xpY2UoMCwgc3BhY2VQb3MpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJkZWxheVwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxheSA9IHBhcnNlSW50KGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm5vcm1hbFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGVybS53cml0ZShjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzZXBcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoZW5kQ29tbWFuZFBvcyArIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAyOiAvLyA8c3BhY2U+XG4gICAgICAgICAgICAgICAgdGVybS53cml0ZShcIiBcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAzOiAvLyBcXG5cbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlTGluZShcIlwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRlbGF5ID0gNTAwO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJJbnZhbGlkIGNoYXIgaW5kZXggXCIgKyBpbmRleCk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgTGluZUNsYW1wIGZyb20gXCJAdHZhbmMvbGluZWNsYW1wXCI7XHJcblxyXG5jb25zdCBDVVJTT1JfQkxJTktfSU5URVJWQUwgPSA1MDA7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUZXJtaW5hbCB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuXHJcbiAgICBmb250U2l6ZTogbnVtYmVyO1xyXG4gICAgd2lkdGg6IG51bWJlcjtcclxuICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgbGluZUhlaWdodDogbnVtYmVyO1xyXG5cclxuICAgIG1heExpbmVzOiBudW1iZXI7XHJcbiAgICBjaGFyc1BlckxpbmU6IG51bWJlcjtcclxuXHJcbiAgICBjb250ZW50ID0gXCI+IFwiO1xyXG5cclxuICAgIHByaXZhdGUgY3Vyc29yVmlzaWJsZSA9IHRydWU7XHJcbiAgICBwcml2YXRlIGN1cnNvckVuYWJsZWQgPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBjdXJzb3JUaWNrcyA9IDA7XHJcblxyXG4gICAgY29uc3RydWN0b3IoZWxlbTogSFRNTEVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBlbGVtO1xyXG5cclxuICAgICAgICB0aGlzLmZvbnRTaXplID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5mb250U2l6ZS5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMud2lkdGggPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLndpZHRoLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmhlaWdodC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XHJcbiAgICAgICAgY29uc3QgY2xhbXAgPSBuZXcgTGluZUNsYW1wKHRoaXMuZWxlbWVudCk7XHJcbiAgICAgICAgdGhpcy5saW5lSGVpZ2h0ID0gY2xhbXAuY2FsY3VsYXRlVGV4dE1ldHJpY3MoKS5hZGRpdGlvbmFsTGluZUhlaWdodDtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcIlwiO1xyXG5cclxuICAgICAgICB0aGlzLm1heExpbmVzID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAvIHRoaXMubGluZUhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5jaGFyc1BlckxpbmUgPSBNYXRoLmZsb29yKHRoaXMud2lkdGggLyAodGhpcy5mb250U2l6ZSAqIDAuNikpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlc2l6ZSgpIHtcclxuICAgICAgICB0aGlzLndpZHRoID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS53aWR0aC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5oZWlnaHQuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5tYXhMaW5lcyA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgLyB0aGlzLmxpbmVIZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2hhcnNQZXJMaW5lID0gTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gKHRoaXMuZm9udFNpemUgKiAwLjYpKTtcclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnNvckVuYWJsZWQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY3Vyc29yVGlja3MgPj0gQ1VSU09SX0JMSU5LX0lOVEVSVkFMKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnNvclRpY2tzID0gMDtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmxpcEN1cnNvcigpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJzb3JUaWNrcyArPSBkdDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzaG93KCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5pbm5lckhUTUwgPSB0aGlzLmNvbnRlbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgY2xlYXIoKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgPSBcIlwiO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFBvc2l0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRlbnQubGVuZ3RoIC0gKHRoaXMuY3Vyc29yVmlzaWJsZSA/IDAgOiAxKTtcclxuICAgIH1cclxuXHJcbiAgICBwdXQodGV4dDogc3RyaW5nLCBwb3M/OiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgcG9zICE9IHVuZGVmaW5lZCAmJlxyXG4gICAgICAgICAgICBwb3MgPj0gMCAmJlxyXG4gICAgICAgICAgICBwb3MgPD0gdGhpcy5jb250ZW50Lmxlbmd0aCAtIHRleHQubGVuZ3RoXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCA9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgcG9zKSArXHJcbiAgICAgICAgICAgICAgICB0ZXh0ICtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudC5zbGljZShwb3MgKyB0ZXh0Lmxlbmd0aCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1dExpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgKz0gdGV4dCArIFwiPGJyIC8+PiBcIjtcclxuICAgIH1cclxuXHJcbiAgICByZXNldCgpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5wdXQoXCI+IFwiKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGUodGV4dDogc3RyaW5nLCBwb3M/OiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnB1dCh0ZXh0LCBwb3MpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB3cml0ZUxpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5wdXRMaW5lKHRleHQpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5zY3JvbGwoMCwgdGhpcy5lbGVtZW50LnNjcm9sbEhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHJhbmRvbUNoYXJhY3RlcnMoY291bnQ6IG51bWJlcikge1xyXG4gICAgICAgIGxldCB2YWx1ZXMgPSBuZXcgVWludDhBcnJheShjb3VudCk7XHJcbiAgICAgICAgd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXModmFsdWVzKTtcclxuICAgICAgICBjb25zdCBtYXBwZWRWYWx1ZXMgPSB2YWx1ZXMubWFwKCh4KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGFkaiA9IHggJSAzNjtcclxuICAgICAgICAgICAgcmV0dXJuIGFkaiA8IDI2ID8gYWRqICsgNjUgOiBhZGogLSAyNiArIDQ4O1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBtYXBwZWRWYWx1ZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZpbGxSYW5kb20obGluZXM6IG51bWJlcikge1xyXG4gICAgICAgIHRoaXMuY2xlYXIoKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5wdXQodGhpcy5yYW5kb21DaGFyYWN0ZXJzKHRoaXMuY2hhcnNQZXJMaW5lKSk7XHJcbiAgICAgICAgICAgIHRoaXMucHV0KFwiPGJyIC8+XCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnB1dCh0aGlzLnJhbmRvbUNoYXJhY3RlcnModGhpcy5jaGFyc1BlckxpbmUpKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXRDdXJzb3JFbmFibGVkKHZhbHVlOiBib29sZWFuKSB7XHJcbiAgICAgICAgdGhpcy5jdXJzb3JFbmFibGVkID0gdmFsdWU7XHJcbiAgICAgICAgLy8gaWYgdGhlIGN1cnNvciBuZWVkZWQgdG8gYmUgdHVybmVkIG9mZiwgZml4IGl0XHJcbiAgICAgICAgaWYgKCF0aGlzLmN1cnNvckVuYWJsZWQgJiYgIXRoaXMuY3Vyc29yVmlzaWJsZSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgPSB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgLTEpO1xyXG4gICAgICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICAgICAgdGhpcy5jdXJzb3JWaXNpYmxlID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBmbGlwQ3Vyc29yKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnNvckVuYWJsZWQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY3Vyc29yVmlzaWJsZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50ICs9IFwiX1wiO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50ID0gdGhpcy5jb250ZW50LnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmN1cnNvclZpc2libGUgPSAhdGhpcy5jdXJzb3JWaXNpYmxlO1xyXG4gICAgICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgQnViYmxlcyBmcm9tIFwiLi9idWJibGVzXCI7XG5pbXBvcnQgR2FtZSBmcm9tIFwiLi9nYW1lXCI7XG5cbmxldCBnYW1lOiBHYW1lO1xuXG5sZXQgYnViYmxlczogQnViYmxlcztcblxubGV0IGxhc3RUaW1lOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxud2luZG93Lm9ubG9hZCA9ICgpID0+IHtcbiAgICBidWJibGVzID0gbmV3IEJ1YmJsZXMoXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmFja2dyb3VuZFwiKSBhcyBIVE1MQ2FudmFzRWxlbWVudFxuICAgICk7XG4gICAgZ2FtZSA9IG5ldyBHYW1lKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidGVybWluYWxcIikhKTtcblxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbn07XG5cbndpbmRvdy5vbnJlc2l6ZSA9ICgpID0+IHtcbiAgICBidWJibGVzLnJlc2l6ZSgpO1xuICAgIGdhbWUucmVzaXplKCk7XG59O1xuXG5kb2N1bWVudC5vbmtleWRvd24gPSAoZSkgPT4ge1xuICAgIGdhbWUua2V5ZG93bihlKTtcbn07XG5cbmRvY3VtZW50Lm9udmlzaWJpbGl0eWNoYW5nZSA9ICgpID0+IHtcbiAgICBpZiAoZG9jdW1lbnQudmlzaWJpbGl0eVN0YXRlID09IFwidmlzaWJsZVwiKSB7XG4gICAgICAgIGxhc3RUaW1lID0gbnVsbDtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgLy8gVGhpcyByZWFsbHkgc2hvdWxkbid0IGJlIG5lZWRlZCBpZiBicm93c2VycyBhcmUgZm9sbG93aW5nIGNvbnZlbnRpb24sXG4gICAgLy8gYnV0IGJldHRlciBzYWZlIHRoYW4gc29ycnlcbiAgICBpZiAoZG9jdW1lbnQuaGlkZGVuKSB7XG4gICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsYXN0VGltZSAhPSBudWxsKSB7XG4gICAgICAgIGxldCBkdCA9IHRpbWUgLSBsYXN0VGltZTtcblxuICAgICAgICBidWJibGVzLnVwZGF0ZShkdCk7XG4gICAgICAgIGdhbWUudXBkYXRlKGR0KTtcbiAgICB9XG5cbiAgICBsYXN0VGltZSA9IHRpbWU7XG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xufVxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9