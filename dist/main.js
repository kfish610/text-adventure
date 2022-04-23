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

module.exports = {"begin":{"text":"Connecting[delay 100].[delay 100].[delay 100].","options":[]}}

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
        for (var i = 0; i < 20; i++) {
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
        this.speed = 0.04;
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;
        this.size = 0;
        var v = Math.random();
        var hue = v < 0.5 ? 150 : 230;
        var sat = v < 0.5 ? 50 : 85;
        var light = v < 0.5 ? 25 : 40;
        this.color = "hsla(" + hue + ", " + sat + "%, " + light + "%, 40%)";
        this.lifetime = Math.pow(Math.random(), 5) * 8000 + 500;
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
            this.manager.setState(PlayingState);
        }
    };
    return WipeState;
}(_state__WEBPACK_IMPORTED_MODULE_0__["default"]));

var PlayingState = /** @class */ (function (_super) {
    __extends(PlayingState, _super);
    function PlayingState() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.story = __webpack_require__(/*! ./story.cson */ "./src/story.cson");
        _this.curr = "begin";
        _this.remainingText = _this.story["begin"].text;
        _this.delay = 0;
        return _this;
    }
    PlayingState.prototype.update = function (dt, term) {
        if (this.remainingText.length == 0)
            return;
        if (this.delay <= 0) {
            var commandPos = this.remainingText.indexOf("[");
            if (commandPos == 0) {
                var command = this.remainingText.substring(1, this.remainingText.indexOf("]"));
                var args = command.split(" ");
                if (args[0] == "delay") {
                    this.delay = parseInt(args[1]);
                    this.remainingText = this.remainingText.substring(this.remainingText.indexOf("]") + 1);
                }
                else if (args[0] == "enter") {
                    term.writeLine("");
                }
            }
            else {
                term.write(this.remainingText.substring(0, commandPos));
                this.remainingText = this.remainingText.substring(commandPos);
            }
        }
        else {
            this.delay -= dt;
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
        this.element.innerText = this.content;
    };
    Terminal.prototype.clear = function () {
        this.setCursorEnabled(false);
        this.content = "";
    };
    Terminal.prototype.put = function (text) {
        this.setCursorEnabled(false);
        this.content += text;
    };
    Terminal.prototype.putLine = function (text) {
        this.setCursorEnabled(false);
        this.content += text + "\n> ";
    };
    Terminal.prototype.reset = function () {
        this.clear();
        this.put("> ");
        this.show();
        this.setCursorEnabled(true);
    };
    Terminal.prototype.write = function (text) {
        this.put(text);
        this.show();
        this.setCursorEnabled(true);
    };
    Terminal.prototype.writeLine = function (text) {
        this.putLine(text);
        this.show();
        this.setCursorEnabled(true);
    };
    Terminal.prototype.fillRandom = function (lines) {
        this.clear();
        for (var i = 0; i < lines; i++) {
            this.put(this.randomCharacters(this.charsPerLine));
            this.put("\n");
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
    Terminal.prototype.randomCharacters = function (count) {
        var values = new Uint8Array(count);
        window.crypto.getRandomValues(values);
        var mappedValues = values.map(function (x) {
            var adj = x % 36;
            return adj < 26 ? adj + 65 : adj - 26 + 48;
        });
        return String.fromCharCode.apply(null, mappedValues);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxlQUFlLGtCQUFrQjtBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWEsYUFBYTtBQUMxQjtBQUNBO0FBQ0EsYUFBYSxRQUFRO0FBQ3JCO0FBQ0E7QUFDQSxhQUFhLFFBQVE7QUFDckI7QUFDQSwyQ0FBMkM7QUFDM0M7QUFDQSxhQUFhLFFBQVE7QUFDckI7QUFDQTtBQUNBLE1BQU0sc0JBQXNCO0FBQzVCO0FBQ0E7QUFDQTtBQUNBLGFBQWEsU0FBUztBQUN0Qix5REFBeUQ7QUFDekQ7QUFDQTtBQUNBLGFBQWEsU0FBUztBQUN0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWEsUUFBUTtBQUNyQjtBQUNBO0FBQ0E7QUFDQSxhQUFhLFFBQVE7QUFDckI7QUFDQTtBQUNBO0FBQ0EsYUFBYSxRQUFRO0FBQ3JCO0FBQ0E7QUFDQSxNQUFNLHlCQUF5QjtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQSxLQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGVBQWU7QUFDZjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSx1QkFBdUIsdUJBQXVCO0FBQzlDOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSxpQkFBaUIsUUFBUTtBQUN6QjtBQUNBLGtCQUFrQjtBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBa0I7QUFDbEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxrQkFBa0I7QUFDbEI7QUFDQTtBQUNBLGtCQUFrQjtBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87O0FBRVA7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLGVBQWU7QUFDZjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxlQUFlLDRCQUE0QjtBQUMzQztBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxRQUFRO0FBQ1I7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFXO0FBQ1gsV0FBVztBQUNYO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWTs7QUFFWjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsOEJBQThCLGtCQUFrQjtBQUNoRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0EsZUFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVksd0JBQXdCOztBQUVwQztBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBVyxRQUFRO0FBQ25CO0FBQ0E7QUFDQSxXQUFXLFFBQVE7QUFDbkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRWdDOzs7Ozs7Ozs7OztBQ3BaaEMsa0JBQWtCLFNBQVM7Ozs7Ozs7Ozs7Ozs7OztBQ0EzQjtJQUlJLGlCQUFZLE1BQXlCO1FBRnJDLFlBQU8sR0FBa0IsRUFBRSxDQUFDO1FBR3hCLElBQUksQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUUsQ0FBQztRQUNwQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFFZCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNuQztJQUNMLENBQUM7SUFFRCx3QkFBTSxHQUFOLFVBQU8sRUFBVTtRQUNiLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXhFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUMxQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLEVBQUU7Z0JBQzVELElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO2FBQy9CO1lBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDM0IsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUU7Z0JBQzNCLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxNQUFNLEVBQUUsQ0FBQzthQUNsQztpQkFBTTtnQkFDSCxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDbEM7U0FDSjtJQUNMLENBQUM7SUFFRCx3QkFBTSxHQUFOO1FBQ0ksSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixJQUFJLENBQUMsQ0FBQztRQUN2QyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBRW5ELElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQztRQUN6QyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7UUFFM0MsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRXpCLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztJQUNuQyxDQUFDO0lBQ0wsY0FBQztBQUFELENBQUM7O0FBRUQ7SUFRSTtRQUNJLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBRWxCLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDM0MsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQztRQUU1QyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUVkLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUN0QixJQUFJLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUM5QixJQUFJLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUM1QixJQUFJLEtBQUssR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUM5QixJQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sR0FBRyxHQUFHLEdBQUcsSUFBSSxHQUFHLEdBQUcsR0FBRyxLQUFLLEdBQUcsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUVwRSxJQUFJLENBQUMsUUFBUSxHQUFHLGFBQUksQ0FBQyxNQUFNLEVBQUUsRUFBSSxDQUFDLElBQUcsSUFBSSxHQUFHLEdBQUcsQ0FBQztJQUNwRCxDQUFDO0lBRUQsdUJBQU0sR0FBTixVQUFPLEVBQVU7UUFDYixJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQzdCLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxxQkFBSSxHQUFKLFVBQUssR0FBNkI7UUFDOUIsR0FBRyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQzNCLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNoQixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNmLENBQUM7SUFDTCxhQUFDO0FBQUQsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQy9FaUM7QUFDUztBQUNMO0FBRXRDO0lBSUksY0FBWSxRQUFxQjtRQUM3QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksaURBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksc0RBQVksQ0FBQywrQ0FBVSxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVELHFCQUFNLEdBQU4sVUFBTyxFQUFVO1FBQ2IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRUQscUJBQU0sR0FBTjtRQUNJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVELHNCQUFPLEdBQVAsVUFBUSxDQUFnQjtRQUNwQixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QixDQUFDO0lBQ0wsV0FBQztBQUFELENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDdkJEO0lBR0ksZUFBWSxPQUFxQjtRQUM3QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztJQUMzQixDQUFDO0lBRUQsb0JBQUksR0FBSixVQUFLLElBQWMsSUFBRyxDQUFDO0lBRXZCLHNCQUFNLEdBQU4sVUFBTyxFQUFVLEVBQUUsSUFBYyxJQUFHLENBQUM7SUFFckMsdUJBQU8sR0FBUCxVQUFRLENBQWdCLElBQUcsQ0FBQztJQUNoQyxZQUFDO0FBQUQsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNaRDtJQUlJLHNCQUFZLENBQWlDO1FBRjdDLGNBQVMsR0FBRyxJQUFJLENBQUM7UUFHYixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRCwrQkFBUSxHQUFSLFVBQVMsQ0FBaUM7UUFDdEMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztJQUMxQixDQUFDO0lBRUQsNkJBQU0sR0FBTixVQUFPLEVBQVUsRUFBRSxJQUFjO1FBQzdCLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNoQixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0QixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztTQUMxQjtRQUVELElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsOEJBQU8sR0FBUCxVQUFRLENBQWdCO1FBQ3BCLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFCLENBQUM7SUFDTCxtQkFBQztBQUFELENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDNUIyQjtBQUc1QjtJQUFnQyw4QkFBSztJQUFyQzs7SUFRQSxDQUFDO0lBUFkseUJBQUksR0FBYixVQUFjLElBQWM7UUFDeEIsSUFBSSxDQUFDLFNBQVMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFUSw0QkFBTyxHQUFoQixVQUFpQixDQUFnQjtRQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBQ0wsaUJBQUM7QUFBRCxDQUFDLENBUitCLDhDQUFLLEdBUXBDOztBQUVEO0lBQStCLDZCQUFLO0lBQXBDO1FBQUEscUVBOEJDO1FBN0JXLGVBQVMsR0FBRyxDQUFDLENBQUM7UUFDZCxlQUFTLEdBQUcsQ0FBQyxDQUFDOztJQTRCMUIsQ0FBQztJQXpCWSx3QkFBSSxHQUFiLFVBQWMsSUFBYztRQUN4QixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUNuQyxDQUFDO0lBRVEsMEJBQU0sR0FBZixVQUFnQixFQUFVLEVBQUUsSUFBYztRQUN0QyxJQUFJLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxFQUFFO1lBQ3JCLElBQUksSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3BCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQzthQUNwQjtpQkFBTTtnQkFDSCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7YUFDcEI7WUFFRCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUVoQyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztTQUN0QjtRQUVELElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUU7WUFDckIsSUFBSSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUM7U0FDeEI7YUFBTTtZQUNILElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNiLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO1NBQ3ZDO0lBQ0wsQ0FBQztJQUNMLGdCQUFDO0FBQUQsQ0FBQyxDQTlCOEIsOENBQUssR0E4Qm5DOztBQWFEO0lBQWtDLGdDQUFLO0lBQXZDO1FBQUEscUVBcUNDO1FBcENHLFdBQUssR0FBMEIsbUJBQU8sQ0FBQyxzQ0FBYyxDQUFDLENBQUM7UUFFdkQsVUFBSSxHQUFHLE9BQU8sQ0FBQztRQUVmLG1CQUFhLEdBQUcsS0FBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFFekMsV0FBSyxHQUFHLENBQUMsQ0FBQzs7SUE4QmQsQ0FBQztJQTVCWSw2QkFBTSxHQUFmLFVBQWdCLEVBQVUsRUFBRSxJQUFjO1FBQ3RDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLElBQUksQ0FBQztZQUFFLE9BQU87UUFFM0MsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsRUFBRTtZQUNqQixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNqRCxJQUFJLFVBQVUsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pCLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUN0QyxDQUFDLEVBQ0QsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQ2xDLENBQUM7Z0JBQ0YsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFFOUIsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxFQUFFO29CQUNwQixJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FDN0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUN0QyxDQUFDO2lCQUNMO3FCQUFNLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sRUFBRTtvQkFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztpQkFDdEI7YUFDSjtpQkFBTTtnQkFDSCxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ2pFO1NBQ0o7YUFBTTtZQUNILElBQUksQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1NBQ3BCO0lBQ0wsQ0FBQztJQUNMLG1CQUFDO0FBQUQsQ0FBQyxDQXJDaUMsOENBQUssR0FxQ3RDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUM3RndDO0FBRXpDLElBQU0scUJBQXFCLEdBQUcsR0FBRyxDQUFDO0FBRWxDO0lBaUJJLGtCQUFZLElBQWlCO1FBTjdCLFlBQU8sR0FBRyxJQUFJLENBQUM7UUFFUCxrQkFBYSxHQUFHLElBQUksQ0FBQztRQUNyQixrQkFBYSxHQUFHLElBQUksQ0FBQztRQUNyQixnQkFBVyxHQUFHLENBQUMsQ0FBQztRQUdwQixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUVwQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FDcEIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ3ZELENBQUM7UUFDRixJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FDakIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ3BELENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FDbEIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQ3JELENBQUM7UUFFRixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO1FBQ3pDLElBQU0sS0FBSyxHQUFHLElBQUksd0RBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztRQUNwRSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO1FBRWpDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQseUJBQU0sR0FBTjtRQUNJLElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUNqQixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FDcEQsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUNsQixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FDckQsQ0FBQztRQUVGLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQseUJBQU0sR0FBTixVQUFPLEVBQVU7UUFDYixJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUU7WUFDcEIsSUFBSSxJQUFJLENBQUMsV0FBVyxJQUFJLHFCQUFxQixFQUFFO2dCQUMzQyxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztnQkFDckIsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2FBQ3JCO2lCQUFNO2dCQUNILElBQUksQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDO2FBQzFCO1NBQ0o7SUFDTCxDQUFDO0lBRUQsdUJBQUksR0FBSjtRQUNJLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDMUMsQ0FBQztJQUVELHdCQUFLLEdBQUw7UUFDSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDdEIsQ0FBQztJQUVELHNCQUFHLEdBQUgsVUFBSSxJQUFZO1FBQ1osSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDO0lBQ3pCLENBQUM7SUFFRCwwQkFBTyxHQUFQLFVBQVEsSUFBWTtRQUNoQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDO0lBQ2xDLENBQUM7SUFFRCx3QkFBSyxHQUFMO1FBQ0ksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNaLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsd0JBQUssR0FBTCxVQUFNLElBQVk7UUFDZCxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1osSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFRCw0QkFBUyxHQUFULFVBQVUsSUFBWTtRQUNsQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNaLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsNkJBQVUsR0FBVixVQUFXLEtBQWE7UUFDcEIsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM1QixJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUNuRCxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2xCO1FBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxtQ0FBZ0IsR0FBaEIsVUFBaUIsS0FBYztRQUMzQixJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQztRQUMzQixnREFBZ0Q7UUFDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQzVDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7U0FDN0I7SUFDTCxDQUFDO0lBRU8sNkJBQVUsR0FBbEI7UUFDSSxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUU7WUFDcEIsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUNwQixJQUFJLENBQUMsT0FBTyxJQUFJLEdBQUcsQ0FBQzthQUN2QjtpQkFBTTtnQkFDSCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzVDO1lBQ0QsSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDekMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1NBQ2Y7SUFDTCxDQUFDO0lBRU8sbUNBQWdCLEdBQXhCLFVBQXlCLEtBQWE7UUFDbEMsSUFBSSxNQUFNLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsSUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFDLENBQUM7WUFDOUIsSUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNuQixPQUFPLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxNQUFNLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUNMLGVBQUM7QUFBRCxDQUFDOzs7Ozs7OztVQ2xKRDtVQUNBOztVQUVBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBOzs7OztXQ3RCQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLHlDQUF5Qyx3Q0FBd0M7V0FDakY7V0FDQTtXQUNBOzs7OztXQ1BBOzs7OztXQ0FBO1dBQ0E7V0FDQTtXQUNBLHVEQUF1RCxpQkFBaUI7V0FDeEU7V0FDQSxnREFBZ0QsYUFBYTtXQUM3RDs7Ozs7Ozs7Ozs7Ozs7QUNOZ0M7QUFDTjtBQUUxQixJQUFJLElBQVUsQ0FBQztBQUVmLElBQUksT0FBZ0IsQ0FBQztBQUVyQixJQUFJLFFBQVEsR0FBa0IsSUFBSSxDQUFDO0FBRW5DLE1BQU0sQ0FBQyxNQUFNLEdBQUc7SUFDWixPQUFPLEdBQUcsSUFBSSxnREFBTyxDQUNqQixRQUFRLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBc0IsQ0FDN0QsQ0FBQztJQUNGLElBQUksR0FBRyxJQUFJLDZDQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUUsQ0FBQyxDQUFDO0lBRXRELE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUM7QUFFRixNQUFNLENBQUMsUUFBUSxHQUFHO0lBQ2QsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ2pCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUNsQixDQUFDLENBQUM7QUFFRixRQUFRLENBQUMsU0FBUyxHQUFHLFVBQUMsQ0FBQztJQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLENBQUMsQ0FBQztBQUVGLFFBQVEsQ0FBQyxrQkFBa0IsR0FBRztJQUMxQixJQUFJLFFBQVEsQ0FBQyxlQUFlLElBQUksU0FBUyxFQUFFO1FBQ3ZDLFFBQVEsR0FBRyxJQUFJLENBQUM7S0FDbkI7QUFDTCxDQUFDLENBQUM7QUFFRixTQUFTLE1BQU0sQ0FBQyxJQUFZO0lBQ3hCLHdFQUF3RTtJQUN4RSw2QkFBNkI7SUFDN0IsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQ2pCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyQyxPQUFPO0tBQ1Y7SUFFRCxJQUFJLFFBQVEsSUFBSSxJQUFJLEVBQUU7UUFDbEIsSUFBSSxFQUFFLEdBQUcsSUFBSSxHQUFHLFFBQVEsQ0FBQztRQUV6QixPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDbkI7SUFFRCxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ2hCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9ub2RlX21vZHVsZXMvQHR2YW5jL2xpbmVjbGFtcC9kaXN0L2VzbS5qcyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdG9yeS5jc29uIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2J1YmJsZXMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvZ2FtZS50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdGF0ZS50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdGF0ZV9tYW5hZ2VyLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlcy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy90ZXJtaW5hbC50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVkdWNlcyBmb250IHNpemUgb3IgdHJpbXMgdGV4dCB0byBtYWtlIGl0IGZpdCB3aXRoaW4gc3BlY2lmaWVkIGJvdW5kcy5cbiAqXG4gKiBTdXBwb3J0cyBjbGFtcGluZyBieSBudW1iZXIgb2YgbGluZXMgb3IgdGV4dCBoZWlnaHQuXG4gKlxuICogS25vd24gbGltaXRhdGlvbnM6XG4gKiAxLiBDaGFyYWN0ZXJzIHRoYXQgZGlzdG9ydCBsaW5lIGhlaWdodHMgKGVtb2ppcywgemFsZ28pIG1heSBjYXVzZVxuICogdW5leHBlY3RlZCByZXN1bHRzLlxuICogMi4gQ2FsbGluZyB7QHNlZSBoYXJkQ2xhbXAoKX0gd2lwZXMgY2hpbGQgZWxlbWVudHMuIEZ1dHVyZSB1cGRhdGVzIG1heSBhbGxvd1xuICogaW5saW5lIGNoaWxkIGVsZW1lbnRzIHRvIGJlIHByZXNlcnZlZC5cbiAqXG4gKiBAdG9kbyBTcGxpdCB0ZXh0IG1ldHJpY3MgaW50byBvd24gbGlicmFyeVxuICogQHRvZG8gVGVzdCBub24tTFRSIHRleHRcbiAqL1xuY2xhc3MgTGluZUNsYW1wIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnRcbiAgICogVGhlIGVsZW1lbnQgdG8gY2xhbXAuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogT3B0aW9ucyB0byBnb3Zlcm4gY2xhbXBpbmcgYmVoYXZpb3IuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhMaW5lc11cbiAgICogVGhlIG1heGltdW0gbnVtYmVyIG9mIGxpbmVzIHRvIGFsbG93LiBEZWZhdWx0cyB0byAxLlxuICAgKiBUbyBzZXQgYSBtYXhpbXVtIGhlaWdodCBpbnN0ZWFkLCB1c2Uge0BzZWUgb3B0aW9ucy5tYXhIZWlnaHR9XG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhIZWlnaHRdXG4gICAqIFRoZSBtYXhpbXVtIGhlaWdodCAoaW4gcGl4ZWxzKSBvZiB0ZXh0IGluIGFuIGVsZW1lbnQuXG4gICAqIFRoaXMgb3B0aW9uIGlzIHVuZGVmaW5lZCBieSBkZWZhdWx0LiBPbmNlIHNldCwgaXQgdGFrZXMgcHJlY2VkZW5jZSBvdmVyXG4gICAqIHtAc2VlIG9wdGlvbnMubWF4TGluZXN9LiBOb3RlIHRoYXQgdGhpcyBhcHBsaWVzIHRvIHRoZSBoZWlnaHQgb2YgdGhlIHRleHQsIG5vdFxuICAgKiB0aGUgZWxlbWVudCBpdHNlbGYuIFJlc3RyaWN0aW5nIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgY2FuIGJlIGFjaGlldmVkXG4gICAqIHdpdGggQ1NTIDxjb2RlPm1heC1oZWlnaHQ8L2NvZGU+LlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnVzZVNvZnRDbGFtcF1cbiAgICogSWYgdHJ1ZSwgcmVkdWNlIGZvbnQgc2l6ZSAoc29mdCBjbGFtcCkgdG8gYXQgbGVhc3Qge0BzZWUgb3B0aW9ucy5taW5Gb250U2l6ZX1cbiAgICogYmVmb3JlIHJlc29ydGluZyB0byB0cmltbWluZyB0ZXh0LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICpcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5oYXJkQ2xhbXBBc0ZhbGxiYWNrXVxuICAgKiBJZiB0cnVlLCByZXNvcnQgdG8gaGFyZCBjbGFtcGluZyBpZiBzb2Z0IGNsYW1waW5nIHJlYWNoZXMgdGhlIG1pbmltdW0gZm9udCBzaXplXG4gICAqIGFuZCBzdGlsbCBkb2Vzbid0IGZpdCB3aXRoaW4gdGhlIG1heCBoZWlnaHQgb3IgbnVtYmVyIG9mIGxpbmVzLlxuICAgKiBEZWZhdWx0cyB0byB0cnVlLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZWxsaXBzaXNdXG4gICAqIFRoZSBjaGFyYWN0ZXIgd2l0aCB3aGljaCB0byByZXByZXNlbnQgY2xpcHBlZCB0cmFpbGluZyB0ZXh0LlxuICAgKiBUaGlzIG9wdGlvbiB0YWtlcyBlZmZlY3Qgd2hlbiBcImhhcmRcIiBjbGFtcGluZyBpcyB1c2VkLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWluRm9udFNpemVdXG4gICAqIFRoZSBsb3dlc3QgZm9udCBzaXplLCBpbiBwaXhlbHMsIHRvIHRyeSBiZWZvcmUgcmVzb3J0aW5nIHRvIHJlbW92aW5nXG4gICAqIHRyYWlsaW5nIHRleHQgKGhhcmQgY2xhbXBpbmcpLiBEZWZhdWx0cyB0byAxLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4Rm9udFNpemVdXG4gICAqIFRoZSBtYXhpbXVtIGZvbnQgc2l6ZSBpbiBwaXhlbHMuIFdlJ2xsIHN0YXJ0IHdpdGggdGhpcyBmb250IHNpemUgdGhlblxuICAgKiByZWR1Y2UgdW50aWwgdGV4dCBmaXRzIGNvbnN0cmFpbnRzLCBvciBmb250IHNpemUgaXMgZXF1YWwgdG9cbiAgICoge0BzZWUgb3B0aW9ucy5taW5Gb250U2l6ZX0uIERlZmF1bHRzIHRvIHRoZSBlbGVtZW50J3MgaW5pdGlhbCBjb21wdXRlZCBmb250IHNpemUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbGVtZW50LFxuICAgIHtcbiAgICAgIG1heExpbmVzID0gdW5kZWZpbmVkLFxuICAgICAgbWF4SGVpZ2h0ID0gdW5kZWZpbmVkLFxuICAgICAgdXNlU29mdENsYW1wID0gZmFsc2UsXG4gICAgICBoYXJkQ2xhbXBBc0ZhbGxiYWNrID0gdHJ1ZSxcbiAgICAgIG1pbkZvbnRTaXplID0gMSxcbiAgICAgIG1heEZvbnRTaXplID0gdW5kZWZpbmVkLFxuICAgICAgZWxsaXBzaXMgPSBcIuKAplwiLFxuICAgIH0gPSB7fVxuICApIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJvcmlnaW5hbFdvcmRzXCIsIHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiBlbGVtZW50LnRleHRDb250ZW50Lm1hdGNoKC9cXFMrXFxzKi9nKSB8fCBbXSxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInVwZGF0ZUhhbmRsZXJcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6ICgpID0+IHRoaXMuYXBwbHkoKSxcbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm9ic2VydmVyXCIsIHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiBuZXcgTXV0YXRpb25PYnNlcnZlcih0aGlzLnVwZGF0ZUhhbmRsZXIpLFxuICAgIH0pO1xuXG4gICAgaWYgKHVuZGVmaW5lZCA9PT0gbWF4Rm9udFNpemUpIHtcbiAgICAgIG1heEZvbnRTaXplID0gcGFyc2VJbnQod2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkuZm9udFNpemUsIDEwKTtcbiAgICB9XG5cbiAgICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xuICAgIHRoaXMubWF4TGluZXMgPSBtYXhMaW5lcztcbiAgICB0aGlzLm1heEhlaWdodCA9IG1heEhlaWdodDtcbiAgICB0aGlzLnVzZVNvZnRDbGFtcCA9IHVzZVNvZnRDbGFtcDtcbiAgICB0aGlzLmhhcmRDbGFtcEFzRmFsbGJhY2sgPSBoYXJkQ2xhbXBBc0ZhbGxiYWNrO1xuICAgIHRoaXMubWluRm9udFNpemUgPSBtaW5Gb250U2l6ZTtcbiAgICB0aGlzLm1heEZvbnRTaXplID0gbWF4Rm9udFNpemU7XG4gICAgdGhpcy5lbGxpcHNpcyA9IGVsbGlwc2lzO1xuICB9XG5cbiAgLyoqXG4gICAqIEdhdGhlciBtZXRyaWNzIGFib3V0IHRoZSBsYXlvdXQgb2YgdGhlIGVsZW1lbnQncyB0ZXh0LlxuICAgKiBUaGlzIGlzIGEgc29tZXdoYXQgZXhwZW5zaXZlIG9wZXJhdGlvbiAtIGNhbGwgd2l0aCBjYXJlLlxuICAgKlxuICAgKiBAcmV0dXJucyB7VGV4dE1ldHJpY3N9XG4gICAqIExheW91dCBtZXRyaWNzIGZvciB0aGUgY2xhbXBlZCBlbGVtZW50J3MgdGV4dC5cbiAgICovXG4gIGNhbGN1bGF0ZVRleHRNZXRyaWNzKCkge1xuICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmVsZW1lbnQ7XG4gICAgY29uc3QgY2xvbmUgPSBlbGVtZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICBjb25zdCBzdHlsZSA9IGNsb25lLnN0eWxlO1xuXG4gICAgLy8gQXBwZW5kLCBkb24ndCByZXBsYWNlXG4gICAgc3R5bGUuY3NzVGV4dCArPSBcIjttaW4taGVpZ2h0OjAhaW1wb3J0YW50O21heC1oZWlnaHQ6bm9uZSFpbXBvcnRhbnRcIjtcbiAgICBlbGVtZW50LnJlcGxhY2VXaXRoKGNsb25lKTtcblxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG5cbiAgICAvLyBDbGVhciB0byBtZWFzdXJlIGVtcHR5IGhlaWdodC4gdGV4dENvbnRlbnQgZmFzdGVyIHRoYW4gaW5uZXJIVE1MXG4gICAgY2xvbmUudGV4dENvbnRlbnQgPSBcIlwiO1xuXG4gICAgY29uc3QgbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0ID0gY2xvbmUub2Zmc2V0SGVpZ2h0O1xuICAgIGNvbnN0IHRleHRIZWlnaHQgPSBuYXR1cmFsSGVpZ2h0IC0gbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0O1xuXG4gICAgLy8gRmlsbCBlbGVtZW50IHdpdGggc2luZ2xlIG5vbi1icmVha2luZyBzcGFjZSB0byBmaW5kIGhlaWdodCBvZiBvbmUgbGluZVxuICAgIGNsb25lLnRleHRDb250ZW50ID0gXCJcXHhhMFwiO1xuXG4gICAgLy8gR2V0IGhlaWdodCBvZiBlbGVtZW50IHdpdGggb25seSBvbmUgbGluZSBvZiB0ZXh0XG4gICAgY29uc3QgbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lID0gY2xvbmUub2Zmc2V0SGVpZ2h0O1xuICAgIGNvbnN0IGZpcnN0TGluZUhlaWdodCA9IG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSAtIG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dDtcblxuICAgIC8vIEFkZCBsaW5lICg8YnI+ICsgbmJzcCkuIGFwcGVuZENoaWxkKCkgZmFzdGVyIHRoYW4gaW5uZXJIVE1MXG4gICAgY2xvbmUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJyXCIpKTtcbiAgICBjbG9uZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlxceGEwXCIpKTtcblxuICAgIGNvbnN0IGFkZGl0aW9uYWxMaW5lSGVpZ2h0ID0gY2xvbmUub2Zmc2V0SGVpZ2h0IC0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lO1xuICAgIGNvbnN0IGxpbmVDb3VudCA9XG4gICAgICAxICsgKG5hdHVyYWxIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUpIC8gYWRkaXRpb25hbExpbmVIZWlnaHQ7XG5cbiAgICAvLyBSZXN0b3JlIG9yaWdpbmFsIGNvbnRlbnRcbiAgICBjbG9uZS5yZXBsYWNlV2l0aChlbGVtZW50KTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlZGVmIHtPYmplY3R9IFRleHRNZXRyaWNzXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge3RleHRIZWlnaHR9XG4gICAgICogVGhlIHZlcnRpY2FsIHNwYWNlIHJlcXVpcmVkIHRvIGRpc3BsYXkgdGhlIGVsZW1lbnQncyBjdXJyZW50IHRleHQuXG4gICAgICogVGhpcyBpcyA8ZW0+bm90PC9lbT4gbmVjZXNzYXJpbHkgdGhlIHNhbWUgYXMgdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudC5cbiAgICAgKiBUaGlzIG51bWJlciBtYXkgZXZlbiBiZSBncmVhdGVyIHRoYW4gdGhlIGVsZW1lbnQncyBoZWlnaHQgaW4gY2FzZXNcbiAgICAgKiB3aGVyZSB0aGUgdGV4dCBvdmVyZmxvd3MgdGhlIGVsZW1lbnQncyBibG9jayBheGlzLlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmV9XG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCB3aXRoIG9ubHkgb25lIGxpbmUgb2YgdGV4dCBhbmQgd2l0aG91dFxuICAgICAqIG1pbmltdW0gb3IgbWF4aW11bSBoZWlnaHRzLiBUaGlzIGluZm9ybWF0aW9uIG1heSBiZSBoZWxwZnVsIHdoZW5cbiAgICAgKiBkZWFsaW5nIHdpdGggaW5saW5lIGVsZW1lbnRzIChhbmQgcG90ZW50aWFsbHkgb3RoZXIgc2NlbmFyaW9zKSwgd2hlcmVcbiAgICAgKiB0aGUgZmlyc3QgbGluZSBvZiB0ZXh0IGRvZXMgbm90IGluY3JlYXNlIHRoZSBlbGVtZW50J3MgaGVpZ2h0LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtmaXJzdExpbmVIZWlnaHR9XG4gICAgICogVGhlIGhlaWdodCB0aGF0IHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgYWRkcyB0byB0aGUgZWxlbWVudCwgaS5lLiwgdGhlXG4gICAgICogZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgd2hpbGUgZW1wdHkgYW5kIHRoZSBoZWlnaHRcbiAgICAgKiBvZiB0aGUgZWxlbWVudCB3aGlsZSBpdCBjb250YWlucyBvbmUgbGluZSBvZiB0ZXh0LiBUaGlzIG51bWJlciBtYXkgYmVcbiAgICAgKiB6ZXJvIGZvciBpbmxpbmUgZWxlbWVudHMgYmVjYXVzZSB0aGUgZmlyc3QgbGluZSBvZiB0ZXh0IGRvZXMgbm90XG4gICAgICogaW5jcmVhc2UgdGhlIGhlaWdodCBvZiBpbmxpbmUgZWxlbWVudHMuXG5cbiAgICAgKiBAcHJvcGVydHkge2FkZGl0aW9uYWxMaW5lSGVpZ2h0fVxuICAgICAqIFRoZSBoZWlnaHQgdGhhdCBlYWNoIGxpbmUgb2YgdGV4dCBhZnRlciB0aGUgZmlyc3QgYWRkcyB0byB0aGUgZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7bGluZUNvdW50fVxuICAgICAqIFRoZSBudW1iZXIgb2YgbGluZXMgb2YgdGV4dCB0aGUgZWxlbWVudCBjb250YWlucy5cbiAgICAgKi9cbiAgICByZXR1cm4ge1xuICAgICAgdGV4dEhlaWdodCxcbiAgICAgIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSxcbiAgICAgIGZpcnN0TGluZUhlaWdodCxcbiAgICAgIGFkZGl0aW9uYWxMaW5lSGVpZ2h0LFxuICAgICAgbGluZUNvdW50LFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXYXRjaCBmb3IgY2hhbmdlcyB0aGF0IG1heSBhZmZlY3QgbGF5b3V0LiBSZXNwb25kIGJ5IHJlY2xhbXBpbmcgaWZcbiAgICogbmVjZXNzYXJ5LlxuICAgKi9cbiAgd2F0Y2goKSB7XG4gICAgaWYgKCF0aGlzLl93YXRjaGluZykge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy51cGRhdGVIYW5kbGVyKTtcblxuICAgICAgLy8gTWluaW11bSByZXF1aXJlZCB0byBkZXRlY3QgY2hhbmdlcyB0byB0ZXh0IG5vZGVzLFxuICAgICAgLy8gYW5kIHdob2xlc2FsZSByZXBsYWNlbWVudCB2aWEgaW5uZXJIVE1MXG4gICAgICB0aGlzLm9ic2VydmVyLm9ic2VydmUodGhpcy5lbGVtZW50LCB7XG4gICAgICAgIGNoYXJhY3RlckRhdGE6IHRydWUsXG4gICAgICAgIHN1YnRyZWU6IHRydWUsXG4gICAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICAgICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl93YXRjaGluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wIHdhdGNoaW5nIGZvciBsYXlvdXQgY2hhbmdlcy5cbiAgICpcbiAgICogQHJldHVybnMge0xpbmVDbGFtcH1cbiAgICovXG4gIHVud2F0Y2goKSB7XG4gICAgdGhpcy5vYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy51cGRhdGVIYW5kbGVyKTtcblxuICAgIHRoaXMuX3dhdGNoaW5nID0gZmFsc2U7XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIENvbmR1Y3QgZWl0aGVyIHNvZnQgY2xhbXBpbmcgb3IgaGFyZCBjbGFtcGluZywgYWNjb3JkaW5nIHRvIHRoZSB2YWx1ZSBvZlxuICAgKiBwcm9wZXJ0eSB7QHNlZSBMaW5lQ2xhbXAudXNlU29mdENsYW1wfS5cbiAgICovXG4gIGFwcGx5KCkge1xuICAgIGlmICh0aGlzLmVsZW1lbnQub2Zmc2V0SGVpZ2h0KSB7XG4gICAgICBjb25zdCBwcmV2aW91c2x5V2F0Y2hpbmcgPSB0aGlzLl93YXRjaGluZztcblxuICAgICAgLy8gSWdub3JlIGludGVybmFsbHkgc3RhcnRlZCBtdXRhdGlvbnMsIGxlc3Qgd2UgcmVjdXJzZSBpbnRvIG9ibGl2aW9uXG4gICAgICB0aGlzLnVud2F0Y2goKTtcblxuICAgICAgdGhpcy5lbGVtZW50LnRleHRDb250ZW50ID0gdGhpcy5vcmlnaW5hbFdvcmRzLmpvaW4oXCJcIik7XG5cbiAgICAgIGlmICh0aGlzLnVzZVNvZnRDbGFtcCkge1xuICAgICAgICB0aGlzLnNvZnRDbGFtcCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5oYXJkQ2xhbXAoKTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVzdW1lIG9ic2VydmF0aW9uIGlmIHByZXZpb3VzbHkgd2F0Y2hpbmdcbiAgICAgIGlmIChwcmV2aW91c2x5V2F0Y2hpbmcpIHtcbiAgICAgICAgdGhpcy53YXRjaChmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmltcyB0ZXh0IHVudGlsIGl0IGZpdHMgd2l0aGluIGNvbnN0cmFpbnRzXG4gICAqIChtYXhpbXVtIGhlaWdodCBvciBudW1iZXIgb2YgbGluZXMpLlxuICAgKlxuICAgKiBAc2VlIHtMaW5lQ2xhbXAubWF4TGluZXN9XG4gICAqIEBzZWUge0xpbmVDbGFtcC5tYXhIZWlnaHR9XG4gICAqL1xuICBoYXJkQ2xhbXAoc2tpcENoZWNrID0gdHJ1ZSkge1xuICAgIGlmIChza2lwQ2hlY2sgfHwgdGhpcy5zaG91bGRDbGFtcCgpKSB7XG4gICAgICBsZXQgY3VycmVudFRleHQ7XG5cbiAgICAgIGZpbmRCb3VuZGFyeShcbiAgICAgICAgMSxcbiAgICAgICAgdGhpcy5vcmlnaW5hbFdvcmRzLmxlbmd0aCxcbiAgICAgICAgKHZhbCkgPT4ge1xuICAgICAgICAgIGN1cnJlbnRUZXh0ID0gdGhpcy5vcmlnaW5hbFdvcmRzLnNsaWNlKDAsIHZhbCkuam9pbihcIiBcIik7XG4gICAgICAgICAgdGhpcy5lbGVtZW50LnRleHRDb250ZW50ID0gY3VycmVudFRleHQ7XG5cbiAgICAgICAgICByZXR1cm4gdGhpcy5zaG91bGRDbGFtcCgpXG4gICAgICAgIH0sXG4gICAgICAgICh2YWwsIG1pbiwgbWF4KSA9PiB7XG4gICAgICAgICAgLy8gQWRkIG9uZSBtb3JlIHdvcmQgaWYgbm90IG9uIG1heFxuICAgICAgICAgIGlmICh2YWwgPiBtaW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRUZXh0ID0gdGhpcy5vcmlnaW5hbFdvcmRzLnNsaWNlKDAsIG1heCkuam9pbihcIiBcIik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVGhlbiB0cmltIGxldHRlcnMgdW50aWwgaXQgZml0c1xuICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgIGN1cnJlbnRUZXh0ID0gY3VycmVudFRleHQuc2xpY2UoMCwgLTEpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnRleHRDb250ZW50ID0gY3VycmVudFRleHQgKyB0aGlzLmVsbGlwc2lzO1xuICAgICAgICAgIH0gd2hpbGUgKHRoaXMuc2hvdWxkQ2xhbXAoKSlcblxuICAgICAgICAgIC8vIEJyb2FkY2FzdCBtb3JlIHNwZWNpZmljIGhhcmRDbGFtcCBldmVudCBmaXJzdFxuICAgICAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuaGFyZGNsYW1wXCIpO1xuICAgICAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuY2xhbXBcIik7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWR1Y2VzIGZvbnQgc2l6ZSB1bnRpbCB0ZXh0IGZpdHMgd2l0aGluIHRoZSBzcGVjaWZpZWQgaGVpZ2h0IG9yIG51bWJlciBvZlxuICAgKiBsaW5lcy4gUmVzb3J0cyB0byB1c2luZyB7QHNlZSBoYXJkQ2xhbXAoKX0gaWYgdGV4dCBzdGlsbCBleGNlZWRzIGNsYW1wXG4gICAqIHBhcmFtZXRlcnMuXG4gICAqL1xuICBzb2Z0Q2xhbXAoKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB0aGlzLmVsZW1lbnQuc3R5bGU7XG4gICAgY29uc3Qgc3RhcnRTaXplID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5mb250U2l6ZTtcbiAgICBzdHlsZS5mb250U2l6ZSA9IFwiXCI7XG5cbiAgICBsZXQgZG9uZSA9IGZhbHNlO1xuICAgIGxldCBzaG91bGRDbGFtcDtcblxuICAgIGZpbmRCb3VuZGFyeShcbiAgICAgIHRoaXMubWluRm9udFNpemUsXG4gICAgICB0aGlzLm1heEZvbnRTaXplLFxuICAgICAgKHZhbCkgPT4ge1xuICAgICAgICBzdHlsZS5mb250U2l6ZSA9IHZhbCArIFwicHhcIjtcbiAgICAgICAgc2hvdWxkQ2xhbXAgPSB0aGlzLnNob3VsZENsYW1wKCk7XG4gICAgICAgIHJldHVybiBzaG91bGRDbGFtcFxuICAgICAgfSxcbiAgICAgICh2YWwsIG1pbikgPT4ge1xuICAgICAgICBpZiAodmFsID4gbWluKSB7XG4gICAgICAgICAgc3R5bGUuZm9udFNpemUgPSBtaW4gKyBcInB4XCI7XG4gICAgICAgICAgc2hvdWxkQ2xhbXAgPSB0aGlzLnNob3VsZENsYW1wKCk7XG4gICAgICAgIH1cbiAgICAgICAgZG9uZSA9ICFzaG91bGRDbGFtcDtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgY2hhbmdlZCA9IHN0eWxlLmZvbnRTaXplICE9PSBzdGFydFNpemU7XG5cbiAgICAvLyBFbWl0IHNwZWNpZmljIHNvZnRDbGFtcCBldmVudCBmaXJzdFxuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLnNvZnRjbGFtcFwiKTtcbiAgICB9XG5cbiAgICAvLyBEb24ndCBlbWl0IGBsaW5lY2xhbXAuY2xhbXBgIGV2ZW50IHR3aWNlLlxuICAgIGlmICghZG9uZSAmJiB0aGlzLmhhcmRDbGFtcEFzRmFsbGJhY2spIHtcbiAgICAgIHRoaXMuaGFyZENsYW1wKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGNoYW5nZWQpIHtcbiAgICAgIC8vIGhhcmRDbGFtcCBlbWl0cyBgbGluZWNsYW1wLmNsYW1wYCB0b28uIE9ubHkgZW1pdCBmcm9tIGhlcmUgaWYgd2UncmVcbiAgICAgIC8vIG5vdCBhbHNvIGhhcmQgY2xhbXBpbmcuXG4gICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmNsYW1wXCIpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqIFdoZXRoZXIgaGVpZ2h0IG9mIHRleHQgb3IgbnVtYmVyIG9mIGxpbmVzIGV4Y2VlZCBjb25zdHJhaW50cy5cbiAgICpcbiAgICogQHNlZSBMaW5lQ2xhbXAubWF4SGVpZ2h0XG4gICAqIEBzZWUgTGluZUNsYW1wLm1heExpbmVzXG4gICAqL1xuICBzaG91bGRDbGFtcCgpIHtcbiAgICBjb25zdCB7IGxpbmVDb3VudCwgdGV4dEhlaWdodCB9ID0gdGhpcy5jYWxjdWxhdGVUZXh0TWV0cmljcygpO1xuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhIZWlnaHQgJiYgdW5kZWZpbmVkICE9PSB0aGlzLm1heExpbmVzKSB7XG4gICAgICByZXR1cm4gdGV4dEhlaWdodCA+IHRoaXMubWF4SGVpZ2h0IHx8IGxpbmVDb3VudCA+IHRoaXMubWF4TGluZXNcbiAgICB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heEhlaWdodCkge1xuICAgICAgcmV0dXJuIHRleHRIZWlnaHQgPiB0aGlzLm1heEhlaWdodFxuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4TGluZXMpIHtcbiAgICAgIHJldHVybiBsaW5lQ291bnQgPiB0aGlzLm1heExpbmVzXG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJtYXhMaW5lcyBvciBtYXhIZWlnaHQgbXVzdCBiZSBzZXQgYmVmb3JlIGNhbGxpbmcgc2hvdWxkQ2xhbXAoKS5cIlxuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIFBlcmZvcm1zIGEgYmluYXJ5IHNlYXJjaCBmb3IgdGhlIG1heGltdW0gd2hvbGUgbnVtYmVyIGluIGEgY29udGlnb3VzIHJhbmdlXG4gKiB3aGVyZSBhIGdpdmVuIHRlc3QgY2FsbGJhY2sgd2lsbCBnbyBmcm9tIHJldHVybmluZyB0cnVlIHRvIHJldHVybmluZyBmYWxzZS5cbiAqXG4gKiBTaW5jZSB0aGlzIHVzZXMgYSBiaW5hcnktc2VhcmNoIGFsZ29yaXRobSB0aGlzIGlzIGFuIE8obG9nIG4pIGZ1bmN0aW9uLFxuICogd2hlcmUgbiA9IG1heCAtIG1pbi5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbWluXG4gKiBUaGUgbG93ZXIgYm91bmRhcnkgb2YgdGhlIHJhbmdlLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhcbiAqIFRoZSB1cHBlciBib3VuZGFyeSBvZiB0aGUgcmFuZ2UuXG4gKlxuICogQHBhcmFtIHRlc3RcbiAqIEEgY2FsbGJhY2sgdGhhdCByZWNlaXZlcyB0aGUgY3VycmVudCB2YWx1ZSBpbiB0aGUgcmFuZ2UgYW5kIHJldHVybnMgYSB0cnV0aHkgb3IgZmFsc3kgdmFsdWUuXG4gKlxuICogQHBhcmFtIGRvbmVcbiAqIEEgZnVuY3Rpb24gdG8gcGVyZm9ybSB3aGVuIGNvbXBsZXRlLiBSZWNlaXZlcyB0aGUgZm9sbG93aW5nIHBhcmFtZXRlcnNcbiAqIC0gY3Vyc29yXG4gKiAtIG1heFBhc3NpbmdWYWx1ZVxuICogLSBtaW5GYWlsaW5nVmFsdWVcbiAqL1xuZnVuY3Rpb24gZmluZEJvdW5kYXJ5KG1pbiwgbWF4LCB0ZXN0LCBkb25lKSB7XG4gIGxldCBjdXJzb3IgPSBtYXg7XG4gIC8vIHN0YXJ0IGhhbGZ3YXkgdGhyb3VnaCB0aGUgcmFuZ2VcbiAgd2hpbGUgKG1heCA+IG1pbikge1xuICAgIGlmICh0ZXN0KGN1cnNvcikpIHtcbiAgICAgIG1heCA9IGN1cnNvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgbWluID0gY3Vyc29yO1xuICAgIH1cblxuICAgIGlmIChtYXggLSBtaW4gPT09IDEpIHtcbiAgICAgIGRvbmUoY3Vyc29yLCBtaW4sIG1heCk7XG4gICAgICBicmVha1xuICAgIH1cblxuICAgIGN1cnNvciA9IE1hdGgucm91bmQoKG1pbiArIG1heCkgLyAyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbWl0KGluc3RhbmNlLCB0eXBlKSB7XG4gIGluc3RhbmNlLmVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQodHlwZSkpO1xufVxuXG5leHBvcnQgeyBMaW5lQ2xhbXAgYXMgZGVmYXVsdCB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XCJiZWdpblwiOntcInRleHRcIjpcIkNvbm5lY3RpbmdbZGVsYXkgMTAwXS5bZGVsYXkgMTAwXS5bZGVsYXkgMTAwXS5cIixcIm9wdGlvbnNcIjpbXX19IiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnViYmxlcyB7XG4gICAgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gICAgYnViYmxlczogQXJyYXk8QnViYmxlPiA9IFtdO1xuXG4gICAgY29uc3RydWN0b3IoY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCkge1xuICAgICAgICB0aGlzLmN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuICAgICAgICB0aGlzLnJlc2l6ZSgpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjA7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5idWJibGVzLnB1c2gobmV3IEJ1YmJsZSgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuY3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLmN0eC5jYW52YXMud2lkdGgsIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5idWJibGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5idWJibGVzW2ldLnNwZWVkID4gMCAmJiB0aGlzLmJ1YmJsZXNbaV0ubGlmZXRpbWUgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5zcGVlZCAqPSAtMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLnVwZGF0ZShkdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5idWJibGVzW2ldLnNpemUgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXSA9IG5ldyBCdWJibGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLmRyYXcodGhpcy5jdHgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzaXplKCkge1xuICAgICAgICB2YXIgZHByID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICAgICAgdmFyIHJlY3QgPSB0aGlzLmN0eC5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgdGhpcy5jdHguY2FudmFzLndpZHRoID0gcmVjdC53aWR0aCAqIGRwcjtcbiAgICAgICAgdGhpcy5jdHguY2FudmFzLmhlaWdodCA9IHJlY3QuaGVpZ2h0ICogZHByO1xuXG4gICAgICAgIHRoaXMuY3R4LnNjYWxlKGRwciwgZHByKTtcblxuICAgICAgICB0aGlzLmN0eC5maWx0ZXIgPSBcImJsdXIoNTBweClcIjtcbiAgICB9XG59XG5cbmNsYXNzIEJ1YmJsZSB7XG4gICAgc3BlZWQ6IG51bWJlcjtcbiAgICB4OiBudW1iZXI7XG4gICAgeTogbnVtYmVyO1xuICAgIHNpemU6IG51bWJlcjtcbiAgICBjb2xvcjogc3RyaW5nO1xuICAgIGxpZmV0aW1lOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5zcGVlZCA9IDAuMDQ7XG5cbiAgICAgICAgdGhpcy54ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLnJhbmRvbSgpICogd2luZG93LmlubmVySGVpZ2h0O1xuXG4gICAgICAgIHRoaXMuc2l6ZSA9IDA7XG5cbiAgICAgICAgbGV0IHYgPSBNYXRoLnJhbmRvbSgpO1xuICAgICAgICBsZXQgaHVlID0gdiA8IDAuNSA/IDE1MCA6IDIzMDtcbiAgICAgICAgbGV0IHNhdCA9IHYgPCAwLjUgPyA1MCA6IDg1O1xuICAgICAgICBsZXQgbGlnaHQgPSB2IDwgMC41ID8gMjUgOiA0MDtcbiAgICAgICAgdGhpcy5jb2xvciA9IFwiaHNsYShcIiArIGh1ZSArIFwiLCBcIiArIHNhdCArIFwiJSwgXCIgKyBsaWdodCArIFwiJSwgNDAlKVwiO1xuXG4gICAgICAgIHRoaXMubGlmZXRpbWUgPSBNYXRoLnJhbmRvbSgpICoqIDUgKiA4MDAwICsgNTAwO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc2l6ZSArPSB0aGlzLnNwZWVkICogZHQ7XG4gICAgICAgIHRoaXMubGlmZXRpbWUgLT0gZHQ7XG4gICAgfVxuXG4gICAgZHJhdyhjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCkge1xuICAgICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5jb2xvcjtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKHRoaXMueCwgdGhpcy55LCB0aGlzLnNpemUsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGwoKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcbmltcG9ydCBTdGF0ZU1hbmFnZXIgZnJvbSBcIi4vc3RhdGVfbWFuYWdlclwiO1xuaW1wb3J0IHsgQmVnaW5TdGF0ZSB9IGZyb20gXCIuL3N0YXRlc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBHYW1lIHtcbiAgICB0ZXJtOiBUZXJtaW5hbDtcbiAgICBtYW5hZ2VyOiBTdGF0ZU1hbmFnZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZXJtaW5hbDogSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy50ZXJtID0gbmV3IFRlcm1pbmFsKHRlcm1pbmFsKTtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbmV3IFN0YXRlTWFuYWdlcihCZWdpblN0YXRlKTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIudXBkYXRlKGR0LCB0aGlzLnRlcm0pO1xuXG4gICAgICAgIHRoaXMudGVybS51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdGhpcy50ZXJtLnJlc2l6ZSgpO1xuICAgIH1cblxuICAgIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGVNYW5hZ2VyIGZyb20gXCIuL3N0YXRlX21hbmFnZXJcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhYnN0cmFjdCBjbGFzcyBTdGF0ZSB7XG4gICAgcHJvdGVjdGVkIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFN0YXRlTWFuYWdlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIGluaXQodGVybTogVGVybWluYWwpIHt9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHt9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHt9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTdGF0ZU1hbmFnZXIge1xuICAgIHN0YXRlOiBTdGF0ZTtcbiAgICBuZWVkc0luaXQgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICB9XG5cbiAgICBzZXRTdGF0ZShzOiBuZXcgKG06IFN0YXRlTWFuYWdlcikgPT4gU3RhdGUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5ldyBzKHRoaXMpO1xuICAgICAgICB0aGlzLm5lZWRzSW5pdCA9IHRydWU7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLm5lZWRzSW5pdCkge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZS5pbml0KHRlcm0pO1xuICAgICAgICAgICAgdGhpcy5uZWVkc0luaXQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUudXBkYXRlKGR0LCB0ZXJtKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5rZXlkb3duKGUpO1xuICAgIH1cbn1cbiIsImltcG9ydCBTdGF0ZSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuL3Rlcm1pbmFsXCI7XG5cbmV4cG9ydCBjbGFzcyBCZWdpblN0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIG92ZXJyaWRlIGluaXQodGVybTogVGVybWluYWwpIHtcbiAgICAgICAgdGVybS53cml0ZUxpbmUoXCJQcmVzcyBhbnkga2V5IHRvIGJlZ2luLi4uXCIpO1xuICAgIH1cblxuICAgIG92ZXJyaWRlIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgICAgICB0aGlzLm1hbmFnZXIuc2V0U3RhdGUoV2lwZVN0YXRlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXaXBlU3RhdGUgZXh0ZW5kcyBTdGF0ZSB7XG4gICAgcHJpdmF0ZSB3aXBlVGltZXIgPSAwO1xuICAgIHByaXZhdGUgd2lwZVRpY2tzID0gMDtcbiAgICBwcml2YXRlIHdpcGVMaW5lczogbnVtYmVyO1xuXG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcImhpZGRlblwiO1xuICAgICAgICB0aGlzLndpcGVMaW5lcyA9IHRlcm0ubWF4TGluZXM7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLndpcGVUaW1lciA+IDUwKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53aXBlVGlja3MgPiA1KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlTGluZXMtLTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlVGlja3MrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGVybS5maWxsUmFuZG9tKHRoaXMud2lwZUxpbmVzKTtcblxuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2lwZUxpbmVzID49IDApIHtcbiAgICAgICAgICAgIHRoaXMud2lwZVRpbWVyICs9IGR0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGVybS5yZXNldCgpO1xuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLnNldFN0YXRlKFBsYXlpbmdTdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbnR5cGUgT3B0aW9uID0ge1xuICAgIHRleHQ6IHN0cmluZztcbiAgICBpY29uOiBzdHJpbmc7XG4gICAgbmV4dDogc3RyaW5nO1xufTtcblxudHlwZSBTY2VuZSA9IHtcbiAgICB0ZXh0OiBzdHJpbmc7XG4gICAgb3B0aW9uczogT3B0aW9uW107XG59O1xuXG5leHBvcnQgY2xhc3MgUGxheWluZ1N0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHN0b3J5OiBSZWNvcmQ8c3RyaW5nLCBTY2VuZT4gPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG4gICAgY3VyciA9IFwiYmVnaW5cIjtcblxuICAgIHJlbWFpbmluZ1RleHQgPSB0aGlzLnN0b3J5W1wiYmVnaW5cIl0udGV4dDtcblxuICAgIGRlbGF5ID0gMDtcblxuICAgIG92ZXJyaWRlIHVwZGF0ZShkdDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBpZiAodGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aCA9PSAwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuZGVsYXkgPD0gMCkge1xuICAgICAgICAgICAgbGV0IGNvbW1hbmRQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIltcIik7XG4gICAgICAgICAgICBpZiAoY29tbWFuZFBvcyA9PSAwKSB7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc3Vic3RyaW5nKFxuICAgICAgICAgICAgICAgICAgICAxLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIl1cIilcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGxldCBhcmdzID0gY29tbWFuZC5zcGxpdChcIiBcIik7XG5cbiAgICAgICAgICAgICAgICBpZiAoYXJnc1swXSA9PSBcImRlbGF5XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxheSA9IHBhcnNlSW50KGFyZ3NbMV0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc3Vic3RyaW5nKFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0LmluZGV4T2YoXCJdXCIpICsgMVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYXJnc1swXSA9PSBcImVudGVyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGVybS53cml0ZUxpbmUoXCJcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKHRoaXMucmVtYWluaW5nVGV4dC5zdWJzdHJpbmcoMCwgY29tbWFuZFBvcykpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zdWJzdHJpbmcoY29tbWFuZFBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF5IC09IGR0O1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IExpbmVDbGFtcCBmcm9tIFwiQHR2YW5jL2xpbmVjbGFtcFwiO1xyXG5cclxuY29uc3QgQ1VSU09SX0JMSU5LX0lOVEVSVkFMID0gNTAwO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGVybWluYWwge1xyXG4gICAgZWxlbWVudDogSFRNTEVsZW1lbnQ7XHJcblxyXG4gICAgZm9udFNpemU6IG51bWJlcjtcclxuICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICBoZWlnaHQ6IG51bWJlcjtcclxuICAgIGxpbmVIZWlnaHQ6IG51bWJlcjtcclxuXHJcbiAgICBtYXhMaW5lczogbnVtYmVyO1xyXG4gICAgY2hhcnNQZXJMaW5lOiBudW1iZXI7XHJcblxyXG4gICAgY29udGVudCA9IFwiPiBcIjtcclxuXHJcbiAgICBwcml2YXRlIGN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBjdXJzb3JFbmFibGVkID0gdHJ1ZTtcclxuICAgIHByaXZhdGUgY3Vyc29yVGlja3MgPSAwO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbTtcclxuXHJcbiAgICAgICAgdGhpcy5mb250U2l6ZSA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemUuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLndpZHRoID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS53aWR0aC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5oZWlnaHQuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xyXG4gICAgICAgIGNvbnN0IGNsYW1wID0gbmV3IExpbmVDbGFtcCh0aGlzLmVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMubGluZUhlaWdodCA9IGNsYW1wLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCkuYWRkaXRpb25hbExpbmVIZWlnaHQ7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJcIjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXhMaW5lcyA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgLyB0aGlzLmxpbmVIZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2hhcnNQZXJMaW5lID0gTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gKHRoaXMuZm9udFNpemUgKiAwLjYpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXNpemUoKSB7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkud2lkdGguc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuaGVpZ2h0LnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMubWF4TGluZXMgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0IC8gdGhpcy5saW5lSGVpZ2h0KTtcclxuICAgICAgICB0aGlzLmNoYXJzUGVyTGluZSA9IE1hdGguZmxvb3IodGhpcy53aWR0aCAvICh0aGlzLmZvbnRTaXplICogMC42KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclRpY2tzID49IENVUlNPUl9CTElOS19JTlRFUlZBTCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJzb3JUaWNrcyA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsaXBDdXJzb3IoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Vyc29yVGlja3MgKz0gZHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc2hvdygpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuaW5uZXJUZXh0ID0gdGhpcy5jb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyKCkge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ID0gXCJcIjtcclxuICAgIH1cclxuXHJcbiAgICBwdXQodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgKz0gdGV4dDtcclxuICAgIH1cclxuXHJcbiAgICBwdXRMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQgKyBcIlxcbj4gXCI7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzZXQoKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMucHV0KFwiPiBcIik7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHdyaXRlKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMucHV0KHRleHQpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB3cml0ZUxpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5wdXRMaW5lKHRleHQpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBmaWxsUmFuZG9tKGxpbmVzOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lczsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgICAgICB0aGlzLnB1dChcIlxcblwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5wdXQodGhpcy5yYW5kb21DaGFyYWN0ZXJzKHRoaXMuY2hhcnNQZXJMaW5lKSk7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0Q3Vyc29yRW5hYmxlZCh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuY3Vyc29yRW5hYmxlZCA9IHZhbHVlO1xyXG4gICAgICAgIC8vIGlmIHRoZSBjdXJzb3IgbmVlZGVkIHRvIGJlIHR1cm5lZCBvZmYsIGZpeCBpdFxyXG4gICAgICAgIGlmICghdGhpcy5jdXJzb3JFbmFibGVkICYmICF0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ID0gdGhpcy5jb250ZW50LnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZmxpcEN1cnNvcigpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCArPSBcIl9cIjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5jdXJzb3JWaXNpYmxlID0gIXRoaXMuY3Vyc29yVmlzaWJsZTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcmFuZG9tQ2hhcmFjdGVycyhjb3VudDogbnVtYmVyKSB7XHJcbiAgICAgICAgbGV0IHZhbHVlcyA9IG5ldyBVaW50OEFycmF5KGNvdW50KTtcclxuICAgICAgICB3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyh2YWx1ZXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZFZhbHVlcyA9IHZhbHVlcy5tYXAoKHgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgYWRqID0geCAlIDM2O1xyXG4gICAgICAgICAgICByZXR1cm4gYWRqIDwgMjYgPyBhZGogKyA2NSA6IGFkaiAtIDI2ICsgNDg7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG1hcHBlZFZhbHVlcyk7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgQnViYmxlcyBmcm9tIFwiLi9idWJibGVzXCI7XG5pbXBvcnQgR2FtZSBmcm9tIFwiLi9nYW1lXCI7XG5cbmxldCBnYW1lOiBHYW1lO1xuXG5sZXQgYnViYmxlczogQnViYmxlcztcblxubGV0IGxhc3RUaW1lOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxud2luZG93Lm9ubG9hZCA9ICgpID0+IHtcbiAgICBidWJibGVzID0gbmV3IEJ1YmJsZXMoXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmFja2dyb3VuZFwiKSBhcyBIVE1MQ2FudmFzRWxlbWVudFxuICAgICk7XG4gICAgZ2FtZSA9IG5ldyBHYW1lKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidGVybWluYWxcIikhKTtcblxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbn07XG5cbndpbmRvdy5vbnJlc2l6ZSA9ICgpID0+IHtcbiAgICBidWJibGVzLnJlc2l6ZSgpO1xuICAgIGdhbWUucmVzaXplKCk7XG59O1xuXG5kb2N1bWVudC5vbmtleWRvd24gPSAoZSkgPT4ge1xuICAgIGdhbWUua2V5ZG93bihlKTtcbn07XG5cbmRvY3VtZW50Lm9udmlzaWJpbGl0eWNoYW5nZSA9ICgpID0+IHtcbiAgICBpZiAoZG9jdW1lbnQudmlzaWJpbGl0eVN0YXRlID09IFwidmlzaWJsZVwiKSB7XG4gICAgICAgIGxhc3RUaW1lID0gbnVsbDtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgLy8gVGhpcyByZWFsbHkgc2hvdWxkbid0IGJlIG5lZWRlZCBpZiBicm93c2VycyBhcmUgZm9sbG93aW5nIGNvbnZlbnRpb24sXG4gICAgLy8gYnV0IGJldHRlciBzYWZlIHRoYW4gc29ycnlcbiAgICBpZiAoZG9jdW1lbnQuaGlkZGVuKSB7XG4gICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsYXN0VGltZSAhPSBudWxsKSB7XG4gICAgICAgIGxldCBkdCA9IHRpbWUgLSBsYXN0VGltZTtcblxuICAgICAgICBidWJibGVzLnVwZGF0ZShkdCk7XG4gICAgICAgIGdhbWUudXBkYXRlKGR0KTtcbiAgICB9XG5cbiAgICBsYXN0VGltZSA9IHRpbWU7XG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xufVxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9