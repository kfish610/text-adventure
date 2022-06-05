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

module.exports = {"begin":{"text":"[delay 500]Connecting[delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750]\n[sound alarm.wav]<em>Beep</em> [delay 1000]<em>Beep</em> [delay 1000]<em>Beep</em>[delay 1000]\n[sound click.wav]You wake up slowly to the sound of your alarm.\nIt drones on and on until you wake up enough to turn it off.\nWhat do you do?","options":[{"icon":"newspaper","text":"Check the news","next":"checkNews"},{"icon":"arrow-up-from-bracket","text":"Get out of bed","next":"getUp"}]},"checkNews":{"text":"You grab your Augmented Reality glasses from your nightstand and put them on.\nAs you scroll somewhat absentmindedly through the news, one story catches your eye.\nAn image of a flooded town off of the Missisippi River.\nMurky brown water everywhere, past waist height.\nCars, buildings, and trees barely above the surface.\n[image https://images.foxtv.com/static.fox7austin.com/www.fox7austin.com/content/uploads/2020/02/932/524/Flooding-in-MIssissippi-.jpg?ve=1&tl=1]\nNature is a cruel mistress, you think.\nBut then again, we've always had to deal with natural disasters, right?\nWell, thats enough of the news for today. That stuff is always just depressing.","loop":"begin"},"getUp":{"text":"You get up and get ready for the day.\nWhen you come back out of the bathroom, you notice two things:\n1. It's freezing in here\n2. Your room is a mess","options":[{"icon":"fan","text":"Turn off the A/C","next":"turnOff"},{"icon":"folder","text":"Check out the mess","next":"mess","return":"continue"},{"icon":"arrow-up-from-bracket","text":"Leave","next":"leave"}]},"turnOff":{"text":"As you go over to turn off the air conditioning, you take a look out the window. Just as you expected, its cloudy and rainy. The A/C must have been making the temperature even colder than it already was outside.\nYou've had it turned all the way up for the past few days due to the heatwave. You'd been worried that it wasn't going to end: you had never seen a heatwave go for that long or that hot in your life. Clearly it's over now, though, if the temperature is anything to go by.\nYou adjust the A/C's settings in its app on your AR glasses. On to more important things.","loop":"getUp"},"mess":{"text":"You spend so much time at work nowadays that your room is pretty messy. In theory, all of your materials would be contained in the folder on your desk, but you spend so much time reorganizing and adjusting that it all ends up strewn about. You'd probably be better off using virtual documents, but something about feeling the papers in your hand still appeals to you more than just seeing them.\nYou pick up what few papers remain the folder and flick through them. They're the three studies you've based your presentation on. You stare at them for a little, pensively. You'd always wanted to be the one doing the research. That's why you took this job; presenting research seemed like a good way to get some connections, not to mention you needed the money. But at some point you lost track of that goal, and even though you can probably afford to go back to school now, being a researcher feels like someone else's dream. The kind of thing a kid tells themself before they've been exposed to the real world.\nThis job is fine. It pays well. <b>It's fine</b>.\nAnyway, you have three studies in the folder.\nDo you want to review any of them before the big hearing later?","options":[{"icon":"industry","text":"CCS Study","next":"ccs"},{"icon":"fire-flame-simple","text":"Efficiency Study","next":"efficiency"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"lca"},{"icon":"arrow-up-from-bracket","text":"Continue","next":"continue"}]},"ccs":{"text":"This study is about CCS, Carbon Capture and Storage. It's a technology that significantly reduces the carbon emissions of coal and natural gas power plants, by up to 90%. So of course, the fossil fuels corporation you work for is pretty interested in it as a way to keep their business... up to date with the times. This study is an overview of past and current research into CCS technologies, some of which promise to reduce emissions by up to 95% or even more. It also has some low level explanations of how the technology works, such as some diagrams of possible processes.\n[image https://ars.els-cdn.com/content/image/1-s2.0-S0048969720367346-gr1.jpg]\nOf course, the extra work needed to capture and store the carbon dioxide does make the cost of electricity for CCS plants higher, and the technology can never reduce emissions to near zero like renewables. The study does note that, but your supervisor said not to focus on that part so much. After all, how much harm could just a little more carbon dioxide really do?","loop":"mess"},"efficiency":{"text":"This study is an analysis of the cost efficiency of various fossil fuel energy sources compared to renewable sources. The study found that all together, renewables cost about 6-8 cents per kilowatt-hour (kWh), while fossil fuel sources like coal and natural gas cost about 4-5 cents per kWh, depending on the source. Your supervisor was very insistent you highlight that while a 2 or 3 cent difference may not seem like much, if you multiply it over the whole power grid, it starts to add up. And you suppose that makes sense; if the government is going to be subsidizing energy, it might as well get the most out of each dollar.\nThe study, being funded by the company you work for, neglects to mention the cost increases from the use of CCS, which you've been told raise it up to about the same levels as renewables, if not more. But you've been assured that your company is working hard to make CCS cheaper, and once they do that they'll be sure to switch over. So that makes you feel a little better... you think. Until then though the company is still intending to focus on non-CCS plants. You won't be mentioning that either.","loop":"mess"},"lca":{"text":"This study you're not supposed to have. Your supervisor had been making a big fuss about some new lifecycle analysis that would show fossil fuels weren't as bad as everyone thought, but a couple of months later they had just stopped talking about it. So you did a little digging, found the researchers who did the study, and asked them for a copy. \nOnce they sent it to you, you quickly realized why you hadn't heard any more about it. Rather than find evidence that fossil fuels weren't as destructive as people thought, they actually found evidence that certain aspects of the process were more destructive than initially thought.\nYou're not sure why you kept the study. You certainly aren't going to use it at today's hearing, that would be... bad for your job security, to say the least. But something about it keeps nagging at you. Maybe it's the enormity of it all. You know about climate change—it's hard to ignore it with all the protests that have been going on recently—but as far as you can tell, everything seems to be fine. Sure, there's been a lot of floods in some other states recently, and there's definitely been a lot of heatwaves here in Texas, but none of it seems that bad. But seeing the sheer amount of carbon being emitted, together with references to the direct and indirect effects, even in a fossil fuel funded study; it makes you uncomfortable, to say the least.\nYou put the study back in the folder. You shouldn't be distracting yourself with that today. This is possibly the biggest hearing of your career. If you mess this up, it'll mean the majority of fossil fuel subsidies will be diverted to renewable energy, and less money for your employer means less money for you. No mistakes today.","loop":"mess"},"continue":{"text":"You turn your attention to the rest of the room.","loop":"getUp"},"leave":{"text":"You're a bit early, but you decide you might as well head to the virtual conference center already. It's a bit of a pain having to go somewhere just to have a better video capture, but you want to look your best. At least its better than having to fly to D.C. to attend the hearing: you know some people at your company who have been lobbying a whole lot longer than you, and they won't stop talking about how much of a pain the business trips used to be.\nOf course, you don't have a car; gas is more expensive than ever, and driving is becoming increasingly unfashionable nowadays. You could take the bus, but you'd like some privacy while you prepare yourself, so you call a taxi instead. Still, you're faced with a choice: normal car, or flying car?","options":[{"icon":"car","text":"Normal Car","next":"normalCar"},{"icon":"plane","text":"Flying Car","next":"flyingCar"}]},"normalCar":{"text":"Despite the novelty of a flying car, a standard car is probably the more reasonable option. It's certainly the most economical option, though the difference between them has been getting surprisingly small, all considered. The car arrives-the decrease of human drivers has made traffic almost a thing of the past at this point-and you get in.\n[background traffic.mp3]As the car drives off, you look out the window. You see a lot of business, but weirdly, most of them seem empty. Then you realize why. On nearly every building, there's an AR flyer attached to it, with something along the lines of \"now hiring\". You'd seen a piece in the news recently about how low-wage workers were getting hit hard by heat stress in the recent string of heatwaves. The air conditioners weren't up to the task of a nearly week long heatwave. But you had assumed it was just a couple of people that were effected. This doesn't really seem like just a couple of people, though. \nBut you're sure this is just a temporary thing. It's a once in a lifetime heatwave, after all. Then again, you'd seen on the weather forecast that temperatures were supposed to go back up the rest of this week, and that today is just an outlier. But... they're probably just missing something. You're sure things will go back to normal soon. Probably.\nYou're shaken out of your thoughts by the car slowing down and stopping. You're here. \nTime to go inside and get ready for the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Enter","next":"enter"}]},"flyingCar":{"text":"You decide on the flying car. You can spend a little extra just for today; it is an important day after all. Plus, it'll get you there faster. And the views are much nicer. You wait a minute, and then hear the whirring of the rotors on the car. To be honest you had always imagined flying cars as floating, or maybe with wings like an airplane. But you suppose technology is rarely exactly what we expect it to be. You get in the car, and it takes off.\n[background flying.mp3]You look out the window as the ground drifts further from you. You're not sure you'll ever get used to that. Still, it's a nice view. Unfortunately, your view is occasionally blocked by an advertisement. It's not exactly surprising that they're all over the sky; we put billboards everywhere on highways. But it would have been nice to leave this sight unblemished. At least they're not physically in the air, only visible in your AR glasses. In fact, usually you'd just take them off, but you have to be watching for messages from your company, just in case. So you're going to have to deal with the occasional ad drifting into view.\nOne in particular catches your eye. At first, it just looked like a cloud of smoke, but then you see it reform in the letters \"DECARBONIZE\". Well, it's an impressive rendering, you'll give them that. The smoke then continues to reform into different words and sentences. \n\"Do you really want this in your air?\"[delay 1000]\n\"We're at a tipping point\"[delay 1000]\n\"There is no Earth 2\"[delay 1000]\n\"There's still time to fix this\"[delay 1000]\n\"Zero carbon by 2100\"[delay 1000]\nIt then links to a website, which you quickly wave away. You scoff. Zero carbon? There's no way we could do that, right? And even if we could, carbon dioxide isn't <em>that</em> bad. Right? The lifecycle analysis in your folder nags at you... but you push the thought away. Focus. Your supervisor told you not to worry about the environmental impacts so much. So it's probably fine.\nYou're shaken out of your thoughts by the car landing. You're here. \nTime to go inside and get ready for the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Enter","next":"enter"}]}}

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
            this.background.stop();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QyxFQUFFO1FBQ3ZCLElBQUksRUFBRSxHQUFHLElBQUksR0FBRyxRQUFRLENBQUM7UUFFekIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ25CO0lBRUQsUUFBUSxHQUFHLElBQUksQ0FBQztJQUNoQixNQUFNLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vbm9kZV9tb2R1bGVzL0B0dmFuYy9saW5lY2xhbXAvZGlzdC9lc20uanMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RvcnkuY3NvbiIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9hdWRpb19tYW5hZ2VyLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2J1YmJsZXMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnV0dG9ucy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9nYW1lLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlX21hbmFnZXIudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGVzLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3Rlcm1pbmFsLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWR1Y2VzIGZvbnQgc2l6ZSBvciB0cmltcyB0ZXh0IHRvIG1ha2UgaXQgZml0IHdpdGhpbiBzcGVjaWZpZWQgYm91bmRzLlxuICpcbiAqIFN1cHBvcnRzIGNsYW1waW5nIGJ5IG51bWJlciBvZiBsaW5lcyBvciB0ZXh0IGhlaWdodC5cbiAqXG4gKiBLbm93biBsaW1pdGF0aW9uczpcbiAqIDEuIENoYXJhY3RlcnMgdGhhdCBkaXN0b3J0IGxpbmUgaGVpZ2h0cyAoZW1vamlzLCB6YWxnbykgbWF5IGNhdXNlXG4gKiB1bmV4cGVjdGVkIHJlc3VsdHMuXG4gKiAyLiBDYWxsaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSB3aXBlcyBjaGlsZCBlbGVtZW50cy4gRnV0dXJlIHVwZGF0ZXMgbWF5IGFsbG93XG4gKiBpbmxpbmUgY2hpbGQgZWxlbWVudHMgdG8gYmUgcHJlc2VydmVkLlxuICpcbiAqIEB0b2RvIFNwbGl0IHRleHQgbWV0cmljcyBpbnRvIG93biBsaWJyYXJ5XG4gKiBAdG9kbyBUZXN0IG5vbi1MVFIgdGV4dFxuICovXG5jbGFzcyBMaW5lQ2xhbXAge1xuICAvKipcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxuICAgKiBUaGUgZWxlbWVudCB0byBjbGFtcC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBPcHRpb25zIHRvIGdvdmVybiBjbGFtcGluZyBiZWhhdmlvci5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heExpbmVzXVxuICAgKiBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdG8gYWxsb3cuIERlZmF1bHRzIHRvIDEuXG4gICAqIFRvIHNldCBhIG1heGltdW0gaGVpZ2h0IGluc3RlYWQsIHVzZSB7QHNlZSBvcHRpb25zLm1heEhlaWdodH1cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEhlaWdodF1cbiAgICogVGhlIG1heGltdW0gaGVpZ2h0IChpbiBwaXhlbHMpIG9mIHRleHQgaW4gYW4gZWxlbWVudC5cbiAgICogVGhpcyBvcHRpb24gaXMgdW5kZWZpbmVkIGJ5IGRlZmF1bHQuIE9uY2Ugc2V0LCBpdCB0YWtlcyBwcmVjZWRlbmNlIG92ZXJcbiAgICoge0BzZWUgb3B0aW9ucy5tYXhMaW5lc30uIE5vdGUgdGhhdCB0aGlzIGFwcGxpZXMgdG8gdGhlIGhlaWdodCBvZiB0aGUgdGV4dCwgbm90XG4gICAqIHRoZSBlbGVtZW50IGl0c2VsZi4gUmVzdHJpY3RpbmcgdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCBjYW4gYmUgYWNoaWV2ZWRcbiAgICogd2l0aCBDU1MgPGNvZGU+bWF4LWhlaWdodDwvY29kZT4uXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlU29mdENsYW1wXVxuICAgKiBJZiB0cnVlLCByZWR1Y2UgZm9udCBzaXplIChzb2Z0IGNsYW1wKSB0byBhdCBsZWFzdCB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfVxuICAgKiBiZWZvcmUgcmVzb3J0aW5nIHRvIHRyaW1taW5nIHRleHQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmhhcmRDbGFtcEFzRmFsbGJhY2tdXG4gICAqIElmIHRydWUsIHJlc29ydCB0byBoYXJkIGNsYW1waW5nIGlmIHNvZnQgY2xhbXBpbmcgcmVhY2hlcyB0aGUgbWluaW11bSBmb250IHNpemVcbiAgICogYW5kIHN0aWxsIGRvZXNuJ3QgZml0IHdpdGhpbiB0aGUgbWF4IGhlaWdodCBvciBudW1iZXIgb2YgbGluZXMuXG4gICAqIERlZmF1bHRzIHRvIHRydWUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5lbGxpcHNpc11cbiAgICogVGhlIGNoYXJhY3RlciB3aXRoIHdoaWNoIHRvIHJlcHJlc2VudCBjbGlwcGVkIHRyYWlsaW5nIHRleHQuXG4gICAqIFRoaXMgb3B0aW9uIHRha2VzIGVmZmVjdCB3aGVuIFwiaGFyZFwiIGNsYW1waW5nIGlzIHVzZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5Gb250U2l6ZV1cbiAgICogVGhlIGxvd2VzdCBmb250IHNpemUsIGluIHBpeGVscywgdG8gdHJ5IGJlZm9yZSByZXNvcnRpbmcgdG8gcmVtb3ZpbmdcbiAgICogdHJhaWxpbmcgdGV4dCAoaGFyZCBjbGFtcGluZykuIERlZmF1bHRzIHRvIDEuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhGb250U2l6ZV1cbiAgICogVGhlIG1heGltdW0gZm9udCBzaXplIGluIHBpeGVscy4gV2UnbGwgc3RhcnQgd2l0aCB0aGlzIGZvbnQgc2l6ZSB0aGVuXG4gICAqIHJlZHVjZSB1bnRpbCB0ZXh0IGZpdHMgY29uc3RyYWludHMsIG9yIGZvbnQgc2l6ZSBpcyBlcXVhbCB0b1xuICAgKiB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfS4gRGVmYXVsdHMgdG8gdGhlIGVsZW1lbnQncyBpbml0aWFsIGNvbXB1dGVkIGZvbnQgc2l6ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGVsZW1lbnQsXG4gICAge1xuICAgICAgbWF4TGluZXMgPSB1bmRlZmluZWQsXG4gICAgICBtYXhIZWlnaHQgPSB1bmRlZmluZWQsXG4gICAgICB1c2VTb2Z0Q2xhbXAgPSBmYWxzZSxcbiAgICAgIGhhcmRDbGFtcEFzRmFsbGJhY2sgPSB0cnVlLFxuICAgICAgbWluRm9udFNpemUgPSAxLFxuICAgICAgbWF4Rm9udFNpemUgPSB1bmRlZmluZWQsXG4gICAgICBlbGxpcHNpcyA9IFwi4oCmXCIsXG4gICAgfSA9IHt9XG4gICkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm9yaWdpbmFsV29yZHNcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IGVsZW1lbnQudGV4dENvbnRlbnQubWF0Y2goL1xcUytcXHMqL2cpIHx8IFtdLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwidXBkYXRlSGFuZGxlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogKCkgPT4gdGhpcy5hcHBseSgpLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib2JzZXJ2ZXJcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMudXBkYXRlSGFuZGxlciksXG4gICAgfSk7XG5cbiAgICBpZiAodW5kZWZpbmVkID09PSBtYXhGb250U2l6ZSkge1xuICAgICAgbWF4Rm9udFNpemUgPSBwYXJzZUludCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS5mb250U2l6ZSwgMTApO1xuICAgIH1cblxuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgdGhpcy5tYXhMaW5lcyA9IG1heExpbmVzO1xuICAgIHRoaXMubWF4SGVpZ2h0ID0gbWF4SGVpZ2h0O1xuICAgIHRoaXMudXNlU29mdENsYW1wID0gdXNlU29mdENsYW1wO1xuICAgIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjayA9IGhhcmRDbGFtcEFzRmFsbGJhY2s7XG4gICAgdGhpcy5taW5Gb250U2l6ZSA9IG1pbkZvbnRTaXplO1xuICAgIHRoaXMubWF4Rm9udFNpemUgPSBtYXhGb250U2l6ZTtcbiAgICB0aGlzLmVsbGlwc2lzID0gZWxsaXBzaXM7XG4gIH1cblxuICAvKipcbiAgICogR2F0aGVyIG1ldHJpY3MgYWJvdXQgdGhlIGxheW91dCBvZiB0aGUgZWxlbWVudCdzIHRleHQuXG4gICAqIFRoaXMgaXMgYSBzb21ld2hhdCBleHBlbnNpdmUgb3BlcmF0aW9uIC0gY2FsbCB3aXRoIGNhcmUuXG4gICAqXG4gICAqIEByZXR1cm5zIHtUZXh0TWV0cmljc31cbiAgICogTGF5b3V0IG1ldHJpY3MgZm9yIHRoZSBjbGFtcGVkIGVsZW1lbnQncyB0ZXh0LlxuICAgKi9cbiAgY2FsY3VsYXRlVGV4dE1ldHJpY3MoKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICBjb25zdCBjbG9uZSA9IGVsZW1lbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgIGNvbnN0IHN0eWxlID0gY2xvbmUuc3R5bGU7XG5cbiAgICAvLyBBcHBlbmQsIGRvbid0IHJlcGxhY2VcbiAgICBzdHlsZS5jc3NUZXh0ICs9IFwiO21pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7bWF4LWhlaWdodDpub25lIWltcG9ydGFudFwiO1xuICAgIGVsZW1lbnQucmVwbGFjZVdpdGgoY2xvbmUpO1xuXG4gICAgY29uc3QgbmF0dXJhbEhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodDtcblxuICAgIC8vIENsZWFyIHRvIG1lYXN1cmUgZW1wdHkgaGVpZ2h0LiB0ZXh0Q29udGVudCBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXCI7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgdGV4dEhlaWdodCA9IG5hdHVyYWxIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBGaWxsIGVsZW1lbnQgd2l0aCBzaW5nbGUgbm9uLWJyZWFraW5nIHNwYWNlIHRvIGZpbmQgaGVpZ2h0IG9mIG9uZSBsaW5lXG4gICAgY2xvbmUudGV4dENvbnRlbnQgPSBcIlxceGEwXCI7XG5cbiAgICAvLyBHZXQgaGVpZ2h0IG9mIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHRcbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgZmlyc3RMaW5lSGVpZ2h0ID0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lIC0gbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0O1xuXG4gICAgLy8gQWRkIGxpbmUgKDxicj4gKyBuYnNwKS4gYXBwZW5kQ2hpbGQoKSBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnJcIikpO1xuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXFx4YTBcIikpO1xuXG4gICAgY29uc3QgYWRkaXRpb25hbExpbmVIZWlnaHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmU7XG4gICAgY29uc3QgbGluZUNvdW50ID1cbiAgICAgIDEgKyAobmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSkgLyBhZGRpdGlvbmFsTGluZUhlaWdodDtcblxuICAgIC8vIFJlc3RvcmUgb3JpZ2luYWwgY29udGVudFxuICAgIGNsb25lLnJlcGxhY2VXaXRoKGVsZW1lbnQpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGVkZWYge09iamVjdH0gVGV4dE1ldHJpY3NcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7dGV4dEhlaWdodH1cbiAgICAgKiBUaGUgdmVydGljYWwgc3BhY2UgcmVxdWlyZWQgdG8gZGlzcGxheSB0aGUgZWxlbWVudCdzIGN1cnJlbnQgdGV4dC5cbiAgICAgKiBUaGlzIGlzIDxlbT5ub3Q8L2VtPiBuZWNlc3NhcmlseSB0aGUgc2FtZSBhcyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50LlxuICAgICAqIFRoaXMgbnVtYmVyIG1heSBldmVuIGJlIGdyZWF0ZXIgdGhhbiB0aGUgZWxlbWVudCdzIGhlaWdodCBpbiBjYXNlc1xuICAgICAqIHdoZXJlIHRoZSB0ZXh0IG92ZXJmbG93cyB0aGUgZWxlbWVudCdzIGJsb2NrIGF4aXMuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge25hdHVyYWxIZWlnaHRXaXRoT25lTGluZX1cbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdpdGggb25seSBvbmUgbGluZSBvZiB0ZXh0IGFuZCB3aXRob3V0XG4gICAgICogbWluaW11bSBvciBtYXhpbXVtIGhlaWdodHMuIFRoaXMgaW5mb3JtYXRpb24gbWF5IGJlIGhlbHBmdWwgd2hlblxuICAgICAqIGRlYWxpbmcgd2l0aCBpbmxpbmUgZWxlbWVudHMgKGFuZCBwb3RlbnRpYWxseSBvdGhlciBzY2VuYXJpb3MpLCB3aGVyZVxuICAgICAqIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3QgaW5jcmVhc2UgdGhlIGVsZW1lbnQncyBoZWlnaHQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2ZpcnN0TGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBhZGRzIHRvIHRoZSBlbGVtZW50LCBpLmUuLCB0aGVcbiAgICAgKiBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCB3aGlsZSBlbXB0eSBhbmQgdGhlIGhlaWdodFxuICAgICAqIG9mIHRoZSBlbGVtZW50IHdoaWxlIGl0IGNvbnRhaW5zIG9uZSBsaW5lIG9mIHRleHQuIFRoaXMgbnVtYmVyIG1heSBiZVxuICAgICAqIHplcm8gZm9yIGlubGluZSBlbGVtZW50cyBiZWNhdXNlIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3RcbiAgICAgKiBpbmNyZWFzZSB0aGUgaGVpZ2h0IG9mIGlubGluZSBlbGVtZW50cy5cblxuICAgICAqIEBwcm9wZXJ0eSB7YWRkaXRpb25hbExpbmVIZWlnaHR9XG4gICAgICogVGhlIGhlaWdodCB0aGF0IGVhY2ggbGluZSBvZiB0ZXh0IGFmdGVyIHRoZSBmaXJzdCBhZGRzIHRvIHRoZSBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtsaW5lQ291bnR9XG4gICAgICogVGhlIG51bWJlciBvZiBsaW5lcyBvZiB0ZXh0IHRoZSBlbGVtZW50IGNvbnRhaW5zLlxuICAgICAqL1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0SGVpZ2h0LFxuICAgICAgbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lLFxuICAgICAgZmlyc3RMaW5lSGVpZ2h0LFxuICAgICAgYWRkaXRpb25hbExpbmVIZWlnaHQsXG4gICAgICBsaW5lQ291bnQsXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBjaGFuZ2VzIHRoYXQgbWF5IGFmZmVjdCBsYXlvdXQuIFJlc3BvbmQgYnkgcmVjbGFtcGluZyBpZlxuICAgKiBuZWNlc3NhcnkuXG4gICAqL1xuICB3YXRjaCgpIHtcbiAgICBpZiAoIXRoaXMuX3dhdGNoaW5nKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgICAvLyBNaW5pbXVtIHJlcXVpcmVkIHRvIGRldGVjdCBjaGFuZ2VzIHRvIHRleHQgbm9kZXMsXG4gICAgICAvLyBhbmQgd2hvbGVzYWxlIHJlcGxhY2VtZW50IHZpYSBpbm5lckhUTUxcbiAgICAgIHRoaXMub2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmVsZW1lbnQsIHtcbiAgICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZSxcbiAgICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3dhdGNoaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3Agd2F0Y2hpbmcgZm9yIGxheW91dCBjaGFuZ2VzLlxuICAgKlxuICAgKiBAcmV0dXJucyB7TGluZUNsYW1wfVxuICAgKi9cbiAgdW53YXRjaCgpIHtcbiAgICB0aGlzLm9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgdGhpcy5fd2F0Y2hpbmcgPSBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ29uZHVjdCBlaXRoZXIgc29mdCBjbGFtcGluZyBvciBoYXJkIGNsYW1waW5nLCBhY2NvcmRpbmcgdG8gdGhlIHZhbHVlIG9mXG4gICAqIHByb3BlcnR5IHtAc2VlIExpbmVDbGFtcC51c2VTb2Z0Q2xhbXB9LlxuICAgKi9cbiAgYXBwbHkoKSB7XG4gICAgaWYgKHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQpIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzbHlXYXRjaGluZyA9IHRoaXMuX3dhdGNoaW5nO1xuXG4gICAgICAvLyBJZ25vcmUgaW50ZXJuYWxseSBzdGFydGVkIG11dGF0aW9ucywgbGVzdCB3ZSByZWN1cnNlIGludG8gb2JsaXZpb25cbiAgICAgIHRoaXMudW53YXRjaCgpO1xuXG4gICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSB0aGlzLm9yaWdpbmFsV29yZHMuam9pbihcIlwiKTtcblxuICAgICAgaWYgKHRoaXMudXNlU29mdENsYW1wKSB7XG4gICAgICAgIHRoaXMuc29mdENsYW1wKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhhcmRDbGFtcCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXN1bWUgb2JzZXJ2YXRpb24gaWYgcHJldmlvdXNseSB3YXRjaGluZ1xuICAgICAgaWYgKHByZXZpb3VzbHlXYXRjaGluZykge1xuICAgICAgICB0aGlzLndhdGNoKGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFRyaW1zIHRleHQgdW50aWwgaXQgZml0cyB3aXRoaW4gY29uc3RyYWludHNcbiAgICogKG1heGltdW0gaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcykuXG4gICAqXG4gICAqIEBzZWUge0xpbmVDbGFtcC5tYXhMaW5lc31cbiAgICogQHNlZSB7TGluZUNsYW1wLm1heEhlaWdodH1cbiAgICovXG4gIGhhcmRDbGFtcChza2lwQ2hlY2sgPSB0cnVlKSB7XG4gICAgaWYgKHNraXBDaGVjayB8fCB0aGlzLnNob3VsZENsYW1wKCkpIHtcbiAgICAgIGxldCBjdXJyZW50VGV4dDtcblxuICAgICAgZmluZEJvdW5kYXJ5KFxuICAgICAgICAxLFxuICAgICAgICB0aGlzLm9yaWdpbmFsV29yZHMubGVuZ3RoLFxuICAgICAgICAodmFsKSA9PiB7XG4gICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgdmFsKS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dDtcblxuICAgICAgICAgIHJldHVybiB0aGlzLnNob3VsZENsYW1wKClcbiAgICAgICAgfSxcbiAgICAgICAgKHZhbCwgbWluLCBtYXgpID0+IHtcbiAgICAgICAgICAvLyBBZGQgb25lIG1vcmUgd29yZCBpZiBub3Qgb24gbWF4XG4gICAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgbWF4KS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGVuIHRyaW0gbGV0dGVycyB1bnRpbCBpdCBmaXRzXG4gICAgICAgICAgZG8ge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSBjdXJyZW50VGV4dC5zbGljZSgwLCAtMSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dCArIHRoaXMuZWxsaXBzaXM7XG4gICAgICAgICAgfSB3aGlsZSAodGhpcy5zaG91bGRDbGFtcCgpKVxuXG4gICAgICAgICAgLy8gQnJvYWRjYXN0IG1vcmUgc3BlY2lmaWMgaGFyZENsYW1wIGV2ZW50IGZpcnN0XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5oYXJkY2xhbXBcIik7XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZHVjZXMgZm9udCBzaXplIHVudGlsIHRleHQgZml0cyB3aXRoaW4gdGhlIHNwZWNpZmllZCBoZWlnaHQgb3IgbnVtYmVyIG9mXG4gICAqIGxpbmVzLiBSZXNvcnRzIHRvIHVzaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSBpZiB0ZXh0IHN0aWxsIGV4Y2VlZHMgY2xhbXBcbiAgICogcGFyYW1ldGVycy5cbiAgICovXG4gIHNvZnRDbGFtcCgpIHtcbiAgICBjb25zdCBzdHlsZSA9IHRoaXMuZWxlbWVudC5zdHlsZTtcbiAgICBjb25zdCBzdGFydFNpemUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmZvbnRTaXplO1xuICAgIHN0eWxlLmZvbnRTaXplID0gXCJcIjtcblxuICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgbGV0IHNob3VsZENsYW1wO1xuXG4gICAgZmluZEJvdW5kYXJ5KFxuICAgICAgdGhpcy5taW5Gb250U2l6ZSxcbiAgICAgIHRoaXMubWF4Rm9udFNpemUsXG4gICAgICAodmFsKSA9PiB7XG4gICAgICAgIHN0eWxlLmZvbnRTaXplID0gdmFsICsgXCJweFwiO1xuICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgcmV0dXJuIHNob3VsZENsYW1wXG4gICAgICB9LFxuICAgICAgKHZhbCwgbWluKSA9PiB7XG4gICAgICAgIGlmICh2YWwgPiBtaW4pIHtcbiAgICAgICAgICBzdHlsZS5mb250U2l6ZSA9IG1pbiArIFwicHhcIjtcbiAgICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgfVxuICAgICAgICBkb25lID0gIXNob3VsZENsYW1wO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBjaGFuZ2VkID0gc3R5bGUuZm9udFNpemUgIT09IHN0YXJ0U2l6ZTtcblxuICAgIC8vIEVtaXQgc3BlY2lmaWMgc29mdENsYW1wIGV2ZW50IGZpcnN0XG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuc29mdGNsYW1wXCIpO1xuICAgIH1cblxuICAgIC8vIERvbid0IGVtaXQgYGxpbmVjbGFtcC5jbGFtcGAgZXZlbnQgdHdpY2UuXG4gICAgaWYgKCFkb25lICYmIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjaykge1xuICAgICAgdGhpcy5oYXJkQ2xhbXAoZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY2hhbmdlZCkge1xuICAgICAgLy8gaGFyZENsYW1wIGVtaXRzIGBsaW5lY2xhbXAuY2xhbXBgIHRvby4gT25seSBlbWl0IGZyb20gaGVyZSBpZiB3ZSdyZVxuICAgICAgLy8gbm90IGFsc28gaGFyZCBjbGFtcGluZy5cbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuY2xhbXBcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICogV2hldGhlciBoZWlnaHQgb2YgdGV4dCBvciBudW1iZXIgb2YgbGluZXMgZXhjZWVkIGNvbnN0cmFpbnRzLlxuICAgKlxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhIZWlnaHRcbiAgICogQHNlZSBMaW5lQ2xhbXAubWF4TGluZXNcbiAgICovXG4gIHNob3VsZENsYW1wKCkge1xuICAgIGNvbnN0IHsgbGluZUNvdW50LCB0ZXh0SGVpZ2h0IH0gPSB0aGlzLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCk7XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heEhlaWdodCAmJiB1bmRlZmluZWQgIT09IHRoaXMubWF4TGluZXMpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHQgfHwgbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0KSB7XG4gICAgICByZXR1cm4gdGV4dEhlaWdodCA+IHRoaXMubWF4SGVpZ2h0XG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIGxpbmVDb3VudCA+IHRoaXMubWF4TGluZXNcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIm1heExpbmVzIG9yIG1heEhlaWdodCBtdXN0IGJlIHNldCBiZWZvcmUgY2FsbGluZyBzaG91bGRDbGFtcCgpLlwiXG4gICAgKVxuICB9XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYSBiaW5hcnkgc2VhcmNoIGZvciB0aGUgbWF4aW11bSB3aG9sZSBudW1iZXIgaW4gYSBjb250aWdvdXMgcmFuZ2VcbiAqIHdoZXJlIGEgZ2l2ZW4gdGVzdCBjYWxsYmFjayB3aWxsIGdvIGZyb20gcmV0dXJuaW5nIHRydWUgdG8gcmV0dXJuaW5nIGZhbHNlLlxuICpcbiAqIFNpbmNlIHRoaXMgdXNlcyBhIGJpbmFyeS1zZWFyY2ggYWxnb3JpdGhtIHRoaXMgaXMgYW4gTyhsb2cgbikgZnVuY3Rpb24sXG4gKiB3aGVyZSBuID0gbWF4IC0gbWluLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIFRoZSBsb3dlciBib3VuZGFyeSBvZiB0aGUgcmFuZ2UuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogVGhlIHVwcGVyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0gdGVzdFxuICogQSBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHRoZSBjdXJyZW50IHZhbHVlIGluIHRoZSByYW5nZSBhbmQgcmV0dXJucyBhIHRydXRoeSBvciBmYWxzeSB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0gZG9uZVxuICogQSBmdW5jdGlvbiB0byBwZXJmb3JtIHdoZW4gY29tcGxldGUuIFJlY2VpdmVzIHRoZSBmb2xsb3dpbmcgcGFyYW1ldGVyc1xuICogLSBjdXJzb3JcbiAqIC0gbWF4UGFzc2luZ1ZhbHVlXG4gKiAtIG1pbkZhaWxpbmdWYWx1ZVxuICovXG5mdW5jdGlvbiBmaW5kQm91bmRhcnkobWluLCBtYXgsIHRlc3QsIGRvbmUpIHtcbiAgbGV0IGN1cnNvciA9IG1heDtcbiAgLy8gc3RhcnQgaGFsZndheSB0aHJvdWdoIHRoZSByYW5nZVxuICB3aGlsZSAobWF4ID4gbWluKSB7XG4gICAgaWYgKHRlc3QoY3Vyc29yKSkge1xuICAgICAgbWF4ID0gY3Vyc29yO1xuICAgIH0gZWxzZSB7XG4gICAgICBtaW4gPSBjdXJzb3I7XG4gICAgfVxuXG4gICAgaWYgKG1heCAtIG1pbiA9PT0gMSkge1xuICAgICAgZG9uZShjdXJzb3IsIG1pbiwgbWF4KTtcbiAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgY3Vyc29yID0gTWF0aC5yb3VuZCgobWluICsgbWF4KSAvIDIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXQoaW5zdGFuY2UsIHR5cGUpIHtcbiAgaW5zdGFuY2UuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCh0eXBlKSk7XG59XG5cbmV4cG9ydCB7IExpbmVDbGFtcCBhcyBkZWZhdWx0IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcImJlZ2luXCI6e1widGV4dFwiOlwiW2RlbGF5IDUwMF1Db25uZWN0aW5nW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1cXG5bc291bmQgYWxhcm0ud2F2XTxlbT5CZWVwPC9lbT4gW2RlbGF5IDEwMDBdPGVtPkJlZXA8L2VtPiBbZGVsYXkgMTAwMF08ZW0+QmVlcDwvZW0+W2RlbGF5IDEwMDBdXFxuW3NvdW5kIGNsaWNrLndhdl1Zb3Ugd2FrZSB1cCBzbG93bHkgdG8gdGhlIHNvdW5kIG9mIHlvdXIgYWxhcm0uXFxuSXQgZHJvbmVzIG9uIGFuZCBvbiB1bnRpbCB5b3Ugd2FrZSB1cCBlbm91Z2ggdG8gdHVybiBpdCBvZmYuXFxuV2hhdCBkbyB5b3UgZG8/XCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcIm5ld3NwYXBlclwiLFwidGV4dFwiOlwiQ2hlY2sgdGhlIG5ld3NcIixcIm5leHRcIjpcImNoZWNrTmV3c1wifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkdldCBvdXQgb2YgYmVkXCIsXCJuZXh0XCI6XCJnZXRVcFwifV19LFwiY2hlY2tOZXdzXCI6e1widGV4dFwiOlwiWW91IGdyYWIgeW91ciBBdWdtZW50ZWQgUmVhbGl0eSBnbGFzc2VzIGZyb20geW91ciBuaWdodHN0YW5kIGFuZCBwdXQgdGhlbSBvbi5cXG5BcyB5b3Ugc2Nyb2xsIHNvbWV3aGF0IGFic2VudG1pbmRlZGx5IHRocm91Z2ggdGhlIG5ld3MsIG9uZSBzdG9yeSBjYXRjaGVzIHlvdXIgZXllLlxcbkFuIGltYWdlIG9mIGEgZmxvb2RlZCB0b3duIG9mZiBvZiB0aGUgTWlzc2lzaXBwaSBSaXZlci5cXG5NdXJreSBicm93biB3YXRlciBldmVyeXdoZXJlLCBwYXN0IHdhaXN0IGhlaWdodC5cXG5DYXJzLCBidWlsZGluZ3MsIGFuZCB0cmVlcyBiYXJlbHkgYWJvdmUgdGhlIHN1cmZhY2UuXFxuW2ltYWdlIGh0dHBzOi8vaW1hZ2VzLmZveHR2LmNvbS9zdGF0aWMuZm94N2F1c3Rpbi5jb20vd3d3LmZveDdhdXN0aW4uY29tL2NvbnRlbnQvdXBsb2Fkcy8yMDIwLzAyLzkzMi81MjQvRmxvb2RpbmctaW4tTUlzc2lzc2lwcGktLmpwZz92ZT0xJnRsPTFdXFxuTmF0dXJlIGlzIGEgY3J1ZWwgbWlzdHJlc3MsIHlvdSB0aGluay5cXG5CdXQgdGhlbiBhZ2Fpbiwgd2UndmUgYWx3YXlzIGhhZCB0byBkZWFsIHdpdGggbmF0dXJhbCBkaXNhc3RlcnMsIHJpZ2h0P1xcbldlbGwsIHRoYXRzIGVub3VnaCBvZiB0aGUgbmV3cyBmb3IgdG9kYXkuIFRoYXQgc3R1ZmYgaXMgYWx3YXlzIGp1c3QgZGVwcmVzc2luZy5cIixcImxvb3BcIjpcImJlZ2luXCJ9LFwiZ2V0VXBcIjp7XCJ0ZXh0XCI6XCJZb3UgZ2V0IHVwIGFuZCBnZXQgcmVhZHkgZm9yIHRoZSBkYXkuXFxuV2hlbiB5b3UgY29tZSBiYWNrIG91dCBvZiB0aGUgYmF0aHJvb20sIHlvdSBub3RpY2UgdHdvIHRoaW5nczpcXG4xLiBJdCdzIGZyZWV6aW5nIGluIGhlcmVcXG4yLiBZb3VyIHJvb20gaXMgYSBtZXNzXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImZhblwiLFwidGV4dFwiOlwiVHVybiBvZmYgdGhlIEEvQ1wiLFwibmV4dFwiOlwidHVybk9mZlwifSx7XCJpY29uXCI6XCJmb2xkZXJcIixcInRleHRcIjpcIkNoZWNrIG91dCB0aGUgbWVzc1wiLFwibmV4dFwiOlwibWVzc1wiLFwicmV0dXJuXCI6XCJjb250aW51ZVwifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkxlYXZlXCIsXCJuZXh0XCI6XCJsZWF2ZVwifV19LFwidHVybk9mZlwiOntcInRleHRcIjpcIkFzIHlvdSBnbyBvdmVyIHRvIHR1cm4gb2ZmIHRoZSBhaXIgY29uZGl0aW9uaW5nLCB5b3UgdGFrZSBhIGxvb2sgb3V0IHRoZSB3aW5kb3cuIEp1c3QgYXMgeW91IGV4cGVjdGVkLCBpdHMgY2xvdWR5IGFuZCByYWlueS4gVGhlIEEvQyBtdXN0IGhhdmUgYmVlbiBtYWtpbmcgdGhlIHRlbXBlcmF0dXJlIGV2ZW4gY29sZGVyIHRoYW4gaXQgYWxyZWFkeSB3YXMgb3V0c2lkZS5cXG5Zb3UndmUgaGFkIGl0IHR1cm5lZCBhbGwgdGhlIHdheSB1cCBmb3IgdGhlIHBhc3QgZmV3IGRheXMgZHVlIHRvIHRoZSBoZWF0d2F2ZS4gWW91J2QgYmVlbiB3b3JyaWVkIHRoYXQgaXQgd2Fzbid0IGdvaW5nIHRvIGVuZDogeW91IGhhZCBuZXZlciBzZWVuIGEgaGVhdHdhdmUgZ28gZm9yIHRoYXQgbG9uZyBvciB0aGF0IGhvdCBpbiB5b3VyIGxpZmUuIENsZWFybHkgaXQncyBvdmVyIG5vdywgdGhvdWdoLCBpZiB0aGUgdGVtcGVyYXR1cmUgaXMgYW55dGhpbmcgdG8gZ28gYnkuXFxuWW91IGFkanVzdCB0aGUgQS9DJ3Mgc2V0dGluZ3MgaW4gaXRzIGFwcCBvbiB5b3VyIEFSIGdsYXNzZXMuIE9uIHRvIG1vcmUgaW1wb3J0YW50IHRoaW5ncy5cIixcImxvb3BcIjpcImdldFVwXCJ9LFwibWVzc1wiOntcInRleHRcIjpcIllvdSBzcGVuZCBzbyBtdWNoIHRpbWUgYXQgd29yayBub3dhZGF5cyB0aGF0IHlvdXIgcm9vbSBpcyBwcmV0dHkgbWVzc3kuIEluIHRoZW9yeSwgYWxsIG9mIHlvdXIgbWF0ZXJpYWxzIHdvdWxkIGJlIGNvbnRhaW5lZCBpbiB0aGUgZm9sZGVyIG9uIHlvdXIgZGVzaywgYnV0IHlvdSBzcGVuZCBzbyBtdWNoIHRpbWUgcmVvcmdhbml6aW5nIGFuZCBhZGp1c3RpbmcgdGhhdCBpdCBhbGwgZW5kcyB1cCBzdHJld24gYWJvdXQuIFlvdSdkIHByb2JhYmx5IGJlIGJldHRlciBvZmYgdXNpbmcgdmlydHVhbCBkb2N1bWVudHMsIGJ1dCBzb21ldGhpbmcgYWJvdXQgZmVlbGluZyB0aGUgcGFwZXJzIGluIHlvdXIgaGFuZCBzdGlsbCBhcHBlYWxzIHRvIHlvdSBtb3JlIHRoYW4ganVzdCBzZWVpbmcgdGhlbS5cXG5Zb3UgcGljayB1cCB3aGF0IGZldyBwYXBlcnMgcmVtYWluIHRoZSBmb2xkZXIgYW5kIGZsaWNrIHRocm91Z2ggdGhlbS4gVGhleSdyZSB0aGUgdGhyZWUgc3R1ZGllcyB5b3UndmUgYmFzZWQgeW91ciBwcmVzZW50YXRpb24gb24uIFlvdSBzdGFyZSBhdCB0aGVtIGZvciBhIGxpdHRsZSwgcGVuc2l2ZWx5LiBZb3UnZCBhbHdheXMgd2FudGVkIHRvIGJlIHRoZSBvbmUgZG9pbmcgdGhlIHJlc2VhcmNoLiBUaGF0J3Mgd2h5IHlvdSB0b29rIHRoaXMgam9iOyBwcmVzZW50aW5nIHJlc2VhcmNoIHNlZW1lZCBsaWtlIGEgZ29vZCB3YXkgdG8gZ2V0IHNvbWUgY29ubmVjdGlvbnMsIG5vdCB0byBtZW50aW9uIHlvdSBuZWVkZWQgdGhlIG1vbmV5LiBCdXQgYXQgc29tZSBwb2ludCB5b3UgbG9zdCB0cmFjayBvZiB0aGF0IGdvYWwsIGFuZCBldmVuIHRob3VnaCB5b3UgY2FuIHByb2JhYmx5IGFmZm9yZCB0byBnbyBiYWNrIHRvIHNjaG9vbCBub3csIGJlaW5nIGEgcmVzZWFyY2hlciBmZWVscyBsaWtlIHNvbWVvbmUgZWxzZSdzIGRyZWFtLiBUaGUga2luZCBvZiB0aGluZyBhIGtpZCB0ZWxscyB0aGVtc2VsZiBiZWZvcmUgdGhleSd2ZSBiZWVuIGV4cG9zZWQgdG8gdGhlIHJlYWwgd29ybGQuXFxuVGhpcyBqb2IgaXMgZmluZS4gSXQgcGF5cyB3ZWxsLiA8Yj5JdCdzIGZpbmU8L2I+LlxcbkFueXdheSwgeW91IGhhdmUgdGhyZWUgc3R1ZGllcyBpbiB0aGUgZm9sZGVyLlxcbkRvIHlvdSB3YW50IHRvIHJldmlldyBhbnkgb2YgdGhlbSBiZWZvcmUgdGhlIGJpZyBoZWFyaW5nIGxhdGVyP1wiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJpbmR1c3RyeVwiLFwidGV4dFwiOlwiQ0NTIFN0dWR5XCIsXCJuZXh0XCI6XCJjY3NcIn0se1wiaWNvblwiOlwiZmlyZS1mbGFtZS1zaW1wbGVcIixcInRleHRcIjpcIkVmZmljaWVuY3kgU3R1ZHlcIixcIm5leHRcIjpcImVmZmljaWVuY3lcIn0se1wiaWNvblwiOlwiYXJyb3dzLXJvdGF0ZVwiLFwidGV4dFwiOlwiTGlmZWN5Y2xlIEFuYWx5c2lzXCIsXCJuZXh0XCI6XCJsY2FcIn0se1wiaWNvblwiOlwiYXJyb3ctdXAtZnJvbS1icmFja2V0XCIsXCJ0ZXh0XCI6XCJDb250aW51ZVwiLFwibmV4dFwiOlwiY29udGludWVcIn1dfSxcImNjc1wiOntcInRleHRcIjpcIlRoaXMgc3R1ZHkgaXMgYWJvdXQgQ0NTLCBDYXJib24gQ2FwdHVyZSBhbmQgU3RvcmFnZS4gSXQncyBhIHRlY2hub2xvZ3kgdGhhdCBzaWduaWZpY2FudGx5IHJlZHVjZXMgdGhlIGNhcmJvbiBlbWlzc2lvbnMgb2YgY29hbCBhbmQgbmF0dXJhbCBnYXMgcG93ZXIgcGxhbnRzLCBieSB1cCB0byA5MCUuIFNvIG9mIGNvdXJzZSwgdGhlIGZvc3NpbCBmdWVscyBjb3Jwb3JhdGlvbiB5b3Ugd29yayBmb3IgaXMgcHJldHR5IGludGVyZXN0ZWQgaW4gaXQgYXMgYSB3YXkgdG8ga2VlcCB0aGVpciBidXNpbmVzcy4uLiB1cCB0byBkYXRlIHdpdGggdGhlIHRpbWVzLiBUaGlzIHN0dWR5IGlzIGFuIG92ZXJ2aWV3IG9mIHBhc3QgYW5kIGN1cnJlbnQgcmVzZWFyY2ggaW50byBDQ1MgdGVjaG5vbG9naWVzLCBzb21lIG9mIHdoaWNoIHByb21pc2UgdG8gcmVkdWNlIGVtaXNzaW9ucyBieSB1cCB0byA5NSUgb3IgZXZlbiBtb3JlLiBJdCBhbHNvIGhhcyBzb21lIGxvdyBsZXZlbCBleHBsYW5hdGlvbnMgb2YgaG93IHRoZSB0ZWNobm9sb2d5IHdvcmtzLCBzdWNoIGFzIHNvbWUgZGlhZ3JhbXMgb2YgcG9zc2libGUgcHJvY2Vzc2VzLlxcbltpbWFnZSBodHRwczovL2Fycy5lbHMtY2RuLmNvbS9jb250ZW50L2ltYWdlLzEtczIuMC1TMDA0ODk2OTcyMDM2NzM0Ni1ncjEuanBnXVxcbk9mIGNvdXJzZSwgdGhlIGV4dHJhIHdvcmsgbmVlZGVkIHRvIGNhcHR1cmUgYW5kIHN0b3JlIHRoZSBjYXJib24gZGlveGlkZSBkb2VzIG1ha2UgdGhlIGNvc3Qgb2YgZWxlY3RyaWNpdHkgZm9yIENDUyBwbGFudHMgaGlnaGVyLCBhbmQgdGhlIHRlY2hub2xvZ3kgY2FuIG5ldmVyIHJlZHVjZSBlbWlzc2lvbnMgdG8gbmVhciB6ZXJvIGxpa2UgcmVuZXdhYmxlcy4gVGhlIHN0dWR5IGRvZXMgbm90ZSB0aGF0LCBidXQgeW91ciBzdXBlcnZpc29yIHNhaWQgbm90IHRvIGZvY3VzIG9uIHRoYXQgcGFydCBzbyBtdWNoLiBBZnRlciBhbGwsIGhvdyBtdWNoIGhhcm0gY291bGQganVzdCBhIGxpdHRsZSBtb3JlIGNhcmJvbiBkaW94aWRlIHJlYWxseSBkbz9cIixcImxvb3BcIjpcIm1lc3NcIn0sXCJlZmZpY2llbmN5XCI6e1widGV4dFwiOlwiVGhpcyBzdHVkeSBpcyBhbiBhbmFseXNpcyBvZiB0aGUgY29zdCBlZmZpY2llbmN5IG9mIHZhcmlvdXMgZm9zc2lsIGZ1ZWwgZW5lcmd5IHNvdXJjZXMgY29tcGFyZWQgdG8gcmVuZXdhYmxlIHNvdXJjZXMuIFRoZSBzdHVkeSBmb3VuZCB0aGF0IGFsbCB0b2dldGhlciwgcmVuZXdhYmxlcyBjb3N0IGFib3V0IDYtOCBjZW50cyBwZXIga2lsb3dhdHQtaG91ciAoa1doKSwgd2hpbGUgZm9zc2lsIGZ1ZWwgc291cmNlcyBsaWtlIGNvYWwgYW5kIG5hdHVyYWwgZ2FzIGNvc3QgYWJvdXQgNC01IGNlbnRzIHBlciBrV2gsIGRlcGVuZGluZyBvbiB0aGUgc291cmNlLiBZb3VyIHN1cGVydmlzb3Igd2FzIHZlcnkgaW5zaXN0ZW50IHlvdSBoaWdobGlnaHQgdGhhdCB3aGlsZSBhIDIgb3IgMyBjZW50IGRpZmZlcmVuY2UgbWF5IG5vdCBzZWVtIGxpa2UgbXVjaCwgaWYgeW91IG11bHRpcGx5IGl0IG92ZXIgdGhlIHdob2xlIHBvd2VyIGdyaWQsIGl0IHN0YXJ0cyB0byBhZGQgdXAuIEFuZCB5b3Ugc3VwcG9zZSB0aGF0IG1ha2VzIHNlbnNlOyBpZiB0aGUgZ292ZXJubWVudCBpcyBnb2luZyB0byBiZSBzdWJzaWRpemluZyBlbmVyZ3ksIGl0IG1pZ2h0IGFzIHdlbGwgZ2V0IHRoZSBtb3N0IG91dCBvZiBlYWNoIGRvbGxhci5cXG5UaGUgc3R1ZHksIGJlaW5nIGZ1bmRlZCBieSB0aGUgY29tcGFueSB5b3Ugd29yayBmb3IsIG5lZ2xlY3RzIHRvIG1lbnRpb24gdGhlIGNvc3QgaW5jcmVhc2VzIGZyb20gdGhlIHVzZSBvZiBDQ1MsIHdoaWNoIHlvdSd2ZSBiZWVuIHRvbGQgcmFpc2UgaXQgdXAgdG8gYWJvdXQgdGhlIHNhbWUgbGV2ZWxzIGFzIHJlbmV3YWJsZXMsIGlmIG5vdCBtb3JlLiBCdXQgeW91J3ZlIGJlZW4gYXNzdXJlZCB0aGF0IHlvdXIgY29tcGFueSBpcyB3b3JraW5nIGhhcmQgdG8gbWFrZSBDQ1MgY2hlYXBlciwgYW5kIG9uY2UgdGhleSBkbyB0aGF0IHRoZXknbGwgYmUgc3VyZSB0byBzd2l0Y2ggb3Zlci4gU28gdGhhdCBtYWtlcyB5b3UgZmVlbCBhIGxpdHRsZSBiZXR0ZXIuLi4geW91IHRoaW5rLiBVbnRpbCB0aGVuIHRob3VnaCB0aGUgY29tcGFueSBpcyBzdGlsbCBpbnRlbmRpbmcgdG8gZm9jdXMgb24gbm9uLUNDUyBwbGFudHMuIFlvdSB3b24ndCBiZSBtZW50aW9uaW5nIHRoYXQgZWl0aGVyLlwiLFwibG9vcFwiOlwibWVzc1wifSxcImxjYVwiOntcInRleHRcIjpcIlRoaXMgc3R1ZHkgeW91J3JlIG5vdCBzdXBwb3NlZCB0byBoYXZlLiBZb3VyIHN1cGVydmlzb3IgaGFkIGJlZW4gbWFraW5nIGEgYmlnIGZ1c3MgYWJvdXQgc29tZSBuZXcgbGlmZWN5Y2xlIGFuYWx5c2lzIHRoYXQgd291bGQgc2hvdyBmb3NzaWwgZnVlbHMgd2VyZW4ndCBhcyBiYWQgYXMgZXZlcnlvbmUgdGhvdWdodCwgYnV0IGEgY291cGxlIG9mIG1vbnRocyBsYXRlciB0aGV5IGhhZCBqdXN0IHN0b3BwZWQgdGFsa2luZyBhYm91dCBpdC4gU28geW91IGRpZCBhIGxpdHRsZSBkaWdnaW5nLCBmb3VuZCB0aGUgcmVzZWFyY2hlcnMgd2hvIGRpZCB0aGUgc3R1ZHksIGFuZCBhc2tlZCB0aGVtIGZvciBhIGNvcHkuIFxcbk9uY2UgdGhleSBzZW50IGl0IHRvIHlvdSwgeW91IHF1aWNrbHkgcmVhbGl6ZWQgd2h5IHlvdSBoYWRuJ3QgaGVhcmQgYW55IG1vcmUgYWJvdXQgaXQuIFJhdGhlciB0aGFuIGZpbmQgZXZpZGVuY2UgdGhhdCBmb3NzaWwgZnVlbHMgd2VyZW4ndCBhcyBkZXN0cnVjdGl2ZSBhcyBwZW9wbGUgdGhvdWdodCwgdGhleSBhY3R1YWxseSBmb3VuZCBldmlkZW5jZSB0aGF0IGNlcnRhaW4gYXNwZWN0cyBvZiB0aGUgcHJvY2VzcyB3ZXJlIG1vcmUgZGVzdHJ1Y3RpdmUgdGhhbiBpbml0aWFsbHkgdGhvdWdodC5cXG5Zb3UncmUgbm90IHN1cmUgd2h5IHlvdSBrZXB0IHRoZSBzdHVkeS4gWW91IGNlcnRhaW5seSBhcmVuJ3QgZ29pbmcgdG8gdXNlIGl0IGF0IHRvZGF5J3MgaGVhcmluZywgdGhhdCB3b3VsZCBiZS4uLiBiYWQgZm9yIHlvdXIgam9iIHNlY3VyaXR5LCB0byBzYXkgdGhlIGxlYXN0LiBCdXQgc29tZXRoaW5nIGFib3V0IGl0IGtlZXBzIG5hZ2dpbmcgYXQgeW91LiBNYXliZSBpdCdzIHRoZSBlbm9ybWl0eSBvZiBpdCBhbGwuIFlvdSBrbm93IGFib3V0IGNsaW1hdGUgY2hhbmdl4oCUaXQncyBoYXJkIHRvIGlnbm9yZSBpdCB3aXRoIGFsbCB0aGUgcHJvdGVzdHMgdGhhdCBoYXZlIGJlZW4gZ29pbmcgb24gcmVjZW50bHnigJRidXQgYXMgZmFyIGFzIHlvdSBjYW4gdGVsbCwgZXZlcnl0aGluZyBzZWVtcyB0byBiZSBmaW5lLiBTdXJlLCB0aGVyZSdzIGJlZW4gYSBsb3Qgb2YgZmxvb2RzIGluIHNvbWUgb3RoZXIgc3RhdGVzIHJlY2VudGx5LCBhbmQgdGhlcmUncyBkZWZpbml0ZWx5IGJlZW4gYSBsb3Qgb2YgaGVhdHdhdmVzIGhlcmUgaW4gVGV4YXMsIGJ1dCBub25lIG9mIGl0IHNlZW1zIHRoYXQgYmFkLiBCdXQgc2VlaW5nIHRoZSBzaGVlciBhbW91bnQgb2YgY2FyYm9uIGJlaW5nIGVtaXR0ZWQsIHRvZ2V0aGVyIHdpdGggcmVmZXJlbmNlcyB0byB0aGUgZGlyZWN0IGFuZCBpbmRpcmVjdCBlZmZlY3RzLCBldmVuIGluIGEgZm9zc2lsIGZ1ZWwgZnVuZGVkIHN0dWR5OyBpdCBtYWtlcyB5b3UgdW5jb21mb3J0YWJsZSwgdG8gc2F5IHRoZSBsZWFzdC5cXG5Zb3UgcHV0IHRoZSBzdHVkeSBiYWNrIGluIHRoZSBmb2xkZXIuIFlvdSBzaG91bGRuJ3QgYmUgZGlzdHJhY3RpbmcgeW91cnNlbGYgd2l0aCB0aGF0IHRvZGF5LiBUaGlzIGlzIHBvc3NpYmx5IHRoZSBiaWdnZXN0IGhlYXJpbmcgb2YgeW91ciBjYXJlZXIuIElmIHlvdSBtZXNzIHRoaXMgdXAsIGl0J2xsIG1lYW4gdGhlIG1ham9yaXR5IG9mIGZvc3NpbCBmdWVsIHN1YnNpZGllcyB3aWxsIGJlIGRpdmVydGVkIHRvIHJlbmV3YWJsZSBlbmVyZ3ksIGFuZCBsZXNzIG1vbmV5IGZvciB5b3VyIGVtcGxveWVyIG1lYW5zIGxlc3MgbW9uZXkgZm9yIHlvdS4gTm8gbWlzdGFrZXMgdG9kYXkuXCIsXCJsb29wXCI6XCJtZXNzXCJ9LFwiY29udGludWVcIjp7XCJ0ZXh0XCI6XCJZb3UgdHVybiB5b3VyIGF0dGVudGlvbiB0byB0aGUgcmVzdCBvZiB0aGUgcm9vbS5cIixcImxvb3BcIjpcImdldFVwXCJ9LFwibGVhdmVcIjp7XCJ0ZXh0XCI6XCJZb3UncmUgYSBiaXQgZWFybHksIGJ1dCB5b3UgZGVjaWRlIHlvdSBtaWdodCBhcyB3ZWxsIGhlYWQgdG8gdGhlIHZpcnR1YWwgY29uZmVyZW5jZSBjZW50ZXIgYWxyZWFkeS4gSXQncyBhIGJpdCBvZiBhIHBhaW4gaGF2aW5nIHRvIGdvIHNvbWV3aGVyZSBqdXN0IHRvIGhhdmUgYSBiZXR0ZXIgdmlkZW8gY2FwdHVyZSwgYnV0IHlvdSB3YW50IHRvIGxvb2sgeW91ciBiZXN0LiBBdCBsZWFzdCBpdHMgYmV0dGVyIHRoYW4gaGF2aW5nIHRvIGZseSB0byBELkMuIHRvIGF0dGVuZCB0aGUgaGVhcmluZzogeW91IGtub3cgc29tZSBwZW9wbGUgYXQgeW91ciBjb21wYW55IHdobyBoYXZlIGJlZW4gbG9iYnlpbmcgYSB3aG9sZSBsb3QgbG9uZ2VyIHRoYW4geW91LCBhbmQgdGhleSB3b24ndCBzdG9wIHRhbGtpbmcgYWJvdXQgaG93IG11Y2ggb2YgYSBwYWluIHRoZSBidXNpbmVzcyB0cmlwcyB1c2VkIHRvIGJlLlxcbk9mIGNvdXJzZSwgeW91IGRvbid0IGhhdmUgYSBjYXI7IGdhcyBpcyBtb3JlIGV4cGVuc2l2ZSB0aGFuIGV2ZXIsIGFuZCBkcml2aW5nIGlzIGJlY29taW5nIGluY3JlYXNpbmdseSB1bmZhc2hpb25hYmxlIG5vd2FkYXlzLiBZb3UgY291bGQgdGFrZSB0aGUgYnVzLCBidXQgeW91J2QgbGlrZSBzb21lIHByaXZhY3kgd2hpbGUgeW91IHByZXBhcmUgeW91cnNlbGYsIHNvIHlvdSBjYWxsIGEgdGF4aSBpbnN0ZWFkLiBTdGlsbCwgeW91J3JlIGZhY2VkIHdpdGggYSBjaG9pY2U6IG5vcm1hbCBjYXIsIG9yIGZseWluZyBjYXI/XCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImNhclwiLFwidGV4dFwiOlwiTm9ybWFsIENhclwiLFwibmV4dFwiOlwibm9ybWFsQ2FyXCJ9LHtcImljb25cIjpcInBsYW5lXCIsXCJ0ZXh0XCI6XCJGbHlpbmcgQ2FyXCIsXCJuZXh0XCI6XCJmbHlpbmdDYXJcIn1dfSxcIm5vcm1hbENhclwiOntcInRleHRcIjpcIkRlc3BpdGUgdGhlIG5vdmVsdHkgb2YgYSBmbHlpbmcgY2FyLCBhIHN0YW5kYXJkIGNhciBpcyBwcm9iYWJseSB0aGUgbW9yZSByZWFzb25hYmxlIG9wdGlvbi4gSXQncyBjZXJ0YWlubHkgdGhlIG1vc3QgZWNvbm9taWNhbCBvcHRpb24sIHRob3VnaCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZW0gaGFzIGJlZW4gZ2V0dGluZyBzdXJwcmlzaW5nbHkgc21hbGwsIGFsbCBjb25zaWRlcmVkLiBUaGUgY2FyIGFycml2ZXMtdGhlIGRlY3JlYXNlIG9mIGh1bWFuIGRyaXZlcnMgaGFzIG1hZGUgdHJhZmZpYyBhbG1vc3QgYSB0aGluZyBvZiB0aGUgcGFzdCBhdCB0aGlzIHBvaW50LWFuZCB5b3UgZ2V0IGluLlxcbltiYWNrZ3JvdW5kIHRyYWZmaWMubXAzXUFzIHRoZSBjYXIgZHJpdmVzIG9mZiwgeW91IGxvb2sgb3V0IHRoZSB3aW5kb3cuIFlvdSBzZWUgYSBsb3Qgb2YgYnVzaW5lc3MsIGJ1dCB3ZWlyZGx5LCBtb3N0IG9mIHRoZW0gc2VlbSBlbXB0eS4gVGhlbiB5b3UgcmVhbGl6ZSB3aHkuIE9uIG5lYXJseSBldmVyeSBidWlsZGluZywgdGhlcmUncyBhbiBBUiBmbHllciBhdHRhY2hlZCB0byBpdCwgd2l0aCBzb21ldGhpbmcgYWxvbmcgdGhlIGxpbmVzIG9mIFxcXCJub3cgaGlyaW5nXFxcIi4gWW91J2Qgc2VlbiBhIHBpZWNlIGluIHRoZSBuZXdzIHJlY2VudGx5IGFib3V0IGhvdyBsb3ctd2FnZSB3b3JrZXJzIHdlcmUgZ2V0dGluZyBoaXQgaGFyZCBieSBoZWF0IHN0cmVzcyBpbiB0aGUgcmVjZW50IHN0cmluZyBvZiBoZWF0d2F2ZXMuIFRoZSBhaXIgY29uZGl0aW9uZXJzIHdlcmVuJ3QgdXAgdG8gdGhlIHRhc2sgb2YgYSBuZWFybHkgd2VlayBsb25nIGhlYXR3YXZlLiBCdXQgeW91IGhhZCBhc3N1bWVkIGl0IHdhcyBqdXN0IGEgY291cGxlIG9mIHBlb3BsZSB0aGF0IHdlcmUgZWZmZWN0ZWQuIFRoaXMgZG9lc24ndCByZWFsbHkgc2VlbSBsaWtlIGp1c3QgYSBjb3VwbGUgb2YgcGVvcGxlLCB0aG91Z2guIFxcbkJ1dCB5b3UncmUgc3VyZSB0aGlzIGlzIGp1c3QgYSB0ZW1wb3JhcnkgdGhpbmcuIEl0J3MgYSBvbmNlIGluIGEgbGlmZXRpbWUgaGVhdHdhdmUsIGFmdGVyIGFsbC4gVGhlbiBhZ2FpbiwgeW91J2Qgc2VlbiBvbiB0aGUgd2VhdGhlciBmb3JlY2FzdCB0aGF0IHRlbXBlcmF0dXJlcyB3ZXJlIHN1cHBvc2VkIHRvIGdvIGJhY2sgdXAgdGhlIHJlc3Qgb2YgdGhpcyB3ZWVrLCBhbmQgdGhhdCB0b2RheSBpcyBqdXN0IGFuIG91dGxpZXIuIEJ1dC4uLiB0aGV5J3JlIHByb2JhYmx5IGp1c3QgbWlzc2luZyBzb21ldGhpbmcuIFlvdSdyZSBzdXJlIHRoaW5ncyB3aWxsIGdvIGJhY2sgdG8gbm9ybWFsIHNvb24uIFByb2JhYmx5LlxcbllvdSdyZSBzaGFrZW4gb3V0IG9mIHlvdXIgdGhvdWdodHMgYnkgdGhlIGNhciBzbG93aW5nIGRvd24gYW5kIHN0b3BwaW5nLiBZb3UncmUgaGVyZS4gXFxuVGltZSB0byBnbyBpbnNpZGUgYW5kIGdldCByZWFkeSBmb3IgdGhlIGhlYXJpbmcuXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiRW50ZXJcIixcIm5leHRcIjpcImVudGVyXCJ9XX0sXCJmbHlpbmdDYXJcIjp7XCJ0ZXh0XCI6XCJZb3UgZGVjaWRlIG9uIHRoZSBmbHlpbmcgY2FyLiBZb3UgY2FuIHNwZW5kIGEgbGl0dGxlIGV4dHJhIGp1c3QgZm9yIHRvZGF5OyBpdCBpcyBhbiBpbXBvcnRhbnQgZGF5IGFmdGVyIGFsbC4gUGx1cywgaXQnbGwgZ2V0IHlvdSB0aGVyZSBmYXN0ZXIuIEFuZCB0aGUgdmlld3MgYXJlIG11Y2ggbmljZXIuIFlvdSB3YWl0IGEgbWludXRlLCBhbmQgdGhlbiBoZWFyIHRoZSB3aGlycmluZyBvZiB0aGUgcm90b3JzIG9uIHRoZSBjYXIuIFRvIGJlIGhvbmVzdCB5b3UgaGFkIGFsd2F5cyBpbWFnaW5lZCBmbHlpbmcgY2FycyBhcyBmbG9hdGluZywgb3IgbWF5YmUgd2l0aCB3aW5ncyBsaWtlIGFuIGFpcnBsYW5lLiBCdXQgeW91IHN1cHBvc2UgdGVjaG5vbG9neSBpcyByYXJlbHkgZXhhY3RseSB3aGF0IHdlIGV4cGVjdCBpdCB0byBiZS4gWW91IGdldCBpbiB0aGUgY2FyLCBhbmQgaXQgdGFrZXMgb2ZmLlxcbltiYWNrZ3JvdW5kIGZseWluZy5tcDNdWW91IGxvb2sgb3V0IHRoZSB3aW5kb3cgYXMgdGhlIGdyb3VuZCBkcmlmdHMgZnVydGhlciBmcm9tIHlvdS4gWW91J3JlIG5vdCBzdXJlIHlvdSdsbCBldmVyIGdldCB1c2VkIHRvIHRoYXQuIFN0aWxsLCBpdCdzIGEgbmljZSB2aWV3LiBVbmZvcnR1bmF0ZWx5LCB5b3VyIHZpZXcgaXMgb2NjYXNpb25hbGx5IGJsb2NrZWQgYnkgYW4gYWR2ZXJ0aXNlbWVudC4gSXQncyBub3QgZXhhY3RseSBzdXJwcmlzaW5nIHRoYXQgdGhleSdyZSBhbGwgb3ZlciB0aGUgc2t5OyB3ZSBwdXQgYmlsbGJvYXJkcyBldmVyeXdoZXJlIG9uIGhpZ2h3YXlzLiBCdXQgaXQgd291bGQgaGF2ZSBiZWVuIG5pY2UgdG8gbGVhdmUgdGhpcyBzaWdodCB1bmJsZW1pc2hlZC4gQXQgbGVhc3QgdGhleSdyZSBub3QgcGh5c2ljYWxseSBpbiB0aGUgYWlyLCBvbmx5IHZpc2libGUgaW4geW91ciBBUiBnbGFzc2VzLiBJbiBmYWN0LCB1c3VhbGx5IHlvdSdkIGp1c3QgdGFrZSB0aGVtIG9mZiwgYnV0IHlvdSBoYXZlIHRvIGJlIHdhdGNoaW5nIGZvciBtZXNzYWdlcyBmcm9tIHlvdXIgY29tcGFueSwganVzdCBpbiBjYXNlLiBTbyB5b3UncmUgZ29pbmcgdG8gaGF2ZSB0byBkZWFsIHdpdGggdGhlIG9jY2FzaW9uYWwgYWQgZHJpZnRpbmcgaW50byB2aWV3Llxcbk9uZSBpbiBwYXJ0aWN1bGFyIGNhdGNoZXMgeW91ciBleWUuIEF0IGZpcnN0LCBpdCBqdXN0IGxvb2tlZCBsaWtlIGEgY2xvdWQgb2Ygc21va2UsIGJ1dCB0aGVuIHlvdSBzZWUgaXQgcmVmb3JtIGluIHRoZSBsZXR0ZXJzIFxcXCJERUNBUkJPTklaRVxcXCIuIFdlbGwsIGl0J3MgYW4gaW1wcmVzc2l2ZSByZW5kZXJpbmcsIHlvdSdsbCBnaXZlIHRoZW0gdGhhdC4gVGhlIHNtb2tlIHRoZW4gY29udGludWVzIHRvIHJlZm9ybSBpbnRvIGRpZmZlcmVudCB3b3JkcyBhbmQgc2VudGVuY2VzLiBcXG5cXFwiRG8geW91IHJlYWxseSB3YW50IHRoaXMgaW4geW91ciBhaXI/XFxcIltkZWxheSAxMDAwXVxcblxcXCJXZSdyZSBhdCBhIHRpcHBpbmcgcG9pbnRcXFwiW2RlbGF5IDEwMDBdXFxuXFxcIlRoZXJlIGlzIG5vIEVhcnRoIDJcXFwiW2RlbGF5IDEwMDBdXFxuXFxcIlRoZXJlJ3Mgc3RpbGwgdGltZSB0byBmaXggdGhpc1xcXCJbZGVsYXkgMTAwMF1cXG5cXFwiWmVybyBjYXJib24gYnkgMjEwMFxcXCJbZGVsYXkgMTAwMF1cXG5JdCB0aGVuIGxpbmtzIHRvIGEgd2Vic2l0ZSwgd2hpY2ggeW91IHF1aWNrbHkgd2F2ZSBhd2F5LiBZb3Ugc2NvZmYuIFplcm8gY2FyYm9uPyBUaGVyZSdzIG5vIHdheSB3ZSBjb3VsZCBkbyB0aGF0LCByaWdodD8gQW5kIGV2ZW4gaWYgd2UgY291bGQsIGNhcmJvbiBkaW94aWRlIGlzbid0IDxlbT50aGF0PC9lbT4gYmFkLiBSaWdodD8gVGhlIGxpZmVjeWNsZSBhbmFseXNpcyBpbiB5b3VyIGZvbGRlciBuYWdzIGF0IHlvdS4uLiBidXQgeW91IHB1c2ggdGhlIHRob3VnaHQgYXdheS4gRm9jdXMuIFlvdXIgc3VwZXJ2aXNvciB0b2xkIHlvdSBub3QgdG8gd29ycnkgYWJvdXQgdGhlIGVudmlyb25tZW50YWwgaW1wYWN0cyBzbyBtdWNoLiBTbyBpdCdzIHByb2JhYmx5IGZpbmUuXFxuWW91J3JlIHNoYWtlbiBvdXQgb2YgeW91ciB0aG91Z2h0cyBieSB0aGUgY2FyIGxhbmRpbmcuIFlvdSdyZSBoZXJlLiBcXG5UaW1lIHRvIGdvIGluc2lkZSBhbmQgZ2V0IHJlYWR5IGZvciB0aGUgaGVhcmluZy5cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiYXJyb3ctdXAtZnJvbS1icmFja2V0XCIsXCJ0ZXh0XCI6XCJFbnRlclwiLFwibmV4dFwiOlwiZW50ZXJcIn1dfX0iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBBdWRpb01hbmFnZXIge1xuICAgIGVsZW1lbnQgPSBuZXcgQXVkaW8oKTtcbiAgICBcbiAgICBwbGF5KG5hbWU6IFN0cmluZywgdm9sdW1lOiBudW1iZXIgPSAxKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5zcmMgPSBgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2tmaXNoNjEwL3RleHQtYWR2ZW50dXJlL21haW4vYXNzZXRzLyR7bmFtZX1gO1xuICAgICAgICB0aGlzLmVsZW1lbnQudm9sdW1lID0gdm9sdW1lO1xuICAgICAgICB0aGlzLmVsZW1lbnQuY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB0aGlzLmVsZW1lbnQucGxheSgpO1xuICAgIH1cblxuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5wYXVzZSgpO1xuICAgICAgICB0aGlzLmVsZW1lbnQuY3VycmVudFRpbWUgPSAwO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGF1c2UoKTtcbiAgICB9XG5cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5wbGF5KCk7XG4gICAgfVxuXG4gICAgbG9vcChzaG91bGRMb29wOiBib29sZWFuKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5sb29wID0gc2hvdWxkTG9vcDtcbiAgICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnViYmxlcyB7XG4gICAgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gICAgYnViYmxlczogQXJyYXk8QnViYmxlPiA9IFtdO1xuXG4gICAgY29uc3RydWN0b3IoY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCkge1xuICAgICAgICB0aGlzLmN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuICAgICAgICB0aGlzLnJlc2l6ZSgpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTA7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5idWJibGVzLnB1c2gobmV3IEJ1YmJsZSgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuY3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLmN0eC5jYW52YXMud2lkdGgsIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5idWJibGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5idWJibGVzW2ldLnNwZWVkID4gMCAmJiB0aGlzLmJ1YmJsZXNbaV0ubGlmZXRpbWUgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5zcGVlZCAqPSAtMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLnVwZGF0ZShkdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5idWJibGVzW2ldLnNpemUgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXSA9IG5ldyBCdWJibGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5idWJibGVzW2ldLmRyYXcodGhpcy5jdHgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzaXplKCkge1xuICAgICAgICB2YXIgZHByID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICAgICAgdmFyIHJlY3QgPSB0aGlzLmN0eC5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgdGhpcy5jdHguY2FudmFzLndpZHRoID0gcmVjdC53aWR0aCAqIGRwcjtcbiAgICAgICAgdGhpcy5jdHguY2FudmFzLmhlaWdodCA9IHJlY3QuaGVpZ2h0ICogZHByO1xuXG4gICAgICAgIC8vIHRoaXMuY3R4LnNjYWxlKGRwciwgZHByKTtcblxuICAgICAgICB0aGlzLmN0eC5maWx0ZXIgPSBcImJsdXIoNTBweClcIjtcbiAgICB9XG59XG5cbmNsYXNzIEJ1YmJsZSB7XG4gICAgc3BlZWQ6IG51bWJlcjtcbiAgICB4OiBudW1iZXI7XG4gICAgeTogbnVtYmVyO1xuICAgIHNpemU6IG51bWJlcjtcbiAgICBjb2xvcjogc3RyaW5nO1xuICAgIGxpZmV0aW1lOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5zcGVlZCA9IDAuMDI7XG5cbiAgICAgICAgdGhpcy54ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLnJhbmRvbSgpICogd2luZG93LmlubmVySGVpZ2h0O1xuXG4gICAgICAgIHRoaXMuc2l6ZSA9IDEwO1xuXG4gICAgICAgIGxldCB2ID0gTWF0aC5yYW5kb20oKTtcbiAgICAgICAgbGV0IGh1ZSA9IHYgPCAwLjUgPyAxNTAgOiAyMzA7XG4gICAgICAgIGxldCBzYXQgPSB2IDwgMC41ID8gNTAgOiA4NTtcbiAgICAgICAgbGV0IGxpZ2h0ID0gdiA8IDAuNSA/IDI1IDogNDA7XG4gICAgICAgIHRoaXMuY29sb3IgPSBcImhzbGEoXCIgKyBodWUgKyBcIiwgXCIgKyBzYXQgKyBcIiUsIFwiICsgbGlnaHQgKyBcIiUsIDIwJSlcIjtcblxuICAgICAgICB0aGlzLmxpZmV0aW1lID0gTWF0aC5yYW5kb20oKSAqKiA1ICogMTYwMDAgKyAyMDAwO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc2l6ZSArPSB0aGlzLnNwZWVkICogZHQ7XG4gICAgICAgIHRoaXMubGlmZXRpbWUgLT0gZHQ7XG4gICAgfVxuXG4gICAgZHJhdyhjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCkge1xuICAgICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5jb2xvcjtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBjdHguYXJjKHRoaXMueCwgdGhpcy55LCB0aGlzLnNpemUsIDAsIE1hdGguUEkgKiAyKTtcbiAgICAgICAgY3R4LmZpbGwoKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdG9yeSwgT3B0aW9uIH0gZnJvbSAnLi9zdG9yeSc7XG5cbmxldCBzdG9yeTogU3RvcnkgPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBCdXR0b25zIHtcbiAgICBlbGVtOiBIVE1MRWxlbWVudDtcbiAgICBzZWxlY3RlZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgdGV4dDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgZW5hYmxlZCA9IGZhbHNlO1xuICAgIGJ1dHRvbnM6IEhUTUxCdXR0b25FbGVtZW50W10gPSBbXTtcbiAgICBmaXJzdEV4aXQgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IoZWxlbTogSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5lbGVtID0gZWxlbTtcbiAgICB9XG5cbiAgICBlbmFibGUoc2NlbmU6IHN0cmluZykge1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgbGV0IG9wdGlvbnM6IE9wdGlvbltdO1xuICAgICAgICBpZiAoc3Rvcnlbc2NlbmVdLm9wdGlvbnMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gc3Rvcnlbc3Rvcnlbc2NlbmVdLmxvb3AhXS5vcHRpb25zITtcbiAgICAgICAgICAgIGxldCBsb29wZWRPcHQgPSBvcHRpb25zLmZpbmRJbmRleChvID0+IG8ucmV0dXJuICE9IHVuZGVmaW5lZCA/IG8ucmV0dXJuID09IHNjZW5lIDogby5uZXh0ID09IHNjZW5lKTtcbiAgICAgICAgICAgIG9wdGlvbnMuc3BsaWNlKGxvb3BlZE9wdCwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0gc3Rvcnlbc2NlbmVdLm9wdGlvbnMhO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHN0ZXAgPSBvcHRpb25zLmxlbmd0aCA9PSA0ID8gNiA6IDEyL29wdGlvbnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbiA9IG9wdGlvbnNbaV07XG4gICAgICAgICAgICBsZXQgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc05hbWUgPSBcIm92ZXJsYXlcIjtcbiAgICAgICAgICAgIGJ1dHRvbi5pbm5lckhUTUwgPSAgXCI+IDxpIGNsYXNzPVxcXCJmYS1zb2xpZCBmYS1cIisgb3B0aW9uLmljb24gK1wiXFxcIj48L2k+IFwiICsgb3B0aW9uLnRleHQ7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gXCI0IC8gMTBcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5sZW5ndGggPT0gNCkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gaSA8IDIgPyAoaSpzdGVwICsgMSkudG9TdHJpbmcoKSArIFwiIC8gXCIgKyAoKGkrMSkqc3RlcCArIDEpLnRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAoKGktMikqc3RlcCArIDEpLnRvU3RyaW5nKCkgKyBcIiAvIFwiICsgKChpLTEpKnN0ZXAgKyAxKS50b1N0cmluZygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IChpKnN0ZXAgKyAxKS50b1N0cmluZygpICsgXCIgLyBcIiArICgoaSsxKSpzdGVwICsgMSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJ1dHRvbi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZpcnN0RXhpdCAmJiBvcHRpb24uaWNvbiA9PSBcImFycm93LXVwLWZyb20tYnJhY2tldFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RFeGl0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50Lm9udmlzaWJpbGl0eWNoYW5nZSEobmV3IEV2ZW50KFwidmlzaWJpbGl0eWNoYW5nZVwiKSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY29uZmlybShcIk9wdGlvbnMgd2l0aCB0aGlzIGljb24gKHRoZSBleGl0aW5nIGFycm93KSBsZWF2ZSBhIHNjZW5lIHBlcm1hbmVudGx5LiBcXFxuVGhpcyBtZWFucyB0aGF0IGlmIHRoZXJlJ3MgYW55IG90aGVyIG9wdGlvbnMgeW91IGhhdmVuJ3QgdHJpZWQgeWV0LCBcXFxuYWZ0ZXIgY2xpY2tpbmcgdGhpcyBvcHRpb24geW91IHdvbid0IGJlIGFibGUgdG8gcmVhZCB0aGVtIHdpdGhvdXQgcmVzdGFydGluZyB0aGUgZ2FtZS4gXFxcbkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBjb250aW51ZT9cIikpIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RlZCA9IG9wdGlvbi5uZXh0O1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dCA9IFwiPGkgY2xhc3M9XFxcImZhLXNvbGlkIGZhLVwiKyBvcHRpb24uaWNvbiArXCJcXFwiPjwvaT4gXCIgKyBvcHRpb24udGV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW0uY2xhc3NOYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW0uaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1dHRvbnMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmVsZW0uYXBwZW5kQ2hpbGQoYnV0dG9uKTtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9ucy5wdXNoKGJ1dHRvbik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbGVtLmNsYXNzTmFtZSA9IFwib3V0XCI7XG4gICAgfVxufSIsImltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuaW1wb3J0IFN0YXRlTWFuYWdlciBmcm9tIFwiLi9zdGF0ZV9tYW5hZ2VyXCI7XG5pbXBvcnQgeyBCZWdpblN0YXRlIH0gZnJvbSBcIi4vc3RhdGVzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEdhbWUge1xuICAgIHRlcm06IFRlcm1pbmFsO1xuICAgIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKHRlcm1pbmFsOiBIVE1MRWxlbWVudCkge1xuICAgICAgICB0ZXJtaW5hbC5zdHlsZS5saW5lSGVpZ2h0ID0gXCIxLjJyZW1cIjtcbiAgICAgICAgdGhpcy50ZXJtID0gbmV3IFRlcm1pbmFsKHRlcm1pbmFsKTtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbmV3IFN0YXRlTWFuYWdlcihCZWdpblN0YXRlKTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIudXBkYXRlKGR0LCB0aGlzLnRlcm0pO1xuXG4gICAgICAgIHRoaXMudGVybS51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdGhpcy50ZXJtLnJlc2l6ZSgpO1xuICAgIH1cblxuICAgIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGVNYW5hZ2VyIGZyb20gXCIuL3N0YXRlX21hbmFnZXJcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhYnN0cmFjdCBjbGFzcyBTdGF0ZSB7XG4gICAgcHJvdGVjdGVkIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFN0YXRlTWFuYWdlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIGluaXQodGVybTogVGVybWluYWwpIHt9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHt9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHt9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTdGF0ZU1hbmFnZXIge1xuICAgIHN0YXRlOiBTdGF0ZTtcbiAgICBuZWVkc0luaXQgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICB9XG5cbiAgICBzZXRTdGF0ZShzOiBuZXcgKG06IFN0YXRlTWFuYWdlcikgPT4gU3RhdGUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5ldyBzKHRoaXMpO1xuICAgICAgICB0aGlzLm5lZWRzSW5pdCA9IHRydWU7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLm5lZWRzSW5pdCkge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZS5pbml0KHRlcm0pO1xuICAgICAgICAgICAgdGhpcy5uZWVkc0luaXQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUudXBkYXRlKGR0LCB0ZXJtKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5rZXlkb3duKGUpO1xuICAgIH1cbn1cbiIsImltcG9ydCBTdGF0ZSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuL3Rlcm1pbmFsXCI7XG5pbXBvcnQgQnV0dG9ucyBmcm9tIFwiLi9idXR0b25zXCI7XG5pbXBvcnQgeyBTdG9yeSB9IGZyb20gJy4vc3RvcnknO1xuaW1wb3J0IEF1ZGlvTWFuYWdlciBmcm9tIFwiLi9hdWRpb19tYW5hZ2VyXCI7XG5cbmxldCBzdG9yeTogU3RvcnkgPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5leHBvcnQgY2xhc3MgQmVnaW5TdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRlcm0ud3JpdGVMaW5lKFwiUHJlc3MgYW55IGtleSB0byBiZWdpbi4uLlwiKTtcbiAgICB9XG5cbiAgICBvdmVycmlkZSBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLnNldFN0YXRlKFdpcGVTdGF0ZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2lwZVN0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHByaXZhdGUgd2lwZVRpbWVyID0gMDtcbiAgICBwcml2YXRlIHdpcGVUaWNrcyA9IDA7XG4gICAgcHJpdmF0ZSB3aXBlTGluZXM6IG51bWJlcjtcblxuICAgIG92ZXJyaWRlIGluaXQodGVybTogVGVybWluYWwpIHtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLm92ZXJmbG93ID0gXCJoaWRkZW5cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnNjcm9sbFNuYXBUeXBlID0gXCJ1bnNldFwiO1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSBcIjEuNnJlbVwiO1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gXCIxLjZyZW1cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnRleHRJbmRlbnQgPSBcInVuc2V0XCI7XG4gICAgICAgIHRoaXMud2lwZUxpbmVzID0gdGVybS5tYXhMaW5lcztcbiAgICB9XG5cbiAgICBvdmVycmlkZSB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgaWYgKHRoaXMud2lwZVRpbWVyID4gNTApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndpcGVUaWNrcyA+IDUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVMaW5lcy0tO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVUaWNrcysrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0ZXJtLmZpbGxSYW5kb20odGhpcy53aXBlTGluZXMpO1xuXG4gICAgICAgICAgICB0aGlzLndpcGVUaW1lciA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53aXBlTGluZXMgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgKz0gZHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0ZXJtLnJlc2V0KCk7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcIlwiO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnNjcm9sbFNuYXBUeXBlID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5wYWRkaW5nTGVmdCA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS50ZXh0SW5kZW50ID0gXCJcIjtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5zZXRTdGF0ZShQbGF5aW5nU3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGxheWluZ1N0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHNjZW5lID0gXCJiZWdpblwiO1xuXG4gICAgcmVtYWluaW5nVGV4dCA9IFwiXCI7XG5cbiAgICBkZWxheSA9IDA7XG5cbiAgICB0ZXh0RGVjb2RlZCA9IC0xO1xuICAgIHRleHRQb3NpdGlvbiA9IC0xO1xuXG4gICAgYnV0dG9ucyA9IG5ldyBCdXR0b25zKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYnV0dG9uc1wiKSEpO1xuXG4gICAgYXVkaW8gPSBuZXcgQXVkaW9NYW5hZ2VyKCk7XG4gICAgYmFja2dyb3VuZCA9IG5ldyBBdWRpb01hbmFnZXIoKTtcblxuICAgIGN1cnJTb3VuZCA9IFwiY2xpY2sud2F2XCI7XG5cbiAgICBsb2NrID0gZmFsc2U7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRoaXMuYXVkaW8ubG9vcChmYWxzZSk7XG4gICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jbG9zZScpIS5vbmNsaWNrID0gKGUpID0+IHtcbiAgICAgICAgICAgIHRoaXMubG9jayA9IGZhbHNlO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ltYWdlLWNvbnRhaW5lcicpIS5jbGFzc05hbWUgPSBcIlwiO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIG92ZXJyaWRlIHVwZGF0ZShkdDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBpZiAodGhpcy5sb2NrKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuYnV0dG9ucy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuYnV0dG9ucy5zZWxlY3RlZCAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmJhY2tncm91bmQuc3RvcCgpO1xuICAgICAgICAgICAgdGVybS53cml0ZUxpbmUodGhpcy5idXR0b25zLnRleHQhKTtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUgPSB0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQ7XG4gICAgICAgICAgICB0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gc3RvcnlbdGhpcy5zY2VuZV0udGV4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlbWFpbmluZ1RleHQubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRoaXMuYXVkaW8uc3RvcCgpO1xuICAgICAgICAgICAgdGVybS5icmVhaygpO1xuICAgICAgICAgICAgdGhpcy5idXR0b25zLmVuYWJsZSh0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmRlbGF5IDw9IDApIHtcbiAgICAgICAgICAgIGxldCBbcG9zLCBpbmRleF0gPSB0aGlzLmluZGV4T2ZNYW55KHRoaXMucmVtYWluaW5nVGV4dCwgXCI8WyBcXG5cIik7XG4gICAgICAgICAgICBpZihwb3MgPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlU3BlY2lhbChpbmRleCwgdGVybSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMud3JpdGVUZXh0KHBvcywgdGVybSwgZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWxheSAtPSBkdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaW5kZXhPZk1hbnkoc3RyOiBzdHJpbmcsIGNoYXJzOiBzdHJpbmcpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBjID0gY2hhcnMuaW5kZXhPZihzdHJbaV0pO1xuICAgICAgICAgICAgaWYgKGMgIT0gLTEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2ksIGNdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbLTEsIC0xXTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHdyaXRlVGV4dChsZW46IG51bWJlciwgdGVybTogVGVybWluYWwsIGR0OiBudW1iZXIpIHtcbiAgICAgICAgaWYgKGxlbiA9PSAtMSkge1xuICAgICAgICAgICAgbGVuID0gdGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmF1ZGlvLnBsYXkodGhpcy5jdXJyU291bmQpO1xuICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCA9IDA7XG4gICAgICAgICAgICB0aGlzLnRleHRQb3NpdGlvbiA9IHRlcm0uZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB0ZXh0ID1cbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgwLCB0aGlzLnRleHREZWNvZGVkKSArXG4gICAgICAgICAgICB0ZXJtLnJhbmRvbUNoYXJhY3RlcnMobGVuIC0gdGhpcy50ZXh0RGVjb2RlZCk7XG5cbiAgICAgICAgdGVybS53cml0ZSh0ZXh0LCB0aGlzLnRleHRQb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMudGV4dERlY29kZWQgPT0gbGVuKSB7XG4gICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UobGVuKTtcbiAgICAgICAgICAgIHRoaXMudGV4dERlY29kZWQgPSAtMTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGV4dERlY29kZWQrKztcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZVNwZWNpYWwoaW5kZXg6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgc3dpdGNoIChpbmRleCkge1xuICAgICAgICAgICAgY2FzZSAwOiAvLyA8XG4gICAgICAgICAgICAgICAgbGV0IGVuZFRhZ1BvcyA9IHRoaXMucmVtYWluaW5nVGV4dC5pbmRleE9mKFwiPlwiKTtcbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgwLCBlbmRUYWdQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGVuZFRhZ1BvcyArIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAxOiAvLyBbXG4gICAgICAgICAgICAgICAgbGV0IGVuZENvbW1hbmRQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIl1cIik7XG4gICAgICAgICAgICAgICAgbGV0IGNvbW1hbmQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSwgZW5kQ29tbWFuZFBvcyk7XG4gICAgICAgICAgICAgICAgbGV0IHNwYWNlUG9zID0gY29tbWFuZC5pbmRleE9mKFwiIFwiKTtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwYWNlUG9zID09IC0xID8gY29tbWFuZCA6IGNvbW1hbmQuc2xpY2UoMCwgc3BhY2VQb3MpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJkZWxheVwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxheSA9IHBhcnNlSW50KGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm5vcm1hbFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hdWRpby5wbGF5KHRoaXMuY3VyclNvdW5kKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUoY29tbWFuZC5zbGljZShzcGFjZVBvcyArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwic2VwXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInNvdW5kXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJTb3VuZCA9IGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiYmFja2dyb3VuZFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNwYWNlUG9zID09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnN0b3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnBsYXkoY29tbWFuZC5zbGljZShzcGFjZVBvcyArIDEpLCAwLjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJpbWFnZVwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGVybS53cml0ZShgPGEgb25jbGljaz0naW1nQ2xpY2soKSc+Q2xpY2sgdG8gdmlldyBpbWFnZTwvYT5gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubG9jayA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuaW1nQ2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZScpIGFzIEhUTUxJbWFnZUVsZW1lbnQpLnNyYyA9IGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UtY29udGFpbmVyJykhLmNsYXNzTmFtZSA9IFwic2hvd1wiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGVuZENvbW1hbmRQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMjogLy8gPHNwYWNlPlxuICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUoXCIgXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMzogLy8gXFxuXG4gICAgICAgICAgICAgICAgdGVybS53cml0ZUxpbmUoXCJcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWxheSA9IDUwMDtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiSW52YWxpZCBjaGFyIGluZGV4IFwiICsgaW5kZXgpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5kZWNsYXJlIGdsb2JhbCB7XG4gICAgaW50ZXJmYWNlIFdpbmRvdyB7IGltZ0NsaWNrOiAoKSA9PiB2b2lkOyB9XG59XG4iLCJpbXBvcnQgTGluZUNsYW1wIGZyb20gXCJAdHZhbmMvbGluZWNsYW1wXCI7XHJcblxyXG5jb25zdCBDVVJTT1JfQkxJTktfSU5URVJWQUwgPSA1MDA7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUZXJtaW5hbCB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuXHJcbiAgICBmb250U2l6ZTogbnVtYmVyO1xyXG4gICAgd2lkdGg6IG51bWJlcjtcclxuICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgbGluZUhlaWdodDogbnVtYmVyO1xyXG5cclxuICAgIG1heExpbmVzOiBudW1iZXI7XHJcbiAgICBjaGFyc1BlckxpbmU6IG51bWJlcjtcclxuXHJcbiAgICBjb250ZW50ID0gXCI8ZGl2Pj4gXCI7XHJcblxyXG4gICAgcHJpdmF0ZSBjdXJzb3JWaXNpYmxlID0gdHJ1ZTtcclxuICAgIHByaXZhdGUgY3Vyc29yRW5hYmxlZCA9IHRydWU7XHJcbiAgICBwcml2YXRlIGN1cnNvclRpY2tzID0gMDtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihlbGVtOiBIVE1MRWxlbWVudCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGVsZW07XHJcblxyXG4gICAgICAgIHRoaXMuZm9udFNpemUgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmZvbnRTaXplLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkud2lkdGguc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuaGVpZ2h0LnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcclxuICAgICAgICBjb25zdCBjbGFtcCA9IG5ldyBMaW5lQ2xhbXAodGhpcy5lbGVtZW50KTtcclxuICAgICAgICB0aGlzLmxpbmVIZWlnaHQgPSBjbGFtcC5jYWxjdWxhdGVUZXh0TWV0cmljcygpLmFkZGl0aW9uYWxMaW5lSGVpZ2h0O1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiXCI7XHJcblxyXG4gICAgICAgIHRoaXMubWF4TGluZXMgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0IC8gdGhpcy5saW5lSGVpZ2h0KTtcclxuICAgICAgICB0aGlzLmNoYXJzUGVyTGluZSA9IE1hdGguZmxvb3IodGhpcy53aWR0aCAvICh0aGlzLmZvbnRTaXplICogMC42KSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzaXplKCkge1xyXG4gICAgICAgIHRoaXMud2lkdGggPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLndpZHRoLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmhlaWdodC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICB0aGlzLm1heExpbmVzID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAvIHRoaXMubGluZUhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5jaGFyc1BlckxpbmUgPSBNYXRoLmZsb29yKHRoaXMud2lkdGggLyAodGhpcy5mb250U2l6ZSAqIDAuNikpO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZShkdDogbnVtYmVyKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3Vyc29yRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJzb3JUaWNrcyA+PSBDVVJTT1JfQkxJTktfSU5URVJWQUwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Vyc29yVGlja3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ3Vyc29yKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnNvclRpY2tzICs9IGR0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHNob3coKSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmlubmVySFRNTCA9IHRoaXMuY29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICBjbGVhcigpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCA9IFwiXCI7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0UG9zaXRpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGVudC5sZW5ndGggLSAodGhpcy5jdXJzb3JWaXNpYmxlID8gMCA6IDEpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1dCh0ZXh0OiBzdHJpbmcsIHBvcz86IG51bWJlcikge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBwb3MgIT0gdW5kZWZpbmVkICYmXHJcbiAgICAgICAgICAgIHBvcyA+PSAwICYmXHJcbiAgICAgICAgICAgIHBvcyA8PSB0aGlzLmNvbnRlbnQubGVuZ3RoIC0gdGV4dC5sZW5ndGhcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ID1cclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudC5zbGljZSgwLCBwb3MpICtcclxuICAgICAgICAgICAgICAgIHRleHQgK1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50LnNsaWNlKHBvcyArIHRleHQubGVuZ3RoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgKz0gdGV4dDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHV0TGluZSh0ZXh0OiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCArPSB0ZXh0ICsgXCI8L2Rpdj48ZGl2Pj4gXCI7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzZXQoKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMucHV0KFwiPiBcIik7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHdyaXRlKHRleHQ6IHN0cmluZywgcG9zPzogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5wdXQodGV4dCwgcG9zKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGVMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMucHV0TGluZSh0ZXh0KTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgYnJlYWsoKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgKz0gXCI8L2Rpdj48YnIvPjxkaXY+PiBcIjtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmFuZG9tQ2hhcmFjdGVycyhjb3VudDogbnVtYmVyKSB7XHJcbiAgICAgICAgbGV0IHZhbHVlcyA9IG5ldyBVaW50OEFycmF5KGNvdW50KTtcclxuICAgICAgICB3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyh2YWx1ZXMpO1xyXG4gICAgICAgIGNvbnN0IG1hcHBlZFZhbHVlcyA9IHZhbHVlcy5tYXAoKHgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgYWRqID0geCAlIDM2O1xyXG4gICAgICAgICAgICByZXR1cm4gYWRqIDwgMjYgPyBhZGogKyA2NSA6IGFkaiAtIDI2ICsgNDg7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG1hcHBlZFZhbHVlcyk7XHJcbiAgICB9XHJcblxyXG4gICAgZmlsbFJhbmRvbShsaW5lczogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhcigpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXM7IGkrKykge1xyXG4gICAgICAgICAgICB0aGlzLnB1dCh0aGlzLnJhbmRvbUNoYXJhY3RlcnModGhpcy5jaGFyc1BlckxpbmUpKTtcclxuICAgICAgICAgICAgdGhpcy5wdXQoXCI8YnIgLz5cIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldEN1cnNvckVuYWJsZWQodmFsdWU6IGJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLmN1cnNvckVuYWJsZWQgPSB2YWx1ZTtcclxuICAgICAgICAvLyBpZiB0aGUgY3Vyc29yIG5lZWRlZCB0byBiZSB0dXJuZWQgb2ZmLCBmaXggaXRcclxuICAgICAgICBpZiAoIXRoaXMuY3Vyc29yRW5hYmxlZCAmJiAhdGhpcy5jdXJzb3JWaXNpYmxlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgICAgICB0aGlzLmN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGZsaXBDdXJzb3IoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3Vyc29yRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJzb3JWaXNpYmxlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgKz0gXCJfXCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgPSB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgLTEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9ICF0aGlzLmN1cnNvclZpc2libGU7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCBCdWJibGVzIGZyb20gXCIuL2J1YmJsZXNcIjtcbmltcG9ydCBHYW1lIGZyb20gXCIuL2dhbWVcIjtcblxubGV0IGdhbWU6IEdhbWU7XG5cbmxldCBidWJibGVzOiBCdWJibGVzO1xuXG5sZXQgbGFzdFRpbWU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG53aW5kb3cub25sb2FkID0gKCkgPT4ge1xuICAgIGJ1YmJsZXMgPSBuZXcgQnViYmxlcyhcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJiYWNrZ3JvdW5kXCIpIGFzIEhUTUxDYW52YXNFbGVtZW50XG4gICAgKTtcbiAgICBnYW1lID0gbmV3IEdhbWUoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0ZXJtaW5hbFwiKSEpO1xuXG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xufTtcblxud2luZG93Lm9ucmVzaXplID0gKCkgPT4ge1xuICAgIGJ1YmJsZXMucmVzaXplKCk7XG4gICAgZ2FtZS5yZXNpemUoKTtcbn07XG5cbmRvY3VtZW50Lm9ua2V5ZG93biA9IChlKSA9PiB7XG4gICAgZ2FtZS5rZXlkb3duKGUpO1xufTtcblxuZG9jdW1lbnQub252aXNpYmlsaXR5Y2hhbmdlID0gKCkgPT4ge1xuICAgIGlmIChkb2N1bWVudC52aXNpYmlsaXR5U3RhdGUgPT0gXCJ2aXNpYmxlXCIpIHtcbiAgICAgICAgbGFzdFRpbWUgPSBudWxsO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAvLyBUaGlzIHJlYWxseSBzaG91bGRuJ3QgYmUgbmVlZGVkIGlmIGJyb3dzZXJzIGFyZSBmb2xsb3dpbmcgY29udmVudGlvbixcbiAgICAvLyBidXQgYmV0dGVyIHNhZmUgdGhhbiBzb3JyeVxuICAgIGlmIChkb2N1bWVudC5oaWRkZW4pIHtcbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGxhc3RUaW1lID09IG51bGwpIHtcbiAgICAgICAgbGFzdFRpbWUgPSAtMTtcbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChsYXN0VGltZSAhPSAtMSkge1xuICAgICAgICBsZXQgZHQgPSB0aW1lIC0gbGFzdFRpbWU7XG5cbiAgICAgICAgYnViYmxlcy51cGRhdGUoZHQpO1xuICAgICAgICBnYW1lLnVwZGF0ZShkdCk7XG4gICAgfVxuXG4gICAgbGFzdFRpbWUgPSB0aW1lO1xuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==