/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@tvanc/lineclamp/dist/esm.js":
/*!***************************************************!*\
  !*** ./node_modules/@tvanc/lineclamp/dist/esm.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ LineClamp)\n/* harmony export */ });\n/**\n * Reduces font size or trims text to make it fit within specified bounds.\n *\n * Supports clamping by number of lines or text height.\n *\n * Known limitations:\n * 1. Characters that distort line heights (emojis, zalgo) may cause\n * unexpected results.\n * 2. Calling {@see hardClamp()} wipes child elements. Future updates may allow\n * inline child elements to be preserved.\n *\n * @todo Split text metrics into own library\n * @todo Test non-LTR text\n */\nclass LineClamp {\n  /**\n   * @param {HTMLElement} element\n   * The element to clamp.\n   *\n   * @param {Object} [options]\n   * Options to govern clamping behavior.\n   *\n   * @param {number} [options.maxLines]\n   * The maximum number of lines to allow. Defaults to 1.\n   * To set a maximum height instead, use {@see options.maxHeight}\n   *\n   * @param {number} [options.maxHeight]\n   * The maximum height (in pixels) of text in an element.\n   * This option is undefined by default. Once set, it takes precedence over\n   * {@see options.maxLines}. Note that this applies to the height of the text, not\n   * the element itself. Restricting the height of the element can be achieved\n   * with CSS <code>max-height</code>.\n   *\n   * @param {boolean} [options.useSoftClamp]\n   * If true, reduce font size (soft clamp) to at least {@see options.minFontSize}\n   * before resorting to trimming text. Defaults to false.\n   *\n   * @param {boolean} [options.hardClampAsFallback]\n   * If true, resort to hard clamping if soft clamping reaches the minimum font size\n   * and still doesn't fit within the max height or number of lines.\n   * Defaults to true.\n   *\n   * @param {string} [options.ellipsis]\n   * The character with which to represent clipped trailing text.\n   * This option takes effect when \"hard\" clamping is used.\n   *\n   * @param {number} [options.minFontSize]\n   * The lowest font size, in pixels, to try before resorting to removing\n   * trailing text (hard clamping). Defaults to 1.\n   *\n   * @param {number} [options.maxFontSize]\n   * The maximum font size in pixels. We'll start with this font size then\n   * reduce until text fits constraints, or font size is equal to\n   * {@see options.minFontSize}. Defaults to the element's initial computed font size.\n   */\n  constructor(\n    element,\n    {\n      maxLines = undefined,\n      maxHeight = undefined,\n      useSoftClamp = false,\n      hardClampAsFallback = true,\n      minFontSize = 1,\n      maxFontSize = undefined,\n      ellipsis = \"…\",\n    } = {}\n  ) {\n    Object.defineProperty(this, \"originalWords\", {\n      writable: false,\n      value: element.textContent.match(/\\S+\\s*/g) || [],\n    });\n\n    Object.defineProperty(this, \"updateHandler\", {\n      writable: false,\n      value: () => this.apply(),\n    });\n\n    Object.defineProperty(this, \"observer\", {\n      writable: false,\n      value: new MutationObserver(this.updateHandler),\n    });\n\n    if (undefined === maxFontSize) {\n      maxFontSize = parseInt(window.getComputedStyle(element).fontSize, 10);\n    }\n\n    this.element = element;\n    this.maxLines = maxLines;\n    this.maxHeight = maxHeight;\n    this.useSoftClamp = useSoftClamp;\n    this.hardClampAsFallback = hardClampAsFallback;\n    this.minFontSize = minFontSize;\n    this.maxFontSize = maxFontSize;\n    this.ellipsis = ellipsis;\n  }\n\n  /**\n   * Gather metrics about the layout of the element's text.\n   * This is a somewhat expensive operation - call with care.\n   *\n   * @returns {TextMetrics}\n   * Layout metrics for the clamped element's text.\n   */\n  calculateTextMetrics() {\n    const element = this.element;\n    const clone = element.cloneNode(true);\n    const style = clone.style;\n\n    // Append, don't replace\n    style.cssText += \";min-height:0!important;max-height:none!important\";\n    element.replaceWith(clone);\n\n    const naturalHeight = clone.offsetHeight;\n\n    // Clear to measure empty height. textContent faster than innerHTML\n    clone.textContent = \"\";\n\n    const naturalHeightWithoutText = clone.offsetHeight;\n    const textHeight = naturalHeight - naturalHeightWithoutText;\n\n    // Fill element with single non-breaking space to find height of one line\n    clone.textContent = \"\\xa0\";\n\n    // Get height of element with only one line of text\n    const naturalHeightWithOneLine = clone.offsetHeight;\n    const firstLineHeight = naturalHeightWithOneLine - naturalHeightWithoutText;\n\n    // Add line (<br> + nbsp). appendChild() faster than innerHTML\n    clone.appendChild(document.createElement(\"br\"));\n    clone.appendChild(document.createTextNode(\"\\xa0\"));\n\n    const additionalLineHeight = clone.offsetHeight - naturalHeightWithOneLine;\n    const lineCount =\n      1 + (naturalHeight - naturalHeightWithOneLine) / additionalLineHeight;\n\n    // Restore original content\n    clone.replaceWith(element);\n\n    /**\n     * @typedef {Object} TextMetrics\n     *\n     * @property {textHeight}\n     * The vertical space required to display the element's current text.\n     * This is <em>not</em> necessarily the same as the height of the element.\n     * This number may even be greater than the element's height in cases\n     * where the text overflows the element's block axis.\n     *\n     * @property {naturalHeightWithOneLine}\n     * The height of the element with only one line of text and without\n     * minimum or maximum heights. This information may be helpful when\n     * dealing with inline elements (and potentially other scenarios), where\n     * the first line of text does not increase the element's height.\n     *\n     * @property {firstLineHeight}\n     * The height that the first line of text adds to the element, i.e., the\n     * difference between the height of the element while empty and the height\n     * of the element while it contains one line of text. This number may be\n     * zero for inline elements because the first line of text does not\n     * increase the height of inline elements.\n\n     * @property {additionalLineHeight}\n     * The height that each line of text after the first adds to the element.\n     *\n     * @property {lineCount}\n     * The number of lines of text the element contains.\n     */\n    return {\n      textHeight,\n      naturalHeightWithOneLine,\n      firstLineHeight,\n      additionalLineHeight,\n      lineCount,\n    }\n  }\n\n  /**\n   * Watch for changes that may affect layout. Respond by reclamping if\n   * necessary.\n   */\n  watch() {\n    if (!this._watching) {\n      window.addEventListener(\"resize\", this.updateHandler);\n\n      // Minimum required to detect changes to text nodes,\n      // and wholesale replacement via innerHTML\n      this.observer.observe(this.element, {\n        characterData: true,\n        subtree: true,\n        childList: true,\n        attributes: true,\n      });\n\n      this._watching = true;\n    }\n\n    return this\n  }\n\n  /**\n   * Stop watching for layout changes.\n   *\n   * @returns {LineClamp}\n   */\n  unwatch() {\n    this.observer.disconnect();\n    window.removeEventListener(\"resize\", this.updateHandler);\n\n    this._watching = false;\n\n    return this\n  }\n\n  /**\n   * Conduct either soft clamping or hard clamping, according to the value of\n   * property {@see LineClamp.useSoftClamp}.\n   */\n  apply() {\n    if (this.element.offsetHeight) {\n      const previouslyWatching = this._watching;\n\n      // Ignore internally started mutations, lest we recurse into oblivion\n      this.unwatch();\n\n      this.element.textContent = this.originalWords.join(\"\");\n\n      if (this.useSoftClamp) {\n        this.softClamp();\n      } else {\n        this.hardClamp();\n      }\n\n      // Resume observation if previously watching\n      if (previouslyWatching) {\n        this.watch(false);\n      }\n    }\n\n    return this\n  }\n\n  /**\n   * Trims text until it fits within constraints\n   * (maximum height or number of lines).\n   *\n   * @see {LineClamp.maxLines}\n   * @see {LineClamp.maxHeight}\n   */\n  hardClamp(skipCheck = true) {\n    if (skipCheck || this.shouldClamp()) {\n      let currentText;\n\n      findBoundary(\n        1,\n        this.originalWords.length,\n        (val) => {\n          currentText = this.originalWords.slice(0, val).join(\" \");\n          this.element.textContent = currentText;\n\n          return this.shouldClamp()\n        },\n        (val, min, max) => {\n          // Add one more word if not on max\n          if (val > min) {\n            currentText = this.originalWords.slice(0, max).join(\" \");\n          }\n\n          // Then trim letters until it fits\n          do {\n            currentText = currentText.slice(0, -1);\n            this.element.textContent = currentText + this.ellipsis;\n          } while (this.shouldClamp())\n\n          // Broadcast more specific hardClamp event first\n          emit(this, \"lineclamp.hardclamp\");\n          emit(this, \"lineclamp.clamp\");\n        }\n      );\n    }\n\n    return this\n  }\n\n  /**\n   * Reduces font size until text fits within the specified height or number of\n   * lines. Resorts to using {@see hardClamp()} if text still exceeds clamp\n   * parameters.\n   */\n  softClamp() {\n    const style = this.element.style;\n    const startSize = window.getComputedStyle(this.element).fontSize;\n    style.fontSize = \"\";\n\n    let done = false;\n    let shouldClamp;\n\n    findBoundary(\n      this.minFontSize,\n      this.maxFontSize,\n      (val) => {\n        style.fontSize = val + \"px\";\n        shouldClamp = this.shouldClamp();\n        return shouldClamp\n      },\n      (val, min) => {\n        if (val > min) {\n          style.fontSize = min + \"px\";\n          shouldClamp = this.shouldClamp();\n        }\n        done = !shouldClamp;\n      }\n    );\n\n    const changed = style.fontSize !== startSize;\n\n    // Emit specific softClamp event first\n    if (changed) {\n      emit(this, \"lineclamp.softclamp\");\n    }\n\n    // Don't emit `lineclamp.clamp` event twice.\n    if (!done && this.hardClampAsFallback) {\n      this.hardClamp(false);\n    } else if (changed) {\n      // hardClamp emits `lineclamp.clamp` too. Only emit from here if we're\n      // not also hard clamping.\n      emit(this, \"lineclamp.clamp\");\n    }\n\n    return this\n  }\n\n  /**\n   * @returns {boolean}\n   * Whether height of text or number of lines exceed constraints.\n   *\n   * @see LineClamp.maxHeight\n   * @see LineClamp.maxLines\n   */\n  shouldClamp() {\n    const { lineCount, textHeight } = this.calculateTextMetrics();\n\n    if (undefined !== this.maxHeight && undefined !== this.maxLines) {\n      return textHeight > this.maxHeight || lineCount > this.maxLines\n    }\n\n    if (undefined !== this.maxHeight) {\n      return textHeight > this.maxHeight\n    }\n\n    if (undefined !== this.maxLines) {\n      return lineCount > this.maxLines\n    }\n\n    throw new Error(\n      \"maxLines or maxHeight must be set before calling shouldClamp().\"\n    )\n  }\n}\n\n/**\n * Performs a binary search for the maximum whole number in a contigous range\n * where a given test callback will go from returning true to returning false.\n *\n * Since this uses a binary-search algorithm this is an O(log n) function,\n * where n = max - min.\n *\n * @param {Number} min\n * The lower boundary of the range.\n *\n * @param {Number} max\n * The upper boundary of the range.\n *\n * @param test\n * A callback that receives the current value in the range and returns a truthy or falsy value.\n *\n * @param done\n * A function to perform when complete. Receives the following parameters\n * - cursor\n * - maxPassingValue\n * - minFailingValue\n */\nfunction findBoundary(min, max, test, done) {\n  let cursor = max;\n  // start halfway through the range\n  while (max > min) {\n    if (test(cursor)) {\n      max = cursor;\n    } else {\n      min = cursor;\n    }\n\n    if (max - min === 1) {\n      done(cursor, min, max);\n      break\n    }\n\n    cursor = Math.round((min + max) / 2);\n  }\n}\n\nfunction emit(instance, type) {\n  instance.element.dispatchEvent(new CustomEvent(type));\n}\n\n\n\n\n//# sourceURL=webpack://text-adventure/./node_modules/@tvanc/lineclamp/dist/esm.js?");

/***/ }),

