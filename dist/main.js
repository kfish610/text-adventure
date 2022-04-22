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

module.exports = {"main":{"text":"Connecting[delay 100].[delay 100].[delay 100].","options":[]}}

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

var Game = /** @class */ (function () {
    function Game(terminal) {
        this.begin = false;
        this.wipeTimer = 0;
        this.wipeTicks = 0;
        this.wipeLines = 0;
        this.term = new _terminal__WEBPACK_IMPORTED_MODULE_0__["default"](terminal);
        this.wipeLines = this.term.maxLines;
        this.term.element.style.overflow = "hidden";
        this.term.writeLine("Press any key to begin...");
    }
    Game.prototype.update = function (dt) {
        this.term.update(dt);
        if (!this.begin)
            return;
        if (this.wipeLines >= 0) {
            if (this.wipeTimer > 50) {
                this.wipeTimer = 0;
                this.wipeTicks++;
                if (this.wipeTicks >= 20) {
                    this.wipeLines--;
                }
                this.term.fillRandom(this.wipeLines);
            }
            if (this.wipeLines >= 0) {
                this.wipeTimer += dt;
            }
            else {
                this.term.reset();
            }
        }
    };
    Game.prototype.resize = function () {
        this.term.resize();
    };
    Game.prototype.keydown = function (e) {
        if (!this.begin) {
            this.begin = true;
        }
    };
    return Game;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Game);


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


var story = __webpack_require__(/*! ./story.cson */ "./src/story.cson");
var game;
var bubbles;
var lastTime = null;
window.onload = function () {
    bubbles = new _bubbles__WEBPACK_IMPORTED_MODULE_0__["default"](document.getElementById("background"));
    game = new _game__WEBPACK_IMPORTED_MODULE_1__["default"](document.getElementById("terminal"));
    console.log(story);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LENBQUM7SUFDakIsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ2xCLENBQUMsQ0FBQztBQUVGLFFBQVEsQ0FBQyxTQUFTLEdBQUcsVUFBQyxDQUFDO0lBQ25CLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDO0FBRUYsUUFBUSxDQUFDLGtCQUFrQixHQUFHO0lBQzFCLElBQUksUUFBUSxDQUFDLGVBQWUsSUFBSSxTQUFTLEVBQUU7UUFDdkMsUUFBUSxHQUFHLElBQUksQ0FBQztLQUNuQjtBQUNMLENBQUMsQ0FBQztBQUVGLFNBQVMsTUFBTSxDQUFDLElBQVk7SUFDeEIsd0VBQXdFO0lBQ3hFLDZCQUE2QjtJQUM3QixJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUU7UUFDakIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JDLE9BQU87S0FDVjtJQUVELElBQUksUUFBUSxJQUFJLElBQUksRUFBRTtRQUNsQixJQUFJLEVBQUUsR0FBRyxJQUFJLEdBQUcsUUFBUSxDQUFDO1FBRXpCLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUNuQjtJQUVELFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDaEIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3pDLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL25vZGVfbW9kdWxlcy9AdHZhbmMvbGluZWNsYW1wL2Rpc3QvZXNtLmpzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0b3J5LmNzb24iLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnViYmxlcy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9nYW1lLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3Rlcm1pbmFsLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWR1Y2VzIGZvbnQgc2l6ZSBvciB0cmltcyB0ZXh0IHRvIG1ha2UgaXQgZml0IHdpdGhpbiBzcGVjaWZpZWQgYm91bmRzLlxuICpcbiAqIFN1cHBvcnRzIGNsYW1waW5nIGJ5IG51bWJlciBvZiBsaW5lcyBvciB0ZXh0IGhlaWdodC5cbiAqXG4gKiBLbm93biBsaW1pdGF0aW9uczpcbiAqIDEuIENoYXJhY3RlcnMgdGhhdCBkaXN0b3J0IGxpbmUgaGVpZ2h0cyAoZW1vamlzLCB6YWxnbykgbWF5IGNhdXNlXG4gKiB1bmV4cGVjdGVkIHJlc3VsdHMuXG4gKiAyLiBDYWxsaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSB3aXBlcyBjaGlsZCBlbGVtZW50cy4gRnV0dXJlIHVwZGF0ZXMgbWF5IGFsbG93XG4gKiBpbmxpbmUgY2hpbGQgZWxlbWVudHMgdG8gYmUgcHJlc2VydmVkLlxuICpcbiAqIEB0b2RvIFNwbGl0IHRleHQgbWV0cmljcyBpbnRvIG93biBsaWJyYXJ5XG4gKiBAdG9kbyBUZXN0IG5vbi1MVFIgdGV4dFxuICovXG5jbGFzcyBMaW5lQ2xhbXAge1xuICAvKipcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxuICAgKiBUaGUgZWxlbWVudCB0byBjbGFtcC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBPcHRpb25zIHRvIGdvdmVybiBjbGFtcGluZyBiZWhhdmlvci5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heExpbmVzXVxuICAgKiBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdG8gYWxsb3cuIERlZmF1bHRzIHRvIDEuXG4gICAqIFRvIHNldCBhIG1heGltdW0gaGVpZ2h0IGluc3RlYWQsIHVzZSB7QHNlZSBvcHRpb25zLm1heEhlaWdodH1cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEhlaWdodF1cbiAgICogVGhlIG1heGltdW0gaGVpZ2h0IChpbiBwaXhlbHMpIG9mIHRleHQgaW4gYW4gZWxlbWVudC5cbiAgICogVGhpcyBvcHRpb24gaXMgdW5kZWZpbmVkIGJ5IGRlZmF1bHQuIE9uY2Ugc2V0LCBpdCB0YWtlcyBwcmVjZWRlbmNlIG92ZXJcbiAgICoge0BzZWUgb3B0aW9ucy5tYXhMaW5lc30uIE5vdGUgdGhhdCB0aGlzIGFwcGxpZXMgdG8gdGhlIGhlaWdodCBvZiB0aGUgdGV4dCwgbm90XG4gICAqIHRoZSBlbGVtZW50IGl0c2VsZi4gUmVzdHJpY3RpbmcgdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCBjYW4gYmUgYWNoaWV2ZWRcbiAgICogd2l0aCBDU1MgPGNvZGU+bWF4LWhlaWdodDwvY29kZT4uXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlU29mdENsYW1wXVxuICAgKiBJZiB0cnVlLCByZWR1Y2UgZm9udCBzaXplIChzb2Z0IGNsYW1wKSB0byBhdCBsZWFzdCB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfVxuICAgKiBiZWZvcmUgcmVzb3J0aW5nIHRvIHRyaW1taW5nIHRleHQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmhhcmRDbGFtcEFzRmFsbGJhY2tdXG4gICAqIElmIHRydWUsIHJlc29ydCB0byBoYXJkIGNsYW1waW5nIGlmIHNvZnQgY2xhbXBpbmcgcmVhY2hlcyB0aGUgbWluaW11bSBmb250IHNpemVcbiAgICogYW5kIHN0aWxsIGRvZXNuJ3QgZml0IHdpdGhpbiB0aGUgbWF4IGhlaWdodCBvciBudW1iZXIgb2YgbGluZXMuXG4gICAqIERlZmF1bHRzIHRvIHRydWUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5lbGxpcHNpc11cbiAgICogVGhlIGNoYXJhY3RlciB3aXRoIHdoaWNoIHRvIHJlcHJlc2VudCBjbGlwcGVkIHRyYWlsaW5nIHRleHQuXG4gICAqIFRoaXMgb3B0aW9uIHRha2VzIGVmZmVjdCB3aGVuIFwiaGFyZFwiIGNsYW1waW5nIGlzIHVzZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5Gb250U2l6ZV1cbiAgICogVGhlIGxvd2VzdCBmb250IHNpemUsIGluIHBpeGVscywgdG8gdHJ5IGJlZm9yZSByZXNvcnRpbmcgdG8gcmVtb3ZpbmdcbiAgICogdHJhaWxpbmcgdGV4dCAoaGFyZCBjbGFtcGluZykuIERlZmF1bHRzIHRvIDEuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhGb250U2l6ZV1cbiAgICogVGhlIG1heGltdW0gZm9udCBzaXplIGluIHBpeGVscy4gV2UnbGwgc3RhcnQgd2l0aCB0aGlzIGZvbnQgc2l6ZSB0aGVuXG4gICAqIHJlZHVjZSB1bnRpbCB0ZXh0IGZpdHMgY29uc3RyYWludHMsIG9yIGZvbnQgc2l6ZSBpcyBlcXVhbCB0b1xuICAgKiB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfS4gRGVmYXVsdHMgdG8gdGhlIGVsZW1lbnQncyBpbml0aWFsIGNvbXB1dGVkIGZvbnQgc2l6ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGVsZW1lbnQsXG4gICAge1xuICAgICAgbWF4TGluZXMgPSB1bmRlZmluZWQsXG4gICAgICBtYXhIZWlnaHQgPSB1bmRlZmluZWQsXG4gICAgICB1c2VTb2Z0Q2xhbXAgPSBmYWxzZSxcbiAgICAgIGhhcmRDbGFtcEFzRmFsbGJhY2sgPSB0cnVlLFxuICAgICAgbWluRm9udFNpemUgPSAxLFxuICAgICAgbWF4Rm9udFNpemUgPSB1bmRlZmluZWQsXG4gICAgICBlbGxpcHNpcyA9IFwi4oCmXCIsXG4gICAgfSA9IHt9XG4gICkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm9yaWdpbmFsV29yZHNcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IGVsZW1lbnQudGV4dENvbnRlbnQubWF0Y2goL1xcUytcXHMqL2cpIHx8IFtdLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwidXBkYXRlSGFuZGxlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogKCkgPT4gdGhpcy5hcHBseSgpLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib2JzZXJ2ZXJcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMudXBkYXRlSGFuZGxlciksXG4gICAgfSk7XG5cbiAgICBpZiAodW5kZWZpbmVkID09PSBtYXhGb250U2l6ZSkge1xuICAgICAgbWF4Rm9udFNpemUgPSBwYXJzZUludCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS5mb250U2l6ZSwgMTApO1xuICAgIH1cblxuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgdGhpcy5tYXhMaW5lcyA9IG1heExpbmVzO1xuICAgIHRoaXMubWF4SGVpZ2h0ID0gbWF4SGVpZ2h0O1xuICAgIHRoaXMudXNlU29mdENsYW1wID0gdXNlU29mdENsYW1wO1xuICAgIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjayA9IGhhcmRDbGFtcEFzRmFsbGJhY2s7XG4gICAgdGhpcy5taW5Gb250U2l6ZSA9IG1pbkZvbnRTaXplO1xuICAgIHRoaXMubWF4Rm9udFNpemUgPSBtYXhGb250U2l6ZTtcbiAgICB0aGlzLmVsbGlwc2lzID0gZWxsaXBzaXM7XG4gIH1cblxuICAvKipcbiAgICogR2F0aGVyIG1ldHJpY3MgYWJvdXQgdGhlIGxheW91dCBvZiB0aGUgZWxlbWVudCdzIHRleHQuXG4gICAqIFRoaXMgaXMgYSBzb21ld2hhdCBleHBlbnNpdmUgb3BlcmF0aW9uIC0gY2FsbCB3aXRoIGNhcmUuXG4gICAqXG4gICAqIEByZXR1cm5zIHtUZXh0TWV0cmljc31cbiAgICogTGF5b3V0IG1ldHJpY3MgZm9yIHRoZSBjbGFtcGVkIGVsZW1lbnQncyB0ZXh0LlxuICAgKi9cbiAgY2FsY3VsYXRlVGV4dE1ldHJpY3MoKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICBjb25zdCBjbG9uZSA9IGVsZW1lbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgIGNvbnN0IHN0eWxlID0gY2xvbmUuc3R5bGU7XG5cbiAgICAvLyBBcHBlbmQsIGRvbid0IHJlcGxhY2VcbiAgICBzdHlsZS5jc3NUZXh0ICs9IFwiO21pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7bWF4LWhlaWdodDpub25lIWltcG9ydGFudFwiO1xuICAgIGVsZW1lbnQucmVwbGFjZVdpdGgoY2xvbmUpO1xuXG4gICAgY29uc3QgbmF0dXJhbEhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodDtcblxuICAgIC8vIENsZWFyIHRvIG1lYXN1cmUgZW1wdHkgaGVpZ2h0LiB0ZXh0Q29udGVudCBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXCI7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgdGV4dEhlaWdodCA9IG5hdHVyYWxIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBGaWxsIGVsZW1lbnQgd2l0aCBzaW5nbGUgbm9uLWJyZWFraW5nIHNwYWNlIHRvIGZpbmQgaGVpZ2h0IG9mIG9uZSBsaW5lXG4gICAgY2xvbmUudGV4dENvbnRlbnQgPSBcIlxceGEwXCI7XG5cbiAgICAvLyBHZXQgaGVpZ2h0IG9mIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHRcbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgZmlyc3RMaW5lSGVpZ2h0ID0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lIC0gbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0O1xuXG4gICAgLy8gQWRkIGxpbmUgKDxicj4gKyBuYnNwKS4gYXBwZW5kQ2hpbGQoKSBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnJcIikpO1xuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXFx4YTBcIikpO1xuXG4gICAgY29uc3QgYWRkaXRpb25hbExpbmVIZWlnaHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmU7XG4gICAgY29uc3QgbGluZUNvdW50ID1cbiAgICAgIDEgKyAobmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSkgLyBhZGRpdGlvbmFsTGluZUhlaWdodDtcblxuICAgIC8vIFJlc3RvcmUgb3JpZ2luYWwgY29udGVudFxuICAgIGNsb25lLnJlcGxhY2VXaXRoKGVsZW1lbnQpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGVkZWYge09iamVjdH0gVGV4dE1ldHJpY3NcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7dGV4dEhlaWdodH1cbiAgICAgKiBUaGUgdmVydGljYWwgc3BhY2UgcmVxdWlyZWQgdG8gZGlzcGxheSB0aGUgZWxlbWVudCdzIGN1cnJlbnQgdGV4dC5cbiAgICAgKiBUaGlzIGlzIDxlbT5ub3Q8L2VtPiBuZWNlc3NhcmlseSB0aGUgc2FtZSBhcyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50LlxuICAgICAqIFRoaXMgbnVtYmVyIG1heSBldmVuIGJlIGdyZWF0ZXIgdGhhbiB0aGUgZWxlbWVudCdzIGhlaWdodCBpbiBjYXNlc1xuICAgICAqIHdoZXJlIHRoZSB0ZXh0IG92ZXJmbG93cyB0aGUgZWxlbWVudCdzIGJsb2NrIGF4aXMuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge25hdHVyYWxIZWlnaHRXaXRoT25lTGluZX1cbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdpdGggb25seSBvbmUgbGluZSBvZiB0ZXh0IGFuZCB3aXRob3V0XG4gICAgICogbWluaW11bSBvciBtYXhpbXVtIGhlaWdodHMuIFRoaXMgaW5mb3JtYXRpb24gbWF5IGJlIGhlbHBmdWwgd2hlblxuICAgICAqIGRlYWxpbmcgd2l0aCBpbmxpbmUgZWxlbWVudHMgKGFuZCBwb3RlbnRpYWxseSBvdGhlciBzY2VuYXJpb3MpLCB3aGVyZVxuICAgICAqIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3QgaW5jcmVhc2UgdGhlIGVsZW1lbnQncyBoZWlnaHQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2ZpcnN0TGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBhZGRzIHRvIHRoZSBlbGVtZW50LCBpLmUuLCB0aGVcbiAgICAgKiBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCB3aGlsZSBlbXB0eSBhbmQgdGhlIGhlaWdodFxuICAgICAqIG9mIHRoZSBlbGVtZW50IHdoaWxlIGl0IGNvbnRhaW5zIG9uZSBsaW5lIG9mIHRleHQuIFRoaXMgbnVtYmVyIG1heSBiZVxuICAgICAqIHplcm8gZm9yIGlubGluZSBlbGVtZW50cyBiZWNhdXNlIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3RcbiAgICAgKiBpbmNyZWFzZSB0aGUgaGVpZ2h0IG9mIGlubGluZSBlbGVtZW50cy5cblxuICAgICAqIEBwcm9wZXJ0eSB7YWRkaXRpb25hbExpbmVIZWlnaHR9XG4gICAgICogVGhlIGhlaWdodCB0aGF0IGVhY2ggbGluZSBvZiB0ZXh0IGFmdGVyIHRoZSBmaXJzdCBhZGRzIHRvIHRoZSBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtsaW5lQ291bnR9XG4gICAgICogVGhlIG51bWJlciBvZiBsaW5lcyBvZiB0ZXh0IHRoZSBlbGVtZW50IGNvbnRhaW5zLlxuICAgICAqL1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0SGVpZ2h0LFxuICAgICAgbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lLFxuICAgICAgZmlyc3RMaW5lSGVpZ2h0LFxuICAgICAgYWRkaXRpb25hbExpbmVIZWlnaHQsXG4gICAgICBsaW5lQ291bnQsXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBjaGFuZ2VzIHRoYXQgbWF5IGFmZmVjdCBsYXlvdXQuIFJlc3BvbmQgYnkgcmVjbGFtcGluZyBpZlxuICAgKiBuZWNlc3NhcnkuXG4gICAqL1xuICB3YXRjaCgpIHtcbiAgICBpZiAoIXRoaXMuX3dhdGNoaW5nKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgICAvLyBNaW5pbXVtIHJlcXVpcmVkIHRvIGRldGVjdCBjaGFuZ2VzIHRvIHRleHQgbm9kZXMsXG4gICAgICAvLyBhbmQgd2hvbGVzYWxlIHJlcGxhY2VtZW50IHZpYSBpbm5lckhUTUxcbiAgICAgIHRoaXMub2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmVsZW1lbnQsIHtcbiAgICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZSxcbiAgICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3dhdGNoaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3Agd2F0Y2hpbmcgZm9yIGxheW91dCBjaGFuZ2VzLlxuICAgKlxuICAgKiBAcmV0dXJucyB7TGluZUNsYW1wfVxuICAgKi9cbiAgdW53YXRjaCgpIHtcbiAgICB0aGlzLm9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgdGhpcy5fd2F0Y2hpbmcgPSBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ29uZHVjdCBlaXRoZXIgc29mdCBjbGFtcGluZyBvciBoYXJkIGNsYW1waW5nLCBhY2NvcmRpbmcgdG8gdGhlIHZhbHVlIG9mXG4gICAqIHByb3BlcnR5IHtAc2VlIExpbmVDbGFtcC51c2VTb2Z0Q2xhbXB9LlxuICAgKi9cbiAgYXBwbHkoKSB7XG4gICAgaWYgKHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQpIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzbHlXYXRjaGluZyA9IHRoaXMuX3dhdGNoaW5nO1xuXG4gICAgICAvLyBJZ25vcmUgaW50ZXJuYWxseSBzdGFydGVkIG11dGF0aW9ucywgbGVzdCB3ZSByZWN1cnNlIGludG8gb2JsaXZpb25cbiAgICAgIHRoaXMudW53YXRjaCgpO1xuXG4gICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSB0aGlzLm9yaWdpbmFsV29yZHMuam9pbihcIlwiKTtcblxuICAgICAgaWYgKHRoaXMudXNlU29mdENsYW1wKSB7XG4gICAgICAgIHRoaXMuc29mdENsYW1wKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhhcmRDbGFtcCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXN1bWUgb2JzZXJ2YXRpb24gaWYgcHJldmlvdXNseSB3YXRjaGluZ1xuICAgICAgaWYgKHByZXZpb3VzbHlXYXRjaGluZykge1xuICAgICAgICB0aGlzLndhdGNoKGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFRyaW1zIHRleHQgdW50aWwgaXQgZml0cyB3aXRoaW4gY29uc3RyYWludHNcbiAgICogKG1heGltdW0gaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcykuXG4gICAqXG4gICAqIEBzZWUge0xpbmVDbGFtcC5tYXhMaW5lc31cbiAgICogQHNlZSB7TGluZUNsYW1wLm1heEhlaWdodH1cbiAgICovXG4gIGhhcmRDbGFtcChza2lwQ2hlY2sgPSB0cnVlKSB7XG4gICAgaWYgKHNraXBDaGVjayB8fCB0aGlzLnNob3VsZENsYW1wKCkpIHtcbiAgICAgIGxldCBjdXJyZW50VGV4dDtcblxuICAgICAgZmluZEJvdW5kYXJ5KFxuICAgICAgICAxLFxuICAgICAgICB0aGlzLm9yaWdpbmFsV29yZHMubGVuZ3RoLFxuICAgICAgICAodmFsKSA9PiB7XG4gICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgdmFsKS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dDtcblxuICAgICAgICAgIHJldHVybiB0aGlzLnNob3VsZENsYW1wKClcbiAgICAgICAgfSxcbiAgICAgICAgKHZhbCwgbWluLCBtYXgpID0+IHtcbiAgICAgICAgICAvLyBBZGQgb25lIG1vcmUgd29yZCBpZiBub3Qgb24gbWF4XG4gICAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgbWF4KS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGVuIHRyaW0gbGV0dGVycyB1bnRpbCBpdCBmaXRzXG4gICAgICAgICAgZG8ge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSBjdXJyZW50VGV4dC5zbGljZSgwLCAtMSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dCArIHRoaXMuZWxsaXBzaXM7XG4gICAgICAgICAgfSB3aGlsZSAodGhpcy5zaG91bGRDbGFtcCgpKVxuXG4gICAgICAgICAgLy8gQnJvYWRjYXN0IG1vcmUgc3BlY2lmaWMgaGFyZENsYW1wIGV2ZW50IGZpcnN0XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5oYXJkY2xhbXBcIik7XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZHVjZXMgZm9udCBzaXplIHVudGlsIHRleHQgZml0cyB3aXRoaW4gdGhlIHNwZWNpZmllZCBoZWlnaHQgb3IgbnVtYmVyIG9mXG4gICAqIGxpbmVzLiBSZXNvcnRzIHRvIHVzaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSBpZiB0ZXh0IHN0aWxsIGV4Y2VlZHMgY2xhbXBcbiAgICogcGFyYW1ldGVycy5cbiAgICovXG4gIHNvZnRDbGFtcCgpIHtcbiAgICBjb25zdCBzdHlsZSA9IHRoaXMuZWxlbWVudC5zdHlsZTtcbiAgICBjb25zdCBzdGFydFNpemUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmZvbnRTaXplO1xuICAgIHN0eWxlLmZvbnRTaXplID0gXCJcIjtcblxuICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgbGV0IHNob3VsZENsYW1wO1xuXG4gICAgZmluZEJvdW5kYXJ5KFxuICAgICAgdGhpcy5taW5Gb250U2l6ZSxcbiAgICAgIHRoaXMubWF4Rm9udFNpemUsXG4gICAgICAodmFsKSA9PiB7XG4gICAgICAgIHN0eWxlLmZvbnRTaXplID0gdmFsICsgXCJweFwiO1xuICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgcmV0dXJuIHNob3VsZENsYW1wXG4gICAgICB9LFxuICAgICAgKHZhbCwgbWluKSA9PiB7XG4gICAgICAgIGlmICh2YWwgPiBtaW4pIHtcbiAgICAgICAgICBzdHlsZS5mb250U2l6ZSA9IG1pbiArIFwicHhcIjtcbiAgICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgfVxuICAgICAgICBkb25lID0gIXNob3VsZENsYW1wO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBjaGFuZ2VkID0gc3R5bGUuZm9udFNpemUgIT09IHN0YXJ0U2l6ZTtcblxuICAgIC8vIEVtaXQgc3BlY2lmaWMgc29mdENsYW1wIGV2ZW50IGZpcnN0XG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuc29mdGNsYW1wXCIpO1xuICAgIH1cblxuICAgIC8vIERvbid0IGVtaXQgYGxpbmVjbGFtcC5jbGFtcGAgZXZlbnQgdHdpY2UuXG4gICAgaWYgKCFkb25lICYmIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjaykge1xuICAgICAgdGhpcy5oYXJkQ2xhbXAoZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY2hhbmdlZCkge1xuICAgICAgLy8gaGFyZENsYW1wIGVtaXRzIGBsaW5lY2xhbXAuY2xhbXBgIHRvby4gT25seSBlbWl0IGZyb20gaGVyZSBpZiB3ZSdyZVxuICAgICAgLy8gbm90IGFsc28gaGFyZCBjbGFtcGluZy5cbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuY2xhbXBcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICogV2hldGhlciBoZWlnaHQgb2YgdGV4dCBvciBudW1iZXIgb2YgbGluZXMgZXhjZWVkIGNvbnN0cmFpbnRzLlxuICAgKlxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhIZWlnaHRcbiAgICogQHNlZSBMaW5lQ2xhbXAubWF4TGluZXNcbiAgICovXG4gIHNob3VsZENsYW1wKCkge1xuICAgIGNvbnN0IHsgbGluZUNvdW50LCB0ZXh0SGVpZ2h0IH0gPSB0aGlzLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCk7XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heEhlaWdodCAmJiB1bmRlZmluZWQgIT09IHRoaXMubWF4TGluZXMpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHQgfHwgbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0KSB7XG4gICAgICByZXR1cm4gdGV4dEhlaWdodCA+IHRoaXMubWF4SGVpZ2h0XG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIGxpbmVDb3VudCA+IHRoaXMubWF4TGluZXNcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIm1heExpbmVzIG9yIG1heEhlaWdodCBtdXN0IGJlIHNldCBiZWZvcmUgY2FsbGluZyBzaG91bGRDbGFtcCgpLlwiXG4gICAgKVxuICB9XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYSBiaW5hcnkgc2VhcmNoIGZvciB0aGUgbWF4aW11bSB3aG9sZSBudW1iZXIgaW4gYSBjb250aWdvdXMgcmFuZ2VcbiAqIHdoZXJlIGEgZ2l2ZW4gdGVzdCBjYWxsYmFjayB3aWxsIGdvIGZyb20gcmV0dXJuaW5nIHRydWUgdG8gcmV0dXJuaW5nIGZhbHNlLlxuICpcbiAqIFNpbmNlIHRoaXMgdXNlcyBhIGJpbmFyeS1zZWFyY2ggYWxnb3JpdGhtIHRoaXMgaXMgYW4gTyhsb2cgbikgZnVuY3Rpb24sXG4gKiB3aGVyZSBuID0gbWF4IC0gbWluLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIFRoZSBsb3dlciBib3VuZGFyeSBvZiB0aGUgcmFuZ2UuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogVGhlIHVwcGVyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0gdGVzdFxuICogQSBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHRoZSBjdXJyZW50IHZhbHVlIGluIHRoZSByYW5nZSBhbmQgcmV0dXJucyBhIHRydXRoeSBvciBmYWxzeSB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0gZG9uZVxuICogQSBmdW5jdGlvbiB0byBwZXJmb3JtIHdoZW4gY29tcGxldGUuIFJlY2VpdmVzIHRoZSBmb2xsb3dpbmcgcGFyYW1ldGVyc1xuICogLSBjdXJzb3JcbiAqIC0gbWF4UGFzc2luZ1ZhbHVlXG4gKiAtIG1pbkZhaWxpbmdWYWx1ZVxuICovXG5mdW5jdGlvbiBmaW5kQm91bmRhcnkobWluLCBtYXgsIHRlc3QsIGRvbmUpIHtcbiAgbGV0IGN1cnNvciA9IG1heDtcbiAgLy8gc3RhcnQgaGFsZndheSB0aHJvdWdoIHRoZSByYW5nZVxuICB3aGlsZSAobWF4ID4gbWluKSB7XG4gICAgaWYgKHRlc3QoY3Vyc29yKSkge1xuICAgICAgbWF4ID0gY3Vyc29yO1xuICAgIH0gZWxzZSB7XG4gICAgICBtaW4gPSBjdXJzb3I7XG4gICAgfVxuXG4gICAgaWYgKG1heCAtIG1pbiA9PT0gMSkge1xuICAgICAgZG9uZShjdXJzb3IsIG1pbiwgbWF4KTtcbiAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgY3Vyc29yID0gTWF0aC5yb3VuZCgobWluICsgbWF4KSAvIDIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXQoaW5zdGFuY2UsIHR5cGUpIHtcbiAgaW5zdGFuY2UuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCh0eXBlKSk7XG59XG5cbmV4cG9ydCB7IExpbmVDbGFtcCBhcyBkZWZhdWx0IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcIm1haW5cIjp7XCJ0ZXh0XCI6XCJDb25uZWN0aW5nW2RlbGF5IDEwMF0uW2RlbGF5IDEwMF0uW2RlbGF5IDEwMF0uXCIsXCJvcHRpb25zXCI6W119fSIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1YmJsZXMge1xuICAgIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuICAgIGJ1YmJsZXM6IEFycmF5PEJ1YmJsZT4gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5jdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcbiAgICAgICAgdGhpcy5yZXNpemUoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDIwOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYnViYmxlcy5wdXNoKG5ldyBCdWJibGUoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLmN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy5jdHguY2FudmFzLndpZHRoLCB0aGlzLmN0eC5jYW52YXMuaGVpZ2h0KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYnViYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zcGVlZCA+IDAgJiYgdGhpcy5idWJibGVzW2ldLmxpZmV0aW1lIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0uc3BlZWQgKj0gLTE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS51cGRhdGUoZHQpO1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zaXplIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0gPSBuZXcgQnViYmxlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5kcmF3KHRoaXMuY3R4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdmFyIGRwciA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIHx8IDE7XG4gICAgICAgIHZhciByZWN0ID0gdGhpcy5jdHguY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy53aWR0aCA9IHJlY3Qud2lkdGggKiBkcHI7XG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodCAqIGRwcjtcblxuICAgICAgICB0aGlzLmN0eC5maWx0ZXIgPSBcImJsdXIoNTBweClcIjtcbiAgICB9XG59XG5cbmNsYXNzIEJ1YmJsZSB7XG4gICAgc3BlZWQ6IG51bWJlcjtcbiAgICB4OiBudW1iZXI7XG4gICAgeTogbnVtYmVyO1xuICAgIHNpemU6IG51bWJlcjtcbiAgICBjb2xvcjogc3RyaW5nO1xuICAgIGxpZmV0aW1lOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5zcGVlZCA9IDAuMDQ7XG5cbiAgICAgICAgdGhpcy54ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLnJhbmRvbSgpICogd2luZG93LmlubmVySGVpZ2h0O1xuXG4gICAgICAgIHRoaXMuc2l6ZSA9IDA7XG5cbiAgICAgICAgbGV0IHYgPSBNYXRoLnJhbmRvbSgpO1xuICAgICAgICBsZXQgaHVlID0gdiA8IDAuNSA/IDE1MCA6IDIzMDtcbiAgICAgICAgbGV0IHNhdCA9IHYgPCAwLjUgPyA1MCA6IDg1O1xuICAgICAgICBsZXQgbGlnaHQgPSB2IDwgMC41ID8gMjUgOiA0MDtcbiAgICAgICAgdGhpcy5jb2xvciA9IFwiaHNsYShcIiArIGh1ZSArIFwiLCBcIiArIHNhdCArIFwiJSwgXCIgKyBsaWdodCArIFwiJSwgNDAlKVwiO1xuXG4gICAgICAgIHRoaXMubGlmZXRpbWUgPSBNYXRoLnJhbmRvbSgpICoqIDUgKiA4MDAwICsgNTAwO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc2l6ZSArPSB0aGlzLnNwZWVkICogZHQ7XG4gICAgICAgIHRoaXMubGlmZXRpbWUgLT0gZHQ7XG4gICAgfVxuXG4gICAgZHJhdyhjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCkge1xuICAgICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5jb2xvcjtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKHRoaXMueCwgdGhpcy55LCB0aGlzLnNpemUsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGwoKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgR2FtZSB7XG4gICAgdGVybTogVGVybWluYWw7XG5cbiAgICBwcml2YXRlIGJlZ2luID0gZmFsc2U7XG4gICAgcHJpdmF0ZSB3aXBlVGltZXIgPSAwO1xuICAgIHByaXZhdGUgd2lwZVRpY2tzID0gMDtcbiAgICBwcml2YXRlIHdpcGVMaW5lcyA9IDA7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZXJtaW5hbDogSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy50ZXJtID0gbmV3IFRlcm1pbmFsKHRlcm1pbmFsKTtcbiAgICAgICAgdGhpcy53aXBlTGluZXMgPSB0aGlzLnRlcm0ubWF4TGluZXM7XG5cbiAgICAgICAgdGhpcy50ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcImhpZGRlblwiO1xuICAgICAgICB0aGlzLnRlcm0ud3JpdGVMaW5lKFwiUHJlc3MgYW55IGtleSB0byBiZWdpbi4uLlwiKTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLnRlcm0udXBkYXRlKGR0KTtcblxuICAgICAgICBpZiAoIXRoaXMuYmVnaW4pIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy53aXBlTGluZXMgPj0gMCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2lwZVRpbWVyID4gNTApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVUaW1lciA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlVGlja3MrKztcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLndpcGVUaWNrcyA+PSAyMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndpcGVMaW5lcy0tO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMudGVybS5maWxsUmFuZG9tKHRoaXMud2lwZUxpbmVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMud2lwZUxpbmVzID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVUaW1lciArPSBkdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXJtLnJlc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXNpemUoKSB7XG4gICAgICAgIHRoaXMudGVybS5yZXNpemUoKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLmJlZ2luKSB7XG4gICAgICAgICAgICB0aGlzLmJlZ2luID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCBMaW5lQ2xhbXAgZnJvbSBcIkB0dmFuYy9saW5lY2xhbXBcIjtcclxuXHJcbmNvbnN0IENVUlNPUl9CTElOS19JTlRFUlZBTCA9IDUwMDtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRlcm1pbmFsIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG5cclxuICAgIGZvbnRTaXplOiBudW1iZXI7XHJcbiAgICB3aWR0aDogbnVtYmVyO1xyXG4gICAgaGVpZ2h0OiBudW1iZXI7XHJcbiAgICBsaW5lSGVpZ2h0OiBudW1iZXI7XHJcblxyXG4gICAgbWF4TGluZXM6IG51bWJlcjtcclxuICAgIGNoYXJzUGVyTGluZTogbnVtYmVyO1xyXG5cclxuICAgIGNvbnRlbnQgPSBcIj4gXCI7XHJcblxyXG4gICAgcHJpdmF0ZSBjdXJzb3JWaXNpYmxlID0gdHJ1ZTtcclxuICAgIHByaXZhdGUgY3Vyc29yRW5hYmxlZCA9IHRydWU7XHJcbiAgICBwcml2YXRlIGN1cnNvclRpY2tzID0gMDtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihlbGVtOiBIVE1MRWxlbWVudCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGVsZW07XHJcblxyXG4gICAgICAgIHRoaXMuZm9udFNpemUgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmZvbnRTaXplLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkud2lkdGguc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuaGVpZ2h0LnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcclxuICAgICAgICBjb25zdCBjbGFtcCA9IG5ldyBMaW5lQ2xhbXAodGhpcy5lbGVtZW50KTtcclxuICAgICAgICB0aGlzLmxpbmVIZWlnaHQgPSBjbGFtcC5jYWxjdWxhdGVUZXh0TWV0cmljcygpLmFkZGl0aW9uYWxMaW5lSGVpZ2h0O1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiXCI7XHJcblxyXG4gICAgICAgIHRoaXMubWF4TGluZXMgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0IC8gdGhpcy5saW5lSGVpZ2h0KTtcclxuICAgICAgICB0aGlzLmNoYXJzUGVyTGluZSA9IE1hdGguZmxvb3IodGhpcy53aWR0aCAvICh0aGlzLmZvbnRTaXplICogMC42KSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzaXplKCkge1xyXG4gICAgICAgIHRoaXMud2lkdGggPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLndpZHRoLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmhlaWdodC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICB0aGlzLm1heExpbmVzID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAvIHRoaXMubGluZUhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5jaGFyc1BlckxpbmUgPSBNYXRoLmZsb29yKHRoaXMud2lkdGggLyAodGhpcy5mb250U2l6ZSAqIDAuNikpO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3Vyc29yRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJzb3JUaWNrcyA+PSBDVVJTT1JfQkxJTktfSU5URVJWQUwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Vyc29yVGlja3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ3Vyc29yKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnNvclRpY2tzICs9IGR0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHNob3coKSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmlubmVyVGV4dCA9IHRoaXMuY29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICBjbGVhcigpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCA9IFwiXCI7XHJcbiAgICB9XHJcblxyXG4gICAgcHV0KHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHV0TGluZSh0ZXh0OiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCArPSB0ZXh0ICsgXCJcXG4+IFwiO1xyXG4gICAgfVxyXG5cclxuICAgIHJlc2V0KCkge1xyXG4gICAgICAgIHRoaXMuY2xlYXIoKTtcclxuICAgICAgICB0aGlzLnB1dChcIj4gXCIpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB3cml0ZSh0ZXh0OiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnB1dCh0ZXh0KTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGVMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMucHV0TGluZSh0ZXh0KTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZmlsbFJhbmRvbShsaW5lczogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXM7IGkrKykge1xyXG4gICAgICAgICAgICB0aGlzLnB1dCh0aGlzLnJhbmRvbUNoYXJhY3RlcnModGhpcy5jaGFyc1BlckxpbmUpKTtcclxuICAgICAgICAgICAgdGhpcy5wdXQoXCJcXG5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldEN1cnNvckVuYWJsZWQodmFsdWU6IGJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLmN1cnNvckVuYWJsZWQgPSB2YWx1ZTtcclxuICAgICAgICAvLyBpZiB0aGUgY3Vyc29yIG5lZWRlZCB0byBiZSB0dXJuZWQgb2ZmLCBmaXggaXRcclxuICAgICAgICBpZiAoIXRoaXMuY3Vyc29yRW5hYmxlZCAmJiAhdGhpcy5jdXJzb3JWaXNpYmxlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgICAgICB0aGlzLmN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGZsaXBDdXJzb3IoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3Vyc29yRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJzb3JWaXNpYmxlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgKz0gXCJfXCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgPSB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9ICF0aGlzLmN1cnNvclZpc2libGU7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHJhbmRvbUNoYXJhY3RlcnMoY291bnQ6IG51bWJlcikge1xyXG4gICAgICAgIGxldCB2YWx1ZXMgPSBuZXcgVWludDhBcnJheShjb3VudCk7XHJcbiAgICAgICAgd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXModmFsdWVzKTtcclxuICAgICAgICBjb25zdCBtYXBwZWRWYWx1ZXMgPSB2YWx1ZXMubWFwKCh4KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGFkaiA9IHggJSAzNjtcclxuICAgICAgICAgICAgcmV0dXJuIGFkaiA8IDI2ID8gYWRqICsgNjUgOiBhZGogLSAyNiArIDQ4O1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBtYXBwZWRWYWx1ZXMpO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IEJ1YmJsZXMgZnJvbSBcIi4vYnViYmxlc1wiO1xuaW1wb3J0IEdhbWUgZnJvbSBcIi4vZ2FtZVwiO1xuXG50eXBlIE9wdGlvbiA9IHtcbiAgICB0ZXh0OiBzdHJpbmc7XG4gICAgaWNvbjogc3RyaW5nO1xuICAgIG5leHQ6IHN0cmluZztcbn07XG5cbnR5cGUgU2NlbmUgPSB7XG4gICAgdGV4dDogc3RyaW5nO1xuICAgIG9wdGlvbnM6IE9wdGlvbltdO1xufTtcblxubGV0IHN0b3J5OiBSZWNvcmQ8c3RyaW5nLCBTY2VuZT4gPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5sZXQgZ2FtZTogR2FtZTtcblxubGV0IGJ1YmJsZXM6IEJ1YmJsZXM7XG5cbmxldCBsYXN0VGltZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbndpbmRvdy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgYnViYmxlcyA9IG5ldyBCdWJibGVzKFxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJhY2tncm91bmRcIikgYXMgSFRNTENhbnZhc0VsZW1lbnRcbiAgICApO1xuICAgIGdhbWUgPSBuZXcgR2FtZShkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRlcm1pbmFsXCIpISk7XG5cbiAgICBjb25zb2xlLmxvZyhzdG9yeSk7XG5cbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG59O1xuXG53aW5kb3cub25yZXNpemUgPSAoKSA9PiB7XG4gICAgYnViYmxlcy5yZXNpemUoKTtcbiAgICBnYW1lLnJlc2l6ZSgpO1xufTtcblxuZG9jdW1lbnQub25rZXlkb3duID0gKGUpID0+IHtcbiAgICBnYW1lLmtleWRvd24oZSk7XG59O1xuXG5kb2N1bWVudC5vbnZpc2liaWxpdHljaGFuZ2UgPSAoKSA9PiB7XG4gICAgaWYgKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSA9PSBcInZpc2libGVcIikge1xuICAgICAgICBsYXN0VGltZSA9IG51bGw7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgIC8vIFRoaXMgcmVhbGx5IHNob3VsZG4ndCBiZSBuZWVkZWQgaWYgYnJvd3NlcnMgYXJlIGZvbGxvd2luZyBjb252ZW50aW9uLFxuICAgIC8vIGJ1dCBiZXR0ZXIgc2FmZSB0aGFuIHNvcnJ5XG4gICAgaWYgKGRvY3VtZW50LmhpZGRlbikge1xuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGFzdFRpbWUgIT0gbnVsbCkge1xuICAgICAgICBsZXQgZHQgPSB0aW1lIC0gbGFzdFRpbWU7XG5cbiAgICAgICAgYnViYmxlcy51cGRhdGUoZHQpO1xuICAgICAgICBnYW1lLnVwZGF0ZShkdCk7XG4gICAgfVxuXG4gICAgbGFzdFRpbWUgPSB0aW1lO1xuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==