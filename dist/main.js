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

module.exports = {"begin":{"text":"[delay 2000]Connecting[delay 1000][normal .][delay 1000][normal .][delay 1000][normal .][newline]","options":[]}}

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
    State.prototype.init = function (term, options) { };
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
        this.initOptions = {};
        this.state = new s(this);
    }
    StateManager.prototype.setState = function (s, options) {
        this.state = new s(this);
        this.initOptions = options;
    };
    StateManager.prototype.update = function (dt, term) {
        if (this.initOptions != null) {
            this.state.init(term, this.initOptions);
            this.initOptions = null;
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

var story = __webpack_require__(/*! ./story.cson */ "./src/story.cson");
var BeginState = /** @class */ (function (_super) {
    __extends(BeginState, _super);
    function BeginState() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BeginState.prototype.init = function (term, options) {
        term.writeLine("Press any key to begin...");
    };
    BeginState.prototype.keydown = function (e) {
        this.manager.setState(WipeState, {});
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
    WipeState.prototype.init = function (term, options) {
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
            this.manager.setState(PlayingState, { text: story["begin"].text });
        }
    };
    return WipeState;
}(_state__WEBPACK_IMPORTED_MODULE_0__["default"]));

var PlayingState = /** @class */ (function (_super) {
    __extends(PlayingState, _super);
    function PlayingState() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.curr = "begin";
        _this.remainingText = "";
        _this.delay = 0;
        _this.textDecoded = -1;
        _this.textPosition = -1;
        _this.textTimer = -1;
        return _this;
    }
    PlayingState.prototype.init = function (term, options) {
        this.remainingText = options.text;
    };
    PlayingState.prototype.update = function (dt, term) {
        if (this.remainingText.length == 0)
            return;
        if (this.delay <= 0) {
            var commandPos = this.remainingText.indexOf("[");
            if (commandPos == 0) {
                var command = this.remainingText.slice(1, this.remainingText.indexOf("]"));
                var args = command.split(" ");
                this.handleCommand(args, term);
                this.remainingText = this.remainingText.slice(this.remainingText.indexOf("]") + 1);
            }
            else {
                this.writeText(commandPos, term, dt);
            }
        }
        else {
            this.delay -= dt;
        }
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
            if (this.textTimer > 100) {
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
        if (this.textTimer > 50) {
            this.textDecoded++;
            this.textTimer = 0;
        }
        this.textTimer += dt;
    };
    PlayingState.prototype.handleCommand = function (args, term) {
        switch (args[0]) {
            case "delay":
                this.delay = parseInt(args[1]);
                break;
            case "normal":
                term.write(args[1]);
                break;
            case "newline":
                term.writeLine("");
                break;
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
        this.content += text + "\n> ";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDO0FBRUYsUUFBUSxDQUFDLGtCQUFrQixHQUFHO0lBQzFCLElBQUksUUFBUSxDQUFDLGVBQWUsSUFBSSxTQUFTLEVBQUU7UUFDdkMsUUFBUSxHQUFHLElBQUksQ0FBQztLQUNuQjtBQUNMLENBQUMsQ0FBQztBQUVGLFNBQVMsTUFBTSxDQUFDLElBQVk7SUFDeEIsd0VBQXdFO0lBQ3hFLDZCQUE2QjtJQUM3QixJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUU7UUFDakIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JDLE9BQU87S0FDVjtJQUVELElBQUksUUFBUSxJQUFJLElBQUksRUFBRTtRQUNsQixJQUFJLEVBQUUsR0FBRyxJQUFJLEdBQUcsUUFBUSxDQUFDO1FBRXpCLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUNuQjtJQUVELFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDaEIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3pDLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL25vZGVfbW9kdWxlcy9AdHZhbmMvbGluZWNsYW1wL2Rpc3QvZXNtLmpzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0b3J5LmNzb24iLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnViYmxlcy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9nYW1lLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlX21hbmFnZXIudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGVzLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3Rlcm1pbmFsLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWR1Y2VzIGZvbnQgc2l6ZSBvciB0cmltcyB0ZXh0IHRvIG1ha2UgaXQgZml0IHdpdGhpbiBzcGVjaWZpZWQgYm91bmRzLlxuICpcbiAqIFN1cHBvcnRzIGNsYW1waW5nIGJ5IG51bWJlciBvZiBsaW5lcyBvciB0ZXh0IGhlaWdodC5cbiAqXG4gKiBLbm93biBsaW1pdGF0aW9uczpcbiAqIDEuIENoYXJhY3RlcnMgdGhhdCBkaXN0b3J0IGxpbmUgaGVpZ2h0cyAoZW1vamlzLCB6YWxnbykgbWF5IGNhdXNlXG4gKiB1bmV4cGVjdGVkIHJlc3VsdHMuXG4gKiAyLiBDYWxsaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSB3aXBlcyBjaGlsZCBlbGVtZW50cy4gRnV0dXJlIHVwZGF0ZXMgbWF5IGFsbG93XG4gKiBpbmxpbmUgY2hpbGQgZWxlbWVudHMgdG8gYmUgcHJlc2VydmVkLlxuICpcbiAqIEB0b2RvIFNwbGl0IHRleHQgbWV0cmljcyBpbnRvIG93biBsaWJyYXJ5XG4gKiBAdG9kbyBUZXN0IG5vbi1MVFIgdGV4dFxuICovXG5jbGFzcyBMaW5lQ2xhbXAge1xuICAvKipcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxuICAgKiBUaGUgZWxlbWVudCB0byBjbGFtcC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBPcHRpb25zIHRvIGdvdmVybiBjbGFtcGluZyBiZWhhdmlvci5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heExpbmVzXVxuICAgKiBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdG8gYWxsb3cuIERlZmF1bHRzIHRvIDEuXG4gICAqIFRvIHNldCBhIG1heGltdW0gaGVpZ2h0IGluc3RlYWQsIHVzZSB7QHNlZSBvcHRpb25zLm1heEhlaWdodH1cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEhlaWdodF1cbiAgICogVGhlIG1heGltdW0gaGVpZ2h0IChpbiBwaXhlbHMpIG9mIHRleHQgaW4gYW4gZWxlbWVudC5cbiAgICogVGhpcyBvcHRpb24gaXMgdW5kZWZpbmVkIGJ5IGRlZmF1bHQuIE9uY2Ugc2V0LCBpdCB0YWtlcyBwcmVjZWRlbmNlIG92ZXJcbiAgICoge0BzZWUgb3B0aW9ucy5tYXhMaW5lc30uIE5vdGUgdGhhdCB0aGlzIGFwcGxpZXMgdG8gdGhlIGhlaWdodCBvZiB0aGUgdGV4dCwgbm90XG4gICAqIHRoZSBlbGVtZW50IGl0c2VsZi4gUmVzdHJpY3RpbmcgdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCBjYW4gYmUgYWNoaWV2ZWRcbiAgICogd2l0aCBDU1MgPGNvZGU+bWF4LWhlaWdodDwvY29kZT4uXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlU29mdENsYW1wXVxuICAgKiBJZiB0cnVlLCByZWR1Y2UgZm9udCBzaXplIChzb2Z0IGNsYW1wKSB0byBhdCBsZWFzdCB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfVxuICAgKiBiZWZvcmUgcmVzb3J0aW5nIHRvIHRyaW1taW5nIHRleHQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmhhcmRDbGFtcEFzRmFsbGJhY2tdXG4gICAqIElmIHRydWUsIHJlc29ydCB0byBoYXJkIGNsYW1waW5nIGlmIHNvZnQgY2xhbXBpbmcgcmVhY2hlcyB0aGUgbWluaW11bSBmb250IHNpemVcbiAgICogYW5kIHN0aWxsIGRvZXNuJ3QgZml0IHdpdGhpbiB0aGUgbWF4IGhlaWdodCBvciBudW1iZXIgb2YgbGluZXMuXG4gICAqIERlZmF1bHRzIHRvIHRydWUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5lbGxpcHNpc11cbiAgICogVGhlIGNoYXJhY3RlciB3aXRoIHdoaWNoIHRvIHJlcHJlc2VudCBjbGlwcGVkIHRyYWlsaW5nIHRleHQuXG4gICAqIFRoaXMgb3B0aW9uIHRha2VzIGVmZmVjdCB3aGVuIFwiaGFyZFwiIGNsYW1waW5nIGlzIHVzZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5Gb250U2l6ZV1cbiAgICogVGhlIGxvd2VzdCBmb250IHNpemUsIGluIHBpeGVscywgdG8gdHJ5IGJlZm9yZSByZXNvcnRpbmcgdG8gcmVtb3ZpbmdcbiAgICogdHJhaWxpbmcgdGV4dCAoaGFyZCBjbGFtcGluZykuIERlZmF1bHRzIHRvIDEuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhGb250U2l6ZV1cbiAgICogVGhlIG1heGltdW0gZm9udCBzaXplIGluIHBpeGVscy4gV2UnbGwgc3RhcnQgd2l0aCB0aGlzIGZvbnQgc2l6ZSB0aGVuXG4gICAqIHJlZHVjZSB1bnRpbCB0ZXh0IGZpdHMgY29uc3RyYWludHMsIG9yIGZvbnQgc2l6ZSBpcyBlcXVhbCB0b1xuICAgKiB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfS4gRGVmYXVsdHMgdG8gdGhlIGVsZW1lbnQncyBpbml0aWFsIGNvbXB1dGVkIGZvbnQgc2l6ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGVsZW1lbnQsXG4gICAge1xuICAgICAgbWF4TGluZXMgPSB1bmRlZmluZWQsXG4gICAgICBtYXhIZWlnaHQgPSB1bmRlZmluZWQsXG4gICAgICB1c2VTb2Z0Q2xhbXAgPSBmYWxzZSxcbiAgICAgIGhhcmRDbGFtcEFzRmFsbGJhY2sgPSB0cnVlLFxuICAgICAgbWluRm9udFNpemUgPSAxLFxuICAgICAgbWF4Rm9udFNpemUgPSB1bmRlZmluZWQsXG4gICAgICBlbGxpcHNpcyA9IFwi4oCmXCIsXG4gICAgfSA9IHt9XG4gICkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm9yaWdpbmFsV29yZHNcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IGVsZW1lbnQudGV4dENvbnRlbnQubWF0Y2goL1xcUytcXHMqL2cpIHx8IFtdLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwidXBkYXRlSGFuZGxlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogKCkgPT4gdGhpcy5hcHBseSgpLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib2JzZXJ2ZXJcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMudXBkYXRlSGFuZGxlciksXG4gICAgfSk7XG5cbiAgICBpZiAodW5kZWZpbmVkID09PSBtYXhGb250U2l6ZSkge1xuICAgICAgbWF4Rm9udFNpemUgPSBwYXJzZUludCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS5mb250U2l6ZSwgMTApO1xuICAgIH1cblxuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgdGhpcy5tYXhMaW5lcyA9IG1heExpbmVzO1xuICAgIHRoaXMubWF4SGVpZ2h0ID0gbWF4SGVpZ2h0O1xuICAgIHRoaXMudXNlU29mdENsYW1wID0gdXNlU29mdENsYW1wO1xuICAgIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjayA9IGhhcmRDbGFtcEFzRmFsbGJhY2s7XG4gICAgdGhpcy5taW5Gb250U2l6ZSA9IG1pbkZvbnRTaXplO1xuICAgIHRoaXMubWF4Rm9udFNpemUgPSBtYXhGb250U2l6ZTtcbiAgICB0aGlzLmVsbGlwc2lzID0gZWxsaXBzaXM7XG4gIH1cblxuICAvKipcbiAgICogR2F0aGVyIG1ldHJpY3MgYWJvdXQgdGhlIGxheW91dCBvZiB0aGUgZWxlbWVudCdzIHRleHQuXG4gICAqIFRoaXMgaXMgYSBzb21ld2hhdCBleHBlbnNpdmUgb3BlcmF0aW9uIC0gY2FsbCB3aXRoIGNhcmUuXG4gICAqXG4gICAqIEByZXR1cm5zIHtUZXh0TWV0cmljc31cbiAgICogTGF5b3V0IG1ldHJpY3MgZm9yIHRoZSBjbGFtcGVkIGVsZW1lbnQncyB0ZXh0LlxuICAgKi9cbiAgY2FsY3VsYXRlVGV4dE1ldHJpY3MoKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICBjb25zdCBjbG9uZSA9IGVsZW1lbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgIGNvbnN0IHN0eWxlID0gY2xvbmUuc3R5bGU7XG5cbiAgICAvLyBBcHBlbmQsIGRvbid0IHJlcGxhY2VcbiAgICBzdHlsZS5jc3NUZXh0ICs9IFwiO21pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7bWF4LWhlaWdodDpub25lIWltcG9ydGFudFwiO1xuICAgIGVsZW1lbnQucmVwbGFjZVdpdGgoY2xvbmUpO1xuXG4gICAgY29uc3QgbmF0dXJhbEhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodDtcblxuICAgIC8vIENsZWFyIHRvIG1lYXN1cmUgZW1wdHkgaGVpZ2h0LiB0ZXh0Q29udGVudCBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXCI7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgdGV4dEhlaWdodCA9IG5hdHVyYWxIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBGaWxsIGVsZW1lbnQgd2l0aCBzaW5nbGUgbm9uLWJyZWFraW5nIHNwYWNlIHRvIGZpbmQgaGVpZ2h0IG9mIG9uZSBsaW5lXG4gICAgY2xvbmUudGV4dENvbnRlbnQgPSBcIlxceGEwXCI7XG5cbiAgICAvLyBHZXQgaGVpZ2h0IG9mIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHRcbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgZmlyc3RMaW5lSGVpZ2h0ID0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lIC0gbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0O1xuXG4gICAgLy8gQWRkIGxpbmUgKDxicj4gKyBuYnNwKS4gYXBwZW5kQ2hpbGQoKSBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnJcIikpO1xuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXFx4YTBcIikpO1xuXG4gICAgY29uc3QgYWRkaXRpb25hbExpbmVIZWlnaHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmU7XG4gICAgY29uc3QgbGluZUNvdW50ID1cbiAgICAgIDEgKyAobmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSkgLyBhZGRpdGlvbmFsTGluZUhlaWdodDtcblxuICAgIC8vIFJlc3RvcmUgb3JpZ2luYWwgY29udGVudFxuICAgIGNsb25lLnJlcGxhY2VXaXRoKGVsZW1lbnQpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGVkZWYge09iamVjdH0gVGV4dE1ldHJpY3NcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7dGV4dEhlaWdodH1cbiAgICAgKiBUaGUgdmVydGljYWwgc3BhY2UgcmVxdWlyZWQgdG8gZGlzcGxheSB0aGUgZWxlbWVudCdzIGN1cnJlbnQgdGV4dC5cbiAgICAgKiBUaGlzIGlzIDxlbT5ub3Q8L2VtPiBuZWNlc3NhcmlseSB0aGUgc2FtZSBhcyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50LlxuICAgICAqIFRoaXMgbnVtYmVyIG1heSBldmVuIGJlIGdyZWF0ZXIgdGhhbiB0aGUgZWxlbWVudCdzIGhlaWdodCBpbiBjYXNlc1xuICAgICAqIHdoZXJlIHRoZSB0ZXh0IG92ZXJmbG93cyB0aGUgZWxlbWVudCdzIGJsb2NrIGF4aXMuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge25hdHVyYWxIZWlnaHRXaXRoT25lTGluZX1cbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdpdGggb25seSBvbmUgbGluZSBvZiB0ZXh0IGFuZCB3aXRob3V0XG4gICAgICogbWluaW11bSBvciBtYXhpbXVtIGhlaWdodHMuIFRoaXMgaW5mb3JtYXRpb24gbWF5IGJlIGhlbHBmdWwgd2hlblxuICAgICAqIGRlYWxpbmcgd2l0aCBpbmxpbmUgZWxlbWVudHMgKGFuZCBwb3RlbnRpYWxseSBvdGhlciBzY2VuYXJpb3MpLCB3aGVyZVxuICAgICAqIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3QgaW5jcmVhc2UgdGhlIGVsZW1lbnQncyBoZWlnaHQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2ZpcnN0TGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBhZGRzIHRvIHRoZSBlbGVtZW50LCBpLmUuLCB0aGVcbiAgICAgKiBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCB3aGlsZSBlbXB0eSBhbmQgdGhlIGhlaWdodFxuICAgICAqIG9mIHRoZSBlbGVtZW50IHdoaWxlIGl0IGNvbnRhaW5zIG9uZSBsaW5lIG9mIHRleHQuIFRoaXMgbnVtYmVyIG1heSBiZVxuICAgICAqIHplcm8gZm9yIGlubGluZSBlbGVtZW50cyBiZWNhdXNlIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3RcbiAgICAgKiBpbmNyZWFzZSB0aGUgaGVpZ2h0IG9mIGlubGluZSBlbGVtZW50cy5cblxuICAgICAqIEBwcm9wZXJ0eSB7YWRkaXRpb25hbExpbmVIZWlnaHR9XG4gICAgICogVGhlIGhlaWdodCB0aGF0IGVhY2ggbGluZSBvZiB0ZXh0IGFmdGVyIHRoZSBmaXJzdCBhZGRzIHRvIHRoZSBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtsaW5lQ291bnR9XG4gICAgICogVGhlIG51bWJlciBvZiBsaW5lcyBvZiB0ZXh0IHRoZSBlbGVtZW50IGNvbnRhaW5zLlxuICAgICAqL1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0SGVpZ2h0LFxuICAgICAgbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lLFxuICAgICAgZmlyc3RMaW5lSGVpZ2h0LFxuICAgICAgYWRkaXRpb25hbExpbmVIZWlnaHQsXG4gICAgICBsaW5lQ291bnQsXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBjaGFuZ2VzIHRoYXQgbWF5IGFmZmVjdCBsYXlvdXQuIFJlc3BvbmQgYnkgcmVjbGFtcGluZyBpZlxuICAgKiBuZWNlc3NhcnkuXG4gICAqL1xuICB3YXRjaCgpIHtcbiAgICBpZiAoIXRoaXMuX3dhdGNoaW5nKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgICAvLyBNaW5pbXVtIHJlcXVpcmVkIHRvIGRldGVjdCBjaGFuZ2VzIHRvIHRleHQgbm9kZXMsXG4gICAgICAvLyBhbmQgd2hvbGVzYWxlIHJlcGxhY2VtZW50IHZpYSBpbm5lckhUTUxcbiAgICAgIHRoaXMub2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmVsZW1lbnQsIHtcbiAgICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZSxcbiAgICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3dhdGNoaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3Agd2F0Y2hpbmcgZm9yIGxheW91dCBjaGFuZ2VzLlxuICAgKlxuICAgKiBAcmV0dXJucyB7TGluZUNsYW1wfVxuICAgKi9cbiAgdW53YXRjaCgpIHtcbiAgICB0aGlzLm9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgdGhpcy5fd2F0Y2hpbmcgPSBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ29uZHVjdCBlaXRoZXIgc29mdCBjbGFtcGluZyBvciBoYXJkIGNsYW1waW5nLCBhY2NvcmRpbmcgdG8gdGhlIHZhbHVlIG9mXG4gICAqIHByb3BlcnR5IHtAc2VlIExpbmVDbGFtcC51c2VTb2Z0Q2xhbXB9LlxuICAgKi9cbiAgYXBwbHkoKSB7XG4gICAgaWYgKHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQpIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzbHlXYXRjaGluZyA9IHRoaXMuX3dhdGNoaW5nO1xuXG4gICAgICAvLyBJZ25vcmUgaW50ZXJuYWxseSBzdGFydGVkIG11dGF0aW9ucywgbGVzdCB3ZSByZWN1cnNlIGludG8gb2JsaXZpb25cbiAgICAgIHRoaXMudW53YXRjaCgpO1xuXG4gICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSB0aGlzLm9yaWdpbmFsV29yZHMuam9pbihcIlwiKTtcblxuICAgICAgaWYgKHRoaXMudXNlU29mdENsYW1wKSB7XG4gICAgICAgIHRoaXMuc29mdENsYW1wKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhhcmRDbGFtcCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXN1bWUgb2JzZXJ2YXRpb24gaWYgcHJldmlvdXNseSB3YXRjaGluZ1xuICAgICAgaWYgKHByZXZpb3VzbHlXYXRjaGluZykge1xuICAgICAgICB0aGlzLndhdGNoKGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFRyaW1zIHRleHQgdW50aWwgaXQgZml0cyB3aXRoaW4gY29uc3RyYWludHNcbiAgICogKG1heGltdW0gaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcykuXG4gICAqXG4gICAqIEBzZWUge0xpbmVDbGFtcC5tYXhMaW5lc31cbiAgICogQHNlZSB7TGluZUNsYW1wLm1heEhlaWdodH1cbiAgICovXG4gIGhhcmRDbGFtcChza2lwQ2hlY2sgPSB0cnVlKSB7XG4gICAgaWYgKHNraXBDaGVjayB8fCB0aGlzLnNob3VsZENsYW1wKCkpIHtcbiAgICAgIGxldCBjdXJyZW50VGV4dDtcblxuICAgICAgZmluZEJvdW5kYXJ5KFxuICAgICAgICAxLFxuICAgICAgICB0aGlzLm9yaWdpbmFsV29yZHMubGVuZ3RoLFxuICAgICAgICAodmFsKSA9PiB7XG4gICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgdmFsKS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dDtcblxuICAgICAgICAgIHJldHVybiB0aGlzLnNob3VsZENsYW1wKClcbiAgICAgICAgfSxcbiAgICAgICAgKHZhbCwgbWluLCBtYXgpID0+IHtcbiAgICAgICAgICAvLyBBZGQgb25lIG1vcmUgd29yZCBpZiBub3Qgb24gbWF4XG4gICAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgbWF4KS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGVuIHRyaW0gbGV0dGVycyB1bnRpbCBpdCBmaXRzXG4gICAgICAgICAgZG8ge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSBjdXJyZW50VGV4dC5zbGljZSgwLCAtMSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dCArIHRoaXMuZWxsaXBzaXM7XG4gICAgICAgICAgfSB3aGlsZSAodGhpcy5zaG91bGRDbGFtcCgpKVxuXG4gICAgICAgICAgLy8gQnJvYWRjYXN0IG1vcmUgc3BlY2lmaWMgaGFyZENsYW1wIGV2ZW50IGZpcnN0XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5oYXJkY2xhbXBcIik7XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZHVjZXMgZm9udCBzaXplIHVudGlsIHRleHQgZml0cyB3aXRoaW4gdGhlIHNwZWNpZmllZCBoZWlnaHQgb3IgbnVtYmVyIG9mXG4gICAqIGxpbmVzLiBSZXNvcnRzIHRvIHVzaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSBpZiB0ZXh0IHN0aWxsIGV4Y2VlZHMgY2xhbXBcbiAgICogcGFyYW1ldGVycy5cbiAgICovXG4gIHNvZnRDbGFtcCgpIHtcbiAgICBjb25zdCBzdHlsZSA9IHRoaXMuZWxlbWVudC5zdHlsZTtcbiAgICBjb25zdCBzdGFydFNpemUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmZvbnRTaXplO1xuICAgIHN0eWxlLmZvbnRTaXplID0gXCJcIjtcblxuICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgbGV0IHNob3VsZENsYW1wO1xuXG4gICAgZmluZEJvdW5kYXJ5KFxuICAgICAgdGhpcy5taW5Gb250U2l6ZSxcbiAgICAgIHRoaXMubWF4Rm9udFNpemUsXG4gICAgICAodmFsKSA9PiB7XG4gICAgICAgIHN0eWxlLmZvbnRTaXplID0gdmFsICsgXCJweFwiO1xuICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgcmV0dXJuIHNob3VsZENsYW1wXG4gICAgICB9LFxuICAgICAgKHZhbCwgbWluKSA9PiB7XG4gICAgICAgIGlmICh2YWwgPiBtaW4pIHtcbiAgICAgICAgICBzdHlsZS5mb250U2l6ZSA9IG1pbiArIFwicHhcIjtcbiAgICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgfVxuICAgICAgICBkb25lID0gIXNob3VsZENsYW1wO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBjaGFuZ2VkID0gc3R5bGUuZm9udFNpemUgIT09IHN0YXJ0U2l6ZTtcblxuICAgIC8vIEVtaXQgc3BlY2lmaWMgc29mdENsYW1wIGV2ZW50IGZpcnN0XG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuc29mdGNsYW1wXCIpO1xuICAgIH1cblxuICAgIC8vIERvbid0IGVtaXQgYGxpbmVjbGFtcC5jbGFtcGAgZXZlbnQgdHdpY2UuXG4gICAgaWYgKCFkb25lICYmIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjaykge1xuICAgICAgdGhpcy5oYXJkQ2xhbXAoZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY2hhbmdlZCkge1xuICAgICAgLy8gaGFyZENsYW1wIGVtaXRzIGBsaW5lY2xhbXAuY2xhbXBgIHRvby4gT25seSBlbWl0IGZyb20gaGVyZSBpZiB3ZSdyZVxuICAgICAgLy8gbm90IGFsc28gaGFyZCBjbGFtcGluZy5cbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuY2xhbXBcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICogV2hldGhlciBoZWlnaHQgb2YgdGV4dCBvciBudW1iZXIgb2YgbGluZXMgZXhjZWVkIGNvbnN0cmFpbnRzLlxuICAgKlxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhIZWlnaHRcbiAgICogQHNlZSBMaW5lQ2xhbXAubWF4TGluZXNcbiAgICovXG4gIHNob3VsZENsYW1wKCkge1xuICAgIGNvbnN0IHsgbGluZUNvdW50LCB0ZXh0SGVpZ2h0IH0gPSB0aGlzLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCk7XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heEhlaWdodCAmJiB1bmRlZmluZWQgIT09IHRoaXMubWF4TGluZXMpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHQgfHwgbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0KSB7XG4gICAgICByZXR1cm4gdGV4dEhlaWdodCA+IHRoaXMubWF4SGVpZ2h0XG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIGxpbmVDb3VudCA+IHRoaXMubWF4TGluZXNcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIm1heExpbmVzIG9yIG1heEhlaWdodCBtdXN0IGJlIHNldCBiZWZvcmUgY2FsbGluZyBzaG91bGRDbGFtcCgpLlwiXG4gICAgKVxuICB9XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYSBiaW5hcnkgc2VhcmNoIGZvciB0aGUgbWF4aW11bSB3aG9sZSBudW1iZXIgaW4gYSBjb250aWdvdXMgcmFuZ2VcbiAqIHdoZXJlIGEgZ2l2ZW4gdGVzdCBjYWxsYmFjayB3aWxsIGdvIGZyb20gcmV0dXJuaW5nIHRydWUgdG8gcmV0dXJuaW5nIGZhbHNlLlxuICpcbiAqIFNpbmNlIHRoaXMgdXNlcyBhIGJpbmFyeS1zZWFyY2ggYWxnb3JpdGhtIHRoaXMgaXMgYW4gTyhsb2cgbikgZnVuY3Rpb24sXG4gKiB3aGVyZSBuID0gbWF4IC0gbWluLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIFRoZSBsb3dlciBib3VuZGFyeSBvZiB0aGUgcmFuZ2UuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogVGhlIHVwcGVyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0gdGVzdFxuICogQSBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHRoZSBjdXJyZW50IHZhbHVlIGluIHRoZSByYW5nZSBhbmQgcmV0dXJucyBhIHRydXRoeSBvciBmYWxzeSB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0gZG9uZVxuICogQSBmdW5jdGlvbiB0byBwZXJmb3JtIHdoZW4gY29tcGxldGUuIFJlY2VpdmVzIHRoZSBmb2xsb3dpbmcgcGFyYW1ldGVyc1xuICogLSBjdXJzb3JcbiAqIC0gbWF4UGFzc2luZ1ZhbHVlXG4gKiAtIG1pbkZhaWxpbmdWYWx1ZVxuICovXG5mdW5jdGlvbiBmaW5kQm91bmRhcnkobWluLCBtYXgsIHRlc3QsIGRvbmUpIHtcbiAgbGV0IGN1cnNvciA9IG1heDtcbiAgLy8gc3RhcnQgaGFsZndheSB0aHJvdWdoIHRoZSByYW5nZVxuICB3aGlsZSAobWF4ID4gbWluKSB7XG4gICAgaWYgKHRlc3QoY3Vyc29yKSkge1xuICAgICAgbWF4ID0gY3Vyc29yO1xuICAgIH0gZWxzZSB7XG4gICAgICBtaW4gPSBjdXJzb3I7XG4gICAgfVxuXG4gICAgaWYgKG1heCAtIG1pbiA9PT0gMSkge1xuICAgICAgZG9uZShjdXJzb3IsIG1pbiwgbWF4KTtcbiAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgY3Vyc29yID0gTWF0aC5yb3VuZCgobWluICsgbWF4KSAvIDIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXQoaW5zdGFuY2UsIHR5cGUpIHtcbiAgaW5zdGFuY2UuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCh0eXBlKSk7XG59XG5cbmV4cG9ydCB7IExpbmVDbGFtcCBhcyBkZWZhdWx0IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcImJlZ2luXCI6e1widGV4dFwiOlwiW2RlbGF5IDIwMDBdQ29ubmVjdGluZ1tkZWxheSAxMDAwXVtub3JtYWwgLl1bZGVsYXkgMTAwMF1bbm9ybWFsIC5dW2RlbGF5IDEwMDBdW25vcm1hbCAuXVtuZXdsaW5lXVwiLFwib3B0aW9uc1wiOltdfX0iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBCdWJibGVzIHtcbiAgICBjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRDtcbiAgICBidWJibGVzOiBBcnJheTxCdWJibGU+ID0gW107XG5cbiAgICBjb25zdHJ1Y3RvcihjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKSE7XG4gICAgICAgIHRoaXMucmVzaXplKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyMDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmJ1YmJsZXMucHVzaChuZXcgQnViYmxlKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMuY3R4LmNhbnZhcy53aWR0aCwgdGhpcy5jdHguY2FudmFzLmhlaWdodCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmJ1YmJsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmJ1YmJsZXNbaV0uc3BlZWQgPiAwICYmIHRoaXMuYnViYmxlc1tpXS5saWZldGltZSA8PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLnNwZWVkICo9IC0xO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0udXBkYXRlKGR0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLmJ1YmJsZXNbaV0uc2l6ZSA8PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldID0gbmV3IEJ1YmJsZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0uZHJhdyh0aGlzLmN0eCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXNpemUoKSB7XG4gICAgICAgIHZhciBkcHIgPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyB8fCAxO1xuICAgICAgICB2YXIgcmVjdCA9IHRoaXMuY3R4LmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgICAgICB0aGlzLmN0eC5jYW52YXMud2lkdGggPSByZWN0LndpZHRoICogZHByO1xuICAgICAgICB0aGlzLmN0eC5jYW52YXMuaGVpZ2h0ID0gcmVjdC5oZWlnaHQgKiBkcHI7XG5cbiAgICAgICAgdGhpcy5jdHguc2NhbGUoZHByLCBkcHIpO1xuXG4gICAgICAgIHRoaXMuY3R4LmZpbHRlciA9IFwiYmx1cig1MHB4KVwiO1xuICAgIH1cbn1cblxuY2xhc3MgQnViYmxlIHtcbiAgICBzcGVlZDogbnVtYmVyO1xuICAgIHg6IG51bWJlcjtcbiAgICB5OiBudW1iZXI7XG4gICAgc2l6ZTogbnVtYmVyO1xuICAgIGNvbG9yOiBzdHJpbmc7XG4gICAgbGlmZXRpbWU6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLnNwZWVkID0gMC4wNDtcblxuICAgICAgICB0aGlzLnggPSBNYXRoLnJhbmRvbSgpICogd2luZG93LmlubmVyV2lkdGg7XG4gICAgICAgIHRoaXMueSA9IE1hdGgucmFuZG9tKCkgKiB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cbiAgICAgICAgdGhpcy5zaXplID0gMDtcblxuICAgICAgICBsZXQgdiA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGxldCBodWUgPSB2IDwgMC41ID8gMTUwIDogMjMwO1xuICAgICAgICBsZXQgc2F0ID0gdiA8IDAuNSA/IDUwIDogODU7XG4gICAgICAgIGxldCBsaWdodCA9IHYgPCAwLjUgPyAyNSA6IDQwO1xuICAgICAgICB0aGlzLmNvbG9yID0gXCJoc2xhKFwiICsgaHVlICsgXCIsIFwiICsgc2F0ICsgXCIlLCBcIiArIGxpZ2h0ICsgXCIlLCA0MCUpXCI7XG5cbiAgICAgICAgdGhpcy5saWZldGltZSA9IE1hdGgucmFuZG9tKCkgKiogNSAqIDgwMDAgKyA1MDA7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zaXplICs9IHRoaXMuc3BlZWQgKiBkdDtcbiAgICAgICAgdGhpcy5saWZldGltZSAtPSBkdDtcbiAgICB9XG5cbiAgICBkcmF3KGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEKSB7XG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmNvbG9yO1xuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGN0eC5hcmModGhpcy54LCB0aGlzLnksIHRoaXMuc2l6ZSwgMCwgTWF0aC5QSSAqIDIpO1xuICAgICAgICBjdHguZmlsbCgpO1xuICAgIH1cbn1cbiIsImltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuaW1wb3J0IFN0YXRlTWFuYWdlciBmcm9tIFwiLi9zdGF0ZV9tYW5hZ2VyXCI7XG5pbXBvcnQgeyBCZWdpblN0YXRlIH0gZnJvbSBcIi4vc3RhdGVzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEdhbWUge1xuICAgIHRlcm06IFRlcm1pbmFsO1xuICAgIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKHRlcm1pbmFsOiBIVE1MRWxlbWVudCkge1xuICAgICAgICB0aGlzLnRlcm0gPSBuZXcgVGVybWluYWwodGVybWluYWwpO1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBuZXcgU3RhdGVNYW5hZ2VyKEJlZ2luU3RhdGUpO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMubWFuYWdlci51cGRhdGUoZHQsIHRoaXMudGVybSk7XG5cbiAgICAgICAgdGhpcy50ZXJtLnVwZGF0ZShkdCk7XG4gICAgfVxuXG4gICAgcmVzaXplKCkge1xuICAgICAgICB0aGlzLnRlcm0ucmVzaXplKCk7XG4gICAgfVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIHRoaXMubWFuYWdlci5rZXlkb3duKGUpO1xuICAgIH1cbn1cbiIsImltcG9ydCBTdGF0ZU1hbmFnZXIgZnJvbSBcIi4vc3RhdGVfbWFuYWdlclwiO1xuaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuL3Rlcm1pbmFsXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGFic3RyYWN0IGNsYXNzIFN0YXRlPFRPcHRpb25zIGV4dGVuZHMgb2JqZWN0PiB7XG4gICAgcHJvdGVjdGVkIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFN0YXRlTWFuYWdlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIGluaXQodGVybTogVGVybWluYWwsIG9wdGlvbnM6IFRPcHRpb25zKSB7fVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7fVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7fVxufVxuIiwiaW1wb3J0IFN0YXRlIGZyb20gXCIuL3N0YXRlXCI7XG5pbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU3RhdGVNYW5hZ2VyIHtcbiAgICBzdGF0ZTogU3RhdGU8b2JqZWN0PjtcbiAgICBpbml0T3B0aW9uczogb2JqZWN0IHwgbnVsbCA9IHt9O1xuXG4gICAgY29uc3RydWN0b3IoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlPGFueT4pIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5ldyBzKHRoaXMpO1xuICAgIH1cblxuICAgIHNldFN0YXRlPFQgZXh0ZW5kcyBvYmplY3Q+KFxuICAgICAgICBzOiBuZXcgKG06IFN0YXRlTWFuYWdlcikgPT4gU3RhdGU8VD4sXG4gICAgICAgIG9wdGlvbnM6IFRcbiAgICApIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5ldyBzKHRoaXMpO1xuICAgICAgICB0aGlzLmluaXRPcHRpb25zID0gb3B0aW9ucztcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5pdE9wdGlvbnMgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZS5pbml0KHRlcm0sIHRoaXMuaW5pdE9wdGlvbnMpO1xuICAgICAgICAgICAgdGhpcy5pbml0T3B0aW9ucyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN0YXRlLnVwZGF0ZShkdCwgdGVybSk7XG4gICAgfVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIHRoaXMuc3RhdGUua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG50eXBlIE9wdGlvbiA9IHtcbiAgICB0ZXh0OiBzdHJpbmc7XG4gICAgaWNvbjogc3RyaW5nO1xuICAgIG5leHQ6IHN0cmluZztcbn07XG5cbnR5cGUgU2NlbmUgPSB7XG4gICAgdGV4dDogc3RyaW5nO1xuICAgIG9wdGlvbnM6IE9wdGlvbltdO1xufTtcblxubGV0IHN0b3J5OiBSZWNvcmQ8c3RyaW5nLCBTY2VuZT4gPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5leHBvcnQgY2xhc3MgQmVnaW5TdGF0ZSBleHRlbmRzIFN0YXRlPHt9PiB7XG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCwgb3B0aW9uczoge30pIHtcbiAgICAgICAgdGVybS53cml0ZUxpbmUoXCJQcmVzcyBhbnkga2V5IHRvIGJlZ2luLi4uXCIpO1xuICAgIH1cblxuICAgIG92ZXJyaWRlIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIuc2V0U3RhdGUoV2lwZVN0YXRlLCB7fSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2lwZVN0YXRlIGV4dGVuZHMgU3RhdGU8e30+IHtcbiAgICBwcml2YXRlIHdpcGVUaW1lciA9IDA7XG4gICAgcHJpdmF0ZSB3aXBlVGlja3MgPSAwO1xuICAgIHByaXZhdGUgd2lwZUxpbmVzOiBudW1iZXI7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsLCBvcHRpb25zOiB7fSkge1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcImhpZGRlblwiO1xuICAgICAgICB0aGlzLndpcGVMaW5lcyA9IHRlcm0ubWF4TGluZXM7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLndpcGVUaW1lciA+IDUwKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53aXBlVGlja3MgPiA1KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlTGluZXMtLTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlVGlja3MrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGVybS5maWxsUmFuZG9tKHRoaXMud2lwZUxpbmVzKTtcblxuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2lwZUxpbmVzID49IDApIHtcbiAgICAgICAgICAgIHRoaXMud2lwZVRpbWVyICs9IGR0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGVybS5yZXNldCgpO1xuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLnNldFN0YXRlKFBsYXlpbmdTdGF0ZSwgeyB0ZXh0OiBzdG9yeVtcImJlZ2luXCJdLnRleHQgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQbGF5aW5nU3RhdGUgZXh0ZW5kcyBTdGF0ZTx7IHRleHQ6IHN0cmluZyB9PiB7XG4gICAgY3VyciA9IFwiYmVnaW5cIjtcblxuICAgIHJlbWFpbmluZ1RleHQgPSBcIlwiO1xuXG4gICAgZGVsYXkgPSAwO1xuXG4gICAgdGV4dERlY29kZWQgPSAtMTtcbiAgICB0ZXh0UG9zaXRpb24gPSAtMTtcbiAgICB0ZXh0VGltZXIgPSAtMTtcblxuICAgIG92ZXJyaWRlIGluaXQodGVybTogVGVybWluYWwsIG9wdGlvbnM6IHsgdGV4dDogc3RyaW5nIH0pIHtcbiAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gb3B0aW9ucy50ZXh0O1xuICAgIH1cblxuICAgIG92ZXJyaWRlIHVwZGF0ZShkdDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBpZiAodGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aCA9PSAwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuZGVsYXkgPD0gMCkge1xuICAgICAgICAgICAgbGV0IGNvbW1hbmRQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIltcIik7XG4gICAgICAgICAgICBpZiAoY29tbWFuZFBvcyA9PSAwKSB7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoXG4gICAgICAgICAgICAgICAgICAgIDEsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dC5pbmRleE9mKFwiXVwiKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgbGV0IGFyZ3MgPSBjb21tYW5kLnNwbGl0KFwiIFwiKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlQ29tbWFuZChhcmdzLCB0ZXJtKTtcblxuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0LmluZGV4T2YoXCJdXCIpICsgMVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVUZXh0KGNvbW1hbmRQb3MsIHRlcm0sIGR0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkgLT0gZHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHdyaXRlVGV4dChsZW46IG51bWJlciwgdGVybTogVGVybWluYWwsIGR0OiBudW1iZXIpIHtcbiAgICAgICAgaWYgKGxlbiA9PSAtMSkge1xuICAgICAgICAgICAgbGVuID0gdGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLnRleHREZWNvZGVkID0gMDtcbiAgICAgICAgICAgIHRoaXMudGV4dFBvc2l0aW9uID0gdGVybS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgdGhpcy50ZXh0VGltZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudGV4dERlY29kZWQgPT0gMCkge1xuICAgICAgICAgICAgaWYgKHRoaXMudGV4dFRpbWVyID4gMTAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCA9IDE7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0VGltZXIgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHRUaW1lciArPSBkdDtcbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKHRlcm0ucmFuZG9tQ2hhcmFjdGVycyhsZW4pLCB0aGlzLnRleHRQb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHRleHQgPVxuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDAsIHRoaXMudGV4dERlY29kZWQpICtcbiAgICAgICAgICAgIHRlcm0ucmFuZG9tQ2hhcmFjdGVycyhsZW4gLSB0aGlzLnRleHREZWNvZGVkKTtcblxuICAgICAgICB0ZXJtLndyaXRlKHRleHQsIHRoaXMudGV4dFBvc2l0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy50ZXh0RGVjb2RlZCA9PSBsZW4pIHtcbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShsZW4pO1xuICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCA9IC0xO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudGV4dFRpbWVyID4gNTApIHtcbiAgICAgICAgICAgIHRoaXMudGV4dERlY29kZWQrKztcbiAgICAgICAgICAgIHRoaXMudGV4dFRpbWVyID0gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnRleHRUaW1lciArPSBkdDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUNvbW1hbmQoYXJnczogQXJyYXk8c3RyaW5nPiwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgc3dpdGNoIChhcmdzWzBdKSB7XG4gICAgICAgICAgICBjYXNlIFwiZGVsYXlcIjpcbiAgICAgICAgICAgICAgICB0aGlzLmRlbGF5ID0gcGFyc2VJbnQoYXJnc1sxXSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwibm9ybWFsXCI6XG4gICAgICAgICAgICAgICAgdGVybS53cml0ZShhcmdzWzFdKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJuZXdsaW5lXCI6XG4gICAgICAgICAgICAgICAgdGVybS53cml0ZUxpbmUoXCJcIik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgTGluZUNsYW1wIGZyb20gXCJAdHZhbmMvbGluZWNsYW1wXCI7XHJcblxyXG5jb25zdCBDVVJTT1JfQkxJTktfSU5URVJWQUwgPSA1MDA7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUZXJtaW5hbCB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuXHJcbiAgICBmb250U2l6ZTogbnVtYmVyO1xyXG4gICAgd2lkdGg6IG51bWJlcjtcclxuICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgbGluZUhlaWdodDogbnVtYmVyO1xyXG5cclxuICAgIG1heExpbmVzOiBudW1iZXI7XHJcbiAgICBjaGFyc1BlckxpbmU6IG51bWJlcjtcclxuXHJcbiAgICBjb250ZW50ID0gXCI+IFwiO1xyXG5cclxuICAgIHByaXZhdGUgY3Vyc29yVmlzaWJsZSA9IHRydWU7XHJcbiAgICBwcml2YXRlIGN1cnNvckVuYWJsZWQgPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBjdXJzb3JUaWNrcyA9IDA7XHJcblxyXG4gICAgY29uc3RydWN0b3IoZWxlbTogSFRNTEVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBlbGVtO1xyXG5cclxuICAgICAgICB0aGlzLmZvbnRTaXplID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5mb250U2l6ZS5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMud2lkdGggPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLndpZHRoLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmhlaWdodC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XHJcbiAgICAgICAgY29uc3QgY2xhbXAgPSBuZXcgTGluZUNsYW1wKHRoaXMuZWxlbWVudCk7XHJcbiAgICAgICAgdGhpcy5saW5lSGVpZ2h0ID0gY2xhbXAuY2FsY3VsYXRlVGV4dE1ldHJpY3MoKS5hZGRpdGlvbmFsTGluZUhlaWdodDtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcIlwiO1xyXG5cclxuICAgICAgICB0aGlzLm1heExpbmVzID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAvIHRoaXMubGluZUhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5jaGFyc1BlckxpbmUgPSBNYXRoLmZsb29yKHRoaXMud2lkdGggLyAodGhpcy5mb250U2l6ZSAqIDAuNikpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlc2l6ZSgpIHtcclxuICAgICAgICB0aGlzLndpZHRoID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS53aWR0aC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5oZWlnaHQuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5tYXhMaW5lcyA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgLyB0aGlzLmxpbmVIZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2hhcnNQZXJMaW5lID0gTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gKHRoaXMuZm9udFNpemUgKiAwLjYpKTtcclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnNvckVuYWJsZWQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY3Vyc29yVGlja3MgPj0gQ1VSU09SX0JMSU5LX0lOVEVSVkFMKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnNvclRpY2tzID0gMDtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmxpcEN1cnNvcigpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJzb3JUaWNrcyArPSBkdDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzaG93KCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5pbm5lclRleHQgPSB0aGlzLmNvbnRlbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgY2xlYXIoKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgPSBcIlwiO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFBvc2l0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRlbnQubGVuZ3RoIC0gKHRoaXMuY3Vyc29yVmlzaWJsZSA/IDAgOiAxKTtcclxuICAgIH1cclxuXHJcbiAgICBwdXQodGV4dDogc3RyaW5nLCBwb3M/OiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgcG9zICE9IHVuZGVmaW5lZCAmJlxyXG4gICAgICAgICAgICBwb3MgPj0gMCAmJlxyXG4gICAgICAgICAgICBwb3MgPD0gdGhpcy5jb250ZW50Lmxlbmd0aCAtIHRleHQubGVuZ3RoXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCA9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgcG9zKSArXHJcbiAgICAgICAgICAgICAgICB0ZXh0ICtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudC5zbGljZShwb3MgKyB0ZXh0Lmxlbmd0aCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1dExpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgKz0gdGV4dCArIFwiXFxuPiBcIjtcclxuICAgIH1cclxuXHJcbiAgICByZXNldCgpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5wdXQoXCI+IFwiKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGUodGV4dDogc3RyaW5nLCBwb3M/OiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnB1dCh0ZXh0LCBwb3MpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB3cml0ZUxpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5wdXRMaW5lKHRleHQpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICByYW5kb21DaGFyYWN0ZXJzKGNvdW50OiBudW1iZXIpIHtcclxuICAgICAgICBsZXQgdmFsdWVzID0gbmV3IFVpbnQ4QXJyYXkoY291bnQpO1xyXG4gICAgICAgIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKHZhbHVlcyk7XHJcbiAgICAgICAgY29uc3QgbWFwcGVkVmFsdWVzID0gdmFsdWVzLm1hcCgoeCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBhZGogPSB4ICUgMzY7XHJcbiAgICAgICAgICAgIHJldHVybiBhZGogPCAyNiA/IGFkaiArIDY1IDogYWRqIC0gMjYgKyA0ODtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbWFwcGVkVmFsdWVzKTtcclxuICAgIH1cclxuXHJcbiAgICBmaWxsUmFuZG9tKGxpbmVzOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lczsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgICAgICB0aGlzLnB1dChcIlxcblwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5wdXQodGhpcy5yYW5kb21DaGFyYWN0ZXJzKHRoaXMuY2hhcnNQZXJMaW5lKSk7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0Q3Vyc29yRW5hYmxlZCh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuY3Vyc29yRW5hYmxlZCA9IHZhbHVlO1xyXG4gICAgICAgIC8vIGlmIHRoZSBjdXJzb3IgbmVlZGVkIHRvIGJlIHR1cm5lZCBvZmYsIGZpeCBpdFxyXG4gICAgICAgIGlmICghdGhpcy5jdXJzb3JFbmFibGVkICYmICF0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ID0gdGhpcy5jb250ZW50LnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZmxpcEN1cnNvcigpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCArPSBcIl9cIjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5jdXJzb3JWaXNpYmxlID0gIXRoaXMuY3Vyc29yVmlzaWJsZTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IEJ1YmJsZXMgZnJvbSBcIi4vYnViYmxlc1wiO1xuaW1wb3J0IEdhbWUgZnJvbSBcIi4vZ2FtZVwiO1xuXG5sZXQgZ2FtZTogR2FtZTtcblxubGV0IGJ1YmJsZXM6IEJ1YmJsZXM7XG5cbmxldCBsYXN0VGltZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbndpbmRvdy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgYnViYmxlcyA9IG5ldyBCdWJibGVzKFxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJhY2tncm91bmRcIikgYXMgSFRNTENhbnZhc0VsZW1lbnRcbiAgICApO1xuICAgIGdhbWUgPSBuZXcgR2FtZShkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRlcm1pbmFsXCIpISk7XG5cbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG59O1xuXG53aW5kb3cub25yZXNpemUgPSAoKSA9PiB7XG4gICAgYnViYmxlcy5yZXNpemUoKTtcbiAgICBnYW1lLnJlc2l6ZSgpO1xufTtcblxuZG9jdW1lbnQub25rZXlkb3duID0gKGUpID0+IHtcbiAgICBnYW1lLmtleWRvd24oZSk7XG59O1xuXG5kb2N1bWVudC5vbnZpc2liaWxpdHljaGFuZ2UgPSAoKSA9PiB7XG4gICAgaWYgKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSA9PSBcInZpc2libGVcIikge1xuICAgICAgICBsYXN0VGltZSA9IG51bGw7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgIC8vIFRoaXMgcmVhbGx5IHNob3VsZG4ndCBiZSBuZWVkZWQgaWYgYnJvd3NlcnMgYXJlIGZvbGxvd2luZyBjb252ZW50aW9uLFxuICAgIC8vIGJ1dCBiZXR0ZXIgc2FmZSB0aGFuIHNvcnJ5XG4gICAgaWYgKGRvY3VtZW50LmhpZGRlbikge1xuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGFzdFRpbWUgIT0gbnVsbCkge1xuICAgICAgICBsZXQgZHQgPSB0aW1lIC0gbGFzdFRpbWU7XG5cbiAgICAgICAgYnViYmxlcy51cGRhdGUoZHQpO1xuICAgICAgICBnYW1lLnVwZGF0ZShkdCk7XG4gICAgfVxuXG4gICAgbGFzdFRpbWUgPSB0aW1lO1xuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==