/***/ "./src/bubbles.js":
/*!************************!*\
  !*** ./src/bubbles.js ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"load\": () => (/* binding */ load),\n/* harmony export */   \"resize\": () => (/* binding */ resize),\n/* harmony export */   \"visibilityChanged\": () => (/* binding */ visibilityChanged)\n/* harmony export */ });\nlet bubbles = [];\r\nlet ctx;\r\nlet lastTime;\r\n\r\nfunction resize() {\r\n    var dpr = window.devicePixelRatio || 1;\r\n    var rect = ctx.canvas.getBoundingClientRect();\r\n\r\n    ctx.canvas.width = rect.width * dpr;\r\n    ctx.canvas.height = rect.height * dpr;\r\n\r\n    ctx.filter = \"blur(50px)\";\r\n}\r\n\r\nfunction visibilityChanged() {\r\n    if (document.visibilityState == \"visible\") {\r\n        lastTime = null;\r\n    }\r\n};\r\n\r\nfunction load() {\r\n    let canvas = document.getElementById(\"background\");\r\n\r\n    ctx = canvas.getContext(\"2d\");\r\n    resize();\r\n\r\n    for (let i = 0; i < 60; i++) {\r\n        bubbles[i] = new Bubble();\r\n    }\r\n\r\n    window.requestAnimationFrame(draw);\r\n};\r\n\r\nfunction draw(time) {\r\n    if (lastTime != null) {\r\n        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);\r\n\r\n        let dt = time - lastTime;\r\n        for (let i = 0; i < bubbles.length; i++) {\r\n            if (bubbles[i].speed > 0 && bubbles[i].lifetime <= 0) {\r\n                bubbles[i].speed *= -1;\r\n            }\r\n\r\n            bubbles[i].update(dt);\r\n            if (bubbles[i].size <= 0) {\r\n                bubbles[i] = new Bubble();\r\n            } else {\r\n                bubbles[i].draw();\r\n            }\r\n        }\r\n    }\r\n\r\n    lastTime = time;\r\n    if (!document.hidden) {\r\n        window.requestAnimationFrame(draw);\r\n    }\r\n}\r\n\r\nclass Bubble {\r\n    constructor() {\r\n        this.speed = 0.03;\r\n\r\n        this.x = Math.random() * window.innerWidth;\r\n        this.y = Math.random() * window.innerHeight;\r\n\r\n        this.size = 0;\r\n\r\n        let v = Math.random();\r\n        let hue = v < 0.5 ? 150 : 230;\r\n        let sat = v < 0.5 ? 50 : 85;\r\n        let light = v < 0.5 ? 25 : 40;\r\n        this.color = \"hsla(\" + hue + \", \"+ sat +\"%, \" + light + \"%, 40%)\";\r\n\r\n        this.lifetime = (Math.random() ** 5) * 7000 + 500;\r\n    }\r\n\r\n    update(dt) {\r\n        this.size += this.speed * dt;\r\n        this.lifetime -= dt;\r\n    }\r\n\r\n    draw() {\r\n        ctx.fillStyle = this.color;\r\n        ctx.beginPath();\r\n        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)\r\n        ctx.fill();\r\n    }\r\n}\n\n//# sourceURL=webpack://text-adventure/./src/bubbles.js?");

