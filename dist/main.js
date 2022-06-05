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

module.exports = {"begin":{"text":"[delay 500]Connecting[delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750]\n[sound alarm.wav]<em>Beep</em> [delay 1000]<em>Beep</em> [delay 1000]<em>Beep</em>[delay 1000]\n[sound click.wav]You wake up slowly to the sound of your alarm.\nIt drones on and on until you wake up enough to turn it off.\nWhat do you do?","options":[{"icon":"newspaper","text":"Check the news","next":"checkNews"},{"icon":"arrow-up-from-bracket","text":"Get out of bed","next":"getUp"}]},"checkNews":{"text":"You grab your Augmented Reality glasses from your nightstand and put them on.\nAs you scroll somewhat absentmindedly through the news, one story catches your eye.\nAn image of a flooded town off of the Missisippi River.\nMurky brown water everywhere, past waist height.\nCars, buildings, and trees barely above the surface.\n[image https://images.foxtv.com/static.fox7austin.com/www.fox7austin.com/content/uploads/2020/02/932/524/Flooding-in-MIssissippi-.jpg?ve=1&tl=1]\nNature is a cruel mistress, you think.\nBut then again, we've always had to deal with natural disasters, right?\nWell, thats enough of the news for today. That stuff is always just depressing.","loop":"begin"},"getUp":{"text":"You get up and get ready for the day.\nWhen you come back out of the bathroom, you notice two things:\n1. It's freezing in here\n2. Your room is a mess","options":[{"icon":"fan","text":"Turn off the A/C","next":"turnOff"},{"icon":"folder","text":"Check out the mess","next":"mess","return":"continue"},{"icon":"arrow-up-from-bracket","text":"Leave","next":"leave"}]},"turnOff":{"text":"As you go over to turn off the air conditioning, you take a look out the window. Just as you expected, its cloudy and rainy. The A/C must have been making the temperature even colder than it already was outside.\nYou've had it turned all the way up for the past few weeks due to the heatwave. You'd been worried that it wasn't going to end: you had never seen a heatwave go for that long or that hot in your life. Clearly it's over now, though, if the temperature is anything to go by.\nYou adjust the A/C's settings in its app on your AR glasses. On to more important things.","loop":"getUp"},"mess":{"text":"You spend so much time at work nowadays that your room is pretty messy. In theory, all of your materials would be contained in the folder on your desk, but you spend so much time reorganizing and adjusting that it all ends up strewn about. You'd probably be better off using virtual documents, but something about feeling the papers in your hand still appeals to you more than just seeing them.\nYou pick up what few papers remain the folder and flick through them. They're the three studies you've based your presentation on. You stare at them for a little, pensively. You'd always wanted to be the one doing the research. That's why you took this job; presenting research seemed like a good way to get some connections, not to mention you needed the money. But at some point you lost track of that goal, and even though you can probably afford to go back to school now, being a researcher feels like someone else's dream. The kind of thing a kid tells themself before they've been exposed to the real world.\nThis job is fine. It pays well. <b>It's fine</b>.\nAnyway, you have three studies in the folder.\nDo you want to review any of them before the big hearing later?","options":[{"icon":"industry","text":"CCS Study","next":"ccs"},{"icon":"fire-flame-simple","text":"Efficiency Study","next":"efficiency"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"lca"},{"icon":"arrow-up-from-bracket","text":"Continue","next":"continue"}]},"ccs":{"text":"This study is about CCS, Carbon Capture and Storage. It's a technology that significantly reduces the carbon emissions of coal and natural gas power plants, by up to 90%. So of course, the fossil fuels corporation you work for is pretty interested in it as a way to keep their business... up to date with the times. This study is an overview of past and current research into CCS technologies, some of which promise to reduce emissions by up to 95% or even more. It also has some low level explanations of how the technology works, such as some diagrams of possible processes.\n[image https://ars.els-cdn.com/content/image/1-s2.0-S0048969720367346-gr1.jpg]\nOf course, the extra work needed to capture and store the carbon dioxide does make the cost of electricity for CCS plants higher, and the technology can never reduce emissions to near zero like renewables. The study does note that, but your supervisor said not to focus on that part so much. After all, how much harm could just a little more carbon dioxide really do?","loop":"mess"},"efficiency":{"text":"This study is an analysis of the cost efficiency of various fossil fuel energy sources compared to renewable sources. The study found that all together, renewables cost about 6-8 cents per kilowatt-hour (kWh), while fossil fuel sources like coal and natural gas cost about 4-5 cents per kWh, depending on the source. Your supervisor was very insistent you highlight that while a 2 or 3 cent difference may not seem like much, if you multiply it over the whole power grid, it starts to add up. And you suppose that makes sense; if the government is going to be subsidizing energy, it might as well get the most out of each dollar.\nThe study, being funded by the company you work for, neglects to mention the cost increases from the use of CCS, which you've been told raise it up to about the same levels as renewables, if not more. But you've been assured that your company is working hard to make CCS cheaper, and once they do that they'll be sure to switch over. So that makes you feel a little better... you think. Until then though the company is still intending to focus on non-CCS plants. You won't be mentioning that either.","loop":"mess"},"lca":{"text":"This study you're not supposed to have. Your supervisor had been making a big fuss about some new lifecycle analysis that would show fossil fuels weren't as bad as everyone thought, but a couple of months later they had just stopped talking about it. So you did a little digging, found the researchers who did the study, and asked them for a copy.\nOnce they sent it to you, you quickly realized why you hadn't heard any more about it. Rather than find evidence that fossil fuels weren't as destructive as people thought, they actually found evidence that certain aspects of the process were more destructive than initially thought.\nYou're not sure why you kept the study. You certainly aren't going to use it at today's hearing, that would be... bad for your job security, to say the least. But something about it keeps nagging at you. Maybe it's the enormity of it all. You know about climate change—it's hard to ignore it with all the protests that have been going on recently—but as far as you can tell, everything seems to be fine. Sure, there's been a lot of floods in some other states recently, and there's definitely been a lot of heatwaves here in Texas, but none of it seems that bad. But seeing the sheer amount of carbon being emitted, together with references to the direct and indirect effects, even in a fossil fuel funded study; it makes you uncomfortable, to say the least.\nYou put the study back in the folder. You shouldn't be distracting yourself with that today. This is possibly the biggest hearing of your career. If you mess this up, it'll mean the majority of fossil fuel subsidies will be diverted to renewable energy, and less money for your employer means less money for you. No mistakes today.","loop":"mess"},"continue":{"text":"You turn your attention to the rest of the room.","loop":"getUp"},"leave":{"text":"You're a bit early, but you decide you might as well head to the virtual conference center already. It's a bit of a pain having to go somewhere just to have a better video capture, but you want to look your best. At least its better than having to fly to D.C. to attend the hearing: you know some people at your company who have been lobbying a whole lot longer than you, and they won't stop talking about how much of a pain the business trips used to be.\nOf course, you don't have a car; gas is more expensive than ever, and driving is becoming increasingly unfashionable nowadays. You could take the bus, but you'd like some privacy while you prepare yourself, so you call a taxi instead. Still, you're faced with a choice: normal car, or flying car?","options":[{"icon":"car","text":"Normal Car","next":"normalCar"},{"icon":"plane","text":"Flying Car","next":"flyingCar"}]},"normalCar":{"text":"Despite the novelty of a flying car, a standard car is probably the more reasonable option. It's certainly the most economical option, though the difference between them has been getting surprisingly small, all considered. The car arrives&mdash;the decrease of human drivers has made traffic almost a thing of the past at this point&mdash;and you get in.\n[background traffic.mp3]As the car drives off, you look out the window. You see a lot of businesses, but weirdly, most of them seem empty. Then you realize why. On nearly every building, there's an AR flyer attached to it, with something along the lines of \"now hiring\". You'd seen a piece in the news recently about how low-wage workers were getting hit hard by heat stress in the recent string of heatwaves. The air conditioners weren't up to the task of the weeks of heatwave. But you had assumed it was just a couple of people that were effected. This doesn't really seem like just a couple of people, though.\nBut you're sure this is just a temporary thing. It's a once in a lifetime heatwave, after all. Then again, you'd seen on the weather forecast that temperatures were supposed to go back up the rest of this week, and that today is just an outlier. But... they're probably just missing something. You're sure things will go back to normal soon. Probably.\nYou're shaken out of your thoughts by the car slowing down and stopping. You're here.\nTime to go inside and get ready for the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Enter","next":"enter"}]},"flyingCar":{"text":"You decide on the flying car. You can spend a little extra just for today; it is an important day after all. Plus, it'll get you there faster. And the views are much nicer. You wait a minute, and then hear the whirring of the rotors on the car. To be honest you had always imagined flying cars as floating, or maybe with wings like an airplane. But you suppose technology is rarely exactly what we expect it to be. You get in the car, and it takes off.\n[background flying.mp3]You look out the window as the ground drifts further from you. You're not sure you'll ever get used to that. Still, it's a nice view. Unfortunately, your view is occasionally blocked by an advertisement. It's not exactly surprising that they're all over the sky; we put billboards everywhere on highways. But it would have been nice to leave this sight unblemished. At least they're not physically in the air, only visible in your AR glasses. In fact, usually you'd just take them off, but you have to be watching for messages from your company, just in case. So you're going to have to deal with the occasional ad drifting into view.\nOne in particular catches your eye. At first, it just looked like a cloud of smoke, but then you see it reform in the letters \"DECARBONIZE\". Well, it's an impressive rendering, you'll give them that. The smoke then continues to reform into different words and sentences.\n\"Do you really want this in your air?\"[delay 1000]\n\"We're at a tipping point\"[delay 1000]\n\"There is no Earth 2\"[delay 1000]\n\"There's still time to fix this\"[delay 1000]\n\"Zero carbon by 2100\"[delay 1000]\nIt then links to a website, which you quickly wave away. You scoff. Zero carbon? There's no way we could do that, right? And even if we could, carbon dioxide isn't <em>that</em> bad. Right? The lifecycle analysis in your folder nags at you... but you push the thought away. Focus. Your supervisor told you not to worry about the environmental impacts so much. So it's probably fine.\nYou're shaken out of your thoughts by the car landing. You're here.\nTime to go inside and get ready for the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Enter","next":"enter"}]},"enter":{"text":"You enter the building. There's a small reception area, where you put your name in and ask if your room is ready. But apparently it's still being used for a few more minutes, so you sit down. And then you see them. A face you recognize... unfortunately. They're a lobbyist too, but for a climate change activism group, and they're going to the same hearing as you. Small world.\nThere's only a couple of chairs in the waiting room, so you sit down closer than you'd like to them. They keep stealing glances at you, and you're pretty sure they know who you are too. Do you want to talk to them? Or just keep sitting for a few minutes?","options":[{"icon":"comment","text":"Talk to them","next":"talk"},{"icon":"chair","text":"Sit awkwardly","next":"sit"}]},"sit":{"text":"You keep sitting. You wouldn't want to talk to them anyway. You're sure they'd be super boring.\n[normal .][delay 750][normal .][delay 750][normal .][normal .][delay 750][normal .][delay 750][normal .]\n[normal .][delay 750][normal .][delay 750][normal .][normal .][delay 750][normal .][delay 750][normal .]\nFinally, your room is ready. Time for the hearing. You take a deep breath, and get up.","options":[{"icon":"arrow-up-from-bracket","text":"Attend the hearing","next":"attend"}]},"talk":{"text":"You decide you might as well fill the time with a little conversation. At worst, maybe you'll know a bit more about how they're going to respond to you.\n\"So... how about that weather today? Crazy how it changed so fast.\" you say.[delay 1000]\nThey look at you for a second, then shake their head. \"As if you care. You're probably going to use it as an excuse to pretend climate change isn't happening. I know your type. You're just in this for the money.\"[delay 1000]\nYou weren't expecting that. \"Hey, I'm just trying to make conversation&mdash;\"[delay 1000]\n\"Sure, and I'm just trying to prevent the world from burning. I mean, you've seen the heatwave these past few weeks. You really think everything is ok?\"[delay 1000]\nThis conversation is... not going how you expected. \"Yeah the heatwave is...[delay 500] weird. But my company is looking into ways to reduce its carbon emissions, or add more carbon offsets. It's going to be <em>fine</em>.\"[delay 1000]\nThey just shake their head again. \"Look, you don't seem evil or anything. It just sounds like you're in denial. Maybe you know it too. But if you cared, you would be working with me, not with the fossil fuels industry. Or at least not actively defending them. So we have nothing to talk about.\"[delay 1000]\nYou start to respond, but the receptionist lets you know that your room is ready. \nYou take a deep breath, and get up. It's time for the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Attend the hearing","next":"attend"}]}}

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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UUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2QsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JDLE9BQU87S0FDVjtTQUFNLElBQUksUUFBUSxJQUFJLENBQUMsQ0FBQyxFQUFFO1FBQ3ZCLElBQUksRUFBRSxHQUFHLElBQUksR0FBRyxRQUFRLENBQUM7UUFFekIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ25CO0lBRUQsUUFBUSxHQUFHLElBQUksQ0FBQztJQUNoQixNQUFNLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vbm9kZV9tb2R1bGVzL0B0dmFuYy9saW5lY2xhbXAvZGlzdC9lc20uanMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RvcnkuY3NvbiIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9hdWRpb19tYW5hZ2VyLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2J1YmJsZXMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnV0dG9ucy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9nYW1lLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3N0YXRlX21hbmFnZXIudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGVzLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL3Rlcm1pbmFsLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWR1Y2VzIGZvbnQgc2l6ZSBvciB0cmltcyB0ZXh0IHRvIG1ha2UgaXQgZml0IHdpdGhpbiBzcGVjaWZpZWQgYm91bmRzLlxuICpcbiAqIFN1cHBvcnRzIGNsYW1waW5nIGJ5IG51bWJlciBvZiBsaW5lcyBvciB0ZXh0IGhlaWdodC5cbiAqXG4gKiBLbm93biBsaW1pdGF0aW9uczpcbiAqIDEuIENoYXJhY3RlcnMgdGhhdCBkaXN0b3J0IGxpbmUgaGVpZ2h0cyAoZW1vamlzLCB6YWxnbykgbWF5IGNhdXNlXG4gKiB1bmV4cGVjdGVkIHJlc3VsdHMuXG4gKiAyLiBDYWxsaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSB3aXBlcyBjaGlsZCBlbGVtZW50cy4gRnV0dXJlIHVwZGF0ZXMgbWF5IGFsbG93XG4gKiBpbmxpbmUgY2hpbGQgZWxlbWVudHMgdG8gYmUgcHJlc2VydmVkLlxuICpcbiAqIEB0b2RvIFNwbGl0IHRleHQgbWV0cmljcyBpbnRvIG93biBsaWJyYXJ5XG4gKiBAdG9kbyBUZXN0IG5vbi1MVFIgdGV4dFxuICovXG5jbGFzcyBMaW5lQ2xhbXAge1xuICAvKipcbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbWVudFxuICAgKiBUaGUgZWxlbWVudCB0byBjbGFtcC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBPcHRpb25zIHRvIGdvdmVybiBjbGFtcGluZyBiZWhhdmlvci5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heExpbmVzXVxuICAgKiBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdG8gYWxsb3cuIERlZmF1bHRzIHRvIDEuXG4gICAqIFRvIHNldCBhIG1heGltdW0gaGVpZ2h0IGluc3RlYWQsIHVzZSB7QHNlZSBvcHRpb25zLm1heEhlaWdodH1cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEhlaWdodF1cbiAgICogVGhlIG1heGltdW0gaGVpZ2h0IChpbiBwaXhlbHMpIG9mIHRleHQgaW4gYW4gZWxlbWVudC5cbiAgICogVGhpcyBvcHRpb24gaXMgdW5kZWZpbmVkIGJ5IGRlZmF1bHQuIE9uY2Ugc2V0LCBpdCB0YWtlcyBwcmVjZWRlbmNlIG92ZXJcbiAgICoge0BzZWUgb3B0aW9ucy5tYXhMaW5lc30uIE5vdGUgdGhhdCB0aGlzIGFwcGxpZXMgdG8gdGhlIGhlaWdodCBvZiB0aGUgdGV4dCwgbm90XG4gICAqIHRoZSBlbGVtZW50IGl0c2VsZi4gUmVzdHJpY3RpbmcgdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCBjYW4gYmUgYWNoaWV2ZWRcbiAgICogd2l0aCBDU1MgPGNvZGU+bWF4LWhlaWdodDwvY29kZT4uXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlU29mdENsYW1wXVxuICAgKiBJZiB0cnVlLCByZWR1Y2UgZm9udCBzaXplIChzb2Z0IGNsYW1wKSB0byBhdCBsZWFzdCB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfVxuICAgKiBiZWZvcmUgcmVzb3J0aW5nIHRvIHRyaW1taW5nIHRleHQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmhhcmRDbGFtcEFzRmFsbGJhY2tdXG4gICAqIElmIHRydWUsIHJlc29ydCB0byBoYXJkIGNsYW1waW5nIGlmIHNvZnQgY2xhbXBpbmcgcmVhY2hlcyB0aGUgbWluaW11bSBmb250IHNpemVcbiAgICogYW5kIHN0aWxsIGRvZXNuJ3QgZml0IHdpdGhpbiB0aGUgbWF4IGhlaWdodCBvciBudW1iZXIgb2YgbGluZXMuXG4gICAqIERlZmF1bHRzIHRvIHRydWUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5lbGxpcHNpc11cbiAgICogVGhlIGNoYXJhY3RlciB3aXRoIHdoaWNoIHRvIHJlcHJlc2VudCBjbGlwcGVkIHRyYWlsaW5nIHRleHQuXG4gICAqIFRoaXMgb3B0aW9uIHRha2VzIGVmZmVjdCB3aGVuIFwiaGFyZFwiIGNsYW1waW5nIGlzIHVzZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5Gb250U2l6ZV1cbiAgICogVGhlIGxvd2VzdCBmb250IHNpemUsIGluIHBpeGVscywgdG8gdHJ5IGJlZm9yZSByZXNvcnRpbmcgdG8gcmVtb3ZpbmdcbiAgICogdHJhaWxpbmcgdGV4dCAoaGFyZCBjbGFtcGluZykuIERlZmF1bHRzIHRvIDEuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhGb250U2l6ZV1cbiAgICogVGhlIG1heGltdW0gZm9udCBzaXplIGluIHBpeGVscy4gV2UnbGwgc3RhcnQgd2l0aCB0aGlzIGZvbnQgc2l6ZSB0aGVuXG4gICAqIHJlZHVjZSB1bnRpbCB0ZXh0IGZpdHMgY29uc3RyYWludHMsIG9yIGZvbnQgc2l6ZSBpcyBlcXVhbCB0b1xuICAgKiB7QHNlZSBvcHRpb25zLm1pbkZvbnRTaXplfS4gRGVmYXVsdHMgdG8gdGhlIGVsZW1lbnQncyBpbml0aWFsIGNvbXB1dGVkIGZvbnQgc2l6ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGVsZW1lbnQsXG4gICAge1xuICAgICAgbWF4TGluZXMgPSB1bmRlZmluZWQsXG4gICAgICBtYXhIZWlnaHQgPSB1bmRlZmluZWQsXG4gICAgICB1c2VTb2Z0Q2xhbXAgPSBmYWxzZSxcbiAgICAgIGhhcmRDbGFtcEFzRmFsbGJhY2sgPSB0cnVlLFxuICAgICAgbWluRm9udFNpemUgPSAxLFxuICAgICAgbWF4Rm9udFNpemUgPSB1bmRlZmluZWQsXG4gICAgICBlbGxpcHNpcyA9IFwi4oCmXCIsXG4gICAgfSA9IHt9XG4gICkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm9yaWdpbmFsV29yZHNcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IGVsZW1lbnQudGV4dENvbnRlbnQubWF0Y2goL1xcUytcXHMqL2cpIHx8IFtdLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwidXBkYXRlSGFuZGxlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogKCkgPT4gdGhpcy5hcHBseSgpLFxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib2JzZXJ2ZXJcIiwge1xuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMudXBkYXRlSGFuZGxlciksXG4gICAgfSk7XG5cbiAgICBpZiAodW5kZWZpbmVkID09PSBtYXhGb250U2l6ZSkge1xuICAgICAgbWF4Rm9udFNpemUgPSBwYXJzZUludCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS5mb250U2l6ZSwgMTApO1xuICAgIH1cblxuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgdGhpcy5tYXhMaW5lcyA9IG1heExpbmVzO1xuICAgIHRoaXMubWF4SGVpZ2h0ID0gbWF4SGVpZ2h0O1xuICAgIHRoaXMudXNlU29mdENsYW1wID0gdXNlU29mdENsYW1wO1xuICAgIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjayA9IGhhcmRDbGFtcEFzRmFsbGJhY2s7XG4gICAgdGhpcy5taW5Gb250U2l6ZSA9IG1pbkZvbnRTaXplO1xuICAgIHRoaXMubWF4Rm9udFNpemUgPSBtYXhGb250U2l6ZTtcbiAgICB0aGlzLmVsbGlwc2lzID0gZWxsaXBzaXM7XG4gIH1cblxuICAvKipcbiAgICogR2F0aGVyIG1ldHJpY3MgYWJvdXQgdGhlIGxheW91dCBvZiB0aGUgZWxlbWVudCdzIHRleHQuXG4gICAqIFRoaXMgaXMgYSBzb21ld2hhdCBleHBlbnNpdmUgb3BlcmF0aW9uIC0gY2FsbCB3aXRoIGNhcmUuXG4gICAqXG4gICAqIEByZXR1cm5zIHtUZXh0TWV0cmljc31cbiAgICogTGF5b3V0IG1ldHJpY3MgZm9yIHRoZSBjbGFtcGVkIGVsZW1lbnQncyB0ZXh0LlxuICAgKi9cbiAgY2FsY3VsYXRlVGV4dE1ldHJpY3MoKSB7XG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICBjb25zdCBjbG9uZSA9IGVsZW1lbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgIGNvbnN0IHN0eWxlID0gY2xvbmUuc3R5bGU7XG5cbiAgICAvLyBBcHBlbmQsIGRvbid0IHJlcGxhY2VcbiAgICBzdHlsZS5jc3NUZXh0ICs9IFwiO21pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7bWF4LWhlaWdodDpub25lIWltcG9ydGFudFwiO1xuICAgIGVsZW1lbnQucmVwbGFjZVdpdGgoY2xvbmUpO1xuXG4gICAgY29uc3QgbmF0dXJhbEhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodDtcblxuICAgIC8vIENsZWFyIHRvIG1lYXN1cmUgZW1wdHkgaGVpZ2h0LiB0ZXh0Q29udGVudCBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXCI7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgdGV4dEhlaWdodCA9IG5hdHVyYWxIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBGaWxsIGVsZW1lbnQgd2l0aCBzaW5nbGUgbm9uLWJyZWFraW5nIHNwYWNlIHRvIGZpbmQgaGVpZ2h0IG9mIG9uZSBsaW5lXG4gICAgY2xvbmUudGV4dENvbnRlbnQgPSBcIlxceGEwXCI7XG5cbiAgICAvLyBHZXQgaGVpZ2h0IG9mIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHRcbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgPSBjbG9uZS5vZmZzZXRIZWlnaHQ7XG4gICAgY29uc3QgZmlyc3RMaW5lSGVpZ2h0ID0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lIC0gbmF0dXJhbEhlaWdodFdpdGhvdXRUZXh0O1xuXG4gICAgLy8gQWRkIGxpbmUgKDxicj4gKyBuYnNwKS4gYXBwZW5kQ2hpbGQoKSBmYXN0ZXIgdGhhbiBpbm5lckhUTUxcbiAgICBjbG9uZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnJcIikpO1xuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXFx4YTBcIikpO1xuXG4gICAgY29uc3QgYWRkaXRpb25hbExpbmVIZWlnaHQgPSBjbG9uZS5vZmZzZXRIZWlnaHQgLSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmU7XG4gICAgY29uc3QgbGluZUNvdW50ID1cbiAgICAgIDEgKyAobmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSkgLyBhZGRpdGlvbmFsTGluZUhlaWdodDtcblxuICAgIC8vIFJlc3RvcmUgb3JpZ2luYWwgY29udGVudFxuICAgIGNsb25lLnJlcGxhY2VXaXRoKGVsZW1lbnQpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGVkZWYge09iamVjdH0gVGV4dE1ldHJpY3NcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7dGV4dEhlaWdodH1cbiAgICAgKiBUaGUgdmVydGljYWwgc3BhY2UgcmVxdWlyZWQgdG8gZGlzcGxheSB0aGUgZWxlbWVudCdzIGN1cnJlbnQgdGV4dC5cbiAgICAgKiBUaGlzIGlzIDxlbT5ub3Q8L2VtPiBuZWNlc3NhcmlseSB0aGUgc2FtZSBhcyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50LlxuICAgICAqIFRoaXMgbnVtYmVyIG1heSBldmVuIGJlIGdyZWF0ZXIgdGhhbiB0aGUgZWxlbWVudCdzIGhlaWdodCBpbiBjYXNlc1xuICAgICAqIHdoZXJlIHRoZSB0ZXh0IG92ZXJmbG93cyB0aGUgZWxlbWVudCdzIGJsb2NrIGF4aXMuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge25hdHVyYWxIZWlnaHRXaXRoT25lTGluZX1cbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdpdGggb25seSBvbmUgbGluZSBvZiB0ZXh0IGFuZCB3aXRob3V0XG4gICAgICogbWluaW11bSBvciBtYXhpbXVtIGhlaWdodHMuIFRoaXMgaW5mb3JtYXRpb24gbWF5IGJlIGhlbHBmdWwgd2hlblxuICAgICAqIGRlYWxpbmcgd2l0aCBpbmxpbmUgZWxlbWVudHMgKGFuZCBwb3RlbnRpYWxseSBvdGhlciBzY2VuYXJpb3MpLCB3aGVyZVxuICAgICAqIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3QgaW5jcmVhc2UgdGhlIGVsZW1lbnQncyBoZWlnaHQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2ZpcnN0TGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBhZGRzIHRvIHRoZSBlbGVtZW50LCBpLmUuLCB0aGVcbiAgICAgKiBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCB3aGlsZSBlbXB0eSBhbmQgdGhlIGhlaWdodFxuICAgICAqIG9mIHRoZSBlbGVtZW50IHdoaWxlIGl0IGNvbnRhaW5zIG9uZSBsaW5lIG9mIHRleHQuIFRoaXMgbnVtYmVyIG1heSBiZVxuICAgICAqIHplcm8gZm9yIGlubGluZSBlbGVtZW50cyBiZWNhdXNlIHRoZSBmaXJzdCBsaW5lIG9mIHRleHQgZG9lcyBub3RcbiAgICAgKiBpbmNyZWFzZSB0aGUgaGVpZ2h0IG9mIGlubGluZSBlbGVtZW50cy5cblxuICAgICAqIEBwcm9wZXJ0eSB7YWRkaXRpb25hbExpbmVIZWlnaHR9XG4gICAgICogVGhlIGhlaWdodCB0aGF0IGVhY2ggbGluZSBvZiB0ZXh0IGFmdGVyIHRoZSBmaXJzdCBhZGRzIHRvIHRoZSBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtsaW5lQ291bnR9XG4gICAgICogVGhlIG51bWJlciBvZiBsaW5lcyBvZiB0ZXh0IHRoZSBlbGVtZW50IGNvbnRhaW5zLlxuICAgICAqL1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0SGVpZ2h0LFxuICAgICAgbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lLFxuICAgICAgZmlyc3RMaW5lSGVpZ2h0LFxuICAgICAgYWRkaXRpb25hbExpbmVIZWlnaHQsXG4gICAgICBsaW5lQ291bnQsXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdhdGNoIGZvciBjaGFuZ2VzIHRoYXQgbWF5IGFmZmVjdCBsYXlvdXQuIFJlc3BvbmQgYnkgcmVjbGFtcGluZyBpZlxuICAgKiBuZWNlc3NhcnkuXG4gICAqL1xuICB3YXRjaCgpIHtcbiAgICBpZiAoIXRoaXMuX3dhdGNoaW5nKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgICAvLyBNaW5pbXVtIHJlcXVpcmVkIHRvIGRldGVjdCBjaGFuZ2VzIHRvIHRleHQgbm9kZXMsXG4gICAgICAvLyBhbmQgd2hvbGVzYWxlIHJlcGxhY2VtZW50IHZpYSBpbm5lckhUTUxcbiAgICAgIHRoaXMub2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmVsZW1lbnQsIHtcbiAgICAgICAgY2hhcmFjdGVyRGF0YTogdHJ1ZSxcbiAgICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3dhdGNoaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3Agd2F0Y2hpbmcgZm9yIGxheW91dCBjaGFuZ2VzLlxuICAgKlxuICAgKiBAcmV0dXJucyB7TGluZUNsYW1wfVxuICAgKi9cbiAgdW53YXRjaCgpIHtcbiAgICB0aGlzLm9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLnVwZGF0ZUhhbmRsZXIpO1xuXG4gICAgdGhpcy5fd2F0Y2hpbmcgPSBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ29uZHVjdCBlaXRoZXIgc29mdCBjbGFtcGluZyBvciBoYXJkIGNsYW1waW5nLCBhY2NvcmRpbmcgdG8gdGhlIHZhbHVlIG9mXG4gICAqIHByb3BlcnR5IHtAc2VlIExpbmVDbGFtcC51c2VTb2Z0Q2xhbXB9LlxuICAgKi9cbiAgYXBwbHkoKSB7XG4gICAgaWYgKHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQpIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzbHlXYXRjaGluZyA9IHRoaXMuX3dhdGNoaW5nO1xuXG4gICAgICAvLyBJZ25vcmUgaW50ZXJuYWxseSBzdGFydGVkIG11dGF0aW9ucywgbGVzdCB3ZSByZWN1cnNlIGludG8gb2JsaXZpb25cbiAgICAgIHRoaXMudW53YXRjaCgpO1xuXG4gICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSB0aGlzLm9yaWdpbmFsV29yZHMuam9pbihcIlwiKTtcblxuICAgICAgaWYgKHRoaXMudXNlU29mdENsYW1wKSB7XG4gICAgICAgIHRoaXMuc29mdENsYW1wKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhhcmRDbGFtcCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXN1bWUgb2JzZXJ2YXRpb24gaWYgcHJldmlvdXNseSB3YXRjaGluZ1xuICAgICAgaWYgKHByZXZpb3VzbHlXYXRjaGluZykge1xuICAgICAgICB0aGlzLndhdGNoKGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFRyaW1zIHRleHQgdW50aWwgaXQgZml0cyB3aXRoaW4gY29uc3RyYWludHNcbiAgICogKG1heGltdW0gaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcykuXG4gICAqXG4gICAqIEBzZWUge0xpbmVDbGFtcC5tYXhMaW5lc31cbiAgICogQHNlZSB7TGluZUNsYW1wLm1heEhlaWdodH1cbiAgICovXG4gIGhhcmRDbGFtcChza2lwQ2hlY2sgPSB0cnVlKSB7XG4gICAgaWYgKHNraXBDaGVjayB8fCB0aGlzLnNob3VsZENsYW1wKCkpIHtcbiAgICAgIGxldCBjdXJyZW50VGV4dDtcblxuICAgICAgZmluZEJvdW5kYXJ5KFxuICAgICAgICAxLFxuICAgICAgICB0aGlzLm9yaWdpbmFsV29yZHMubGVuZ3RoLFxuICAgICAgICAodmFsKSA9PiB7XG4gICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgdmFsKS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dDtcblxuICAgICAgICAgIHJldHVybiB0aGlzLnNob3VsZENsYW1wKClcbiAgICAgICAgfSxcbiAgICAgICAgKHZhbCwgbWluLCBtYXgpID0+IHtcbiAgICAgICAgICAvLyBBZGQgb25lIG1vcmUgd29yZCBpZiBub3Qgb24gbWF4XG4gICAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSB0aGlzLm9yaWdpbmFsV29yZHMuc2xpY2UoMCwgbWF4KS5qb2luKFwiIFwiKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGVuIHRyaW0gbGV0dGVycyB1bnRpbCBpdCBmaXRzXG4gICAgICAgICAgZG8ge1xuICAgICAgICAgICAgY3VycmVudFRleHQgPSBjdXJyZW50VGV4dC5zbGljZSgwLCAtMSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBjdXJyZW50VGV4dCArIHRoaXMuZWxsaXBzaXM7XG4gICAgICAgICAgfSB3aGlsZSAodGhpcy5zaG91bGRDbGFtcCgpKVxuXG4gICAgICAgICAgLy8gQnJvYWRjYXN0IG1vcmUgc3BlY2lmaWMgaGFyZENsYW1wIGV2ZW50IGZpcnN0XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5oYXJkY2xhbXBcIik7XG4gICAgICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZHVjZXMgZm9udCBzaXplIHVudGlsIHRleHQgZml0cyB3aXRoaW4gdGhlIHNwZWNpZmllZCBoZWlnaHQgb3IgbnVtYmVyIG9mXG4gICAqIGxpbmVzLiBSZXNvcnRzIHRvIHVzaW5nIHtAc2VlIGhhcmRDbGFtcCgpfSBpZiB0ZXh0IHN0aWxsIGV4Y2VlZHMgY2xhbXBcbiAgICogcGFyYW1ldGVycy5cbiAgICovXG4gIHNvZnRDbGFtcCgpIHtcbiAgICBjb25zdCBzdHlsZSA9IHRoaXMuZWxlbWVudC5zdHlsZTtcbiAgICBjb25zdCBzdGFydFNpemUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmZvbnRTaXplO1xuICAgIHN0eWxlLmZvbnRTaXplID0gXCJcIjtcblxuICAgIGxldCBkb25lID0gZmFsc2U7XG4gICAgbGV0IHNob3VsZENsYW1wO1xuXG4gICAgZmluZEJvdW5kYXJ5KFxuICAgICAgdGhpcy5taW5Gb250U2l6ZSxcbiAgICAgIHRoaXMubWF4Rm9udFNpemUsXG4gICAgICAodmFsKSA9PiB7XG4gICAgICAgIHN0eWxlLmZvbnRTaXplID0gdmFsICsgXCJweFwiO1xuICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgcmV0dXJuIHNob3VsZENsYW1wXG4gICAgICB9LFxuICAgICAgKHZhbCwgbWluKSA9PiB7XG4gICAgICAgIGlmICh2YWwgPiBtaW4pIHtcbiAgICAgICAgICBzdHlsZS5mb250U2l6ZSA9IG1pbiArIFwicHhcIjtcbiAgICAgICAgICBzaG91bGRDbGFtcCA9IHRoaXMuc2hvdWxkQ2xhbXAoKTtcbiAgICAgICAgfVxuICAgICAgICBkb25lID0gIXNob3VsZENsYW1wO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBjaGFuZ2VkID0gc3R5bGUuZm9udFNpemUgIT09IHN0YXJ0U2l6ZTtcblxuICAgIC8vIEVtaXQgc3BlY2lmaWMgc29mdENsYW1wIGV2ZW50IGZpcnN0XG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuc29mdGNsYW1wXCIpO1xuICAgIH1cblxuICAgIC8vIERvbid0IGVtaXQgYGxpbmVjbGFtcC5jbGFtcGAgZXZlbnQgdHdpY2UuXG4gICAgaWYgKCFkb25lICYmIHRoaXMuaGFyZENsYW1wQXNGYWxsYmFjaykge1xuICAgICAgdGhpcy5oYXJkQ2xhbXAoZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoY2hhbmdlZCkge1xuICAgICAgLy8gaGFyZENsYW1wIGVtaXRzIGBsaW5lY2xhbXAuY2xhbXBgIHRvby4gT25seSBlbWl0IGZyb20gaGVyZSBpZiB3ZSdyZVxuICAgICAgLy8gbm90IGFsc28gaGFyZCBjbGFtcGluZy5cbiAgICAgIGVtaXQodGhpcywgXCJsaW5lY2xhbXAuY2xhbXBcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICogV2hldGhlciBoZWlnaHQgb2YgdGV4dCBvciBudW1iZXIgb2YgbGluZXMgZXhjZWVkIGNvbnN0cmFpbnRzLlxuICAgKlxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhIZWlnaHRcbiAgICogQHNlZSBMaW5lQ2xhbXAubWF4TGluZXNcbiAgICovXG4gIHNob3VsZENsYW1wKCkge1xuICAgIGNvbnN0IHsgbGluZUNvdW50LCB0ZXh0SGVpZ2h0IH0gPSB0aGlzLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCk7XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heEhlaWdodCAmJiB1bmRlZmluZWQgIT09IHRoaXMubWF4TGluZXMpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHQgfHwgbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0KSB7XG4gICAgICByZXR1cm4gdGV4dEhlaWdodCA+IHRoaXMubWF4SGVpZ2h0XG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIGxpbmVDb3VudCA+IHRoaXMubWF4TGluZXNcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIm1heExpbmVzIG9yIG1heEhlaWdodCBtdXN0IGJlIHNldCBiZWZvcmUgY2FsbGluZyBzaG91bGRDbGFtcCgpLlwiXG4gICAgKVxuICB9XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYSBiaW5hcnkgc2VhcmNoIGZvciB0aGUgbWF4aW11bSB3aG9sZSBudW1iZXIgaW4gYSBjb250aWdvdXMgcmFuZ2VcbiAqIHdoZXJlIGEgZ2l2ZW4gdGVzdCBjYWxsYmFjayB3aWxsIGdvIGZyb20gcmV0dXJuaW5nIHRydWUgdG8gcmV0dXJuaW5nIGZhbHNlLlxuICpcbiAqIFNpbmNlIHRoaXMgdXNlcyBhIGJpbmFyeS1zZWFyY2ggYWxnb3JpdGhtIHRoaXMgaXMgYW4gTyhsb2cgbikgZnVuY3Rpb24sXG4gKiB3aGVyZSBuID0gbWF4IC0gbWluLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtaW5cbiAqIFRoZSBsb3dlciBib3VuZGFyeSBvZiB0aGUgcmFuZ2UuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1heFxuICogVGhlIHVwcGVyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0gdGVzdFxuICogQSBjYWxsYmFjayB0aGF0IHJlY2VpdmVzIHRoZSBjdXJyZW50IHZhbHVlIGluIHRoZSByYW5nZSBhbmQgcmV0dXJucyBhIHRydXRoeSBvciBmYWxzeSB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0gZG9uZVxuICogQSBmdW5jdGlvbiB0byBwZXJmb3JtIHdoZW4gY29tcGxldGUuIFJlY2VpdmVzIHRoZSBmb2xsb3dpbmcgcGFyYW1ldGVyc1xuICogLSBjdXJzb3JcbiAqIC0gbWF4UGFzc2luZ1ZhbHVlXG4gKiAtIG1pbkZhaWxpbmdWYWx1ZVxuICovXG5mdW5jdGlvbiBmaW5kQm91bmRhcnkobWluLCBtYXgsIHRlc3QsIGRvbmUpIHtcbiAgbGV0IGN1cnNvciA9IG1heDtcbiAgLy8gc3RhcnQgaGFsZndheSB0aHJvdWdoIHRoZSByYW5nZVxuICB3aGlsZSAobWF4ID4gbWluKSB7XG4gICAgaWYgKHRlc3QoY3Vyc29yKSkge1xuICAgICAgbWF4ID0gY3Vyc29yO1xuICAgIH0gZWxzZSB7XG4gICAgICBtaW4gPSBjdXJzb3I7XG4gICAgfVxuXG4gICAgaWYgKG1heCAtIG1pbiA9PT0gMSkge1xuICAgICAgZG9uZShjdXJzb3IsIG1pbiwgbWF4KTtcbiAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgY3Vyc29yID0gTWF0aC5yb3VuZCgobWluICsgbWF4KSAvIDIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXQoaW5zdGFuY2UsIHR5cGUpIHtcbiAgaW5zdGFuY2UuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCh0eXBlKSk7XG59XG5cbmV4cG9ydCB7IExpbmVDbGFtcCBhcyBkZWZhdWx0IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcImJlZ2luXCI6e1widGV4dFwiOlwiW2RlbGF5IDUwMF1Db25uZWN0aW5nW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1cXG5bc291bmQgYWxhcm0ud2F2XTxlbT5CZWVwPC9lbT4gW2RlbGF5IDEwMDBdPGVtPkJlZXA8L2VtPiBbZGVsYXkgMTAwMF08ZW0+QmVlcDwvZW0+W2RlbGF5IDEwMDBdXFxuW3NvdW5kIGNsaWNrLndhdl1Zb3Ugd2FrZSB1cCBzbG93bHkgdG8gdGhlIHNvdW5kIG9mIHlvdXIgYWxhcm0uXFxuSXQgZHJvbmVzIG9uIGFuZCBvbiB1bnRpbCB5b3Ugd2FrZSB1cCBlbm91Z2ggdG8gdHVybiBpdCBvZmYuXFxuV2hhdCBkbyB5b3UgZG8/XCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcIm5ld3NwYXBlclwiLFwidGV4dFwiOlwiQ2hlY2sgdGhlIG5ld3NcIixcIm5leHRcIjpcImNoZWNrTmV3c1wifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkdldCBvdXQgb2YgYmVkXCIsXCJuZXh0XCI6XCJnZXRVcFwifV19LFwiY2hlY2tOZXdzXCI6e1widGV4dFwiOlwiWW91IGdyYWIgeW91ciBBdWdtZW50ZWQgUmVhbGl0eSBnbGFzc2VzIGZyb20geW91ciBuaWdodHN0YW5kIGFuZCBwdXQgdGhlbSBvbi5cXG5BcyB5b3Ugc2Nyb2xsIHNvbWV3aGF0IGFic2VudG1pbmRlZGx5IHRocm91Z2ggdGhlIG5ld3MsIG9uZSBzdG9yeSBjYXRjaGVzIHlvdXIgZXllLlxcbkFuIGltYWdlIG9mIGEgZmxvb2RlZCB0b3duIG9mZiBvZiB0aGUgTWlzc2lzaXBwaSBSaXZlci5cXG5NdXJreSBicm93biB3YXRlciBldmVyeXdoZXJlLCBwYXN0IHdhaXN0IGhlaWdodC5cXG5DYXJzLCBidWlsZGluZ3MsIGFuZCB0cmVlcyBiYXJlbHkgYWJvdmUgdGhlIHN1cmZhY2UuXFxuW2ltYWdlIGh0dHBzOi8vaW1hZ2VzLmZveHR2LmNvbS9zdGF0aWMuZm94N2F1c3Rpbi5jb20vd3d3LmZveDdhdXN0aW4uY29tL2NvbnRlbnQvdXBsb2Fkcy8yMDIwLzAyLzkzMi81MjQvRmxvb2RpbmctaW4tTUlzc2lzc2lwcGktLmpwZz92ZT0xJnRsPTFdXFxuTmF0dXJlIGlzIGEgY3J1ZWwgbWlzdHJlc3MsIHlvdSB0aGluay5cXG5CdXQgdGhlbiBhZ2Fpbiwgd2UndmUgYWx3YXlzIGhhZCB0byBkZWFsIHdpdGggbmF0dXJhbCBkaXNhc3RlcnMsIHJpZ2h0P1xcbldlbGwsIHRoYXRzIGVub3VnaCBvZiB0aGUgbmV3cyBmb3IgdG9kYXkuIFRoYXQgc3R1ZmYgaXMgYWx3YXlzIGp1c3QgZGVwcmVzc2luZy5cIixcImxvb3BcIjpcImJlZ2luXCJ9LFwiZ2V0VXBcIjp7XCJ0ZXh0XCI6XCJZb3UgZ2V0IHVwIGFuZCBnZXQgcmVhZHkgZm9yIHRoZSBkYXkuXFxuV2hlbiB5b3UgY29tZSBiYWNrIG91dCBvZiB0aGUgYmF0aHJvb20sIHlvdSBub3RpY2UgdHdvIHRoaW5nczpcXG4xLiBJdCdzIGZyZWV6aW5nIGluIGhlcmVcXG4yLiBZb3VyIHJvb20gaXMgYSBtZXNzXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImZhblwiLFwidGV4dFwiOlwiVHVybiBvZmYgdGhlIEEvQ1wiLFwibmV4dFwiOlwidHVybk9mZlwifSx7XCJpY29uXCI6XCJmb2xkZXJcIixcInRleHRcIjpcIkNoZWNrIG91dCB0aGUgbWVzc1wiLFwibmV4dFwiOlwibWVzc1wiLFwicmV0dXJuXCI6XCJjb250aW51ZVwifSx7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkxlYXZlXCIsXCJuZXh0XCI6XCJsZWF2ZVwifV19LFwidHVybk9mZlwiOntcInRleHRcIjpcIkFzIHlvdSBnbyBvdmVyIHRvIHR1cm4gb2ZmIHRoZSBhaXIgY29uZGl0aW9uaW5nLCB5b3UgdGFrZSBhIGxvb2sgb3V0IHRoZSB3aW5kb3cuIEp1c3QgYXMgeW91IGV4cGVjdGVkLCBpdHMgY2xvdWR5IGFuZCByYWlueS4gVGhlIEEvQyBtdXN0IGhhdmUgYmVlbiBtYWtpbmcgdGhlIHRlbXBlcmF0dXJlIGV2ZW4gY29sZGVyIHRoYW4gaXQgYWxyZWFkeSB3YXMgb3V0c2lkZS5cXG5Zb3UndmUgaGFkIGl0IHR1cm5lZCBhbGwgdGhlIHdheSB1cCBmb3IgdGhlIHBhc3QgZmV3IHdlZWtzIGR1ZSB0byB0aGUgaGVhdHdhdmUuIFlvdSdkIGJlZW4gd29ycmllZCB0aGF0IGl0IHdhc24ndCBnb2luZyB0byBlbmQ6IHlvdSBoYWQgbmV2ZXIgc2VlbiBhIGhlYXR3YXZlIGdvIGZvciB0aGF0IGxvbmcgb3IgdGhhdCBob3QgaW4geW91ciBsaWZlLiBDbGVhcmx5IGl0J3Mgb3ZlciBub3csIHRob3VnaCwgaWYgdGhlIHRlbXBlcmF0dXJlIGlzIGFueXRoaW5nIHRvIGdvIGJ5LlxcbllvdSBhZGp1c3QgdGhlIEEvQydzIHNldHRpbmdzIGluIGl0cyBhcHAgb24geW91ciBBUiBnbGFzc2VzLiBPbiB0byBtb3JlIGltcG9ydGFudCB0aGluZ3MuXCIsXCJsb29wXCI6XCJnZXRVcFwifSxcIm1lc3NcIjp7XCJ0ZXh0XCI6XCJZb3Ugc3BlbmQgc28gbXVjaCB0aW1lIGF0IHdvcmsgbm93YWRheXMgdGhhdCB5b3VyIHJvb20gaXMgcHJldHR5IG1lc3N5LiBJbiB0aGVvcnksIGFsbCBvZiB5b3VyIG1hdGVyaWFscyB3b3VsZCBiZSBjb250YWluZWQgaW4gdGhlIGZvbGRlciBvbiB5b3VyIGRlc2ssIGJ1dCB5b3Ugc3BlbmQgc28gbXVjaCB0aW1lIHJlb3JnYW5pemluZyBhbmQgYWRqdXN0aW5nIHRoYXQgaXQgYWxsIGVuZHMgdXAgc3RyZXduIGFib3V0LiBZb3UnZCBwcm9iYWJseSBiZSBiZXR0ZXIgb2ZmIHVzaW5nIHZpcnR1YWwgZG9jdW1lbnRzLCBidXQgc29tZXRoaW5nIGFib3V0IGZlZWxpbmcgdGhlIHBhcGVycyBpbiB5b3VyIGhhbmQgc3RpbGwgYXBwZWFscyB0byB5b3UgbW9yZSB0aGFuIGp1c3Qgc2VlaW5nIHRoZW0uXFxuWW91IHBpY2sgdXAgd2hhdCBmZXcgcGFwZXJzIHJlbWFpbiB0aGUgZm9sZGVyIGFuZCBmbGljayB0aHJvdWdoIHRoZW0uIFRoZXkncmUgdGhlIHRocmVlIHN0dWRpZXMgeW91J3ZlIGJhc2VkIHlvdXIgcHJlc2VudGF0aW9uIG9uLiBZb3Ugc3RhcmUgYXQgdGhlbSBmb3IgYSBsaXR0bGUsIHBlbnNpdmVseS4gWW91J2QgYWx3YXlzIHdhbnRlZCB0byBiZSB0aGUgb25lIGRvaW5nIHRoZSByZXNlYXJjaC4gVGhhdCdzIHdoeSB5b3UgdG9vayB0aGlzIGpvYjsgcHJlc2VudGluZyByZXNlYXJjaCBzZWVtZWQgbGlrZSBhIGdvb2Qgd2F5IHRvIGdldCBzb21lIGNvbm5lY3Rpb25zLCBub3QgdG8gbWVudGlvbiB5b3UgbmVlZGVkIHRoZSBtb25leS4gQnV0IGF0IHNvbWUgcG9pbnQgeW91IGxvc3QgdHJhY2sgb2YgdGhhdCBnb2FsLCBhbmQgZXZlbiB0aG91Z2ggeW91IGNhbiBwcm9iYWJseSBhZmZvcmQgdG8gZ28gYmFjayB0byBzY2hvb2wgbm93LCBiZWluZyBhIHJlc2VhcmNoZXIgZmVlbHMgbGlrZSBzb21lb25lIGVsc2UncyBkcmVhbS4gVGhlIGtpbmQgb2YgdGhpbmcgYSBraWQgdGVsbHMgdGhlbXNlbGYgYmVmb3JlIHRoZXkndmUgYmVlbiBleHBvc2VkIHRvIHRoZSByZWFsIHdvcmxkLlxcblRoaXMgam9iIGlzIGZpbmUuIEl0IHBheXMgd2VsbC4gPGI+SXQncyBmaW5lPC9iPi5cXG5Bbnl3YXksIHlvdSBoYXZlIHRocmVlIHN0dWRpZXMgaW4gdGhlIGZvbGRlci5cXG5EbyB5b3Ugd2FudCB0byByZXZpZXcgYW55IG9mIHRoZW0gYmVmb3JlIHRoZSBiaWcgaGVhcmluZyBsYXRlcj9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiaW5kdXN0cnlcIixcInRleHRcIjpcIkNDUyBTdHVkeVwiLFwibmV4dFwiOlwiY2NzXCJ9LHtcImljb25cIjpcImZpcmUtZmxhbWUtc2ltcGxlXCIsXCJ0ZXh0XCI6XCJFZmZpY2llbmN5IFN0dWR5XCIsXCJuZXh0XCI6XCJlZmZpY2llbmN5XCJ9LHtcImljb25cIjpcImFycm93cy1yb3RhdGVcIixcInRleHRcIjpcIkxpZmVjeWNsZSBBbmFseXNpc1wiLFwibmV4dFwiOlwibGNhXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiQ29udGludWVcIixcIm5leHRcIjpcImNvbnRpbnVlXCJ9XX0sXCJjY3NcIjp7XCJ0ZXh0XCI6XCJUaGlzIHN0dWR5IGlzIGFib3V0IENDUywgQ2FyYm9uIENhcHR1cmUgYW5kIFN0b3JhZ2UuIEl0J3MgYSB0ZWNobm9sb2d5IHRoYXQgc2lnbmlmaWNhbnRseSByZWR1Y2VzIHRoZSBjYXJib24gZW1pc3Npb25zIG9mIGNvYWwgYW5kIG5hdHVyYWwgZ2FzIHBvd2VyIHBsYW50cywgYnkgdXAgdG8gOTAlLiBTbyBvZiBjb3Vyc2UsIHRoZSBmb3NzaWwgZnVlbHMgY29ycG9yYXRpb24geW91IHdvcmsgZm9yIGlzIHByZXR0eSBpbnRlcmVzdGVkIGluIGl0IGFzIGEgd2F5IHRvIGtlZXAgdGhlaXIgYnVzaW5lc3MuLi4gdXAgdG8gZGF0ZSB3aXRoIHRoZSB0aW1lcy4gVGhpcyBzdHVkeSBpcyBhbiBvdmVydmlldyBvZiBwYXN0IGFuZCBjdXJyZW50IHJlc2VhcmNoIGludG8gQ0NTIHRlY2hub2xvZ2llcywgc29tZSBvZiB3aGljaCBwcm9taXNlIHRvIHJlZHVjZSBlbWlzc2lvbnMgYnkgdXAgdG8gOTUlIG9yIGV2ZW4gbW9yZS4gSXQgYWxzbyBoYXMgc29tZSBsb3cgbGV2ZWwgZXhwbGFuYXRpb25zIG9mIGhvdyB0aGUgdGVjaG5vbG9neSB3b3Jrcywgc3VjaCBhcyBzb21lIGRpYWdyYW1zIG9mIHBvc3NpYmxlIHByb2Nlc3Nlcy5cXG5baW1hZ2UgaHR0cHM6Ly9hcnMuZWxzLWNkbi5jb20vY29udGVudC9pbWFnZS8xLXMyLjAtUzAwNDg5Njk3MjAzNjczNDYtZ3IxLmpwZ11cXG5PZiBjb3Vyc2UsIHRoZSBleHRyYSB3b3JrIG5lZWRlZCB0byBjYXB0dXJlIGFuZCBzdG9yZSB0aGUgY2FyYm9uIGRpb3hpZGUgZG9lcyBtYWtlIHRoZSBjb3N0IG9mIGVsZWN0cmljaXR5IGZvciBDQ1MgcGxhbnRzIGhpZ2hlciwgYW5kIHRoZSB0ZWNobm9sb2d5IGNhbiBuZXZlciByZWR1Y2UgZW1pc3Npb25zIHRvIG5lYXIgemVybyBsaWtlIHJlbmV3YWJsZXMuIFRoZSBzdHVkeSBkb2VzIG5vdGUgdGhhdCwgYnV0IHlvdXIgc3VwZXJ2aXNvciBzYWlkIG5vdCB0byBmb2N1cyBvbiB0aGF0IHBhcnQgc28gbXVjaC4gQWZ0ZXIgYWxsLCBob3cgbXVjaCBoYXJtIGNvdWxkIGp1c3QgYSBsaXR0bGUgbW9yZSBjYXJib24gZGlveGlkZSByZWFsbHkgZG8/XCIsXCJsb29wXCI6XCJtZXNzXCJ9LFwiZWZmaWNpZW5jeVwiOntcInRleHRcIjpcIlRoaXMgc3R1ZHkgaXMgYW4gYW5hbHlzaXMgb2YgdGhlIGNvc3QgZWZmaWNpZW5jeSBvZiB2YXJpb3VzIGZvc3NpbCBmdWVsIGVuZXJneSBzb3VyY2VzIGNvbXBhcmVkIHRvIHJlbmV3YWJsZSBzb3VyY2VzLiBUaGUgc3R1ZHkgZm91bmQgdGhhdCBhbGwgdG9nZXRoZXIsIHJlbmV3YWJsZXMgY29zdCBhYm91dCA2LTggY2VudHMgcGVyIGtpbG93YXR0LWhvdXIgKGtXaCksIHdoaWxlIGZvc3NpbCBmdWVsIHNvdXJjZXMgbGlrZSBjb2FsIGFuZCBuYXR1cmFsIGdhcyBjb3N0IGFib3V0IDQtNSBjZW50cyBwZXIga1doLCBkZXBlbmRpbmcgb24gdGhlIHNvdXJjZS4gWW91ciBzdXBlcnZpc29yIHdhcyB2ZXJ5IGluc2lzdGVudCB5b3UgaGlnaGxpZ2h0IHRoYXQgd2hpbGUgYSAyIG9yIDMgY2VudCBkaWZmZXJlbmNlIG1heSBub3Qgc2VlbSBsaWtlIG11Y2gsIGlmIHlvdSBtdWx0aXBseSBpdCBvdmVyIHRoZSB3aG9sZSBwb3dlciBncmlkLCBpdCBzdGFydHMgdG8gYWRkIHVwLiBBbmQgeW91IHN1cHBvc2UgdGhhdCBtYWtlcyBzZW5zZTsgaWYgdGhlIGdvdmVybm1lbnQgaXMgZ29pbmcgdG8gYmUgc3Vic2lkaXppbmcgZW5lcmd5LCBpdCBtaWdodCBhcyB3ZWxsIGdldCB0aGUgbW9zdCBvdXQgb2YgZWFjaCBkb2xsYXIuXFxuVGhlIHN0dWR5LCBiZWluZyBmdW5kZWQgYnkgdGhlIGNvbXBhbnkgeW91IHdvcmsgZm9yLCBuZWdsZWN0cyB0byBtZW50aW9uIHRoZSBjb3N0IGluY3JlYXNlcyBmcm9tIHRoZSB1c2Ugb2YgQ0NTLCB3aGljaCB5b3UndmUgYmVlbiB0b2xkIHJhaXNlIGl0IHVwIHRvIGFib3V0IHRoZSBzYW1lIGxldmVscyBhcyByZW5ld2FibGVzLCBpZiBub3QgbW9yZS4gQnV0IHlvdSd2ZSBiZWVuIGFzc3VyZWQgdGhhdCB5b3VyIGNvbXBhbnkgaXMgd29ya2luZyBoYXJkIHRvIG1ha2UgQ0NTIGNoZWFwZXIsIGFuZCBvbmNlIHRoZXkgZG8gdGhhdCB0aGV5J2xsIGJlIHN1cmUgdG8gc3dpdGNoIG92ZXIuIFNvIHRoYXQgbWFrZXMgeW91IGZlZWwgYSBsaXR0bGUgYmV0dGVyLi4uIHlvdSB0aGluay4gVW50aWwgdGhlbiB0aG91Z2ggdGhlIGNvbXBhbnkgaXMgc3RpbGwgaW50ZW5kaW5nIHRvIGZvY3VzIG9uIG5vbi1DQ1MgcGxhbnRzLiBZb3Ugd29uJ3QgYmUgbWVudGlvbmluZyB0aGF0IGVpdGhlci5cIixcImxvb3BcIjpcIm1lc3NcIn0sXCJsY2FcIjp7XCJ0ZXh0XCI6XCJUaGlzIHN0dWR5IHlvdSdyZSBub3Qgc3VwcG9zZWQgdG8gaGF2ZS4gWW91ciBzdXBlcnZpc29yIGhhZCBiZWVuIG1ha2luZyBhIGJpZyBmdXNzIGFib3V0IHNvbWUgbmV3IGxpZmVjeWNsZSBhbmFseXNpcyB0aGF0IHdvdWxkIHNob3cgZm9zc2lsIGZ1ZWxzIHdlcmVuJ3QgYXMgYmFkIGFzIGV2ZXJ5b25lIHRob3VnaHQsIGJ1dCBhIGNvdXBsZSBvZiBtb250aHMgbGF0ZXIgdGhleSBoYWQganVzdCBzdG9wcGVkIHRhbGtpbmcgYWJvdXQgaXQuIFNvIHlvdSBkaWQgYSBsaXR0bGUgZGlnZ2luZywgZm91bmQgdGhlIHJlc2VhcmNoZXJzIHdobyBkaWQgdGhlIHN0dWR5LCBhbmQgYXNrZWQgdGhlbSBmb3IgYSBjb3B5Llxcbk9uY2UgdGhleSBzZW50IGl0IHRvIHlvdSwgeW91IHF1aWNrbHkgcmVhbGl6ZWQgd2h5IHlvdSBoYWRuJ3QgaGVhcmQgYW55IG1vcmUgYWJvdXQgaXQuIFJhdGhlciB0aGFuIGZpbmQgZXZpZGVuY2UgdGhhdCBmb3NzaWwgZnVlbHMgd2VyZW4ndCBhcyBkZXN0cnVjdGl2ZSBhcyBwZW9wbGUgdGhvdWdodCwgdGhleSBhY3R1YWxseSBmb3VuZCBldmlkZW5jZSB0aGF0IGNlcnRhaW4gYXNwZWN0cyBvZiB0aGUgcHJvY2VzcyB3ZXJlIG1vcmUgZGVzdHJ1Y3RpdmUgdGhhbiBpbml0aWFsbHkgdGhvdWdodC5cXG5Zb3UncmUgbm90IHN1cmUgd2h5IHlvdSBrZXB0IHRoZSBzdHVkeS4gWW91IGNlcnRhaW5seSBhcmVuJ3QgZ29pbmcgdG8gdXNlIGl0IGF0IHRvZGF5J3MgaGVhcmluZywgdGhhdCB3b3VsZCBiZS4uLiBiYWQgZm9yIHlvdXIgam9iIHNlY3VyaXR5LCB0byBzYXkgdGhlIGxlYXN0LiBCdXQgc29tZXRoaW5nIGFib3V0IGl0IGtlZXBzIG5hZ2dpbmcgYXQgeW91LiBNYXliZSBpdCdzIHRoZSBlbm9ybWl0eSBvZiBpdCBhbGwuIFlvdSBrbm93IGFib3V0IGNsaW1hdGUgY2hhbmdl4oCUaXQncyBoYXJkIHRvIGlnbm9yZSBpdCB3aXRoIGFsbCB0aGUgcHJvdGVzdHMgdGhhdCBoYXZlIGJlZW4gZ29pbmcgb24gcmVjZW50bHnigJRidXQgYXMgZmFyIGFzIHlvdSBjYW4gdGVsbCwgZXZlcnl0aGluZyBzZWVtcyB0byBiZSBmaW5lLiBTdXJlLCB0aGVyZSdzIGJlZW4gYSBsb3Qgb2YgZmxvb2RzIGluIHNvbWUgb3RoZXIgc3RhdGVzIHJlY2VudGx5LCBhbmQgdGhlcmUncyBkZWZpbml0ZWx5IGJlZW4gYSBsb3Qgb2YgaGVhdHdhdmVzIGhlcmUgaW4gVGV4YXMsIGJ1dCBub25lIG9mIGl0IHNlZW1zIHRoYXQgYmFkLiBCdXQgc2VlaW5nIHRoZSBzaGVlciBhbW91bnQgb2YgY2FyYm9uIGJlaW5nIGVtaXR0ZWQsIHRvZ2V0aGVyIHdpdGggcmVmZXJlbmNlcyB0byB0aGUgZGlyZWN0IGFuZCBpbmRpcmVjdCBlZmZlY3RzLCBldmVuIGluIGEgZm9zc2lsIGZ1ZWwgZnVuZGVkIHN0dWR5OyBpdCBtYWtlcyB5b3UgdW5jb21mb3J0YWJsZSwgdG8gc2F5IHRoZSBsZWFzdC5cXG5Zb3UgcHV0IHRoZSBzdHVkeSBiYWNrIGluIHRoZSBmb2xkZXIuIFlvdSBzaG91bGRuJ3QgYmUgZGlzdHJhY3RpbmcgeW91cnNlbGYgd2l0aCB0aGF0IHRvZGF5LiBUaGlzIGlzIHBvc3NpYmx5IHRoZSBiaWdnZXN0IGhlYXJpbmcgb2YgeW91ciBjYXJlZXIuIElmIHlvdSBtZXNzIHRoaXMgdXAsIGl0J2xsIG1lYW4gdGhlIG1ham9yaXR5IG9mIGZvc3NpbCBmdWVsIHN1YnNpZGllcyB3aWxsIGJlIGRpdmVydGVkIHRvIHJlbmV3YWJsZSBlbmVyZ3ksIGFuZCBsZXNzIG1vbmV5IGZvciB5b3VyIGVtcGxveWVyIG1lYW5zIGxlc3MgbW9uZXkgZm9yIHlvdS4gTm8gbWlzdGFrZXMgdG9kYXkuXCIsXCJsb29wXCI6XCJtZXNzXCJ9LFwiY29udGludWVcIjp7XCJ0ZXh0XCI6XCJZb3UgdHVybiB5b3VyIGF0dGVudGlvbiB0byB0aGUgcmVzdCBvZiB0aGUgcm9vbS5cIixcImxvb3BcIjpcImdldFVwXCJ9LFwibGVhdmVcIjp7XCJ0ZXh0XCI6XCJZb3UncmUgYSBiaXQgZWFybHksIGJ1dCB5b3UgZGVjaWRlIHlvdSBtaWdodCBhcyB3ZWxsIGhlYWQgdG8gdGhlIHZpcnR1YWwgY29uZmVyZW5jZSBjZW50ZXIgYWxyZWFkeS4gSXQncyBhIGJpdCBvZiBhIHBhaW4gaGF2aW5nIHRvIGdvIHNvbWV3aGVyZSBqdXN0IHRvIGhhdmUgYSBiZXR0ZXIgdmlkZW8gY2FwdHVyZSwgYnV0IHlvdSB3YW50IHRvIGxvb2sgeW91ciBiZXN0LiBBdCBsZWFzdCBpdHMgYmV0dGVyIHRoYW4gaGF2aW5nIHRvIGZseSB0byBELkMuIHRvIGF0dGVuZCB0aGUgaGVhcmluZzogeW91IGtub3cgc29tZSBwZW9wbGUgYXQgeW91ciBjb21wYW55IHdobyBoYXZlIGJlZW4gbG9iYnlpbmcgYSB3aG9sZSBsb3QgbG9uZ2VyIHRoYW4geW91LCBhbmQgdGhleSB3b24ndCBzdG9wIHRhbGtpbmcgYWJvdXQgaG93IG11Y2ggb2YgYSBwYWluIHRoZSBidXNpbmVzcyB0cmlwcyB1c2VkIHRvIGJlLlxcbk9mIGNvdXJzZSwgeW91IGRvbid0IGhhdmUgYSBjYXI7IGdhcyBpcyBtb3JlIGV4cGVuc2l2ZSB0aGFuIGV2ZXIsIGFuZCBkcml2aW5nIGlzIGJlY29taW5nIGluY3JlYXNpbmdseSB1bmZhc2hpb25hYmxlIG5vd2FkYXlzLiBZb3UgY291bGQgdGFrZSB0aGUgYnVzLCBidXQgeW91J2QgbGlrZSBzb21lIHByaXZhY3kgd2hpbGUgeW91IHByZXBhcmUgeW91cnNlbGYsIHNvIHlvdSBjYWxsIGEgdGF4aSBpbnN0ZWFkLiBTdGlsbCwgeW91J3JlIGZhY2VkIHdpdGggYSBjaG9pY2U6IG5vcm1hbCBjYXIsIG9yIGZseWluZyBjYXI/XCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImNhclwiLFwidGV4dFwiOlwiTm9ybWFsIENhclwiLFwibmV4dFwiOlwibm9ybWFsQ2FyXCJ9LHtcImljb25cIjpcInBsYW5lXCIsXCJ0ZXh0XCI6XCJGbHlpbmcgQ2FyXCIsXCJuZXh0XCI6XCJmbHlpbmdDYXJcIn1dfSxcIm5vcm1hbENhclwiOntcInRleHRcIjpcIkRlc3BpdGUgdGhlIG5vdmVsdHkgb2YgYSBmbHlpbmcgY2FyLCBhIHN0YW5kYXJkIGNhciBpcyBwcm9iYWJseSB0aGUgbW9yZSByZWFzb25hYmxlIG9wdGlvbi4gSXQncyBjZXJ0YWlubHkgdGhlIG1vc3QgZWNvbm9taWNhbCBvcHRpb24sIHRob3VnaCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZW0gaGFzIGJlZW4gZ2V0dGluZyBzdXJwcmlzaW5nbHkgc21hbGwsIGFsbCBjb25zaWRlcmVkLiBUaGUgY2FyIGFycml2ZXMmbWRhc2g7dGhlIGRlY3JlYXNlIG9mIGh1bWFuIGRyaXZlcnMgaGFzIG1hZGUgdHJhZmZpYyBhbG1vc3QgYSB0aGluZyBvZiB0aGUgcGFzdCBhdCB0aGlzIHBvaW50Jm1kYXNoO2FuZCB5b3UgZ2V0IGluLlxcbltiYWNrZ3JvdW5kIHRyYWZmaWMubXAzXUFzIHRoZSBjYXIgZHJpdmVzIG9mZiwgeW91IGxvb2sgb3V0IHRoZSB3aW5kb3cuIFlvdSBzZWUgYSBsb3Qgb2YgYnVzaW5lc3NlcywgYnV0IHdlaXJkbHksIG1vc3Qgb2YgdGhlbSBzZWVtIGVtcHR5LiBUaGVuIHlvdSByZWFsaXplIHdoeS4gT24gbmVhcmx5IGV2ZXJ5IGJ1aWxkaW5nLCB0aGVyZSdzIGFuIEFSIGZseWVyIGF0dGFjaGVkIHRvIGl0LCB3aXRoIHNvbWV0aGluZyBhbG9uZyB0aGUgbGluZXMgb2YgXFxcIm5vdyBoaXJpbmdcXFwiLiBZb3UnZCBzZWVuIGEgcGllY2UgaW4gdGhlIG5ld3MgcmVjZW50bHkgYWJvdXQgaG93IGxvdy13YWdlIHdvcmtlcnMgd2VyZSBnZXR0aW5nIGhpdCBoYXJkIGJ5IGhlYXQgc3RyZXNzIGluIHRoZSByZWNlbnQgc3RyaW5nIG9mIGhlYXR3YXZlcy4gVGhlIGFpciBjb25kaXRpb25lcnMgd2VyZW4ndCB1cCB0byB0aGUgdGFzayBvZiB0aGUgd2Vla3Mgb2YgaGVhdHdhdmUuIEJ1dCB5b3UgaGFkIGFzc3VtZWQgaXQgd2FzIGp1c3QgYSBjb3VwbGUgb2YgcGVvcGxlIHRoYXQgd2VyZSBlZmZlY3RlZC4gVGhpcyBkb2Vzbid0IHJlYWxseSBzZWVtIGxpa2UganVzdCBhIGNvdXBsZSBvZiBwZW9wbGUsIHRob3VnaC5cXG5CdXQgeW91J3JlIHN1cmUgdGhpcyBpcyBqdXN0IGEgdGVtcG9yYXJ5IHRoaW5nLiBJdCdzIGEgb25jZSBpbiBhIGxpZmV0aW1lIGhlYXR3YXZlLCBhZnRlciBhbGwuIFRoZW4gYWdhaW4sIHlvdSdkIHNlZW4gb24gdGhlIHdlYXRoZXIgZm9yZWNhc3QgdGhhdCB0ZW1wZXJhdHVyZXMgd2VyZSBzdXBwb3NlZCB0byBnbyBiYWNrIHVwIHRoZSByZXN0IG9mIHRoaXMgd2VlaywgYW5kIHRoYXQgdG9kYXkgaXMganVzdCBhbiBvdXRsaWVyLiBCdXQuLi4gdGhleSdyZSBwcm9iYWJseSBqdXN0IG1pc3Npbmcgc29tZXRoaW5nLiBZb3UncmUgc3VyZSB0aGluZ3Mgd2lsbCBnbyBiYWNrIHRvIG5vcm1hbCBzb29uLiBQcm9iYWJseS5cXG5Zb3UncmUgc2hha2VuIG91dCBvZiB5b3VyIHRob3VnaHRzIGJ5IHRoZSBjYXIgc2xvd2luZyBkb3duIGFuZCBzdG9wcGluZy4gWW91J3JlIGhlcmUuXFxuVGltZSB0byBnbyBpbnNpZGUgYW5kIGdldCByZWFkeSBmb3IgdGhlIGhlYXJpbmcuXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiRW50ZXJcIixcIm5leHRcIjpcImVudGVyXCJ9XX0sXCJmbHlpbmdDYXJcIjp7XCJ0ZXh0XCI6XCJZb3UgZGVjaWRlIG9uIHRoZSBmbHlpbmcgY2FyLiBZb3UgY2FuIHNwZW5kIGEgbGl0dGxlIGV4dHJhIGp1c3QgZm9yIHRvZGF5OyBpdCBpcyBhbiBpbXBvcnRhbnQgZGF5IGFmdGVyIGFsbC4gUGx1cywgaXQnbGwgZ2V0IHlvdSB0aGVyZSBmYXN0ZXIuIEFuZCB0aGUgdmlld3MgYXJlIG11Y2ggbmljZXIuIFlvdSB3YWl0IGEgbWludXRlLCBhbmQgdGhlbiBoZWFyIHRoZSB3aGlycmluZyBvZiB0aGUgcm90b3JzIG9uIHRoZSBjYXIuIFRvIGJlIGhvbmVzdCB5b3UgaGFkIGFsd2F5cyBpbWFnaW5lZCBmbHlpbmcgY2FycyBhcyBmbG9hdGluZywgb3IgbWF5YmUgd2l0aCB3aW5ncyBsaWtlIGFuIGFpcnBsYW5lLiBCdXQgeW91IHN1cHBvc2UgdGVjaG5vbG9neSBpcyByYXJlbHkgZXhhY3RseSB3aGF0IHdlIGV4cGVjdCBpdCB0byBiZS4gWW91IGdldCBpbiB0aGUgY2FyLCBhbmQgaXQgdGFrZXMgb2ZmLlxcbltiYWNrZ3JvdW5kIGZseWluZy5tcDNdWW91IGxvb2sgb3V0IHRoZSB3aW5kb3cgYXMgdGhlIGdyb3VuZCBkcmlmdHMgZnVydGhlciBmcm9tIHlvdS4gWW91J3JlIG5vdCBzdXJlIHlvdSdsbCBldmVyIGdldCB1c2VkIHRvIHRoYXQuIFN0aWxsLCBpdCdzIGEgbmljZSB2aWV3LiBVbmZvcnR1bmF0ZWx5LCB5b3VyIHZpZXcgaXMgb2NjYXNpb25hbGx5IGJsb2NrZWQgYnkgYW4gYWR2ZXJ0aXNlbWVudC4gSXQncyBub3QgZXhhY3RseSBzdXJwcmlzaW5nIHRoYXQgdGhleSdyZSBhbGwgb3ZlciB0aGUgc2t5OyB3ZSBwdXQgYmlsbGJvYXJkcyBldmVyeXdoZXJlIG9uIGhpZ2h3YXlzLiBCdXQgaXQgd291bGQgaGF2ZSBiZWVuIG5pY2UgdG8gbGVhdmUgdGhpcyBzaWdodCB1bmJsZW1pc2hlZC4gQXQgbGVhc3QgdGhleSdyZSBub3QgcGh5c2ljYWxseSBpbiB0aGUgYWlyLCBvbmx5IHZpc2libGUgaW4geW91ciBBUiBnbGFzc2VzLiBJbiBmYWN0LCB1c3VhbGx5IHlvdSdkIGp1c3QgdGFrZSB0aGVtIG9mZiwgYnV0IHlvdSBoYXZlIHRvIGJlIHdhdGNoaW5nIGZvciBtZXNzYWdlcyBmcm9tIHlvdXIgY29tcGFueSwganVzdCBpbiBjYXNlLiBTbyB5b3UncmUgZ29pbmcgdG8gaGF2ZSB0byBkZWFsIHdpdGggdGhlIG9jY2FzaW9uYWwgYWQgZHJpZnRpbmcgaW50byB2aWV3Llxcbk9uZSBpbiBwYXJ0aWN1bGFyIGNhdGNoZXMgeW91ciBleWUuIEF0IGZpcnN0LCBpdCBqdXN0IGxvb2tlZCBsaWtlIGEgY2xvdWQgb2Ygc21va2UsIGJ1dCB0aGVuIHlvdSBzZWUgaXQgcmVmb3JtIGluIHRoZSBsZXR0ZXJzIFxcXCJERUNBUkJPTklaRVxcXCIuIFdlbGwsIGl0J3MgYW4gaW1wcmVzc2l2ZSByZW5kZXJpbmcsIHlvdSdsbCBnaXZlIHRoZW0gdGhhdC4gVGhlIHNtb2tlIHRoZW4gY29udGludWVzIHRvIHJlZm9ybSBpbnRvIGRpZmZlcmVudCB3b3JkcyBhbmQgc2VudGVuY2VzLlxcblxcXCJEbyB5b3UgcmVhbGx5IHdhbnQgdGhpcyBpbiB5b3VyIGFpcj9cXFwiW2RlbGF5IDEwMDBdXFxuXFxcIldlJ3JlIGF0IGEgdGlwcGluZyBwb2ludFxcXCJbZGVsYXkgMTAwMF1cXG5cXFwiVGhlcmUgaXMgbm8gRWFydGggMlxcXCJbZGVsYXkgMTAwMF1cXG5cXFwiVGhlcmUncyBzdGlsbCB0aW1lIHRvIGZpeCB0aGlzXFxcIltkZWxheSAxMDAwXVxcblxcXCJaZXJvIGNhcmJvbiBieSAyMTAwXFxcIltkZWxheSAxMDAwXVxcbkl0IHRoZW4gbGlua3MgdG8gYSB3ZWJzaXRlLCB3aGljaCB5b3UgcXVpY2tseSB3YXZlIGF3YXkuIFlvdSBzY29mZi4gWmVybyBjYXJib24/IFRoZXJlJ3Mgbm8gd2F5IHdlIGNvdWxkIGRvIHRoYXQsIHJpZ2h0PyBBbmQgZXZlbiBpZiB3ZSBjb3VsZCwgY2FyYm9uIGRpb3hpZGUgaXNuJ3QgPGVtPnRoYXQ8L2VtPiBiYWQuIFJpZ2h0PyBUaGUgbGlmZWN5Y2xlIGFuYWx5c2lzIGluIHlvdXIgZm9sZGVyIG5hZ3MgYXQgeW91Li4uIGJ1dCB5b3UgcHVzaCB0aGUgdGhvdWdodCBhd2F5LiBGb2N1cy4gWW91ciBzdXBlcnZpc29yIHRvbGQgeW91IG5vdCB0byB3b3JyeSBhYm91dCB0aGUgZW52aXJvbm1lbnRhbCBpbXBhY3RzIHNvIG11Y2guIFNvIGl0J3MgcHJvYmFibHkgZmluZS5cXG5Zb3UncmUgc2hha2VuIG91dCBvZiB5b3VyIHRob3VnaHRzIGJ5IHRoZSBjYXIgbGFuZGluZy4gWW91J3JlIGhlcmUuXFxuVGltZSB0byBnbyBpbnNpZGUgYW5kIGdldCByZWFkeSBmb3IgdGhlIGhlYXJpbmcuXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiRW50ZXJcIixcIm5leHRcIjpcImVudGVyXCJ9XX0sXCJlbnRlclwiOntcInRleHRcIjpcIllvdSBlbnRlciB0aGUgYnVpbGRpbmcuIFRoZXJlJ3MgYSBzbWFsbCByZWNlcHRpb24gYXJlYSwgd2hlcmUgeW91IHB1dCB5b3VyIG5hbWUgaW4gYW5kIGFzayBpZiB5b3VyIHJvb20gaXMgcmVhZHkuIEJ1dCBhcHBhcmVudGx5IGl0J3Mgc3RpbGwgYmVpbmcgdXNlZCBmb3IgYSBmZXcgbW9yZSBtaW51dGVzLCBzbyB5b3Ugc2l0IGRvd24uIEFuZCB0aGVuIHlvdSBzZWUgdGhlbS4gQSBmYWNlIHlvdSByZWNvZ25pemUuLi4gdW5mb3J0dW5hdGVseS4gVGhleSdyZSBhIGxvYmJ5aXN0IHRvbywgYnV0IGZvciBhIGNsaW1hdGUgY2hhbmdlIGFjdGl2aXNtIGdyb3VwLCBhbmQgdGhleSdyZSBnb2luZyB0byB0aGUgc2FtZSBoZWFyaW5nIGFzIHlvdS4gU21hbGwgd29ybGQuXFxuVGhlcmUncyBvbmx5IGEgY291cGxlIG9mIGNoYWlycyBpbiB0aGUgd2FpdGluZyByb29tLCBzbyB5b3Ugc2l0IGRvd24gY2xvc2VyIHRoYW4geW91J2QgbGlrZSB0byB0aGVtLiBUaGV5IGtlZXAgc3RlYWxpbmcgZ2xhbmNlcyBhdCB5b3UsIGFuZCB5b3UncmUgcHJldHR5IHN1cmUgdGhleSBrbm93IHdobyB5b3UgYXJlIHRvby4gRG8geW91IHdhbnQgdG8gdGFsayB0byB0aGVtPyBPciBqdXN0IGtlZXAgc2l0dGluZyBmb3IgYSBmZXcgbWludXRlcz9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiY29tbWVudFwiLFwidGV4dFwiOlwiVGFsayB0byB0aGVtXCIsXCJuZXh0XCI6XCJ0YWxrXCJ9LHtcImljb25cIjpcImNoYWlyXCIsXCJ0ZXh0XCI6XCJTaXQgYXdrd2FyZGx5XCIsXCJuZXh0XCI6XCJzaXRcIn1dfSxcInNpdFwiOntcInRleHRcIjpcIllvdSBrZWVwIHNpdHRpbmcuIFlvdSB3b3VsZG4ndCB3YW50IHRvIHRhbGsgdG8gdGhlbSBhbnl3YXkuIFlvdSdyZSBzdXJlIHRoZXknZCBiZSBzdXBlciBib3JpbmcuXFxuW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtub3JtYWwgLl1bZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVtub3JtYWwgLl1cXG5bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVxcbkZpbmFsbHksIHlvdXIgcm9vbSBpcyByZWFkeS4gVGltZSBmb3IgdGhlIGhlYXJpbmcuIFlvdSB0YWtlIGEgZGVlcCBicmVhdGgsIGFuZCBnZXQgdXAuXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiQXR0ZW5kIHRoZSBoZWFyaW5nXCIsXCJuZXh0XCI6XCJhdHRlbmRcIn1dfSxcInRhbGtcIjp7XCJ0ZXh0XCI6XCJZb3UgZGVjaWRlIHlvdSBtaWdodCBhcyB3ZWxsIGZpbGwgdGhlIHRpbWUgd2l0aCBhIGxpdHRsZSBjb252ZXJzYXRpb24uIEF0IHdvcnN0LCBtYXliZSB5b3UnbGwga25vdyBhIGJpdCBtb3JlIGFib3V0IGhvdyB0aGV5J3JlIGdvaW5nIHRvIHJlc3BvbmQgdG8geW91LlxcblxcXCJTby4uLiBob3cgYWJvdXQgdGhhdCB3ZWF0aGVyIHRvZGF5PyBDcmF6eSBob3cgaXQgY2hhbmdlZCBzbyBmYXN0LlxcXCIgeW91IHNheS5bZGVsYXkgMTAwMF1cXG5UaGV5IGxvb2sgYXQgeW91IGZvciBhIHNlY29uZCwgdGhlbiBzaGFrZSB0aGVpciBoZWFkLiBcXFwiQXMgaWYgeW91IGNhcmUuIFlvdSdyZSBwcm9iYWJseSBnb2luZyB0byB1c2UgaXQgYXMgYW4gZXhjdXNlIHRvIHByZXRlbmQgY2xpbWF0ZSBjaGFuZ2UgaXNuJ3QgaGFwcGVuaW5nLiBJIGtub3cgeW91ciB0eXBlLiBZb3UncmUganVzdCBpbiB0aGlzIGZvciB0aGUgbW9uZXkuXFxcIltkZWxheSAxMDAwXVxcbllvdSB3ZXJlbid0IGV4cGVjdGluZyB0aGF0LiBcXFwiSGV5LCBJJ20ganVzdCB0cnlpbmcgdG8gbWFrZSBjb252ZXJzYXRpb24mbWRhc2g7XFxcIltkZWxheSAxMDAwXVxcblxcXCJTdXJlLCBhbmQgSSdtIGp1c3QgdHJ5aW5nIHRvIHByZXZlbnQgdGhlIHdvcmxkIGZyb20gYnVybmluZy4gSSBtZWFuLCB5b3UndmUgc2VlbiB0aGUgaGVhdHdhdmUgdGhlc2UgcGFzdCBmZXcgd2Vla3MuIFlvdSByZWFsbHkgdGhpbmsgZXZlcnl0aGluZyBpcyBvaz9cXFwiW2RlbGF5IDEwMDBdXFxuVGhpcyBjb252ZXJzYXRpb24gaXMuLi4gbm90IGdvaW5nIGhvdyB5b3UgZXhwZWN0ZWQuIFxcXCJZZWFoIHRoZSBoZWF0d2F2ZSBpcy4uLltkZWxheSA1MDBdIHdlaXJkLiBCdXQgbXkgY29tcGFueSBpcyBsb29raW5nIGludG8gd2F5cyB0byByZWR1Y2UgaXRzIGNhcmJvbiBlbWlzc2lvbnMsIG9yIGFkZCBtb3JlIGNhcmJvbiBvZmZzZXRzLiBJdCdzIGdvaW5nIHRvIGJlIDxlbT5maW5lPC9lbT4uXFxcIltkZWxheSAxMDAwXVxcblRoZXkganVzdCBzaGFrZSB0aGVpciBoZWFkIGFnYWluLiBcXFwiTG9vaywgeW91IGRvbid0IHNlZW0gZXZpbCBvciBhbnl0aGluZy4gSXQganVzdCBzb3VuZHMgbGlrZSB5b3UncmUgaW4gZGVuaWFsLiBNYXliZSB5b3Uga25vdyBpdCB0b28uIEJ1dCBpZiB5b3UgY2FyZWQsIHlvdSB3b3VsZCBiZSB3b3JraW5nIHdpdGggbWUsIG5vdCB3aXRoIHRoZSBmb3NzaWwgZnVlbHMgaW5kdXN0cnkuIE9yIGF0IGxlYXN0IG5vdCBhY3RpdmVseSBkZWZlbmRpbmcgdGhlbS4gU28gd2UgaGF2ZSBub3RoaW5nIHRvIHRhbGsgYWJvdXQuXFxcIltkZWxheSAxMDAwXVxcbllvdSBzdGFydCB0byByZXNwb25kLCBidXQgdGhlIHJlY2VwdGlvbmlzdCBsZXRzIHlvdSBrbm93IHRoYXQgeW91ciByb29tIGlzIHJlYWR5LiBcXG5Zb3UgdGFrZSBhIGRlZXAgYnJlYXRoLCBhbmQgZ2V0IHVwLiBJdCdzIHRpbWUgZm9yIHRoZSBoZWFyaW5nLlwiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkF0dGVuZCB0aGUgaGVhcmluZ1wiLFwibmV4dFwiOlwiYXR0ZW5kXCJ9XX19IiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXVkaW9NYW5hZ2VyIHtcbiAgICBlbGVtZW50ID0gbmV3IEF1ZGlvKCk7XG4gICAgXG4gICAgcGxheShuYW1lOiBTdHJpbmcsIHZvbHVtZTogbnVtYmVyID0gMSkge1xuICAgICAgICB0aGlzLmVsZW1lbnQuc3JjID0gYGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9rZmlzaDYxMC90ZXh0LWFkdmVudHVyZS9tYWluL2Fzc2V0cy8ke25hbWV9YDtcbiAgICAgICAgdGhpcy5lbGVtZW50LnZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5lbGVtZW50LnBsYXkoKTtcbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGF1c2UoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5lbGVtZW50LnBhdXNlKCk7XG4gICAgfVxuXG4gICAgcmVzdW1lKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGxheSgpO1xuICAgIH1cblxuICAgIGxvb3Aoc2hvdWxkTG9vcDogYm9vbGVhbikge1xuICAgICAgICB0aGlzLmVsZW1lbnQubG9vcCA9IHNob3VsZExvb3A7XG4gICAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1YmJsZXMge1xuICAgIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuICAgIGJ1YmJsZXM6IEFycmF5PEJ1YmJsZT4gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5jdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcbiAgICAgICAgdGhpcy5yZXNpemUoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYnViYmxlcy5wdXNoKG5ldyBCdWJibGUoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLmN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy5jdHguY2FudmFzLndpZHRoLCB0aGlzLmN0eC5jYW52YXMuaGVpZ2h0KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYnViYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zcGVlZCA+IDAgJiYgdGhpcy5idWJibGVzW2ldLmxpZmV0aW1lIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0uc3BlZWQgKj0gLTE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS51cGRhdGUoZHQpO1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zaXplIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0gPSBuZXcgQnViYmxlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5kcmF3KHRoaXMuY3R4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdmFyIGRwciA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIHx8IDE7XG4gICAgICAgIHZhciByZWN0ID0gdGhpcy5jdHguY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy53aWR0aCA9IHJlY3Qud2lkdGggKiBkcHI7XG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodCAqIGRwcjtcblxuICAgICAgICAvLyB0aGlzLmN0eC5zY2FsZShkcHIsIGRwcik7XG5cbiAgICAgICAgdGhpcy5jdHguZmlsdGVyID0gXCJibHVyKDUwcHgpXCI7XG4gICAgfVxufVxuXG5jbGFzcyBCdWJibGUge1xuICAgIHNwZWVkOiBudW1iZXI7XG4gICAgeDogbnVtYmVyO1xuICAgIHk6IG51bWJlcjtcbiAgICBzaXplOiBudW1iZXI7XG4gICAgY29sb3I6IHN0cmluZztcbiAgICBsaWZldGltZTogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuc3BlZWQgPSAwLjAyO1xuXG4gICAgICAgIHRoaXMueCA9IE1hdGgucmFuZG9tKCkgKiB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lckhlaWdodDtcblxuICAgICAgICB0aGlzLnNpemUgPSAxMDtcblxuICAgICAgICBsZXQgdiA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGxldCBodWUgPSB2IDwgMC41ID8gMTUwIDogMjMwO1xuICAgICAgICBsZXQgc2F0ID0gdiA8IDAuNSA/IDUwIDogODU7XG4gICAgICAgIGxldCBsaWdodCA9IHYgPCAwLjUgPyAyNSA6IDQwO1xuICAgICAgICB0aGlzLmNvbG9yID0gXCJoc2xhKFwiICsgaHVlICsgXCIsIFwiICsgc2F0ICsgXCIlLCBcIiArIGxpZ2h0ICsgXCIlLCAyMCUpXCI7XG5cbiAgICAgICAgdGhpcy5saWZldGltZSA9IE1hdGgucmFuZG9tKCkgKiogNSAqIDE2MDAwICsgMjAwMDtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLnNpemUgKz0gdGhpcy5zcGVlZCAqIGR0O1xuICAgICAgICB0aGlzLmxpZmV0aW1lIC09IGR0O1xuICAgIH1cblxuICAgIGRyYXcoY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQpIHtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuY29sb3I7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4LmFyYyh0aGlzLngsIHRoaXMueSwgdGhpcy5zaXplLCAwLCBNYXRoLlBJICogMik7XG4gICAgICAgIGN0eC5maWxsKCk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RvcnksIE9wdGlvbiB9IGZyb20gJy4vc3RvcnknO1xuXG5sZXQgc3Rvcnk6IFN0b3J5ID0gcmVxdWlyZShcIi4vc3RvcnkuY3NvblwiKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnV0dG9ucyB7XG4gICAgZWxlbTogSFRNTEVsZW1lbnQ7XG4gICAgc2VsZWN0ZWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIHRleHQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGVuYWJsZWQgPSBmYWxzZTtcbiAgICBidXR0b25zOiBIVE1MQnV0dG9uRWxlbWVudFtdID0gW107XG4gICAgZmlyc3RFeGl0ID0gdHJ1ZTtcblxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuZWxlbSA9IGVsZW07XG4gICAgfVxuXG4gICAgZW5hYmxlKHNjZW5lOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIGxldCBvcHRpb25zOiBPcHRpb25bXTtcbiAgICAgICAgaWYgKHN0b3J5W3NjZW5lXS5vcHRpb25zID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHN0b3J5W3N0b3J5W3NjZW5lXS5sb29wIV0ub3B0aW9ucyE7XG4gICAgICAgICAgICBsZXQgbG9vcGVkT3B0ID0gb3B0aW9ucy5maW5kSW5kZXgobyA9PiBvLnJldHVybiAhPSB1bmRlZmluZWQgPyBvLnJldHVybiA9PSBzY2VuZSA6IG8ubmV4dCA9PSBzY2VuZSk7XG4gICAgICAgICAgICBvcHRpb25zLnNwbGljZShsb29wZWRPcHQsIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHN0b3J5W3NjZW5lXS5vcHRpb25zITtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdGVwID0gb3B0aW9ucy5sZW5ndGggPT0gNCA/IDYgOiAxMi9vcHRpb25zLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb24gPSBvcHRpb25zW2ldO1xuICAgICAgICAgICAgbGV0IGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gICAgICAgICAgICBidXR0b24uY2xhc3NOYW1lID0gXCJvdmVybGF5XCI7XG4gICAgICAgICAgICBidXR0b24uaW5uZXJIVE1MID0gIFwiPiA8aSBjbGFzcz1cXFwiZmEtc29saWQgZmEtXCIrIG9wdGlvbi5pY29uICtcIlxcXCI+PC9pPiBcIiArIG9wdGlvbi50ZXh0O1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IFwiNCAvIDEwXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMubGVuZ3RoID09IDQpIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IGkgPCAyID8gKGkqc3RlcCArIDEpLnRvU3RyaW5nKCkgKyBcIiAvIFwiICsgKChpKzEpKnN0ZXAgKyAxKS50b1N0cmluZygpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogKChpLTIpKnN0ZXAgKyAxKS50b1N0cmluZygpICsgXCIgLyBcIiArICgoaS0xKSpzdGVwICsgMSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLnN0eWxlLmdyaWRDb2x1bW4gPSAoaSpzdGVwICsgMSkudG9TdHJpbmcoKSArIFwiIC8gXCIgKyAoKGkrMSkqc3RlcCArIDEpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBidXR0b24ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5maXJzdEV4aXQgJiYgb3B0aW9uLmljb24gPT0gXCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcnN0RXhpdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5vbnZpc2liaWxpdHljaGFuZ2UhKG5ldyBFdmVudChcInZpc2liaWxpdHljaGFuZ2VcIikpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbmZpcm0oXCJPcHRpb25zIHdpdGggdGhpcyBpY29uICh0aGUgZXhpdGluZyBhcnJvdykgbGVhdmUgYSBzY2VuZSBwZXJtYW5lbnRseS4gXFxcblRoaXMgbWVhbnMgdGhhdCBpZiB0aGVyZSdzIGFueSBvdGhlciBvcHRpb25zIHlvdSBoYXZlbid0IHRyaWVkIHlldCwgXFxcbmFmdGVyIGNsaWNraW5nIHRoaXMgb3B0aW9uIHlvdSB3b24ndCBiZSBhYmxlIHRvIHJlYWQgdGhlbSB3aXRob3V0IHJlc3RhcnRpbmcgdGhlIGdhbWUuIFxcXG5BcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gY29udGludWU/XCIpKSByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBvcHRpb24ubmV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHQgPSBcIjxpIGNsYXNzPVxcXCJmYS1zb2xpZCBmYS1cIisgb3B0aW9uLmljb24gK1wiXFxcIj48L2k+IFwiICsgb3B0aW9uLnRleHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtLmNsYXNzTmFtZSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtLmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5idXR0b25zID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5lbGVtLmFwcGVuZENoaWxkKGJ1dHRvbik7XG4gICAgICAgICAgICB0aGlzLmJ1dHRvbnMucHVzaChidXR0b24pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZWxlbS5jbGFzc05hbWUgPSBcIm91dFwiO1xuICAgIH1cbn0iLCJpbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcbmltcG9ydCBTdGF0ZU1hbmFnZXIgZnJvbSBcIi4vc3RhdGVfbWFuYWdlclwiO1xuaW1wb3J0IHsgQmVnaW5TdGF0ZSB9IGZyb20gXCIuL3N0YXRlc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBHYW1lIHtcbiAgICB0ZXJtOiBUZXJtaW5hbDtcbiAgICBtYW5hZ2VyOiBTdGF0ZU1hbmFnZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZXJtaW5hbDogSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGVybWluYWwuc3R5bGUubGluZUhlaWdodCA9IFwiMS4ycmVtXCI7XG4gICAgICAgIHRoaXMudGVybSA9IG5ldyBUZXJtaW5hbCh0ZXJtaW5hbCk7XG4gICAgICAgIHRoaXMubWFuYWdlciA9IG5ldyBTdGF0ZU1hbmFnZXIoQmVnaW5TdGF0ZSk7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLnVwZGF0ZShkdCwgdGhpcy50ZXJtKTtcblxuICAgICAgICB0aGlzLnRlcm0udXBkYXRlKGR0KTtcbiAgICB9XG5cbiAgICByZXNpemUoKSB7XG4gICAgICAgIHRoaXMudGVybS5yZXNpemUoKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLmtleWRvd24oZSk7XG4gICAgfVxufVxuIiwiaW1wb3J0IFN0YXRlTWFuYWdlciBmcm9tIFwiLi9zdGF0ZV9tYW5hZ2VyXCI7XG5pbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcblxuZXhwb3J0IGRlZmF1bHQgYWJzdHJhY3QgY2xhc3MgU3RhdGUge1xuICAgIHByb3RlY3RlZCBtYW5hZ2VyOiBTdGF0ZU1hbmFnZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyOiBTdGF0ZU1hbmFnZXIpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcbiAgICB9XG5cbiAgICBpbml0KHRlcm06IFRlcm1pbmFsKSB7fVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7fVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7fVxufVxuIiwiaW1wb3J0IFN0YXRlIGZyb20gXCIuL3N0YXRlXCI7XG5pbXBvcnQgVGVybWluYWwgZnJvbSBcIi4vdGVybWluYWxcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU3RhdGVNYW5hZ2VyIHtcbiAgICBzdGF0ZTogU3RhdGU7XG4gICAgbmVlZHNJbml0ID0gdHJ1ZTtcblxuICAgIGNvbnN0cnVjdG9yKHM6IG5ldyAobTogU3RhdGVNYW5hZ2VyKSA9PiBTdGF0ZSkge1xuICAgICAgICB0aGlzLnN0YXRlID0gbmV3IHModGhpcyk7XG4gICAgfVxuXG4gICAgc2V0U3RhdGUoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICAgICAgdGhpcy5uZWVkc0luaXQgPSB0cnVlO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBpZiAodGhpcy5uZWVkc0luaXQpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUuaW5pdCh0ZXJtKTtcbiAgICAgICAgICAgIHRoaXMubmVlZHNJbml0ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN0YXRlLnVwZGF0ZShkdCwgdGVybSk7XG4gICAgfVxuXG4gICAga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIHRoaXMuc3RhdGUua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuaW1wb3J0IEJ1dHRvbnMgZnJvbSBcIi4vYnV0dG9uc1wiO1xuaW1wb3J0IHsgU3RvcnkgfSBmcm9tICcuL3N0b3J5JztcbmltcG9ydCBBdWRpb01hbmFnZXIgZnJvbSBcIi4vYXVkaW9fbWFuYWdlclwiO1xuXG5sZXQgc3Rvcnk6IFN0b3J5ID0gcmVxdWlyZShcIi4vc3RvcnkuY3NvblwiKTtcblxuZXhwb3J0IGNsYXNzIEJlZ2luU3RhdGUgZXh0ZW5kcyBTdGF0ZSB7XG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICB0ZXJtLndyaXRlTGluZShcIlByZXNzIGFueSBrZXkgdG8gYmVnaW4uLi5cIik7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUga2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgICAgIHRoaXMubWFuYWdlci5zZXRTdGF0ZShXaXBlU3RhdGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdpcGVTdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBwcml2YXRlIHdpcGVUaW1lciA9IDA7XG4gICAgcHJpdmF0ZSB3aXBlVGlja3MgPSAwO1xuICAgIHByaXZhdGUgd2lwZUxpbmVzOiBudW1iZXI7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5vdmVyZmxvdyA9IFwiaGlkZGVuXCI7XG4gICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5zY3JvbGxTbmFwVHlwZSA9IFwidW5zZXRcIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnBhZGRpbmdMZWZ0ID0gXCIxLjZyZW1cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnBhZGRpbmdSaWdodCA9IFwiMS42cmVtXCI7XG4gICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS50ZXh0SW5kZW50ID0gXCJ1bnNldFwiO1xuICAgICAgICB0aGlzLndpcGVMaW5lcyA9IHRlcm0ubWF4TGluZXM7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGUgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLndpcGVUaW1lciA+IDUwKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53aXBlVGlja3MgPiA1KSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlTGluZXMtLTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXBlVGlja3MrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGVybS5maWxsUmFuZG9tKHRoaXMud2lwZUxpbmVzKTtcblxuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2lwZUxpbmVzID49IDApIHtcbiAgICAgICAgICAgIHRoaXMud2lwZVRpbWVyICs9IGR0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGVybS5yZXNldCgpO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLm92ZXJmbG93ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5zY3JvbGxTbmFwVHlwZSA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSBcIlwiO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnBhZGRpbmdSaWdodCA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUudGV4dEluZGVudCA9IFwiXCI7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIuc2V0U3RhdGUoUGxheWluZ1N0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBsYXlpbmdTdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBzY2VuZSA9IFwiYmVnaW5cIjtcblxuICAgIHJlbWFpbmluZ1RleHQgPSBcIlwiO1xuXG4gICAgZGVsYXkgPSAwO1xuXG4gICAgdGV4dERlY29kZWQgPSAtMTtcbiAgICB0ZXh0UG9zaXRpb24gPSAtMTtcblxuICAgIGJ1dHRvbnMgPSBuZXcgQnV0dG9ucyhkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJ1dHRvbnNcIikhKTtcblxuICAgIGF1ZGlvID0gbmV3IEF1ZGlvTWFuYWdlcigpO1xuICAgIGJhY2tncm91bmQgPSBuZXcgQXVkaW9NYW5hZ2VyKCk7XG5cbiAgICBjdXJyU291bmQgPSBcImNsaWNrLndhdlwiO1xuXG4gICAgbG9jayA9IGZhbHNlO1xuXG4gICAgb3ZlcnJpZGUgaW5pdCh0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICB0aGlzLmF1ZGlvLmxvb3AoZmFsc2UpO1xuICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSBzdG9yeVt0aGlzLnNjZW5lXS50ZXh0O1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UtY2xvc2UnKSEub25jbGljayA9IChlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmxvY2sgPSBmYWxzZTtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jb250YWluZXInKSEuY2xhc3NOYW1lID0gXCJcIjtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBvdmVycmlkZSB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgaWYgKHRoaXMubG9jaykgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1dHRvbnMuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnN0b3AoKTtcbiAgICAgICAgICAgIHRlcm0ud3JpdGVMaW5lKHRoaXMuYnV0dG9ucy50ZXh0ISk7XG4gICAgICAgICAgICB0aGlzLnNjZW5lID0gdGhpcy5idXR0b25zLnNlbGVjdGVkO1xuICAgICAgICAgICAgdGhpcy5idXR0b25zLnNlbGVjdGVkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5yZW1haW5pbmdUZXh0Lmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmF1ZGlvLnN0b3AoKTtcbiAgICAgICAgICAgIHRlcm0uYnJlYWsoKTtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9ucy5lbmFibGUodGhpcy5zY2VuZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5kZWxheSA8PSAwKSB7XG4gICAgICAgICAgICBsZXQgW3BvcywgaW5kZXhdID0gdGhpcy5pbmRleE9mTWFueSh0aGlzLnJlbWFpbmluZ1RleHQsIFwiPFsgXFxuXCIpO1xuICAgICAgICAgICAgaWYocG9zID09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVNwZWNpYWwoaW5kZXgsIHRlcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndyaXRlVGV4dChwb3MsIHRlcm0sIGR0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXkgLT0gZHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGluZGV4T2ZNYW55KHN0cjogc3RyaW5nLCBjaGFyczogc3RyaW5nKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYyA9IGNoYXJzLmluZGV4T2Yoc3RyW2ldKTtcbiAgICAgICAgICAgIGlmIChjICE9IC0xKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtpLCBjXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy0xLCAtMV07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB3cml0ZVRleHQobGVuOiBudW1iZXIsIHRlcm06IFRlcm1pbmFsLCBkdDogbnVtYmVyKSB7XG4gICAgICAgIGlmIChsZW4gPT0gLTEpIHtcbiAgICAgICAgICAgIGxlbiA9IHRoaXMucmVtYWluaW5nVGV4dC5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50ZXh0RGVjb2RlZCA9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5hdWRpby5wbGF5KHRoaXMuY3VyclNvdW5kKTtcbiAgICAgICAgICAgIHRoaXMudGV4dERlY29kZWQgPSAwO1xuICAgICAgICAgICAgdGhpcy50ZXh0UG9zaXRpb24gPSB0ZXJtLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdGV4dCA9XG4gICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMCwgdGhpcy50ZXh0RGVjb2RlZCkgK1xuICAgICAgICAgICAgdGVybS5yYW5kb21DaGFyYWN0ZXJzKGxlbiAtIHRoaXMudGV4dERlY29kZWQpO1xuXG4gICAgICAgIHRlcm0ud3JpdGUodGV4dCwgdGhpcy50ZXh0UG9zaXRpb24pO1xuXG4gICAgICAgIGlmICh0aGlzLnRleHREZWNvZGVkID09IGxlbikge1xuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKGxlbik7XG4gICAgICAgICAgICB0aGlzLnRleHREZWNvZGVkID0gLTE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRleHREZWNvZGVkKys7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVTcGVjaWFsKGluZGV4OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHN3aXRjaCAoaW5kZXgpIHtcbiAgICAgICAgICAgIGNhc2UgMDogLy8gPFxuICAgICAgICAgICAgICAgIGxldCBlbmRUYWdQb3MgPSB0aGlzLnJlbWFpbmluZ1RleHQuaW5kZXhPZihcIj5cIik7XG4gICAgICAgICAgICAgICAgdGVybS53cml0ZSh0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMCwgZW5kVGFnUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShlbmRUYWdQb3MgKyAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMTogLy8gW1xuICAgICAgICAgICAgICAgIGxldCBlbmRDb21tYW5kUG9zID0gdGhpcy5yZW1haW5pbmdUZXh0LmluZGV4T2YoXCJdXCIpO1xuICAgICAgICAgICAgICAgIGxldCBjb21tYW5kID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEsIGVuZENvbW1hbmRQb3MpO1xuICAgICAgICAgICAgICAgIGxldCBzcGFjZVBvcyA9IGNvbW1hbmQuaW5kZXhPZihcIiBcIik7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGFjZVBvcyA9PSAtMSA/IGNvbW1hbmQgOiBjb21tYW5kLnNsaWNlKDAsIHNwYWNlUG9zKSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZGVsYXlcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVsYXkgPSBwYXJzZUludChjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJub3JtYWxcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXVkaW8ucGxheSh0aGlzLmN1cnJTb3VuZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInNlcFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzb3VuZFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyU291bmQgPSBjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImJhY2tncm91bmRcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcGFjZVBvcyA9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmFja2dyb3VuZC5zdG9wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmFja2dyb3VuZC5wbGF5KGNvbW1hbmQuc2xpY2Uoc3BhY2VQb3MgKyAxKSwgMC4xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiaW1hZ2VcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUoYDxhIG9uY2xpY2s9J2ltZ0NsaWNrKCknPkNsaWNrIHRvIHZpZXcgaW1hZ2U8L2E+YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmxvY2sgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LmltZ0NsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2UnKSBhcyBIVE1MSW1hZ2VFbGVtZW50KS5zcmMgPSBjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ltYWdlLWNvbnRhaW5lcicpIS5jbGFzc05hbWUgPSBcInNob3dcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShlbmRDb21tYW5kUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDI6IC8vIDxzcGFjZT5cbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKFwiIFwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDM6IC8vIFxcblxuICAgICAgICAgICAgICAgIHRlcm0ud3JpdGVMaW5lKFwiXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVsYXkgPSA1MDA7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkludmFsaWQgY2hhciBpbmRleCBcIiArIGluZGV4KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZGVjbGFyZSBnbG9iYWwge1xuICAgIGludGVyZmFjZSBXaW5kb3cgeyBpbWdDbGljazogKCkgPT4gdm9pZDsgfVxufVxuIiwiaW1wb3J0IExpbmVDbGFtcCBmcm9tIFwiQHR2YW5jL2xpbmVjbGFtcFwiO1xyXG5cclxuY29uc3QgQ1VSU09SX0JMSU5LX0lOVEVSVkFMID0gNTAwO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGVybWluYWwge1xyXG4gICAgZWxlbWVudDogSFRNTEVsZW1lbnQ7XHJcblxyXG4gICAgZm9udFNpemU6IG51bWJlcjtcclxuICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICBoZWlnaHQ6IG51bWJlcjtcclxuICAgIGxpbmVIZWlnaHQ6IG51bWJlcjtcclxuXHJcbiAgICBtYXhMaW5lczogbnVtYmVyO1xyXG4gICAgY2hhcnNQZXJMaW5lOiBudW1iZXI7XHJcblxyXG4gICAgY29udGVudCA9IFwiPGRpdj4+IFwiO1xyXG5cclxuICAgIHByaXZhdGUgY3Vyc29yVmlzaWJsZSA9IHRydWU7XHJcbiAgICBwcml2YXRlIGN1cnNvckVuYWJsZWQgPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBjdXJzb3JUaWNrcyA9IDA7XHJcblxyXG4gICAgY29uc3RydWN0b3IoZWxlbTogSFRNTEVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBlbGVtO1xyXG5cclxuICAgICAgICB0aGlzLmZvbnRTaXplID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5mb250U2l6ZS5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMud2lkdGggPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLndpZHRoLnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBwYXJzZUludChcclxuICAgICAgICAgICAgZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpLmhlaWdodC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XHJcbiAgICAgICAgY29uc3QgY2xhbXAgPSBuZXcgTGluZUNsYW1wKHRoaXMuZWxlbWVudCk7XHJcbiAgICAgICAgdGhpcy5saW5lSGVpZ2h0ID0gY2xhbXAuY2FsY3VsYXRlVGV4dE1ldHJpY3MoKS5hZGRpdGlvbmFsTGluZUhlaWdodDtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcIlwiO1xyXG5cclxuICAgICAgICB0aGlzLm1heExpbmVzID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAvIHRoaXMubGluZUhlaWdodCk7XHJcbiAgICAgICAgdGhpcy5jaGFyc1BlckxpbmUgPSBNYXRoLmZsb29yKHRoaXMud2lkdGggLyAodGhpcy5mb250U2l6ZSAqIDAuNikpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlc2l6ZSgpIHtcclxuICAgICAgICB0aGlzLndpZHRoID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS53aWR0aC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5oZWlnaHQuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5tYXhMaW5lcyA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgLyB0aGlzLmxpbmVIZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2hhcnNQZXJMaW5lID0gTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gKHRoaXMuZm9udFNpemUgKiAwLjYpKTtcclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnNvckVuYWJsZWQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY3Vyc29yVGlja3MgPj0gQ1VSU09SX0JMSU5LX0lOVEVSVkFMKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnNvclRpY2tzID0gMDtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmxpcEN1cnNvcigpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJzb3JUaWNrcyArPSBkdDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzaG93KCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5pbm5lckhUTUwgPSB0aGlzLmNvbnRlbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgY2xlYXIoKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgPSBcIlwiO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFBvc2l0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRlbnQubGVuZ3RoIC0gKHRoaXMuY3Vyc29yVmlzaWJsZSA/IDAgOiAxKTtcclxuICAgIH1cclxuXHJcbiAgICBwdXQodGV4dDogc3RyaW5nLCBwb3M/OiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgcG9zICE9IHVuZGVmaW5lZCAmJlxyXG4gICAgICAgICAgICBwb3MgPj0gMCAmJlxyXG4gICAgICAgICAgICBwb3MgPD0gdGhpcy5jb250ZW50Lmxlbmd0aCAtIHRleHQubGVuZ3RoXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCA9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgcG9zKSArXHJcbiAgICAgICAgICAgICAgICB0ZXh0ICtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudC5zbGljZShwb3MgKyB0ZXh0Lmxlbmd0aCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1dExpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgKz0gdGV4dCArIFwiPC9kaXY+PGRpdj4+IFwiO1xyXG4gICAgfVxyXG5cclxuICAgIHJlc2V0KCkge1xyXG4gICAgICAgIHRoaXMuY2xlYXIoKTtcclxuICAgICAgICB0aGlzLnB1dChcIj4gXCIpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB3cml0ZSh0ZXh0OiBzdHJpbmcsIHBvcz86IG51bWJlcikge1xyXG4gICAgICAgIHRoaXMucHV0KHRleHQsIHBvcyk7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHdyaXRlTGluZSh0ZXh0OiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnB1dExpbmUodGV4dCk7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGJyZWFrKCkge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ICs9IFwiPC9kaXY+PGJyLz48ZGl2Pj4gXCI7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHJhbmRvbUNoYXJhY3RlcnMoY291bnQ6IG51bWJlcikge1xyXG4gICAgICAgIGxldCB2YWx1ZXMgPSBuZXcgVWludDhBcnJheShjb3VudCk7XHJcbiAgICAgICAgd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXModmFsdWVzKTtcclxuICAgICAgICBjb25zdCBtYXBwZWRWYWx1ZXMgPSB2YWx1ZXMubWFwKCh4KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGFkaiA9IHggJSAzNjtcclxuICAgICAgICAgICAgcmV0dXJuIGFkaiA8IDI2ID8gYWRqICsgNjUgOiBhZGogLSAyNiArIDQ4O1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBtYXBwZWRWYWx1ZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZpbGxSYW5kb20obGluZXM6IG51bWJlcikge1xyXG4gICAgICAgIHRoaXMuY2xlYXIoKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5wdXQodGhpcy5yYW5kb21DaGFyYWN0ZXJzKHRoaXMuY2hhcnNQZXJMaW5lKSk7XHJcbiAgICAgICAgICAgIHRoaXMucHV0KFwiPGJyIC8+XCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnB1dCh0aGlzLnJhbmRvbUNoYXJhY3RlcnModGhpcy5jaGFyc1BlckxpbmUpKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXRDdXJzb3JFbmFibGVkKHZhbHVlOiBib29sZWFuKSB7XHJcbiAgICAgICAgdGhpcy5jdXJzb3JFbmFibGVkID0gdmFsdWU7XHJcbiAgICAgICAgLy8gaWYgdGhlIGN1cnNvciBuZWVkZWQgdG8gYmUgdHVybmVkIG9mZiwgZml4IGl0XHJcbiAgICAgICAgaWYgKCF0aGlzLmN1cnNvckVuYWJsZWQgJiYgIXRoaXMuY3Vyc29yVmlzaWJsZSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgPSB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgLTEpO1xyXG4gICAgICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICAgICAgdGhpcy5jdXJzb3JWaXNpYmxlID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBmbGlwQ3Vyc29yKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnNvckVuYWJsZWQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY3Vyc29yVmlzaWJsZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50ICs9IFwiX1wiO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50ID0gdGhpcy5jb250ZW50LnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmN1cnNvclZpc2libGUgPSAhdGhpcy5jdXJzb3JWaXNpYmxlO1xyXG4gICAgICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgQnViYmxlcyBmcm9tIFwiLi9idWJibGVzXCI7XG5pbXBvcnQgR2FtZSBmcm9tIFwiLi9nYW1lXCI7XG5cbmxldCBnYW1lOiBHYW1lO1xuXG5sZXQgYnViYmxlczogQnViYmxlcztcblxubGV0IGxhc3RUaW1lOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxud2luZG93Lm9ubG9hZCA9ICgpID0+IHtcbiAgICBidWJibGVzID0gbmV3IEJ1YmJsZXMoXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmFja2dyb3VuZFwiKSBhcyBIVE1MQ2FudmFzRWxlbWVudFxuICAgICk7XG4gICAgZ2FtZSA9IG5ldyBHYW1lKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidGVybWluYWxcIikhKTtcblxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbn07XG5cbndpbmRvdy5vbnJlc2l6ZSA9ICgpID0+IHtcbiAgICBidWJibGVzLnJlc2l6ZSgpO1xuICAgIGdhbWUucmVzaXplKCk7XG59O1xuXG5kb2N1bWVudC5vbmtleWRvd24gPSAoZSkgPT4ge1xuICAgIGdhbWUua2V5ZG93bihlKTtcbn07XG5cbmRvY3VtZW50Lm9udmlzaWJpbGl0eWNoYW5nZSA9ICgpID0+IHtcbiAgICBpZiAoZG9jdW1lbnQudmlzaWJpbGl0eVN0YXRlID09IFwidmlzaWJsZVwiKSB7XG4gICAgICAgIGxhc3RUaW1lID0gbnVsbDtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgLy8gVGhpcyByZWFsbHkgc2hvdWxkbid0IGJlIG5lZWRlZCBpZiBicm93c2VycyBhcmUgZm9sbG93aW5nIGNvbnZlbnRpb24sXG4gICAgLy8gYnV0IGJldHRlciBzYWZlIHRoYW4gc29ycnlcbiAgICBpZiAoZG9jdW1lbnQuaGlkZGVuKSB7XG4gICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsYXN0VGltZSA9PSBudWxsKSB7XG4gICAgICAgIGxhc3RUaW1lID0gLTE7XG4gICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodXBkYXRlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAobGFzdFRpbWUgIT0gLTEpIHtcbiAgICAgICAgbGV0IGR0ID0gdGltZSAtIGxhc3RUaW1lO1xuXG4gICAgICAgIGJ1YmJsZXMudXBkYXRlKGR0KTtcbiAgICAgICAgZ2FtZS51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIGxhc3RUaW1lID0gdGltZTtcbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=