/***/ }),

/***/ "./src/game.js":
/*!*********************!*\
  !*** ./src/game.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ Game)\n/* harmony export */ });\n/* harmony import */ var _terminal_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./terminal.js */ \"./src/terminal.js\");\n\n\nclass Game {\n    #firstKey = true;\n\n    load() {\n        this.term = new _terminal_js__WEBPACK_IMPORTED_MODULE_0__[\"default\"](document.getElementById(\"terminal\"));\n        this.term.element.style.overflow = \"hidden\";\n\n        this.term.init();\n        this.term.writeLine(\"Press any key to begin...\");\n    }\n\n    resize() {\n        \n    }\n\n    keydown(e) {\n        if(this.#firstKey) {\n            this.#firstKey = false;\n            this.term.setWaiting(false);\n            setTimeout(this.#wipeTerminal.bind(this, Date.now(), this.term.maxLines), 50);\n        }\n    }\n\n    #wipeTerminal(startTime, lines) {\n        if(startTime < 0 || Date.now() - startTime >= 1000) {\n            startTime = -1;\n            lines--;\n        }\n\n        if(lines < 0) {\n            this.term.element.style.overflow = null;\n            this.term.clear();\n            this.term.put(\"> \");\n            this.term.show();\n            this.term.setWaiting(true);\n            return;\n        }\n\n        this.#showRandomText(lines);\n\n        setTimeout(this.#wipeTerminal.bind(this, startTime, lines), 50);\n    }\n\n    #showRandomText(lines) {\n        this.term.clear();\n        for (let i = 0; i < lines; i++) {\n            this.term.put(this.#randomCharacters(this.term.charsPerLine));\n            this.term.put(\"\\n\");\n        }\n        this.term.put(this.#randomCharacters(this.term.charsPerLine));\n        this.term.show();\n    }\n\n    #randomCharacters(count) {\n        let values = new Uint8Array(count)\n        window.crypto.getRandomValues(values);\n        const mappedValues = values.map(x => {\n            const adj = x % 36;\n            return adj < 26 ? adj + 65 : adj - 26 + 48;\n        });\n\n        return String.fromCharCode.apply(null, mappedValues);\n    }\n}\n\n//# sourceURL=webpack://text-adventure/./src/game.js?");

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _bubbles_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./bubbles.js */ \"./src/bubbles.js\");\n/* harmony import */ var _game_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./game.js */ \"./src/game.js\");\n\r\n\r\n\r\n\r\n\r\nlet game;\r\n\r\nwindow.onload = () => {\r\n    _bubbles_js__WEBPACK_IMPORTED_MODULE_0__.load();\r\n\r\n    game = new _game_js__WEBPACK_IMPORTED_MODULE_1__[\"default\"]();\r\n    game.load();\r\n}\r\n\r\nwindow.onresize = () => {\r\n    _bubbles_js__WEBPACK_IMPORTED_MODULE_0__.resize();\r\n\r\n    game.resize();\r\n};\r\n\r\ndocument.onkeydown = e => {\r\n    game.keydown(e);\r\n}\r\n\r\ndocument.onvisibilitychange = () => {\r\n    _bubbles_js__WEBPACK_IMPORTED_MODULE_0__.visibilityChanged();\r\n}\n\n//# sourceURL=webpack://text-adventure/./src/index.js?");

/***/ }),

/***/ "./src/terminal.js":
/*!*************************!*\
  !*** ./src/terminal.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ Terminal)\n/* harmony export */ });\n/* harmony import */ var _tvanc_lineclamp__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tvanc/lineclamp */ \"./node_modules/@tvanc/lineclamp/dist/esm.js\");\n\r\n\r\nclass Terminal {\r\n    element;\r\n    #cursor = false;\r\n    #waiting = false;\r\n    content = \"\";\r\n\r\n    constructor(elem) {\r\n        this.element = elem;\r\n\r\n        this.fontSize = parseInt(getComputedStyle(this.element).fontSize.slice(0, -2));\r\n        this.width = parseInt(getComputedStyle(this.element).width.slice(0, -2));\r\n        this.height = parseInt(getComputedStyle(this.element).height.slice(0, -2));\r\n        \r\n        this.element.style.position = \"absolute\";\r\n        const clamp = new _tvanc_lineclamp__WEBPACK_IMPORTED_MODULE_0__[\"default\"](this.element);\r\n        this.lineHeight = clamp.calculateTextMetrics().additionalLineHeight;\r\n        this.element.style.position = null;\r\n\r\n        this.maxLines = Math.floor(this.height/this.lineHeight);\r\n        this.charsPerLine = Math.floor(this.width / (this.fontSize * 0.6));\r\n    }\r\n\r\n    init() {\r\n        this.#cursor = true;\r\n        this.#waiting = true;\r\n        this.content = \"> \";\r\n        this.#flipCursor();\r\n    }\r\n\r\n    resize() {\r\n        this.width = parseInt(getComputedStyle(term.element).width.slice(0, -2));\r\n        this.height = parseInt(getComputedStyle(term.element).height.slice(0, -2));\r\n\r\n        this.maxLines = Math.floor(height/lineHeight);\r\n        this.charsPerLine = Math.floor(width / (fontSize * 0.6));\r\n    }\r\n\r\n    clear() {\r\n        this.content = \"\";\r\n    }\r\n\r\n    put(text) {\r\n        this.setWaiting(false);\r\n        this.content += text;\r\n    }\r\n\r\n    putLine(text) {\r\n        this.setWaiting(false);\r\n        this.content += text + \"\\n> \";\r\n        this.setWaiting(true);\r\n    }\r\n\r\n    write(text) {\r\n        this.put(text);\r\n        this.show();\r\n    }\r\n\r\n    writeLine(text) {\r\n        this.putLine(text);\r\n        this.show();\r\n    }\r\n\r\n    show() {\r\n        this.element.innerText = this.content;\r\n    }\r\n\r\n    setWaiting(waiting) {\r\n        this.#waiting = waiting;\r\n        // if the cursor needed to be turned off, fix it\r\n        if (!this.#waiting && !this.#cursor) {\r\n            this.content = this.content.slice(0, -1);\r\n            this.show();\r\n            this.#cursor = true;\r\n        }\r\n    }\r\n\r\n    #flipCursor() {\r\n        if (this.#waiting) {\r\n            if (this.#cursor) {\r\n                this.content += \"_\";\r\n            } else {\r\n                this.content = this.content.slice(0, -1);\r\n            }\r\n            this.#cursor = !this.#cursor;\r\n            this.show();\r\n        }\r\n\r\n        setTimeout(this.#flipCursor.bind(this), 500);\r\n    }\r\n}\n\n//# sourceURL=webpack://text-adventure/./src/terminal.js?");

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
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.js");
/******/ 	
/******/ })()
;