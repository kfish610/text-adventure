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

module.exports = {"begin":{"text":"[delay 500]Connecting[delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750]\n[sound alarm.wav]<em>Beep</em> [delay 1000]<em>Beep</em> [delay 1000]<em>Beep</em>[delay 1000]\n[sound click.wav]You wake up slowly to the sound of your alarm.\nIt drones on and on until you wake up enough to turn it off.\nWhat do you do?","options":[{"icon":"newspaper","text":"Check the news","next":"checkNews"},{"icon":"arrow-up-from-bracket","text":"Get out of bed","next":"getUp"}]},"checkNews":{"text":"You grab your Augmented Reality glasses from your nightstand and put them on.\nAs you scroll somewhat absentmindedly through the news, one story catches your eye.\nAn image of a flooded town off of the Missisippi River.\nMurky brown water everywhere, past waist height.\nCars, buildings, and trees barely above the surface.\n[image https://images.foxtv.com/static.fox7austin.com/www.fox7austin.com/content/uploads/2020/02/932/524/Flooding-in-MIssissippi-.jpg?ve=1&tl=1]\nNature is a cruel mistress, you think.\nBut then again, we've always had to deal with natural disasters, right?\nWell, thats enough of the news for today. That stuff is always just depressing.","loop":"begin"},"getUp":{"text":"You get up and get ready for the day.\nWhen you come back out of the bathroom, you notice two things:\n1. It's freezing in here\n2. Your room is a mess","options":[{"icon":"fan","text":"Turn off the A/C","next":"turnOff"},{"icon":"folder","text":"Check out the mess","next":"mess","return":"continue"},{"icon":"arrow-up-from-bracket","text":"Leave","next":"leave"}]},"turnOff":{"text":"As you go over to turn off the air conditioning, you take a look out the window. Just as you expected, its cloudy and rainy. The A/C must have been making the temperature even colder than it already was outside.\nYou've had it turned all the way up for the past few weeks due to the heatwave. You'd been worried that it wasn't going to end: you had never seen a heatwave go for that long or that hot in your life. Clearly it's over now, though, if the temperature is anything to go by.\nYou adjust the A/C's settings in its app on your AR glasses. On to more important things.","loop":"getUp"},"mess":{"text":"You spend so much time at work nowadays that your room is pretty messy. In theory, all of your materials would be contained in the folder on your desk, but you spend so much time reorganizing and adjusting that it all ends up strewn about. You'd probably be better off using virtual documents, but something about feeling the papers in your hand still appeals to you more than just seeing them.\nYou pick up what few papers remain the folder and flick through them. They're the three studies you've based your presentation on. You stare at them for a little, pensively. You'd always wanted to be the one doing the research. That's why you took this job; presenting research seemed like a good way to get some connections, not to mention you needed the money. But at some point you lost track of that goal, and even though you can probably afford to go back to school now, being a researcher feels like someone else's dream. The kind of thing a kid tells themself before they've been exposed to the real world.\nThis job is fine. It pays well. <b>It's fine</b>.\nAnyway, you have three studies in the folder.\nDo you want to review any of them before the big hearing later?","options":[{"icon":"industry","text":"CCS Study","next":"ccs"},{"icon":"fire-flame-simple","text":"Efficiency Study","next":"efficiency"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"lca"},{"icon":"arrow-up-from-bracket","text":"Continue","next":"continue"}]},"ccs":{"text":"This study is about CCS, Carbon Capture and Storage. It's a technology that significantly reduces the carbon emissions of coal and natural gas power plants, by up to 90%. So of course, the fossil fuels corporation you work for is pretty interested in it as a way to keep their business... up to date with the times. This study is an overview of past and current research into CCS technologies, some of which promise to reduce emissions by up to 95% or even more. It also has some low level explanations of how the technology works, such as some diagrams of possible processes.\n[image https://ars.els-cdn.com/content/image/1-s2.0-S0048969720367346-gr1.jpg]\nOf course, the extra work needed to capture and store the carbon dioxide does make the cost of electricity for CCS plants higher, and the technology can never reduce emissions to near zero like renewables. The study does note that, but your supervisor said not to focus on that part so much. After all, how much harm could just a little more carbon dioxide really do?","loop":"mess"},"efficiency":{"text":"This study is an analysis of the cost efficiency of various fossil fuel energy sources compared to renewable sources. The study found that all together, renewables cost about 6-8 cents per kilowatt-hour (kWh), while fossil fuel sources like coal and natural gas cost about 4-5 cents per kWh, depending on the source. Your supervisor was very insistent you highlight that while a 2 or 3 cent difference may not seem like much, if you multiply it over the whole power grid, it starts to add up. And you suppose that makes sense; if the government is going to be subsidizing energy, it might as well get the most out of each dollar.\nThe study, being funded by the company you work for, neglects to mention the cost increases from the use of CCS, which you've been told raise it up to about the same levels as renewables, if not more. But you've been assured that your company is working hard to make CCS cheaper, and once they do that they'll be sure to switch over. So that makes you feel a little better... you think. Until then though the company is still intending to focus on non-CCS plants. You won't be mentioning that either.","loop":"mess"},"lca":{"text":"This study you're not supposed to have. Your supervisor had been making a big fuss about some new lifecycle analysis that would show fossil fuels weren't as bad as everyone thought, but a couple of months later they had just stopped talking about it. So you did a little digging, found the researchers who did the study, and asked them for a copy.\nOnce they sent it to you, you quickly realized why you hadn't heard any more about it. Rather than find evidence that fossil fuels weren't as destructive as people thought, they actually found evidence that certain aspects of the process were more destructive than initially thought.\nYou're not sure why you kept the study. You certainly aren't going to use it at today's hearing, that would be... bad for your job security, to say the least. But something about it keeps nagging at you. Maybe it's the enormity of it all. You know about climate change—it's hard to ignore it with all the protests that have been going on recently—but as far as you can tell, everything seems to be fine. Sure, there's been a lot of floods in some other states recently, and there's definitely been a lot of heatwaves here in Texas, but none of it seems that bad. But seeing the sheer amount of carbon being emitted, together with references to the direct and indirect effects, even in a fossil fuel funded study; it makes you uncomfortable, to say the least.\nYou put the study back in the folder. You shouldn't be distracting yourself with that today. This is possibly the biggest hearing of your career. If you mess this up, it'll mean the majority of fossil fuel subsidies will be diverted to renewable energy, and less money for your employer means less money for you. No mistakes today.","loop":"mess"},"continue":{"text":"You turn your attention to the rest of the room.","loop":"getUp"},"leave":{"text":"You're a bit early, but you decide you might as well head to the virtual conference center already. It's a bit of a pain having to go somewhere just to have a better video capture, but you want to look your best. At least its better than having to fly to D.C. to attend the hearing: you know some people at your company who have been lobbying a whole lot longer than you, and they won't stop talking about how much of a pain the business trips used to be.\nOf course, you don't have a car; gas is more expensive than ever, and driving is becoming increasingly unfashionable nowadays. You could take the bus, but you'd like some privacy while you prepare yourself, so you call a taxi instead. Still, you're faced with a choice: normal car, or flying car?","options":[{"icon":"car","text":"Normal Car","next":"normalCar"},{"icon":"plane","text":"Flying Car","next":"flyingCar"}]},"normalCar":{"text":"Despite the novelty of a flying car, a standard car is probably the more reasonable option. It's certainly the most economical option, though the difference between them has been getting surprisingly small, all considered. The car arrives&mdash;the decrease of human drivers has made traffic almost a thing of the past at this point&mdash;and you get in.\n[background traffic.mp3]As the car drives off, you look out the window. You see a lot of businesses, but weirdly, most of them seem empty. Then you realize why. On nearly every building, there's an AR flyer attached to it, with something along the lines of \"now hiring\". You'd seen a piece in the news recently about how low-wage workers were getting hit hard by heat stress in the recent string of heatwaves. The air conditioners weren't up to the task of the weeks of heatwave. But you had assumed it was just a couple of people that were effected. This doesn't really seem like just a couple of people, though.\nBut you're sure this is just a temporary thing. It's a once in a lifetime heatwave, after all. Then again, you'd seen on the weather forecast that temperatures were supposed to go back up the rest of this week, and that today is just an outlier. But... they're probably just missing something. You're sure things will go back to normal soon. Probably.\nYou're shaken out of your thoughts by the car slowing down and stopping. You're here.\nTime to go inside and get ready for the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Enter","next":"enter"}]},"flyingCar":{"text":"You decide on the flying car. You can spend a little extra just for today; it is an important day after all. Plus, it'll get you there faster. And the views are much nicer. You wait a minute, and then hear the whirring of the rotors on the car. To be honest you had always imagined flying cars as floating, or maybe with wings like an airplane. But you suppose technology is rarely exactly what we expect it to be. You get in the car, and it takes off.\n[background flying.mp3]You look out the window as the ground drifts further from you. You're not sure you'll ever get used to that. Still, it's a nice view. Unfortunately, your view is occasionally blocked by an advertisement. It's not exactly surprising that they're all over the sky; we put billboards everywhere on highways. But it would have been nice to leave this sight unblemished. At least they're not physically in the air, only visible in your AR glasses. In fact, usually you'd just take them off, but you have to be watching for messages from your company, just in case. So you're going to have to deal with the occasional ad drifting into view.\nOne in particular catches your eye. At first, it just looked like a cloud of smoke, but then you see it reform in the letters \"DECARBONIZE\". Well, it's an impressive rendering, you'll give them that. The smoke then continues to reform into different words and sentences.\n\"Do you really want this in your air?\"[delay 1000]\n\"We're at a tipping point\"[delay 1000]\n\"There is no Earth 2\"[delay 1000]\n\"There's still time to fix this\"[delay 1000]\n\"Zero carbon by 2100\"[delay 1000]\nIt then links to a website, which you quickly wave away. You scoff. Zero carbon? There's no way we could do that, right? And even if we could, carbon dioxide isn't <em>that</em> bad. Right? The lifecycle analysis in your folder nags at you... but you push the thought away. Focus. Your supervisor told you not to worry about the environmental impacts so much. So it's probably fine.\nYou're shaken out of your thoughts by the car landing. You're here.\nTime to go inside and get ready for the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Enter","next":"enter"}]},"enter":{"text":"You enter the building. There's a small reception area, where you put your name in and ask if your room is ready. But apparently it's still being used for a few more minutes, so you sit down. And then you see them. A face you recognize... unfortunately. They're a lobbyist too, but for a climate change activism group, and they're going to the same hearing as you. Small world.\nThere's only a couple of chairs in the waiting room, so you sit down closer than you'd like to them. They keep stealing glances at you, and you're pretty sure they know who you are too. Do you want to talk to them? Or just keep sitting for a few minutes?","options":[{"icon":"comment","text":"Talk to them","next":"talk"},{"icon":"chair","text":"Sit awkwardly","next":"sit"}]},"sit":{"text":"You keep sitting. You wouldn't want to talk to them anyway. You're sure they'd be super boring.\n[normal .][delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750][normal .]\n[normal .][delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750][normal .][delay 750][normal .]\nFinally, your room is ready. Time for the hearing. You take a deep breath, and get up.","options":[{"icon":"arrow-up-from-bracket","text":"Attend the hearing","next":"attend"}]},"talk":{"text":"You decide you might as well fill the time with a little conversation. At worst, maybe you'll know a bit more about how they're going to respond to you.\n\"So... how about that weather today? Crazy how it changed so fast.\" you say.[delay 1000]\nThey look at you for a second, then shake their head. \"As if you care. You're probably going to use it as an excuse to pretend climate change isn't happening. I know your type. You're just in this for the money.\"[delay 1000]\nYou weren't expecting that. \"Hey, I'm just trying to make conversation&mdash;\"[delay 1000]\n\"Sure, and I'm just trying to prevent the world from burning. I mean, you've seen the heatwave these past few weeks. You really think everything is ok?\"[delay 1000]\nThis conversation is... not going how you expected. \"Yeah the heatwave is...[delay 500] weird. But my company is looking into ways to reduce its carbon emissions, or add more carbon offsets. It's going to be <em>fine</em>.\"[delay 1000]\nThey just shake their head again. \"Look, you don't seem evil or anything. It just sounds like you're in denial. Maybe you know it too. But if you cared, you would be working with me, not with the fossil fuels industry. Or at least not actively defending them. So we have nothing to talk about.\"[delay 1000]\nYou start to respond, but the receptionist lets you know that your room is ready. \nYou take a deep breath, and get up. It's time for the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Attend the hearing","next":"attend"}]},"attend":{"text":"You log on. Everyone else seems to be logging on around the same time. There's a brief pause while the Representative leading today's hearing waits for everyone to join. Then, she starts. She introduces all of the other Representatives attending, briefly explains the content of todays hearing&mdash;the allocation of energy subsidies&mdash;and then hands it off to you.\nYou knew you were going to be first to speak. You take a deep breath. Now's the moment of truth.\nYou're going to present the two studies you were given. You made sure you could change around the order if you needed to, just in case you changed your mind on the best way to go about presenting them. So, which one would you like to present first?","options":[{"icon":"industry","text":"CCS Study","next":"presentCCS1"},{"icon":"fire-flame-simple","text":"Efficiency Study","next":"presentEfficiency1"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"presentLCA"}]},"presentCCS1":{"text":"\"Good morning, and thank you for having me today. I'd like to talk to you today about some extremely promising advances in Carbon Capture and Storage technology, also known as CCS. CCS is a very promising technology that could significantly reduce carbon emissions. It's been known to reduce emissions by up to 90%, and recent research has found methods than can reach up to 95% reductions, or even above that. Not only that, but this technology can be retrofitted onto existing plants, which means that with some investment, we could pivot our existing plants to use CCS, rather than building completely new energy sources. We feel it is the only responsible path to a cleaner future.\"\nYou continue on with some more specific details, but the pitch was the most important part. You hope it went over well.\nYou finish up this part of the presentation. On to the second study, right? Well, there's always the other study, but you wouldn't present that.","options":[{"icon":"fire-flame-simple","text":"Efficiency Study","next":"presentEfficiency2"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"presentLCA"}]},"presentEfficiency1":{"text":"\"Good morning, and thank you for having me today. I'd like to talk to you today about some new research into the cost of various different energy sources. Renewable energy is very interesting, but it isn't necesarily cost-effective. Our research has found that on average, renewable energy costs around 6-8 cents per kilowatt-hour, while coal and natural gas costs around 4-5 cents per kilowatt-hour. That may not seem significant, but when we're talking about the entire energy grid of the United States, that's hardly a cost one can ignore. So while it is definitely good to consider renewable energy, we can hardly rely on it without incurring a hefty price.\"\nYou continue on with some more specific details, but the pitch was the most important part. You hope it went over well.\nYou finish up this part of the presentation. On to the second study, right? Well, there's always the other study, but you wouldn't present that.","options":[{"icon":"industry","text":"CCS Study","next":"presentCCS2"},{"icon":"arrows-rotate","text":"Lifecycle Analysis","next":"presentLCA"}]},"presentCCS2":{"text":"\"I'd also like to talk to you about some extremely promising advances in Carbon Capture and Storage technology, also known as CCS. CCS is a very promising technology that could significantly reduce carbon emissions. It's been known to reduce emissions by up to 90%, and recent research has found methods than can reach up to 95% reductions, or even above that. Not only that, but this technology can be retrofitted onto existing plants, which means that with some investment, we could pivot our existing plants to use CCS, rather than building completely new energy sources. We feel it is the only responsible path to a cleaner future.\"\nYou continue on with some more specific details, but again, the pitch was the most important part.\nWell, that's it for your time. Now to hear from the rest of those attending the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Finish","next":"finishbad"}]},"presentEfficiency2":{"text":"\"I'd also like to talk to you about some new research into the cost of various different energy sources. Renewable energy is very interesting, but it isn't necesarily cost-effective. Our research has found that on average, renewable energy costs around 6-8 cents per kilowatt-hour, while coal and natural gas costs around 4-5 cents per kilowatt-hour. That may not seem significant, but when we're talking about the entire energy grid of the United States, that's hardly a cost one can ignore. So while it is definitely good to consider renewable energy, we can hardly rely on it without incurring a hefty price.\"\nYou continue on with some more specific details, but again, the pitch was the most important part.\nWell, that's it for your time. Now to hear from the rest of those attending the hearing.","options":[{"icon":"arrow-up-from-bracket","text":"Finish","next":"finishbad"}]},"presentLCA":{"text":"The nagging finally gets to you. You can't do this. You know exactly what you saw in that study and... it's time to act on it.\n\"I'd like to talk to you about... [delay 500]something very important. You see, we all know that climate change is a problem, and that fossil fuels don't help with it. But it's likely even worse than you thought, so I recommend to the assembly that you divert most fossil fuel subsidies to renewables.\"\nThere's a gasp from someone who clearly forgot to mute themself.\n\"I know this may come as a surprise, but I truly feel this is the only responsible move. CCS isn't perfect; it costs more than normal fossil fuels, not to mention that it still emits considerably more than renewable energy sources. And I think it's clear that recent climate events have been worse and more extreme, and the association has been proven.\"\nYou went on about the specifics of the study. You can see the surprise on the faces of the various people attending, but you knew this needed to be said. You finish. It's done.","options":[{"icon":"arrow-up-from-bracket","text":"Finish","next":"finishgood"}]},"finishbad":{"text":"The rest of the hearing is fairly boring. You're only sort of paying attention, until the lobbyist you met in the waiting room begins their section. At that part, you start listening.\nThey talk about the unprecendent amount of heatwaves, flooding, and other extreme climate events that have been occuring.[delay 500]\nThey talk about the rise in global temperature, nearly exactly in line with past predictions.[delay 500]\nThey talk about the amount of money it is costing us, just to cope with the changes.[delay 500]\nThey talk about the drop in prices for renewable energy, that is only continuing with further research.[delay 500]\nThey talk about the clear public interest in the climate, only getting stronger each day.[delay 500]\n\"Even if renewables cost us a bit more, surely that's worthwhile to save our planet? The evidence was clear 30 years ago. Now is the time for action. I hope you can all see that. Thank you.\"\nAnd with that, the hearing was over. Thanks were said, and the hearing was dismissed. You log out of the meeting.\nYou pass the climate activism lobbyist, but they don't look at you.\nYou head home. You tell yourself that you did a good job. \nAt the very least, your employers are very happy.\nBut still... you're not sure if you did what you should have.\nMaybe, it could have gone a different way.","options":[{"icon":"circle-xmark","text":"Ending: Wrong Side of History","next":"wrongside"}]},"finishgood":{"text":"You can barely wait for the hearing to finish. Even though you can't physically see people's eyes on you, you know they're all thinking about what you did. So are you. You can hardly believe it. It just... felt right. But now, you're realizing the repercussions. You're definitely going to lose your job. Was that worth it?\nThe lobbyist you met seems surprised as they give their testimony. They strongly agree with you, and note the change in climate same as you, although with more facts to back it up. At least they seem happy about it.\nFinally, the hearing ends. You log out, and head back out into the waiting room.\nYou see the lobbyist again. They're smiling at you.\nWhat do you do?","options":[{"icon":"comment","text":"Talk to the lobbyist","next":"talkfinal","if":"talk"},{"icon":"house-chimney","text":"Go Home","next":"home"}]},"talkfinal":{"text":"\"Oh. Hi\" you say.\nThey smile. \"I've got to say, you surprised me in there. Maybe you're not just in it for the money.\"\n\"Well... I had a change of heart. I'd like to try to do better.\"\n\"You know, my company is hiring. If you're interested, maybe I could set you up for an interview. I'm sure they'd be interested.\"\nYou weren't expecting that either. They really are full of surprises.\nHow do you respond?","options":[{"icon":"briefcase","text":"Take the job","next":"job"},{"icon":"heart","text":"Ask them out","next":"heart"}]},"job":{"text":"You take the job. After a short interview process, they gladly hire you. They need all the help you can get.\nBetween your testimony and your active work after the fact, fossil fuel investment starts to rapidly dwindle. \nYou even get involved in new legislature that would slowly phase out fossil fuel plants in favor of renewables.\nIt'll still be an uphill battle, but at least you're pretty sure you're on the right side of it.","options":[{"icon":"file-lines","text":"Credits","next":"credits"}]},"heart":{"text":"[background wedding.mp3]To your surprise, they accept. You start dating, and it goes very well.\nEventually, after a while, you tie the knot.\nYou're a very supportive spouse, and you're sure you provide excellent moral support.\nYou must have, because you see clearly that fossil fuels are being phased out.\nThe tide has turned. It'll be a long road to carbon neutrality, but at least you're on it.","options":[{"icon":"file-lines","text":"Credits","next":"credits"}]},"home":{"text":"You head home. Your phone is ringing incessantly, but you don't check it.\nYou know its your employers. Or at least, your previous employers. You don't have to check.\nBut, looking back at your folder, you realize, maybe this isn't such a bad thing.\nAfter all, you had wanted to go back to school, hadn't you?\nMaybe this is just the opportunity you need.\nYou decide it's not too late. You'll start applying right away.\nAt the very least, you'll certainly have a reputation. Hopefully it helps you.","options":[{"icon":"file-lines","text":"Credits","next":"credits"}]},"wrongside":{"text":"The results of the budget hearing were ultimately in your favor. They diverted very little of the fossil fuel subsidies to renewables.\nBut it was a very temporary victory. The year after that, the subsidies were reallocated anyway.\nA change in administration, among other things. But ultimately, it was a losing battle. The public opinion was shifting. It was only a matter of time.\nAt the back of your mind, you think maybe, you could have been on the right side. But that time passed.\nAt least you got the money though, right?","options":[{"icon":"file-lines","text":"Credits","next":"credits"}]},"credits":{"text":"Website created by <a href=\"https://github.com/kfish610/text-adventure\">Kevin Fisher</a>.\nWriting and Research by Kevin Fisher, Leo Lee, and Kevin Xu.\nCCS information from <a href=\"https://doi.org/10.1016/j.scitotenv.2020.143203\">Wilberforce et al.</a>\nCost efficiency information from <a href=\"https://doi.org/10.1016/S1750-5836(07)00024-2\">Viebahn et al.</a>\nAlarm clock sound effect from <a href=\"https://www.youtube.com/watch?v=a0gnGkmF8Qk\">Sound Effect Master</a>.\nFlood image from <a href=\"https://www.fox7austin.com/news/historic-flooding-hits-mississippi-tennessee-with-more-drenching-rains-expected\">Fox 7 Austin</a>.\nClick sound from <a href=\"https://opengameart.org/content/click\">qubodup on OpenGameArt</a>.\nHelicopter sound effect from <a href=\"https://www.youtube.com/watch?v=2RtDgTm6rn4\">Olavo Junior</a>.\nTraffic sound effect from <a href=\"https://www.youtube.com/watch?v=D1lXPlg0sz0\">RoyaltyFreeSounds</a>.\nIcons from <a href=\"https://fontawesome.com/\">Font Awesome</a>.\n\nThank you for playing!","options":[]}}

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
        this.talked = false;
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
            if (option.if != undefined) {
                if (!this_1.talked) {
                    options.splice(i, 1);
                    step = options.length == 4 ? 6 : 12 / options.length;
                    i--;
                    return out_i_1 = i, "continue";
                }
            }
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
                if (scene == "talk") {
                    _this.talked = true;
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
            out_i_1 = i;
        };
        var this_1 = this, out_i_1;
        for (var i = 0; i < options.length; i++) {
            _loop_1(i);
            i = out_i_1;
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
        _this.end = false;
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
        if (this.lock || this.end)
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
            if (this.scene == "credits") {
                this.end = true;
                return;
            }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JDLE9BQU87S0FDVjtJQUVELElBQUksUUFBUSxJQUFJLElBQUksRUFBRTtRQUNsQixRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDZCxNQUFNLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDckMsT0FBTztLQUNWO1NBQU0sSUFBSSxRQUFRLElBQUksQ0FBQyxDQUFDLEVBQUU7UUFDdkIsSUFBSSxFQUFFLEdBQUcsSUFBSSxHQUFHLFFBQVEsQ0FBQztRQUV6QixPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDbkI7SUFFRCxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ2hCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9ub2RlX21vZHVsZXMvQHR2YW5jL2xpbmVjbGFtcC9kaXN0L2VzbS5qcyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdG9yeS5jc29uIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2F1ZGlvX21hbmFnZXIudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvYnViYmxlcy50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9idXR0b25zLnRzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlLy4vc3JjL2dhbWUudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGUudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvc3RhdGVfbWFuYWdlci50cyIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9zdGF0ZXMudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvLi9zcmMvdGVybWluYWwudHMiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3RleHQtYWR2ZW50dXJlL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vdGV4dC1hZHZlbnR1cmUvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly90ZXh0LWFkdmVudHVyZS8uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlZHVjZXMgZm9udCBzaXplIG9yIHRyaW1zIHRleHQgdG8gbWFrZSBpdCBmaXQgd2l0aGluIHNwZWNpZmllZCBib3VuZHMuXG4gKlxuICogU3VwcG9ydHMgY2xhbXBpbmcgYnkgbnVtYmVyIG9mIGxpbmVzIG9yIHRleHQgaGVpZ2h0LlxuICpcbiAqIEtub3duIGxpbWl0YXRpb25zOlxuICogMS4gQ2hhcmFjdGVycyB0aGF0IGRpc3RvcnQgbGluZSBoZWlnaHRzIChlbW9qaXMsIHphbGdvKSBtYXkgY2F1c2VcbiAqIHVuZXhwZWN0ZWQgcmVzdWx0cy5cbiAqIDIuIENhbGxpbmcge0BzZWUgaGFyZENsYW1wKCl9IHdpcGVzIGNoaWxkIGVsZW1lbnRzLiBGdXR1cmUgdXBkYXRlcyBtYXkgYWxsb3dcbiAqIGlubGluZSBjaGlsZCBlbGVtZW50cyB0byBiZSBwcmVzZXJ2ZWQuXG4gKlxuICogQHRvZG8gU3BsaXQgdGV4dCBtZXRyaWNzIGludG8gb3duIGxpYnJhcnlcbiAqIEB0b2RvIFRlc3Qgbm9uLUxUUiB0ZXh0XG4gKi9cbmNsYXNzIExpbmVDbGFtcCB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtZW50XG4gICAqIFRoZSBlbGVtZW50IHRvIGNsYW1wLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIE9wdGlvbnMgdG8gZ292ZXJuIGNsYW1waW5nIGJlaGF2aW9yLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4TGluZXNdXG4gICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBsaW5lcyB0byBhbGxvdy4gRGVmYXVsdHMgdG8gMS5cbiAgICogVG8gc2V0IGEgbWF4aW11bSBoZWlnaHQgaW5zdGVhZCwgdXNlIHtAc2VlIG9wdGlvbnMubWF4SGVpZ2h0fVxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4SGVpZ2h0XVxuICAgKiBUaGUgbWF4aW11bSBoZWlnaHQgKGluIHBpeGVscykgb2YgdGV4dCBpbiBhbiBlbGVtZW50LlxuICAgKiBUaGlzIG9wdGlvbiBpcyB1bmRlZmluZWQgYnkgZGVmYXVsdC4gT25jZSBzZXQsIGl0IHRha2VzIHByZWNlZGVuY2Ugb3ZlclxuICAgKiB7QHNlZSBvcHRpb25zLm1heExpbmVzfS4gTm90ZSB0aGF0IHRoaXMgYXBwbGllcyB0byB0aGUgaGVpZ2h0IG9mIHRoZSB0ZXh0LCBub3RcbiAgICogdGhlIGVsZW1lbnQgaXRzZWxmLiBSZXN0cmljdGluZyB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IGNhbiBiZSBhY2hpZXZlZFxuICAgKiB3aXRoIENTUyA8Y29kZT5tYXgtaGVpZ2h0PC9jb2RlPi5cbiAgICpcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy51c2VTb2Z0Q2xhbXBdXG4gICAqIElmIHRydWUsIHJlZHVjZSBmb250IHNpemUgKHNvZnQgY2xhbXApIHRvIGF0IGxlYXN0IHtAc2VlIG9wdGlvbnMubWluRm9udFNpemV9XG4gICAqIGJlZm9yZSByZXNvcnRpbmcgdG8gdHJpbW1pbmcgdGV4dC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaGFyZENsYW1wQXNGYWxsYmFja11cbiAgICogSWYgdHJ1ZSwgcmVzb3J0IHRvIGhhcmQgY2xhbXBpbmcgaWYgc29mdCBjbGFtcGluZyByZWFjaGVzIHRoZSBtaW5pbXVtIGZvbnQgc2l6ZVxuICAgKiBhbmQgc3RpbGwgZG9lc24ndCBmaXQgd2l0aGluIHRoZSBtYXggaGVpZ2h0IG9yIG51bWJlciBvZiBsaW5lcy5cbiAgICogRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmVsbGlwc2lzXVxuICAgKiBUaGUgY2hhcmFjdGVyIHdpdGggd2hpY2ggdG8gcmVwcmVzZW50IGNsaXBwZWQgdHJhaWxpbmcgdGV4dC5cbiAgICogVGhpcyBvcHRpb24gdGFrZXMgZWZmZWN0IHdoZW4gXCJoYXJkXCIgY2xhbXBpbmcgaXMgdXNlZC5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1pbkZvbnRTaXplXVxuICAgKiBUaGUgbG93ZXN0IGZvbnQgc2l6ZSwgaW4gcGl4ZWxzLCB0byB0cnkgYmVmb3JlIHJlc29ydGluZyB0byByZW1vdmluZ1xuICAgKiB0cmFpbGluZyB0ZXh0IChoYXJkIGNsYW1waW5nKS4gRGVmYXVsdHMgdG8gMS5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heEZvbnRTaXplXVxuICAgKiBUaGUgbWF4aW11bSBmb250IHNpemUgaW4gcGl4ZWxzLiBXZSdsbCBzdGFydCB3aXRoIHRoaXMgZm9udCBzaXplIHRoZW5cbiAgICogcmVkdWNlIHVudGlsIHRleHQgZml0cyBjb25zdHJhaW50cywgb3IgZm9udCBzaXplIGlzIGVxdWFsIHRvXG4gICAqIHtAc2VlIG9wdGlvbnMubWluRm9udFNpemV9LiBEZWZhdWx0cyB0byB0aGUgZWxlbWVudCdzIGluaXRpYWwgY29tcHV0ZWQgZm9udCBzaXplLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgZWxlbWVudCxcbiAgICB7XG4gICAgICBtYXhMaW5lcyA9IHVuZGVmaW5lZCxcbiAgICAgIG1heEhlaWdodCA9IHVuZGVmaW5lZCxcbiAgICAgIHVzZVNvZnRDbGFtcCA9IGZhbHNlLFxuICAgICAgaGFyZENsYW1wQXNGYWxsYmFjayA9IHRydWUsXG4gICAgICBtaW5Gb250U2l6ZSA9IDEsXG4gICAgICBtYXhGb250U2l6ZSA9IHVuZGVmaW5lZCxcbiAgICAgIGVsbGlwc2lzID0gXCLigKZcIixcbiAgICB9ID0ge31cbiAgKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwib3JpZ2luYWxXb3Jkc1wiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogZWxlbWVudC50ZXh0Q29udGVudC5tYXRjaCgvXFxTK1xccyovZykgfHwgW10sXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJ1cGRhdGVIYW5kbGVyXCIsIHtcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmFwcGx5KCksXG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJvYnNlcnZlclwiLCB7XG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogbmV3IE11dGF0aW9uT2JzZXJ2ZXIodGhpcy51cGRhdGVIYW5kbGVyKSxcbiAgICB9KTtcblxuICAgIGlmICh1bmRlZmluZWQgPT09IG1heEZvbnRTaXplKSB7XG4gICAgICBtYXhGb250U2l6ZSA9IHBhcnNlSW50KHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpLmZvbnRTaXplLCAxMCk7XG4gICAgfVxuXG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgICB0aGlzLm1heExpbmVzID0gbWF4TGluZXM7XG4gICAgdGhpcy5tYXhIZWlnaHQgPSBtYXhIZWlnaHQ7XG4gICAgdGhpcy51c2VTb2Z0Q2xhbXAgPSB1c2VTb2Z0Q2xhbXA7XG4gICAgdGhpcy5oYXJkQ2xhbXBBc0ZhbGxiYWNrID0gaGFyZENsYW1wQXNGYWxsYmFjaztcbiAgICB0aGlzLm1pbkZvbnRTaXplID0gbWluRm9udFNpemU7XG4gICAgdGhpcy5tYXhGb250U2l6ZSA9IG1heEZvbnRTaXplO1xuICAgIHRoaXMuZWxsaXBzaXMgPSBlbGxpcHNpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBHYXRoZXIgbWV0cmljcyBhYm91dCB0aGUgbGF5b3V0IG9mIHRoZSBlbGVtZW50J3MgdGV4dC5cbiAgICogVGhpcyBpcyBhIHNvbWV3aGF0IGV4cGVuc2l2ZSBvcGVyYXRpb24gLSBjYWxsIHdpdGggY2FyZS5cbiAgICpcbiAgICogQHJldHVybnMge1RleHRNZXRyaWNzfVxuICAgKiBMYXlvdXQgbWV0cmljcyBmb3IgdGhlIGNsYW1wZWQgZWxlbWVudCdzIHRleHQuXG4gICAqL1xuICBjYWxjdWxhdGVUZXh0TWV0cmljcygpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50O1xuICAgIGNvbnN0IGNsb25lID0gZWxlbWVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgY29uc3Qgc3R5bGUgPSBjbG9uZS5zdHlsZTtcblxuICAgIC8vIEFwcGVuZCwgZG9uJ3QgcmVwbGFjZVxuICAgIHN0eWxlLmNzc1RleHQgKz0gXCI7bWluLWhlaWdodDowIWltcG9ydGFudDttYXgtaGVpZ2h0Om5vbmUhaW1wb3J0YW50XCI7XG4gICAgZWxlbWVudC5yZXBsYWNlV2l0aChjbG9uZSk7XG5cbiAgICBjb25zdCBuYXR1cmFsSGVpZ2h0ID0gY2xvbmUub2Zmc2V0SGVpZ2h0O1xuXG4gICAgLy8gQ2xlYXIgdG8gbWVhc3VyZSBlbXB0eSBoZWlnaHQuIHRleHRDb250ZW50IGZhc3RlciB0aGFuIGlubmVySFRNTFxuICAgIGNsb25lLnRleHRDb250ZW50ID0gXCJcIjtcblxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dCA9IGNsb25lLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCB0ZXh0SGVpZ2h0ID0gbmF0dXJhbEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRob3V0VGV4dDtcblxuICAgIC8vIEZpbGwgZWxlbWVudCB3aXRoIHNpbmdsZSBub24tYnJlYWtpbmcgc3BhY2UgdG8gZmluZCBoZWlnaHQgb2Ygb25lIGxpbmVcbiAgICBjbG9uZS50ZXh0Q29udGVudCA9IFwiXFx4YTBcIjtcblxuICAgIC8vIEdldCBoZWlnaHQgb2YgZWxlbWVudCB3aXRoIG9ubHkgb25lIGxpbmUgb2YgdGV4dFxuICAgIGNvbnN0IG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZSA9IGNsb25lLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCBmaXJzdExpbmVIZWlnaHQgPSBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUgLSBuYXR1cmFsSGVpZ2h0V2l0aG91dFRleHQ7XG5cbiAgICAvLyBBZGQgbGluZSAoPGJyPiArIG5ic3ApLiBhcHBlbmRDaGlsZCgpIGZhc3RlciB0aGFuIGlubmVySFRNTFxuICAgIGNsb25lLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJiclwiKSk7XG4gICAgY2xvbmUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcXHhhMFwiKSk7XG5cbiAgICBjb25zdCBhZGRpdGlvbmFsTGluZUhlaWdodCA9IGNsb25lLm9mZnNldEhlaWdodCAtIG5hdHVyYWxIZWlnaHRXaXRoT25lTGluZTtcbiAgICBjb25zdCBsaW5lQ291bnQgPVxuICAgICAgMSArIChuYXR1cmFsSGVpZ2h0IC0gbmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lKSAvIGFkZGl0aW9uYWxMaW5lSGVpZ2h0O1xuXG4gICAgLy8gUmVzdG9yZSBvcmlnaW5hbCBjb250ZW50XG4gICAgY2xvbmUucmVwbGFjZVdpdGgoZWxlbWVudCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZWRlZiB7T2JqZWN0fSBUZXh0TWV0cmljc1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHt0ZXh0SGVpZ2h0fVxuICAgICAqIFRoZSB2ZXJ0aWNhbCBzcGFjZSByZXF1aXJlZCB0byBkaXNwbGF5IHRoZSBlbGVtZW50J3MgY3VycmVudCB0ZXh0LlxuICAgICAqIFRoaXMgaXMgPGVtPm5vdDwvZW0+IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIGFzIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQuXG4gICAgICogVGhpcyBudW1iZXIgbWF5IGV2ZW4gYmUgZ3JlYXRlciB0aGFuIHRoZSBlbGVtZW50J3MgaGVpZ2h0IGluIGNhc2VzXG4gICAgICogd2hlcmUgdGhlIHRleHQgb3ZlcmZsb3dzIHRoZSBlbGVtZW50J3MgYmxvY2sgYXhpcy5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7bmF0dXJhbEhlaWdodFdpdGhPbmVMaW5lfVxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgd2l0aCBvbmx5IG9uZSBsaW5lIG9mIHRleHQgYW5kIHdpdGhvdXRcbiAgICAgKiBtaW5pbXVtIG9yIG1heGltdW0gaGVpZ2h0cy4gVGhpcyBpbmZvcm1hdGlvbiBtYXkgYmUgaGVscGZ1bCB3aGVuXG4gICAgICogZGVhbGluZyB3aXRoIGlubGluZSBlbGVtZW50cyAoYW5kIHBvdGVudGlhbGx5IG90aGVyIHNjZW5hcmlvcyksIHdoZXJlXG4gICAgICogdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBkb2VzIG5vdCBpbmNyZWFzZSB0aGUgZWxlbWVudCdzIGhlaWdodC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7Zmlyc3RMaW5lSGVpZ2h0fVxuICAgICAqIFRoZSBoZWlnaHQgdGhhdCB0aGUgZmlyc3QgbGluZSBvZiB0ZXh0IGFkZHMgdG8gdGhlIGVsZW1lbnQsIGkuZS4sIHRoZVxuICAgICAqIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgaGVpZ2h0IG9mIHRoZSBlbGVtZW50IHdoaWxlIGVtcHR5IGFuZCB0aGUgaGVpZ2h0XG4gICAgICogb2YgdGhlIGVsZW1lbnQgd2hpbGUgaXQgY29udGFpbnMgb25lIGxpbmUgb2YgdGV4dC4gVGhpcyBudW1iZXIgbWF5IGJlXG4gICAgICogemVybyBmb3IgaW5saW5lIGVsZW1lbnRzIGJlY2F1c2UgdGhlIGZpcnN0IGxpbmUgb2YgdGV4dCBkb2VzIG5vdFxuICAgICAqIGluY3JlYXNlIHRoZSBoZWlnaHQgb2YgaW5saW5lIGVsZW1lbnRzLlxuXG4gICAgICogQHByb3BlcnR5IHthZGRpdGlvbmFsTGluZUhlaWdodH1cbiAgICAgKiBUaGUgaGVpZ2h0IHRoYXQgZWFjaCBsaW5lIG9mIHRleHQgYWZ0ZXIgdGhlIGZpcnN0IGFkZHMgdG8gdGhlIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkge2xpbmVDb3VudH1cbiAgICAgKiBUaGUgbnVtYmVyIG9mIGxpbmVzIG9mIHRleHQgdGhlIGVsZW1lbnQgY29udGFpbnMuXG4gICAgICovXG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHRIZWlnaHQsXG4gICAgICBuYXR1cmFsSGVpZ2h0V2l0aE9uZUxpbmUsXG4gICAgICBmaXJzdExpbmVIZWlnaHQsXG4gICAgICBhZGRpdGlvbmFsTGluZUhlaWdodCxcbiAgICAgIGxpbmVDb3VudCxcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2F0Y2ggZm9yIGNoYW5nZXMgdGhhdCBtYXkgYWZmZWN0IGxheW91dC4gUmVzcG9uZCBieSByZWNsYW1waW5nIGlmXG4gICAqIG5lY2Vzc2FyeS5cbiAgICovXG4gIHdhdGNoKCkge1xuICAgIGlmICghdGhpcy5fd2F0Y2hpbmcpIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMudXBkYXRlSGFuZGxlcik7XG5cbiAgICAgIC8vIE1pbmltdW0gcmVxdWlyZWQgdG8gZGV0ZWN0IGNoYW5nZXMgdG8gdGV4dCBub2RlcyxcbiAgICAgIC8vIGFuZCB3aG9sZXNhbGUgcmVwbGFjZW1lbnQgdmlhIGlubmVySFRNTFxuICAgICAgdGhpcy5vYnNlcnZlci5vYnNlcnZlKHRoaXMuZWxlbWVudCwge1xuICAgICAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlLFxuICAgICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fd2F0Y2hpbmcgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogU3RvcCB3YXRjaGluZyBmb3IgbGF5b3V0IGNoYW5nZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHtMaW5lQ2xhbXB9XG4gICAqL1xuICB1bndhdGNoKCkge1xuICAgIHRoaXMub2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMudXBkYXRlSGFuZGxlcik7XG5cbiAgICB0aGlzLl93YXRjaGluZyA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25kdWN0IGVpdGhlciBzb2Z0IGNsYW1waW5nIG9yIGhhcmQgY2xhbXBpbmcsIGFjY29yZGluZyB0byB0aGUgdmFsdWUgb2ZcbiAgICogcHJvcGVydHkge0BzZWUgTGluZUNsYW1wLnVzZVNvZnRDbGFtcH0uXG4gICAqL1xuICBhcHBseSgpIHtcbiAgICBpZiAodGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCkge1xuICAgICAgY29uc3QgcHJldmlvdXNseVdhdGNoaW5nID0gdGhpcy5fd2F0Y2hpbmc7XG5cbiAgICAgIC8vIElnbm9yZSBpbnRlcm5hbGx5IHN0YXJ0ZWQgbXV0YXRpb25zLCBsZXN0IHdlIHJlY3Vyc2UgaW50byBvYmxpdmlvblxuICAgICAgdGhpcy51bndhdGNoKCk7XG5cbiAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5qb2luKFwiXCIpO1xuXG4gICAgICBpZiAodGhpcy51c2VTb2Z0Q2xhbXApIHtcbiAgICAgICAgdGhpcy5zb2Z0Q2xhbXAoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaGFyZENsYW1wKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc3VtZSBvYnNlcnZhdGlvbiBpZiBwcmV2aW91c2x5IHdhdGNoaW5nXG4gICAgICBpZiAocHJldmlvdXNseVdhdGNoaW5nKSB7XG4gICAgICAgIHRoaXMud2F0Y2goZmFsc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogVHJpbXMgdGV4dCB1bnRpbCBpdCBmaXRzIHdpdGhpbiBjb25zdHJhaW50c1xuICAgKiAobWF4aW11bSBoZWlnaHQgb3IgbnVtYmVyIG9mIGxpbmVzKS5cbiAgICpcbiAgICogQHNlZSB7TGluZUNsYW1wLm1heExpbmVzfVxuICAgKiBAc2VlIHtMaW5lQ2xhbXAubWF4SGVpZ2h0fVxuICAgKi9cbiAgaGFyZENsYW1wKHNraXBDaGVjayA9IHRydWUpIHtcbiAgICBpZiAoc2tpcENoZWNrIHx8IHRoaXMuc2hvdWxkQ2xhbXAoKSkge1xuICAgICAgbGV0IGN1cnJlbnRUZXh0O1xuXG4gICAgICBmaW5kQm91bmRhcnkoXG4gICAgICAgIDEsXG4gICAgICAgIHRoaXMub3JpZ2luYWxXb3Jkcy5sZW5ndGgsXG4gICAgICAgICh2YWwpID0+IHtcbiAgICAgICAgICBjdXJyZW50VGV4dCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5zbGljZSgwLCB2YWwpLmpvaW4oXCIgXCIpO1xuICAgICAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IGN1cnJlbnRUZXh0O1xuXG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2hvdWxkQ2xhbXAoKVxuICAgICAgICB9LFxuICAgICAgICAodmFsLCBtaW4sIG1heCkgPT4ge1xuICAgICAgICAgIC8vIEFkZCBvbmUgbW9yZSB3b3JkIGlmIG5vdCBvbiBtYXhcbiAgICAgICAgICBpZiAodmFsID4gbWluKSB7XG4gICAgICAgICAgICBjdXJyZW50VGV4dCA9IHRoaXMub3JpZ2luYWxXb3Jkcy5zbGljZSgwLCBtYXgpLmpvaW4oXCIgXCIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRoZW4gdHJpbSBsZXR0ZXJzIHVudGlsIGl0IGZpdHNcbiAgICAgICAgICBkbyB7XG4gICAgICAgICAgICBjdXJyZW50VGV4dCA9IGN1cnJlbnRUZXh0LnNsaWNlKDAsIC0xKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9IGN1cnJlbnRUZXh0ICsgdGhpcy5lbGxpcHNpcztcbiAgICAgICAgICB9IHdoaWxlICh0aGlzLnNob3VsZENsYW1wKCkpXG5cbiAgICAgICAgICAvLyBCcm9hZGNhc3QgbW9yZSBzcGVjaWZpYyBoYXJkQ2xhbXAgZXZlbnQgZmlyc3RcbiAgICAgICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmhhcmRjbGFtcFwiKTtcbiAgICAgICAgICBlbWl0KHRoaXMsIFwibGluZWNsYW1wLmNsYW1wXCIpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogUmVkdWNlcyBmb250IHNpemUgdW50aWwgdGV4dCBmaXRzIHdpdGhpbiB0aGUgc3BlY2lmaWVkIGhlaWdodCBvciBudW1iZXIgb2ZcbiAgICogbGluZXMuIFJlc29ydHMgdG8gdXNpbmcge0BzZWUgaGFyZENsYW1wKCl9IGlmIHRleHQgc3RpbGwgZXhjZWVkcyBjbGFtcFxuICAgKiBwYXJhbWV0ZXJzLlxuICAgKi9cbiAgc29mdENsYW1wKCkge1xuICAgIGNvbnN0IHN0eWxlID0gdGhpcy5lbGVtZW50LnN0eWxlO1xuICAgIGNvbnN0IHN0YXJ0U2l6ZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemU7XG4gICAgc3R5bGUuZm9udFNpemUgPSBcIlwiO1xuXG4gICAgbGV0IGRvbmUgPSBmYWxzZTtcbiAgICBsZXQgc2hvdWxkQ2xhbXA7XG5cbiAgICBmaW5kQm91bmRhcnkoXG4gICAgICB0aGlzLm1pbkZvbnRTaXplLFxuICAgICAgdGhpcy5tYXhGb250U2l6ZSxcbiAgICAgICh2YWwpID0+IHtcbiAgICAgICAgc3R5bGUuZm9udFNpemUgPSB2YWwgKyBcInB4XCI7XG4gICAgICAgIHNob3VsZENsYW1wID0gdGhpcy5zaG91bGRDbGFtcCgpO1xuICAgICAgICByZXR1cm4gc2hvdWxkQ2xhbXBcbiAgICAgIH0sXG4gICAgICAodmFsLCBtaW4pID0+IHtcbiAgICAgICAgaWYgKHZhbCA+IG1pbikge1xuICAgICAgICAgIHN0eWxlLmZvbnRTaXplID0gbWluICsgXCJweFwiO1xuICAgICAgICAgIHNob3VsZENsYW1wID0gdGhpcy5zaG91bGRDbGFtcCgpO1xuICAgICAgICB9XG4gICAgICAgIGRvbmUgPSAhc2hvdWxkQ2xhbXA7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGNoYW5nZWQgPSBzdHlsZS5mb250U2l6ZSAhPT0gc3RhcnRTaXplO1xuXG4gICAgLy8gRW1pdCBzcGVjaWZpYyBzb2Z0Q2xhbXAgZXZlbnQgZmlyc3RcbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5zb2Z0Y2xhbXBcIik7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3QgZW1pdCBgbGluZWNsYW1wLmNsYW1wYCBldmVudCB0d2ljZS5cbiAgICBpZiAoIWRvbmUgJiYgdGhpcy5oYXJkQ2xhbXBBc0ZhbGxiYWNrKSB7XG4gICAgICB0aGlzLmhhcmRDbGFtcChmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChjaGFuZ2VkKSB7XG4gICAgICAvLyBoYXJkQ2xhbXAgZW1pdHMgYGxpbmVjbGFtcC5jbGFtcGAgdG9vLiBPbmx5IGVtaXQgZnJvbSBoZXJlIGlmIHdlJ3JlXG4gICAgICAvLyBub3QgYWxzbyBoYXJkIGNsYW1waW5nLlxuICAgICAgZW1pdCh0aGlzLCBcImxpbmVjbGFtcC5jbGFtcFwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKiBXaGV0aGVyIGhlaWdodCBvZiB0ZXh0IG9yIG51bWJlciBvZiBsaW5lcyBleGNlZWQgY29uc3RyYWludHMuXG4gICAqXG4gICAqIEBzZWUgTGluZUNsYW1wLm1heEhlaWdodFxuICAgKiBAc2VlIExpbmVDbGFtcC5tYXhMaW5lc1xuICAgKi9cbiAgc2hvdWxkQ2xhbXAoKSB7XG4gICAgY29uc3QgeyBsaW5lQ291bnQsIHRleHRIZWlnaHQgfSA9IHRoaXMuY2FsY3VsYXRlVGV4dE1ldHJpY3MoKTtcblxuICAgIGlmICh1bmRlZmluZWQgIT09IHRoaXMubWF4SGVpZ2h0ICYmIHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhMaW5lcykge1xuICAgICAgcmV0dXJuIHRleHRIZWlnaHQgPiB0aGlzLm1heEhlaWdodCB8fCBsaW5lQ291bnQgPiB0aGlzLm1heExpbmVzXG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdGhpcy5tYXhIZWlnaHQpIHtcbiAgICAgIHJldHVybiB0ZXh0SGVpZ2h0ID4gdGhpcy5tYXhIZWlnaHRcbiAgICB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB0aGlzLm1heExpbmVzKSB7XG4gICAgICByZXR1cm4gbGluZUNvdW50ID4gdGhpcy5tYXhMaW5lc1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwibWF4TGluZXMgb3IgbWF4SGVpZ2h0IG11c3QgYmUgc2V0IGJlZm9yZSBjYWxsaW5nIHNob3VsZENsYW1wKCkuXCJcbiAgICApXG4gIH1cbn1cblxuLyoqXG4gKiBQZXJmb3JtcyBhIGJpbmFyeSBzZWFyY2ggZm9yIHRoZSBtYXhpbXVtIHdob2xlIG51bWJlciBpbiBhIGNvbnRpZ291cyByYW5nZVxuICogd2hlcmUgYSBnaXZlbiB0ZXN0IGNhbGxiYWNrIHdpbGwgZ28gZnJvbSByZXR1cm5pbmcgdHJ1ZSB0byByZXR1cm5pbmcgZmFsc2UuXG4gKlxuICogU2luY2UgdGhpcyB1c2VzIGEgYmluYXJ5LXNlYXJjaCBhbGdvcml0aG0gdGhpcyBpcyBhbiBPKGxvZyBuKSBmdW5jdGlvbixcbiAqIHdoZXJlIG4gPSBtYXggLSBtaW4uXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1pblxuICogVGhlIGxvd2VyIGJvdW5kYXJ5IG9mIHRoZSByYW5nZS5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbWF4XG4gKiBUaGUgdXBwZXIgYm91bmRhcnkgb2YgdGhlIHJhbmdlLlxuICpcbiAqIEBwYXJhbSB0ZXN0XG4gKiBBIGNhbGxiYWNrIHRoYXQgcmVjZWl2ZXMgdGhlIGN1cnJlbnQgdmFsdWUgaW4gdGhlIHJhbmdlIGFuZCByZXR1cm5zIGEgdHJ1dGh5IG9yIGZhbHN5IHZhbHVlLlxuICpcbiAqIEBwYXJhbSBkb25lXG4gKiBBIGZ1bmN0aW9uIHRvIHBlcmZvcm0gd2hlbiBjb21wbGV0ZS4gUmVjZWl2ZXMgdGhlIGZvbGxvd2luZyBwYXJhbWV0ZXJzXG4gKiAtIGN1cnNvclxuICogLSBtYXhQYXNzaW5nVmFsdWVcbiAqIC0gbWluRmFpbGluZ1ZhbHVlXG4gKi9cbmZ1bmN0aW9uIGZpbmRCb3VuZGFyeShtaW4sIG1heCwgdGVzdCwgZG9uZSkge1xuICBsZXQgY3Vyc29yID0gbWF4O1xuICAvLyBzdGFydCBoYWxmd2F5IHRocm91Z2ggdGhlIHJhbmdlXG4gIHdoaWxlIChtYXggPiBtaW4pIHtcbiAgICBpZiAodGVzdChjdXJzb3IpKSB7XG4gICAgICBtYXggPSBjdXJzb3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1pbiA9IGN1cnNvcjtcbiAgICB9XG5cbiAgICBpZiAobWF4IC0gbWluID09PSAxKSB7XG4gICAgICBkb25lKGN1cnNvciwgbWluLCBtYXgpO1xuICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBjdXJzb3IgPSBNYXRoLnJvdW5kKChtaW4gKyBtYXgpIC8gMik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW1pdChpbnN0YW5jZSwgdHlwZSkge1xuICBpbnN0YW5jZS5lbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KHR5cGUpKTtcbn1cblxuZXhwb3J0IHsgTGluZUNsYW1wIGFzIGRlZmF1bHQgfTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1wiYmVnaW5cIjp7XCJ0ZXh0XCI6XCJbZGVsYXkgNTAwXUNvbm5lY3RpbmdbZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVtub3JtYWwgLl1bZGVsYXkgNzUwXVxcbltzb3VuZCBhbGFybS53YXZdPGVtPkJlZXA8L2VtPiBbZGVsYXkgMTAwMF08ZW0+QmVlcDwvZW0+IFtkZWxheSAxMDAwXTxlbT5CZWVwPC9lbT5bZGVsYXkgMTAwMF1cXG5bc291bmQgY2xpY2sud2F2XVlvdSB3YWtlIHVwIHNsb3dseSB0byB0aGUgc291bmQgb2YgeW91ciBhbGFybS5cXG5JdCBkcm9uZXMgb24gYW5kIG9uIHVudGlsIHlvdSB3YWtlIHVwIGVub3VnaCB0byB0dXJuIGl0IG9mZi5cXG5XaGF0IGRvIHlvdSBkbz9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwibmV3c3BhcGVyXCIsXCJ0ZXh0XCI6XCJDaGVjayB0aGUgbmV3c1wiLFwibmV4dFwiOlwiY2hlY2tOZXdzXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiR2V0IG91dCBvZiBiZWRcIixcIm5leHRcIjpcImdldFVwXCJ9XX0sXCJjaGVja05ld3NcIjp7XCJ0ZXh0XCI6XCJZb3UgZ3JhYiB5b3VyIEF1Z21lbnRlZCBSZWFsaXR5IGdsYXNzZXMgZnJvbSB5b3VyIG5pZ2h0c3RhbmQgYW5kIHB1dCB0aGVtIG9uLlxcbkFzIHlvdSBzY3JvbGwgc29tZXdoYXQgYWJzZW50bWluZGVkbHkgdGhyb3VnaCB0aGUgbmV3cywgb25lIHN0b3J5IGNhdGNoZXMgeW91ciBleWUuXFxuQW4gaW1hZ2Ugb2YgYSBmbG9vZGVkIHRvd24gb2ZmIG9mIHRoZSBNaXNzaXNpcHBpIFJpdmVyLlxcbk11cmt5IGJyb3duIHdhdGVyIGV2ZXJ5d2hlcmUsIHBhc3Qgd2Fpc3QgaGVpZ2h0LlxcbkNhcnMsIGJ1aWxkaW5ncywgYW5kIHRyZWVzIGJhcmVseSBhYm92ZSB0aGUgc3VyZmFjZS5cXG5baW1hZ2UgaHR0cHM6Ly9pbWFnZXMuZm94dHYuY29tL3N0YXRpYy5mb3g3YXVzdGluLmNvbS93d3cuZm94N2F1c3Rpbi5jb20vY29udGVudC91cGxvYWRzLzIwMjAvMDIvOTMyLzUyNC9GbG9vZGluZy1pbi1NSXNzaXNzaXBwaS0uanBnP3ZlPTEmdGw9MV1cXG5OYXR1cmUgaXMgYSBjcnVlbCBtaXN0cmVzcywgeW91IHRoaW5rLlxcbkJ1dCB0aGVuIGFnYWluLCB3ZSd2ZSBhbHdheXMgaGFkIHRvIGRlYWwgd2l0aCBuYXR1cmFsIGRpc2FzdGVycywgcmlnaHQ/XFxuV2VsbCwgdGhhdHMgZW5vdWdoIG9mIHRoZSBuZXdzIGZvciB0b2RheS4gVGhhdCBzdHVmZiBpcyBhbHdheXMganVzdCBkZXByZXNzaW5nLlwiLFwibG9vcFwiOlwiYmVnaW5cIn0sXCJnZXRVcFwiOntcInRleHRcIjpcIllvdSBnZXQgdXAgYW5kIGdldCByZWFkeSBmb3IgdGhlIGRheS5cXG5XaGVuIHlvdSBjb21lIGJhY2sgb3V0IG9mIHRoZSBiYXRocm9vbSwgeW91IG5vdGljZSB0d28gdGhpbmdzOlxcbjEuIEl0J3MgZnJlZXppbmcgaW4gaGVyZVxcbjIuIFlvdXIgcm9vbSBpcyBhIG1lc3NcIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiZmFuXCIsXCJ0ZXh0XCI6XCJUdXJuIG9mZiB0aGUgQS9DXCIsXCJuZXh0XCI6XCJ0dXJuT2ZmXCJ9LHtcImljb25cIjpcImZvbGRlclwiLFwidGV4dFwiOlwiQ2hlY2sgb3V0IHRoZSBtZXNzXCIsXCJuZXh0XCI6XCJtZXNzXCIsXCJyZXR1cm5cIjpcImNvbnRpbnVlXCJ9LHtcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiTGVhdmVcIixcIm5leHRcIjpcImxlYXZlXCJ9XX0sXCJ0dXJuT2ZmXCI6e1widGV4dFwiOlwiQXMgeW91IGdvIG92ZXIgdG8gdHVybiBvZmYgdGhlIGFpciBjb25kaXRpb25pbmcsIHlvdSB0YWtlIGEgbG9vayBvdXQgdGhlIHdpbmRvdy4gSnVzdCBhcyB5b3UgZXhwZWN0ZWQsIGl0cyBjbG91ZHkgYW5kIHJhaW55LiBUaGUgQS9DIG11c3QgaGF2ZSBiZWVuIG1ha2luZyB0aGUgdGVtcGVyYXR1cmUgZXZlbiBjb2xkZXIgdGhhbiBpdCBhbHJlYWR5IHdhcyBvdXRzaWRlLlxcbllvdSd2ZSBoYWQgaXQgdHVybmVkIGFsbCB0aGUgd2F5IHVwIGZvciB0aGUgcGFzdCBmZXcgd2Vla3MgZHVlIHRvIHRoZSBoZWF0d2F2ZS4gWW91J2QgYmVlbiB3b3JyaWVkIHRoYXQgaXQgd2Fzbid0IGdvaW5nIHRvIGVuZDogeW91IGhhZCBuZXZlciBzZWVuIGEgaGVhdHdhdmUgZ28gZm9yIHRoYXQgbG9uZyBvciB0aGF0IGhvdCBpbiB5b3VyIGxpZmUuIENsZWFybHkgaXQncyBvdmVyIG5vdywgdGhvdWdoLCBpZiB0aGUgdGVtcGVyYXR1cmUgaXMgYW55dGhpbmcgdG8gZ28gYnkuXFxuWW91IGFkanVzdCB0aGUgQS9DJ3Mgc2V0dGluZ3MgaW4gaXRzIGFwcCBvbiB5b3VyIEFSIGdsYXNzZXMuIE9uIHRvIG1vcmUgaW1wb3J0YW50IHRoaW5ncy5cIixcImxvb3BcIjpcImdldFVwXCJ9LFwibWVzc1wiOntcInRleHRcIjpcIllvdSBzcGVuZCBzbyBtdWNoIHRpbWUgYXQgd29yayBub3dhZGF5cyB0aGF0IHlvdXIgcm9vbSBpcyBwcmV0dHkgbWVzc3kuIEluIHRoZW9yeSwgYWxsIG9mIHlvdXIgbWF0ZXJpYWxzIHdvdWxkIGJlIGNvbnRhaW5lZCBpbiB0aGUgZm9sZGVyIG9uIHlvdXIgZGVzaywgYnV0IHlvdSBzcGVuZCBzbyBtdWNoIHRpbWUgcmVvcmdhbml6aW5nIGFuZCBhZGp1c3RpbmcgdGhhdCBpdCBhbGwgZW5kcyB1cCBzdHJld24gYWJvdXQuIFlvdSdkIHByb2JhYmx5IGJlIGJldHRlciBvZmYgdXNpbmcgdmlydHVhbCBkb2N1bWVudHMsIGJ1dCBzb21ldGhpbmcgYWJvdXQgZmVlbGluZyB0aGUgcGFwZXJzIGluIHlvdXIgaGFuZCBzdGlsbCBhcHBlYWxzIHRvIHlvdSBtb3JlIHRoYW4ganVzdCBzZWVpbmcgdGhlbS5cXG5Zb3UgcGljayB1cCB3aGF0IGZldyBwYXBlcnMgcmVtYWluIHRoZSBmb2xkZXIgYW5kIGZsaWNrIHRocm91Z2ggdGhlbS4gVGhleSdyZSB0aGUgdGhyZWUgc3R1ZGllcyB5b3UndmUgYmFzZWQgeW91ciBwcmVzZW50YXRpb24gb24uIFlvdSBzdGFyZSBhdCB0aGVtIGZvciBhIGxpdHRsZSwgcGVuc2l2ZWx5LiBZb3UnZCBhbHdheXMgd2FudGVkIHRvIGJlIHRoZSBvbmUgZG9pbmcgdGhlIHJlc2VhcmNoLiBUaGF0J3Mgd2h5IHlvdSB0b29rIHRoaXMgam9iOyBwcmVzZW50aW5nIHJlc2VhcmNoIHNlZW1lZCBsaWtlIGEgZ29vZCB3YXkgdG8gZ2V0IHNvbWUgY29ubmVjdGlvbnMsIG5vdCB0byBtZW50aW9uIHlvdSBuZWVkZWQgdGhlIG1vbmV5LiBCdXQgYXQgc29tZSBwb2ludCB5b3UgbG9zdCB0cmFjayBvZiB0aGF0IGdvYWwsIGFuZCBldmVuIHRob3VnaCB5b3UgY2FuIHByb2JhYmx5IGFmZm9yZCB0byBnbyBiYWNrIHRvIHNjaG9vbCBub3csIGJlaW5nIGEgcmVzZWFyY2hlciBmZWVscyBsaWtlIHNvbWVvbmUgZWxzZSdzIGRyZWFtLiBUaGUga2luZCBvZiB0aGluZyBhIGtpZCB0ZWxscyB0aGVtc2VsZiBiZWZvcmUgdGhleSd2ZSBiZWVuIGV4cG9zZWQgdG8gdGhlIHJlYWwgd29ybGQuXFxuVGhpcyBqb2IgaXMgZmluZS4gSXQgcGF5cyB3ZWxsLiA8Yj5JdCdzIGZpbmU8L2I+LlxcbkFueXdheSwgeW91IGhhdmUgdGhyZWUgc3R1ZGllcyBpbiB0aGUgZm9sZGVyLlxcbkRvIHlvdSB3YW50IHRvIHJldmlldyBhbnkgb2YgdGhlbSBiZWZvcmUgdGhlIGJpZyBoZWFyaW5nIGxhdGVyP1wiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJpbmR1c3RyeVwiLFwidGV4dFwiOlwiQ0NTIFN0dWR5XCIsXCJuZXh0XCI6XCJjY3NcIn0se1wiaWNvblwiOlwiZmlyZS1mbGFtZS1zaW1wbGVcIixcInRleHRcIjpcIkVmZmljaWVuY3kgU3R1ZHlcIixcIm5leHRcIjpcImVmZmljaWVuY3lcIn0se1wiaWNvblwiOlwiYXJyb3dzLXJvdGF0ZVwiLFwidGV4dFwiOlwiTGlmZWN5Y2xlIEFuYWx5c2lzXCIsXCJuZXh0XCI6XCJsY2FcIn0se1wiaWNvblwiOlwiYXJyb3ctdXAtZnJvbS1icmFja2V0XCIsXCJ0ZXh0XCI6XCJDb250aW51ZVwiLFwibmV4dFwiOlwiY29udGludWVcIn1dfSxcImNjc1wiOntcInRleHRcIjpcIlRoaXMgc3R1ZHkgaXMgYWJvdXQgQ0NTLCBDYXJib24gQ2FwdHVyZSBhbmQgU3RvcmFnZS4gSXQncyBhIHRlY2hub2xvZ3kgdGhhdCBzaWduaWZpY2FudGx5IHJlZHVjZXMgdGhlIGNhcmJvbiBlbWlzc2lvbnMgb2YgY29hbCBhbmQgbmF0dXJhbCBnYXMgcG93ZXIgcGxhbnRzLCBieSB1cCB0byA5MCUuIFNvIG9mIGNvdXJzZSwgdGhlIGZvc3NpbCBmdWVscyBjb3Jwb3JhdGlvbiB5b3Ugd29yayBmb3IgaXMgcHJldHR5IGludGVyZXN0ZWQgaW4gaXQgYXMgYSB3YXkgdG8ga2VlcCB0aGVpciBidXNpbmVzcy4uLiB1cCB0byBkYXRlIHdpdGggdGhlIHRpbWVzLiBUaGlzIHN0dWR5IGlzIGFuIG92ZXJ2aWV3IG9mIHBhc3QgYW5kIGN1cnJlbnQgcmVzZWFyY2ggaW50byBDQ1MgdGVjaG5vbG9naWVzLCBzb21lIG9mIHdoaWNoIHByb21pc2UgdG8gcmVkdWNlIGVtaXNzaW9ucyBieSB1cCB0byA5NSUgb3IgZXZlbiBtb3JlLiBJdCBhbHNvIGhhcyBzb21lIGxvdyBsZXZlbCBleHBsYW5hdGlvbnMgb2YgaG93IHRoZSB0ZWNobm9sb2d5IHdvcmtzLCBzdWNoIGFzIHNvbWUgZGlhZ3JhbXMgb2YgcG9zc2libGUgcHJvY2Vzc2VzLlxcbltpbWFnZSBodHRwczovL2Fycy5lbHMtY2RuLmNvbS9jb250ZW50L2ltYWdlLzEtczIuMC1TMDA0ODk2OTcyMDM2NzM0Ni1ncjEuanBnXVxcbk9mIGNvdXJzZSwgdGhlIGV4dHJhIHdvcmsgbmVlZGVkIHRvIGNhcHR1cmUgYW5kIHN0b3JlIHRoZSBjYXJib24gZGlveGlkZSBkb2VzIG1ha2UgdGhlIGNvc3Qgb2YgZWxlY3RyaWNpdHkgZm9yIENDUyBwbGFudHMgaGlnaGVyLCBhbmQgdGhlIHRlY2hub2xvZ3kgY2FuIG5ldmVyIHJlZHVjZSBlbWlzc2lvbnMgdG8gbmVhciB6ZXJvIGxpa2UgcmVuZXdhYmxlcy4gVGhlIHN0dWR5IGRvZXMgbm90ZSB0aGF0LCBidXQgeW91ciBzdXBlcnZpc29yIHNhaWQgbm90IHRvIGZvY3VzIG9uIHRoYXQgcGFydCBzbyBtdWNoLiBBZnRlciBhbGwsIGhvdyBtdWNoIGhhcm0gY291bGQganVzdCBhIGxpdHRsZSBtb3JlIGNhcmJvbiBkaW94aWRlIHJlYWxseSBkbz9cIixcImxvb3BcIjpcIm1lc3NcIn0sXCJlZmZpY2llbmN5XCI6e1widGV4dFwiOlwiVGhpcyBzdHVkeSBpcyBhbiBhbmFseXNpcyBvZiB0aGUgY29zdCBlZmZpY2llbmN5IG9mIHZhcmlvdXMgZm9zc2lsIGZ1ZWwgZW5lcmd5IHNvdXJjZXMgY29tcGFyZWQgdG8gcmVuZXdhYmxlIHNvdXJjZXMuIFRoZSBzdHVkeSBmb3VuZCB0aGF0IGFsbCB0b2dldGhlciwgcmVuZXdhYmxlcyBjb3N0IGFib3V0IDYtOCBjZW50cyBwZXIga2lsb3dhdHQtaG91ciAoa1doKSwgd2hpbGUgZm9zc2lsIGZ1ZWwgc291cmNlcyBsaWtlIGNvYWwgYW5kIG5hdHVyYWwgZ2FzIGNvc3QgYWJvdXQgNC01IGNlbnRzIHBlciBrV2gsIGRlcGVuZGluZyBvbiB0aGUgc291cmNlLiBZb3VyIHN1cGVydmlzb3Igd2FzIHZlcnkgaW5zaXN0ZW50IHlvdSBoaWdobGlnaHQgdGhhdCB3aGlsZSBhIDIgb3IgMyBjZW50IGRpZmZlcmVuY2UgbWF5IG5vdCBzZWVtIGxpa2UgbXVjaCwgaWYgeW91IG11bHRpcGx5IGl0IG92ZXIgdGhlIHdob2xlIHBvd2VyIGdyaWQsIGl0IHN0YXJ0cyB0byBhZGQgdXAuIEFuZCB5b3Ugc3VwcG9zZSB0aGF0IG1ha2VzIHNlbnNlOyBpZiB0aGUgZ292ZXJubWVudCBpcyBnb2luZyB0byBiZSBzdWJzaWRpemluZyBlbmVyZ3ksIGl0IG1pZ2h0IGFzIHdlbGwgZ2V0IHRoZSBtb3N0IG91dCBvZiBlYWNoIGRvbGxhci5cXG5UaGUgc3R1ZHksIGJlaW5nIGZ1bmRlZCBieSB0aGUgY29tcGFueSB5b3Ugd29yayBmb3IsIG5lZ2xlY3RzIHRvIG1lbnRpb24gdGhlIGNvc3QgaW5jcmVhc2VzIGZyb20gdGhlIHVzZSBvZiBDQ1MsIHdoaWNoIHlvdSd2ZSBiZWVuIHRvbGQgcmFpc2UgaXQgdXAgdG8gYWJvdXQgdGhlIHNhbWUgbGV2ZWxzIGFzIHJlbmV3YWJsZXMsIGlmIG5vdCBtb3JlLiBCdXQgeW91J3ZlIGJlZW4gYXNzdXJlZCB0aGF0IHlvdXIgY29tcGFueSBpcyB3b3JraW5nIGhhcmQgdG8gbWFrZSBDQ1MgY2hlYXBlciwgYW5kIG9uY2UgdGhleSBkbyB0aGF0IHRoZXknbGwgYmUgc3VyZSB0byBzd2l0Y2ggb3Zlci4gU28gdGhhdCBtYWtlcyB5b3UgZmVlbCBhIGxpdHRsZSBiZXR0ZXIuLi4geW91IHRoaW5rLiBVbnRpbCB0aGVuIHRob3VnaCB0aGUgY29tcGFueSBpcyBzdGlsbCBpbnRlbmRpbmcgdG8gZm9jdXMgb24gbm9uLUNDUyBwbGFudHMuIFlvdSB3b24ndCBiZSBtZW50aW9uaW5nIHRoYXQgZWl0aGVyLlwiLFwibG9vcFwiOlwibWVzc1wifSxcImxjYVwiOntcInRleHRcIjpcIlRoaXMgc3R1ZHkgeW91J3JlIG5vdCBzdXBwb3NlZCB0byBoYXZlLiBZb3VyIHN1cGVydmlzb3IgaGFkIGJlZW4gbWFraW5nIGEgYmlnIGZ1c3MgYWJvdXQgc29tZSBuZXcgbGlmZWN5Y2xlIGFuYWx5c2lzIHRoYXQgd291bGQgc2hvdyBmb3NzaWwgZnVlbHMgd2VyZW4ndCBhcyBiYWQgYXMgZXZlcnlvbmUgdGhvdWdodCwgYnV0IGEgY291cGxlIG9mIG1vbnRocyBsYXRlciB0aGV5IGhhZCBqdXN0IHN0b3BwZWQgdGFsa2luZyBhYm91dCBpdC4gU28geW91IGRpZCBhIGxpdHRsZSBkaWdnaW5nLCBmb3VuZCB0aGUgcmVzZWFyY2hlcnMgd2hvIGRpZCB0aGUgc3R1ZHksIGFuZCBhc2tlZCB0aGVtIGZvciBhIGNvcHkuXFxuT25jZSB0aGV5IHNlbnQgaXQgdG8geW91LCB5b3UgcXVpY2tseSByZWFsaXplZCB3aHkgeW91IGhhZG4ndCBoZWFyZCBhbnkgbW9yZSBhYm91dCBpdC4gUmF0aGVyIHRoYW4gZmluZCBldmlkZW5jZSB0aGF0IGZvc3NpbCBmdWVscyB3ZXJlbid0IGFzIGRlc3RydWN0aXZlIGFzIHBlb3BsZSB0aG91Z2h0LCB0aGV5IGFjdHVhbGx5IGZvdW5kIGV2aWRlbmNlIHRoYXQgY2VydGFpbiBhc3BlY3RzIG9mIHRoZSBwcm9jZXNzIHdlcmUgbW9yZSBkZXN0cnVjdGl2ZSB0aGFuIGluaXRpYWxseSB0aG91Z2h0LlxcbllvdSdyZSBub3Qgc3VyZSB3aHkgeW91IGtlcHQgdGhlIHN0dWR5LiBZb3UgY2VydGFpbmx5IGFyZW4ndCBnb2luZyB0byB1c2UgaXQgYXQgdG9kYXkncyBoZWFyaW5nLCB0aGF0IHdvdWxkIGJlLi4uIGJhZCBmb3IgeW91ciBqb2Igc2VjdXJpdHksIHRvIHNheSB0aGUgbGVhc3QuIEJ1dCBzb21ldGhpbmcgYWJvdXQgaXQga2VlcHMgbmFnZ2luZyBhdCB5b3UuIE1heWJlIGl0J3MgdGhlIGVub3JtaXR5IG9mIGl0IGFsbC4gWW91IGtub3cgYWJvdXQgY2xpbWF0ZSBjaGFuZ2XigJRpdCdzIGhhcmQgdG8gaWdub3JlIGl0IHdpdGggYWxsIHRoZSBwcm90ZXN0cyB0aGF0IGhhdmUgYmVlbiBnb2luZyBvbiByZWNlbnRseeKAlGJ1dCBhcyBmYXIgYXMgeW91IGNhbiB0ZWxsLCBldmVyeXRoaW5nIHNlZW1zIHRvIGJlIGZpbmUuIFN1cmUsIHRoZXJlJ3MgYmVlbiBhIGxvdCBvZiBmbG9vZHMgaW4gc29tZSBvdGhlciBzdGF0ZXMgcmVjZW50bHksIGFuZCB0aGVyZSdzIGRlZmluaXRlbHkgYmVlbiBhIGxvdCBvZiBoZWF0d2F2ZXMgaGVyZSBpbiBUZXhhcywgYnV0IG5vbmUgb2YgaXQgc2VlbXMgdGhhdCBiYWQuIEJ1dCBzZWVpbmcgdGhlIHNoZWVyIGFtb3VudCBvZiBjYXJib24gYmVpbmcgZW1pdHRlZCwgdG9nZXRoZXIgd2l0aCByZWZlcmVuY2VzIHRvIHRoZSBkaXJlY3QgYW5kIGluZGlyZWN0IGVmZmVjdHMsIGV2ZW4gaW4gYSBmb3NzaWwgZnVlbCBmdW5kZWQgc3R1ZHk7IGl0IG1ha2VzIHlvdSB1bmNvbWZvcnRhYmxlLCB0byBzYXkgdGhlIGxlYXN0LlxcbllvdSBwdXQgdGhlIHN0dWR5IGJhY2sgaW4gdGhlIGZvbGRlci4gWW91IHNob3VsZG4ndCBiZSBkaXN0cmFjdGluZyB5b3Vyc2VsZiB3aXRoIHRoYXQgdG9kYXkuIFRoaXMgaXMgcG9zc2libHkgdGhlIGJpZ2dlc3QgaGVhcmluZyBvZiB5b3VyIGNhcmVlci4gSWYgeW91IG1lc3MgdGhpcyB1cCwgaXQnbGwgbWVhbiB0aGUgbWFqb3JpdHkgb2YgZm9zc2lsIGZ1ZWwgc3Vic2lkaWVzIHdpbGwgYmUgZGl2ZXJ0ZWQgdG8gcmVuZXdhYmxlIGVuZXJneSwgYW5kIGxlc3MgbW9uZXkgZm9yIHlvdXIgZW1wbG95ZXIgbWVhbnMgbGVzcyBtb25leSBmb3IgeW91LiBObyBtaXN0YWtlcyB0b2RheS5cIixcImxvb3BcIjpcIm1lc3NcIn0sXCJjb250aW51ZVwiOntcInRleHRcIjpcIllvdSB0dXJuIHlvdXIgYXR0ZW50aW9uIHRvIHRoZSByZXN0IG9mIHRoZSByb29tLlwiLFwibG9vcFwiOlwiZ2V0VXBcIn0sXCJsZWF2ZVwiOntcInRleHRcIjpcIllvdSdyZSBhIGJpdCBlYXJseSwgYnV0IHlvdSBkZWNpZGUgeW91IG1pZ2h0IGFzIHdlbGwgaGVhZCB0byB0aGUgdmlydHVhbCBjb25mZXJlbmNlIGNlbnRlciBhbHJlYWR5LiBJdCdzIGEgYml0IG9mIGEgcGFpbiBoYXZpbmcgdG8gZ28gc29tZXdoZXJlIGp1c3QgdG8gaGF2ZSBhIGJldHRlciB2aWRlbyBjYXB0dXJlLCBidXQgeW91IHdhbnQgdG8gbG9vayB5b3VyIGJlc3QuIEF0IGxlYXN0IGl0cyBiZXR0ZXIgdGhhbiBoYXZpbmcgdG8gZmx5IHRvIEQuQy4gdG8gYXR0ZW5kIHRoZSBoZWFyaW5nOiB5b3Uga25vdyBzb21lIHBlb3BsZSBhdCB5b3VyIGNvbXBhbnkgd2hvIGhhdmUgYmVlbiBsb2JieWluZyBhIHdob2xlIGxvdCBsb25nZXIgdGhhbiB5b3UsIGFuZCB0aGV5IHdvbid0IHN0b3AgdGFsa2luZyBhYm91dCBob3cgbXVjaCBvZiBhIHBhaW4gdGhlIGJ1c2luZXNzIHRyaXBzIHVzZWQgdG8gYmUuXFxuT2YgY291cnNlLCB5b3UgZG9uJ3QgaGF2ZSBhIGNhcjsgZ2FzIGlzIG1vcmUgZXhwZW5zaXZlIHRoYW4gZXZlciwgYW5kIGRyaXZpbmcgaXMgYmVjb21pbmcgaW5jcmVhc2luZ2x5IHVuZmFzaGlvbmFibGUgbm93YWRheXMuIFlvdSBjb3VsZCB0YWtlIHRoZSBidXMsIGJ1dCB5b3UnZCBsaWtlIHNvbWUgcHJpdmFjeSB3aGlsZSB5b3UgcHJlcGFyZSB5b3Vyc2VsZiwgc28geW91IGNhbGwgYSB0YXhpIGluc3RlYWQuIFN0aWxsLCB5b3UncmUgZmFjZWQgd2l0aCBhIGNob2ljZTogbm9ybWFsIGNhciwgb3IgZmx5aW5nIGNhcj9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiY2FyXCIsXCJ0ZXh0XCI6XCJOb3JtYWwgQ2FyXCIsXCJuZXh0XCI6XCJub3JtYWxDYXJcIn0se1wiaWNvblwiOlwicGxhbmVcIixcInRleHRcIjpcIkZseWluZyBDYXJcIixcIm5leHRcIjpcImZseWluZ0NhclwifV19LFwibm9ybWFsQ2FyXCI6e1widGV4dFwiOlwiRGVzcGl0ZSB0aGUgbm92ZWx0eSBvZiBhIGZseWluZyBjYXIsIGEgc3RhbmRhcmQgY2FyIGlzIHByb2JhYmx5IHRoZSBtb3JlIHJlYXNvbmFibGUgb3B0aW9uLiBJdCdzIGNlcnRhaW5seSB0aGUgbW9zdCBlY29ub21pY2FsIG9wdGlvbiwgdGhvdWdoIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGhlbSBoYXMgYmVlbiBnZXR0aW5nIHN1cnByaXNpbmdseSBzbWFsbCwgYWxsIGNvbnNpZGVyZWQuIFRoZSBjYXIgYXJyaXZlcyZtZGFzaDt0aGUgZGVjcmVhc2Ugb2YgaHVtYW4gZHJpdmVycyBoYXMgbWFkZSB0cmFmZmljIGFsbW9zdCBhIHRoaW5nIG9mIHRoZSBwYXN0IGF0IHRoaXMgcG9pbnQmbWRhc2g7YW5kIHlvdSBnZXQgaW4uXFxuW2JhY2tncm91bmQgdHJhZmZpYy5tcDNdQXMgdGhlIGNhciBkcml2ZXMgb2ZmLCB5b3UgbG9vayBvdXQgdGhlIHdpbmRvdy4gWW91IHNlZSBhIGxvdCBvZiBidXNpbmVzc2VzLCBidXQgd2VpcmRseSwgbW9zdCBvZiB0aGVtIHNlZW0gZW1wdHkuIFRoZW4geW91IHJlYWxpemUgd2h5LiBPbiBuZWFybHkgZXZlcnkgYnVpbGRpbmcsIHRoZXJlJ3MgYW4gQVIgZmx5ZXIgYXR0YWNoZWQgdG8gaXQsIHdpdGggc29tZXRoaW5nIGFsb25nIHRoZSBsaW5lcyBvZiBcXFwibm93IGhpcmluZ1xcXCIuIFlvdSdkIHNlZW4gYSBwaWVjZSBpbiB0aGUgbmV3cyByZWNlbnRseSBhYm91dCBob3cgbG93LXdhZ2Ugd29ya2VycyB3ZXJlIGdldHRpbmcgaGl0IGhhcmQgYnkgaGVhdCBzdHJlc3MgaW4gdGhlIHJlY2VudCBzdHJpbmcgb2YgaGVhdHdhdmVzLiBUaGUgYWlyIGNvbmRpdGlvbmVycyB3ZXJlbid0IHVwIHRvIHRoZSB0YXNrIG9mIHRoZSB3ZWVrcyBvZiBoZWF0d2F2ZS4gQnV0IHlvdSBoYWQgYXNzdW1lZCBpdCB3YXMganVzdCBhIGNvdXBsZSBvZiBwZW9wbGUgdGhhdCB3ZXJlIGVmZmVjdGVkLiBUaGlzIGRvZXNuJ3QgcmVhbGx5IHNlZW0gbGlrZSBqdXN0IGEgY291cGxlIG9mIHBlb3BsZSwgdGhvdWdoLlxcbkJ1dCB5b3UncmUgc3VyZSB0aGlzIGlzIGp1c3QgYSB0ZW1wb3JhcnkgdGhpbmcuIEl0J3MgYSBvbmNlIGluIGEgbGlmZXRpbWUgaGVhdHdhdmUsIGFmdGVyIGFsbC4gVGhlbiBhZ2FpbiwgeW91J2Qgc2VlbiBvbiB0aGUgd2VhdGhlciBmb3JlY2FzdCB0aGF0IHRlbXBlcmF0dXJlcyB3ZXJlIHN1cHBvc2VkIHRvIGdvIGJhY2sgdXAgdGhlIHJlc3Qgb2YgdGhpcyB3ZWVrLCBhbmQgdGhhdCB0b2RheSBpcyBqdXN0IGFuIG91dGxpZXIuIEJ1dC4uLiB0aGV5J3JlIHByb2JhYmx5IGp1c3QgbWlzc2luZyBzb21ldGhpbmcuIFlvdSdyZSBzdXJlIHRoaW5ncyB3aWxsIGdvIGJhY2sgdG8gbm9ybWFsIHNvb24uIFByb2JhYmx5LlxcbllvdSdyZSBzaGFrZW4gb3V0IG9mIHlvdXIgdGhvdWdodHMgYnkgdGhlIGNhciBzbG93aW5nIGRvd24gYW5kIHN0b3BwaW5nLiBZb3UncmUgaGVyZS5cXG5UaW1lIHRvIGdvIGluc2lkZSBhbmQgZ2V0IHJlYWR5IGZvciB0aGUgaGVhcmluZy5cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiYXJyb3ctdXAtZnJvbS1icmFja2V0XCIsXCJ0ZXh0XCI6XCJFbnRlclwiLFwibmV4dFwiOlwiZW50ZXJcIn1dfSxcImZseWluZ0NhclwiOntcInRleHRcIjpcIllvdSBkZWNpZGUgb24gdGhlIGZseWluZyBjYXIuIFlvdSBjYW4gc3BlbmQgYSBsaXR0bGUgZXh0cmEganVzdCBmb3IgdG9kYXk7IGl0IGlzIGFuIGltcG9ydGFudCBkYXkgYWZ0ZXIgYWxsLiBQbHVzLCBpdCdsbCBnZXQgeW91IHRoZXJlIGZhc3Rlci4gQW5kIHRoZSB2aWV3cyBhcmUgbXVjaCBuaWNlci4gWW91IHdhaXQgYSBtaW51dGUsIGFuZCB0aGVuIGhlYXIgdGhlIHdoaXJyaW5nIG9mIHRoZSByb3RvcnMgb24gdGhlIGNhci4gVG8gYmUgaG9uZXN0IHlvdSBoYWQgYWx3YXlzIGltYWdpbmVkIGZseWluZyBjYXJzIGFzIGZsb2F0aW5nLCBvciBtYXliZSB3aXRoIHdpbmdzIGxpa2UgYW4gYWlycGxhbmUuIEJ1dCB5b3Ugc3VwcG9zZSB0ZWNobm9sb2d5IGlzIHJhcmVseSBleGFjdGx5IHdoYXQgd2UgZXhwZWN0IGl0IHRvIGJlLiBZb3UgZ2V0IGluIHRoZSBjYXIsIGFuZCBpdCB0YWtlcyBvZmYuXFxuW2JhY2tncm91bmQgZmx5aW5nLm1wM11Zb3UgbG9vayBvdXQgdGhlIHdpbmRvdyBhcyB0aGUgZ3JvdW5kIGRyaWZ0cyBmdXJ0aGVyIGZyb20geW91LiBZb3UncmUgbm90IHN1cmUgeW91J2xsIGV2ZXIgZ2V0IHVzZWQgdG8gdGhhdC4gU3RpbGwsIGl0J3MgYSBuaWNlIHZpZXcuIFVuZm9ydHVuYXRlbHksIHlvdXIgdmlldyBpcyBvY2Nhc2lvbmFsbHkgYmxvY2tlZCBieSBhbiBhZHZlcnRpc2VtZW50LiBJdCdzIG5vdCBleGFjdGx5IHN1cnByaXNpbmcgdGhhdCB0aGV5J3JlIGFsbCBvdmVyIHRoZSBza3k7IHdlIHB1dCBiaWxsYm9hcmRzIGV2ZXJ5d2hlcmUgb24gaGlnaHdheXMuIEJ1dCBpdCB3b3VsZCBoYXZlIGJlZW4gbmljZSB0byBsZWF2ZSB0aGlzIHNpZ2h0IHVuYmxlbWlzaGVkLiBBdCBsZWFzdCB0aGV5J3JlIG5vdCBwaHlzaWNhbGx5IGluIHRoZSBhaXIsIG9ubHkgdmlzaWJsZSBpbiB5b3VyIEFSIGdsYXNzZXMuIEluIGZhY3QsIHVzdWFsbHkgeW91J2QganVzdCB0YWtlIHRoZW0gb2ZmLCBidXQgeW91IGhhdmUgdG8gYmUgd2F0Y2hpbmcgZm9yIG1lc3NhZ2VzIGZyb20geW91ciBjb21wYW55LCBqdXN0IGluIGNhc2UuIFNvIHlvdSdyZSBnb2luZyB0byBoYXZlIHRvIGRlYWwgd2l0aCB0aGUgb2NjYXNpb25hbCBhZCBkcmlmdGluZyBpbnRvIHZpZXcuXFxuT25lIGluIHBhcnRpY3VsYXIgY2F0Y2hlcyB5b3VyIGV5ZS4gQXQgZmlyc3QsIGl0IGp1c3QgbG9va2VkIGxpa2UgYSBjbG91ZCBvZiBzbW9rZSwgYnV0IHRoZW4geW91IHNlZSBpdCByZWZvcm0gaW4gdGhlIGxldHRlcnMgXFxcIkRFQ0FSQk9OSVpFXFxcIi4gV2VsbCwgaXQncyBhbiBpbXByZXNzaXZlIHJlbmRlcmluZywgeW91J2xsIGdpdmUgdGhlbSB0aGF0LiBUaGUgc21va2UgdGhlbiBjb250aW51ZXMgdG8gcmVmb3JtIGludG8gZGlmZmVyZW50IHdvcmRzIGFuZCBzZW50ZW5jZXMuXFxuXFxcIkRvIHlvdSByZWFsbHkgd2FudCB0aGlzIGluIHlvdXIgYWlyP1xcXCJbZGVsYXkgMTAwMF1cXG5cXFwiV2UncmUgYXQgYSB0aXBwaW5nIHBvaW50XFxcIltkZWxheSAxMDAwXVxcblxcXCJUaGVyZSBpcyBubyBFYXJ0aCAyXFxcIltkZWxheSAxMDAwXVxcblxcXCJUaGVyZSdzIHN0aWxsIHRpbWUgdG8gZml4IHRoaXNcXFwiW2RlbGF5IDEwMDBdXFxuXFxcIlplcm8gY2FyYm9uIGJ5IDIxMDBcXFwiW2RlbGF5IDEwMDBdXFxuSXQgdGhlbiBsaW5rcyB0byBhIHdlYnNpdGUsIHdoaWNoIHlvdSBxdWlja2x5IHdhdmUgYXdheS4gWW91IHNjb2ZmLiBaZXJvIGNhcmJvbj8gVGhlcmUncyBubyB3YXkgd2UgY291bGQgZG8gdGhhdCwgcmlnaHQ/IEFuZCBldmVuIGlmIHdlIGNvdWxkLCBjYXJib24gZGlveGlkZSBpc24ndCA8ZW0+dGhhdDwvZW0+IGJhZC4gUmlnaHQ/IFRoZSBsaWZlY3ljbGUgYW5hbHlzaXMgaW4geW91ciBmb2xkZXIgbmFncyBhdCB5b3UuLi4gYnV0IHlvdSBwdXNoIHRoZSB0aG91Z2h0IGF3YXkuIEZvY3VzLiBZb3VyIHN1cGVydmlzb3IgdG9sZCB5b3Ugbm90IHRvIHdvcnJ5IGFib3V0IHRoZSBlbnZpcm9ubWVudGFsIGltcGFjdHMgc28gbXVjaC4gU28gaXQncyBwcm9iYWJseSBmaW5lLlxcbllvdSdyZSBzaGFrZW4gb3V0IG9mIHlvdXIgdGhvdWdodHMgYnkgdGhlIGNhciBsYW5kaW5nLiBZb3UncmUgaGVyZS5cXG5UaW1lIHRvIGdvIGluc2lkZSBhbmQgZ2V0IHJlYWR5IGZvciB0aGUgaGVhcmluZy5cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiYXJyb3ctdXAtZnJvbS1icmFja2V0XCIsXCJ0ZXh0XCI6XCJFbnRlclwiLFwibmV4dFwiOlwiZW50ZXJcIn1dfSxcImVudGVyXCI6e1widGV4dFwiOlwiWW91IGVudGVyIHRoZSBidWlsZGluZy4gVGhlcmUncyBhIHNtYWxsIHJlY2VwdGlvbiBhcmVhLCB3aGVyZSB5b3UgcHV0IHlvdXIgbmFtZSBpbiBhbmQgYXNrIGlmIHlvdXIgcm9vbSBpcyByZWFkeS4gQnV0IGFwcGFyZW50bHkgaXQncyBzdGlsbCBiZWluZyB1c2VkIGZvciBhIGZldyBtb3JlIG1pbnV0ZXMsIHNvIHlvdSBzaXQgZG93bi4gQW5kIHRoZW4geW91IHNlZSB0aGVtLiBBIGZhY2UgeW91IHJlY29nbml6ZS4uLiB1bmZvcnR1bmF0ZWx5LiBUaGV5J3JlIGEgbG9iYnlpc3QgdG9vLCBidXQgZm9yIGEgY2xpbWF0ZSBjaGFuZ2UgYWN0aXZpc20gZ3JvdXAsIGFuZCB0aGV5J3JlIGdvaW5nIHRvIHRoZSBzYW1lIGhlYXJpbmcgYXMgeW91LiBTbWFsbCB3b3JsZC5cXG5UaGVyZSdzIG9ubHkgYSBjb3VwbGUgb2YgY2hhaXJzIGluIHRoZSB3YWl0aW5nIHJvb20sIHNvIHlvdSBzaXQgZG93biBjbG9zZXIgdGhhbiB5b3UnZCBsaWtlIHRvIHRoZW0uIFRoZXkga2VlcCBzdGVhbGluZyBnbGFuY2VzIGF0IHlvdSwgYW5kIHlvdSdyZSBwcmV0dHkgc3VyZSB0aGV5IGtub3cgd2hvIHlvdSBhcmUgdG9vLiBEbyB5b3Ugd2FudCB0byB0YWxrIHRvIHRoZW0/IE9yIGp1c3Qga2VlcCBzaXR0aW5nIGZvciBhIGZldyBtaW51dGVzP1wiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJjb21tZW50XCIsXCJ0ZXh0XCI6XCJUYWxrIHRvIHRoZW1cIixcIm5leHRcIjpcInRhbGtcIn0se1wiaWNvblwiOlwiY2hhaXJcIixcInRleHRcIjpcIlNpdCBhd2t3YXJkbHlcIixcIm5leHRcIjpcInNpdFwifV19LFwic2l0XCI6e1widGV4dFwiOlwiWW91IGtlZXAgc2l0dGluZy4gWW91IHdvdWxkbid0IHdhbnQgdG8gdGFsayB0byB0aGVtIGFueXdheS4gWW91J3JlIHN1cmUgdGhleSdkIGJlIHN1cGVyIGJvcmluZy5cXG5bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dW2RlbGF5IDc1MF1bbm9ybWFsIC5dXFxuW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVtkZWxheSA3NTBdW25vcm1hbCAuXVxcbkZpbmFsbHksIHlvdXIgcm9vbSBpcyByZWFkeS4gVGltZSBmb3IgdGhlIGhlYXJpbmcuIFlvdSB0YWtlIGEgZGVlcCBicmVhdGgsIGFuZCBnZXQgdXAuXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiQXR0ZW5kIHRoZSBoZWFyaW5nXCIsXCJuZXh0XCI6XCJhdHRlbmRcIn1dfSxcInRhbGtcIjp7XCJ0ZXh0XCI6XCJZb3UgZGVjaWRlIHlvdSBtaWdodCBhcyB3ZWxsIGZpbGwgdGhlIHRpbWUgd2l0aCBhIGxpdHRsZSBjb252ZXJzYXRpb24uIEF0IHdvcnN0LCBtYXliZSB5b3UnbGwga25vdyBhIGJpdCBtb3JlIGFib3V0IGhvdyB0aGV5J3JlIGdvaW5nIHRvIHJlc3BvbmQgdG8geW91LlxcblxcXCJTby4uLiBob3cgYWJvdXQgdGhhdCB3ZWF0aGVyIHRvZGF5PyBDcmF6eSBob3cgaXQgY2hhbmdlZCBzbyBmYXN0LlxcXCIgeW91IHNheS5bZGVsYXkgMTAwMF1cXG5UaGV5IGxvb2sgYXQgeW91IGZvciBhIHNlY29uZCwgdGhlbiBzaGFrZSB0aGVpciBoZWFkLiBcXFwiQXMgaWYgeW91IGNhcmUuIFlvdSdyZSBwcm9iYWJseSBnb2luZyB0byB1c2UgaXQgYXMgYW4gZXhjdXNlIHRvIHByZXRlbmQgY2xpbWF0ZSBjaGFuZ2UgaXNuJ3QgaGFwcGVuaW5nLiBJIGtub3cgeW91ciB0eXBlLiBZb3UncmUganVzdCBpbiB0aGlzIGZvciB0aGUgbW9uZXkuXFxcIltkZWxheSAxMDAwXVxcbllvdSB3ZXJlbid0IGV4cGVjdGluZyB0aGF0LiBcXFwiSGV5LCBJJ20ganVzdCB0cnlpbmcgdG8gbWFrZSBjb252ZXJzYXRpb24mbWRhc2g7XFxcIltkZWxheSAxMDAwXVxcblxcXCJTdXJlLCBhbmQgSSdtIGp1c3QgdHJ5aW5nIHRvIHByZXZlbnQgdGhlIHdvcmxkIGZyb20gYnVybmluZy4gSSBtZWFuLCB5b3UndmUgc2VlbiB0aGUgaGVhdHdhdmUgdGhlc2UgcGFzdCBmZXcgd2Vla3MuIFlvdSByZWFsbHkgdGhpbmsgZXZlcnl0aGluZyBpcyBvaz9cXFwiW2RlbGF5IDEwMDBdXFxuVGhpcyBjb252ZXJzYXRpb24gaXMuLi4gbm90IGdvaW5nIGhvdyB5b3UgZXhwZWN0ZWQuIFxcXCJZZWFoIHRoZSBoZWF0d2F2ZSBpcy4uLltkZWxheSA1MDBdIHdlaXJkLiBCdXQgbXkgY29tcGFueSBpcyBsb29raW5nIGludG8gd2F5cyB0byByZWR1Y2UgaXRzIGNhcmJvbiBlbWlzc2lvbnMsIG9yIGFkZCBtb3JlIGNhcmJvbiBvZmZzZXRzLiBJdCdzIGdvaW5nIHRvIGJlIDxlbT5maW5lPC9lbT4uXFxcIltkZWxheSAxMDAwXVxcblRoZXkganVzdCBzaGFrZSB0aGVpciBoZWFkIGFnYWluLiBcXFwiTG9vaywgeW91IGRvbid0IHNlZW0gZXZpbCBvciBhbnl0aGluZy4gSXQganVzdCBzb3VuZHMgbGlrZSB5b3UncmUgaW4gZGVuaWFsLiBNYXliZSB5b3Uga25vdyBpdCB0b28uIEJ1dCBpZiB5b3UgY2FyZWQsIHlvdSB3b3VsZCBiZSB3b3JraW5nIHdpdGggbWUsIG5vdCB3aXRoIHRoZSBmb3NzaWwgZnVlbHMgaW5kdXN0cnkuIE9yIGF0IGxlYXN0IG5vdCBhY3RpdmVseSBkZWZlbmRpbmcgdGhlbS4gU28gd2UgaGF2ZSBub3RoaW5nIHRvIHRhbGsgYWJvdXQuXFxcIltkZWxheSAxMDAwXVxcbllvdSBzdGFydCB0byByZXNwb25kLCBidXQgdGhlIHJlY2VwdGlvbmlzdCBsZXRzIHlvdSBrbm93IHRoYXQgeW91ciByb29tIGlzIHJlYWR5LiBcXG5Zb3UgdGFrZSBhIGRlZXAgYnJlYXRoLCBhbmQgZ2V0IHVwLiBJdCdzIHRpbWUgZm9yIHRoZSBoZWFyaW5nLlwiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkF0dGVuZCB0aGUgaGVhcmluZ1wiLFwibmV4dFwiOlwiYXR0ZW5kXCJ9XX0sXCJhdHRlbmRcIjp7XCJ0ZXh0XCI6XCJZb3UgbG9nIG9uLiBFdmVyeW9uZSBlbHNlIHNlZW1zIHRvIGJlIGxvZ2dpbmcgb24gYXJvdW5kIHRoZSBzYW1lIHRpbWUuIFRoZXJlJ3MgYSBicmllZiBwYXVzZSB3aGlsZSB0aGUgUmVwcmVzZW50YXRpdmUgbGVhZGluZyB0b2RheSdzIGhlYXJpbmcgd2FpdHMgZm9yIGV2ZXJ5b25lIHRvIGpvaW4uIFRoZW4sIHNoZSBzdGFydHMuIFNoZSBpbnRyb2R1Y2VzIGFsbCBvZiB0aGUgb3RoZXIgUmVwcmVzZW50YXRpdmVzIGF0dGVuZGluZywgYnJpZWZseSBleHBsYWlucyB0aGUgY29udGVudCBvZiB0b2RheXMgaGVhcmluZyZtZGFzaDt0aGUgYWxsb2NhdGlvbiBvZiBlbmVyZ3kgc3Vic2lkaWVzJm1kYXNoO2FuZCB0aGVuIGhhbmRzIGl0IG9mZiB0byB5b3UuXFxuWW91IGtuZXcgeW91IHdlcmUgZ29pbmcgdG8gYmUgZmlyc3QgdG8gc3BlYWsuIFlvdSB0YWtlIGEgZGVlcCBicmVhdGguIE5vdydzIHRoZSBtb21lbnQgb2YgdHJ1dGguXFxuWW91J3JlIGdvaW5nIHRvIHByZXNlbnQgdGhlIHR3byBzdHVkaWVzIHlvdSB3ZXJlIGdpdmVuLiBZb3UgbWFkZSBzdXJlIHlvdSBjb3VsZCBjaGFuZ2UgYXJvdW5kIHRoZSBvcmRlciBpZiB5b3UgbmVlZGVkIHRvLCBqdXN0IGluIGNhc2UgeW91IGNoYW5nZWQgeW91ciBtaW5kIG9uIHRoZSBiZXN0IHdheSB0byBnbyBhYm91dCBwcmVzZW50aW5nIHRoZW0uIFNvLCB3aGljaCBvbmUgd291bGQgeW91IGxpa2UgdG8gcHJlc2VudCBmaXJzdD9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiaW5kdXN0cnlcIixcInRleHRcIjpcIkNDUyBTdHVkeVwiLFwibmV4dFwiOlwicHJlc2VudENDUzFcIn0se1wiaWNvblwiOlwiZmlyZS1mbGFtZS1zaW1wbGVcIixcInRleHRcIjpcIkVmZmljaWVuY3kgU3R1ZHlcIixcIm5leHRcIjpcInByZXNlbnRFZmZpY2llbmN5MVwifSx7XCJpY29uXCI6XCJhcnJvd3Mtcm90YXRlXCIsXCJ0ZXh0XCI6XCJMaWZlY3ljbGUgQW5hbHlzaXNcIixcIm5leHRcIjpcInByZXNlbnRMQ0FcIn1dfSxcInByZXNlbnRDQ1MxXCI6e1widGV4dFwiOlwiXFxcIkdvb2QgbW9ybmluZywgYW5kIHRoYW5rIHlvdSBmb3IgaGF2aW5nIG1lIHRvZGF5LiBJJ2QgbGlrZSB0byB0YWxrIHRvIHlvdSB0b2RheSBhYm91dCBzb21lIGV4dHJlbWVseSBwcm9taXNpbmcgYWR2YW5jZXMgaW4gQ2FyYm9uIENhcHR1cmUgYW5kIFN0b3JhZ2UgdGVjaG5vbG9neSwgYWxzbyBrbm93biBhcyBDQ1MuIENDUyBpcyBhIHZlcnkgcHJvbWlzaW5nIHRlY2hub2xvZ3kgdGhhdCBjb3VsZCBzaWduaWZpY2FudGx5IHJlZHVjZSBjYXJib24gZW1pc3Npb25zLiBJdCdzIGJlZW4ga25vd24gdG8gcmVkdWNlIGVtaXNzaW9ucyBieSB1cCB0byA5MCUsIGFuZCByZWNlbnQgcmVzZWFyY2ggaGFzIGZvdW5kIG1ldGhvZHMgdGhhbiBjYW4gcmVhY2ggdXAgdG8gOTUlIHJlZHVjdGlvbnMsIG9yIGV2ZW4gYWJvdmUgdGhhdC4gTm90IG9ubHkgdGhhdCwgYnV0IHRoaXMgdGVjaG5vbG9neSBjYW4gYmUgcmV0cm9maXR0ZWQgb250byBleGlzdGluZyBwbGFudHMsIHdoaWNoIG1lYW5zIHRoYXQgd2l0aCBzb21lIGludmVzdG1lbnQsIHdlIGNvdWxkIHBpdm90IG91ciBleGlzdGluZyBwbGFudHMgdG8gdXNlIENDUywgcmF0aGVyIHRoYW4gYnVpbGRpbmcgY29tcGxldGVseSBuZXcgZW5lcmd5IHNvdXJjZXMuIFdlIGZlZWwgaXQgaXMgdGhlIG9ubHkgcmVzcG9uc2libGUgcGF0aCB0byBhIGNsZWFuZXIgZnV0dXJlLlxcXCJcXG5Zb3UgY29udGludWUgb24gd2l0aCBzb21lIG1vcmUgc3BlY2lmaWMgZGV0YWlscywgYnV0IHRoZSBwaXRjaCB3YXMgdGhlIG1vc3QgaW1wb3J0YW50IHBhcnQuIFlvdSBob3BlIGl0IHdlbnQgb3ZlciB3ZWxsLlxcbllvdSBmaW5pc2ggdXAgdGhpcyBwYXJ0IG9mIHRoZSBwcmVzZW50YXRpb24uIE9uIHRvIHRoZSBzZWNvbmQgc3R1ZHksIHJpZ2h0PyBXZWxsLCB0aGVyZSdzIGFsd2F5cyB0aGUgb3RoZXIgc3R1ZHksIGJ1dCB5b3Ugd291bGRuJ3QgcHJlc2VudCB0aGF0LlwiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJmaXJlLWZsYW1lLXNpbXBsZVwiLFwidGV4dFwiOlwiRWZmaWNpZW5jeSBTdHVkeVwiLFwibmV4dFwiOlwicHJlc2VudEVmZmljaWVuY3kyXCJ9LHtcImljb25cIjpcImFycm93cy1yb3RhdGVcIixcInRleHRcIjpcIkxpZmVjeWNsZSBBbmFseXNpc1wiLFwibmV4dFwiOlwicHJlc2VudExDQVwifV19LFwicHJlc2VudEVmZmljaWVuY3kxXCI6e1widGV4dFwiOlwiXFxcIkdvb2QgbW9ybmluZywgYW5kIHRoYW5rIHlvdSBmb3IgaGF2aW5nIG1lIHRvZGF5LiBJJ2QgbGlrZSB0byB0YWxrIHRvIHlvdSB0b2RheSBhYm91dCBzb21lIG5ldyByZXNlYXJjaCBpbnRvIHRoZSBjb3N0IG9mIHZhcmlvdXMgZGlmZmVyZW50IGVuZXJneSBzb3VyY2VzLiBSZW5ld2FibGUgZW5lcmd5IGlzIHZlcnkgaW50ZXJlc3RpbmcsIGJ1dCBpdCBpc24ndCBuZWNlc2FyaWx5IGNvc3QtZWZmZWN0aXZlLiBPdXIgcmVzZWFyY2ggaGFzIGZvdW5kIHRoYXQgb24gYXZlcmFnZSwgcmVuZXdhYmxlIGVuZXJneSBjb3N0cyBhcm91bmQgNi04IGNlbnRzIHBlciBraWxvd2F0dC1ob3VyLCB3aGlsZSBjb2FsIGFuZCBuYXR1cmFsIGdhcyBjb3N0cyBhcm91bmQgNC01IGNlbnRzIHBlciBraWxvd2F0dC1ob3VyLiBUaGF0IG1heSBub3Qgc2VlbSBzaWduaWZpY2FudCwgYnV0IHdoZW4gd2UncmUgdGFsa2luZyBhYm91dCB0aGUgZW50aXJlIGVuZXJneSBncmlkIG9mIHRoZSBVbml0ZWQgU3RhdGVzLCB0aGF0J3MgaGFyZGx5IGEgY29zdCBvbmUgY2FuIGlnbm9yZS4gU28gd2hpbGUgaXQgaXMgZGVmaW5pdGVseSBnb29kIHRvIGNvbnNpZGVyIHJlbmV3YWJsZSBlbmVyZ3ksIHdlIGNhbiBoYXJkbHkgcmVseSBvbiBpdCB3aXRob3V0IGluY3VycmluZyBhIGhlZnR5IHByaWNlLlxcXCJcXG5Zb3UgY29udGludWUgb24gd2l0aCBzb21lIG1vcmUgc3BlY2lmaWMgZGV0YWlscywgYnV0IHRoZSBwaXRjaCB3YXMgdGhlIG1vc3QgaW1wb3J0YW50IHBhcnQuIFlvdSBob3BlIGl0IHdlbnQgb3ZlciB3ZWxsLlxcbllvdSBmaW5pc2ggdXAgdGhpcyBwYXJ0IG9mIHRoZSBwcmVzZW50YXRpb24uIE9uIHRvIHRoZSBzZWNvbmQgc3R1ZHksIHJpZ2h0PyBXZWxsLCB0aGVyZSdzIGFsd2F5cyB0aGUgb3RoZXIgc3R1ZHksIGJ1dCB5b3Ugd291bGRuJ3QgcHJlc2VudCB0aGF0LlwiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJpbmR1c3RyeVwiLFwidGV4dFwiOlwiQ0NTIFN0dWR5XCIsXCJuZXh0XCI6XCJwcmVzZW50Q0NTMlwifSx7XCJpY29uXCI6XCJhcnJvd3Mtcm90YXRlXCIsXCJ0ZXh0XCI6XCJMaWZlY3ljbGUgQW5hbHlzaXNcIixcIm5leHRcIjpcInByZXNlbnRMQ0FcIn1dfSxcInByZXNlbnRDQ1MyXCI6e1widGV4dFwiOlwiXFxcIkknZCBhbHNvIGxpa2UgdG8gdGFsayB0byB5b3UgYWJvdXQgc29tZSBleHRyZW1lbHkgcHJvbWlzaW5nIGFkdmFuY2VzIGluIENhcmJvbiBDYXB0dXJlIGFuZCBTdG9yYWdlIHRlY2hub2xvZ3ksIGFsc28ga25vd24gYXMgQ0NTLiBDQ1MgaXMgYSB2ZXJ5IHByb21pc2luZyB0ZWNobm9sb2d5IHRoYXQgY291bGQgc2lnbmlmaWNhbnRseSByZWR1Y2UgY2FyYm9uIGVtaXNzaW9ucy4gSXQncyBiZWVuIGtub3duIHRvIHJlZHVjZSBlbWlzc2lvbnMgYnkgdXAgdG8gOTAlLCBhbmQgcmVjZW50IHJlc2VhcmNoIGhhcyBmb3VuZCBtZXRob2RzIHRoYW4gY2FuIHJlYWNoIHVwIHRvIDk1JSByZWR1Y3Rpb25zLCBvciBldmVuIGFib3ZlIHRoYXQuIE5vdCBvbmx5IHRoYXQsIGJ1dCB0aGlzIHRlY2hub2xvZ3kgY2FuIGJlIHJldHJvZml0dGVkIG9udG8gZXhpc3RpbmcgcGxhbnRzLCB3aGljaCBtZWFucyB0aGF0IHdpdGggc29tZSBpbnZlc3RtZW50LCB3ZSBjb3VsZCBwaXZvdCBvdXIgZXhpc3RpbmcgcGxhbnRzIHRvIHVzZSBDQ1MsIHJhdGhlciB0aGFuIGJ1aWxkaW5nIGNvbXBsZXRlbHkgbmV3IGVuZXJneSBzb3VyY2VzLiBXZSBmZWVsIGl0IGlzIHRoZSBvbmx5IHJlc3BvbnNpYmxlIHBhdGggdG8gYSBjbGVhbmVyIGZ1dHVyZS5cXFwiXFxuWW91IGNvbnRpbnVlIG9uIHdpdGggc29tZSBtb3JlIHNwZWNpZmljIGRldGFpbHMsIGJ1dCBhZ2FpbiwgdGhlIHBpdGNoIHdhcyB0aGUgbW9zdCBpbXBvcnRhbnQgcGFydC5cXG5XZWxsLCB0aGF0J3MgaXQgZm9yIHlvdXIgdGltZS4gTm93IHRvIGhlYXIgZnJvbSB0aGUgcmVzdCBvZiB0aG9zZSBhdHRlbmRpbmcgdGhlIGhlYXJpbmcuXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImFycm93LXVwLWZyb20tYnJhY2tldFwiLFwidGV4dFwiOlwiRmluaXNoXCIsXCJuZXh0XCI6XCJmaW5pc2hiYWRcIn1dfSxcInByZXNlbnRFZmZpY2llbmN5MlwiOntcInRleHRcIjpcIlxcXCJJJ2QgYWxzbyBsaWtlIHRvIHRhbGsgdG8geW91IGFib3V0IHNvbWUgbmV3IHJlc2VhcmNoIGludG8gdGhlIGNvc3Qgb2YgdmFyaW91cyBkaWZmZXJlbnQgZW5lcmd5IHNvdXJjZXMuIFJlbmV3YWJsZSBlbmVyZ3kgaXMgdmVyeSBpbnRlcmVzdGluZywgYnV0IGl0IGlzbid0IG5lY2VzYXJpbHkgY29zdC1lZmZlY3RpdmUuIE91ciByZXNlYXJjaCBoYXMgZm91bmQgdGhhdCBvbiBhdmVyYWdlLCByZW5ld2FibGUgZW5lcmd5IGNvc3RzIGFyb3VuZCA2LTggY2VudHMgcGVyIGtpbG93YXR0LWhvdXIsIHdoaWxlIGNvYWwgYW5kIG5hdHVyYWwgZ2FzIGNvc3RzIGFyb3VuZCA0LTUgY2VudHMgcGVyIGtpbG93YXR0LWhvdXIuIFRoYXQgbWF5IG5vdCBzZWVtIHNpZ25pZmljYW50LCBidXQgd2hlbiB3ZSdyZSB0YWxraW5nIGFib3V0IHRoZSBlbnRpcmUgZW5lcmd5IGdyaWQgb2YgdGhlIFVuaXRlZCBTdGF0ZXMsIHRoYXQncyBoYXJkbHkgYSBjb3N0IG9uZSBjYW4gaWdub3JlLiBTbyB3aGlsZSBpdCBpcyBkZWZpbml0ZWx5IGdvb2QgdG8gY29uc2lkZXIgcmVuZXdhYmxlIGVuZXJneSwgd2UgY2FuIGhhcmRseSByZWx5IG9uIGl0IHdpdGhvdXQgaW5jdXJyaW5nIGEgaGVmdHkgcHJpY2UuXFxcIlxcbllvdSBjb250aW51ZSBvbiB3aXRoIHNvbWUgbW9yZSBzcGVjaWZpYyBkZXRhaWxzLCBidXQgYWdhaW4sIHRoZSBwaXRjaCB3YXMgdGhlIG1vc3QgaW1wb3J0YW50IHBhcnQuXFxuV2VsbCwgdGhhdCdzIGl0IGZvciB5b3VyIHRpbWUuIE5vdyB0byBoZWFyIGZyb20gdGhlIHJlc3Qgb2YgdGhvc2UgYXR0ZW5kaW5nIHRoZSBoZWFyaW5nLlwiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkZpbmlzaFwiLFwibmV4dFwiOlwiZmluaXNoYmFkXCJ9XX0sXCJwcmVzZW50TENBXCI6e1widGV4dFwiOlwiVGhlIG5hZ2dpbmcgZmluYWxseSBnZXRzIHRvIHlvdS4gWW91IGNhbid0IGRvIHRoaXMuIFlvdSBrbm93IGV4YWN0bHkgd2hhdCB5b3Ugc2F3IGluIHRoYXQgc3R1ZHkgYW5kLi4uIGl0J3MgdGltZSB0byBhY3Qgb24gaXQuXFxuXFxcIkknZCBsaWtlIHRvIHRhbGsgdG8geW91IGFib3V0Li4uIFtkZWxheSA1MDBdc29tZXRoaW5nIHZlcnkgaW1wb3J0YW50LiBZb3Ugc2VlLCB3ZSBhbGwga25vdyB0aGF0IGNsaW1hdGUgY2hhbmdlIGlzIGEgcHJvYmxlbSwgYW5kIHRoYXQgZm9zc2lsIGZ1ZWxzIGRvbid0IGhlbHAgd2l0aCBpdC4gQnV0IGl0J3MgbGlrZWx5IGV2ZW4gd29yc2UgdGhhbiB5b3UgdGhvdWdodCwgc28gSSByZWNvbW1lbmQgdG8gdGhlIGFzc2VtYmx5IHRoYXQgeW91IGRpdmVydCBtb3N0IGZvc3NpbCBmdWVsIHN1YnNpZGllcyB0byByZW5ld2FibGVzLlxcXCJcXG5UaGVyZSdzIGEgZ2FzcCBmcm9tIHNvbWVvbmUgd2hvIGNsZWFybHkgZm9yZ290IHRvIG11dGUgdGhlbXNlbGYuXFxuXFxcIkkga25vdyB0aGlzIG1heSBjb21lIGFzIGEgc3VycHJpc2UsIGJ1dCBJIHRydWx5IGZlZWwgdGhpcyBpcyB0aGUgb25seSByZXNwb25zaWJsZSBtb3ZlLiBDQ1MgaXNuJ3QgcGVyZmVjdDsgaXQgY29zdHMgbW9yZSB0aGFuIG5vcm1hbCBmb3NzaWwgZnVlbHMsIG5vdCB0byBtZW50aW9uIHRoYXQgaXQgc3RpbGwgZW1pdHMgY29uc2lkZXJhYmx5IG1vcmUgdGhhbiByZW5ld2FibGUgZW5lcmd5IHNvdXJjZXMuIEFuZCBJIHRoaW5rIGl0J3MgY2xlYXIgdGhhdCByZWNlbnQgY2xpbWF0ZSBldmVudHMgaGF2ZSBiZWVuIHdvcnNlIGFuZCBtb3JlIGV4dHJlbWUsIGFuZCB0aGUgYXNzb2NpYXRpb24gaGFzIGJlZW4gcHJvdmVuLlxcXCJcXG5Zb3Ugd2VudCBvbiBhYm91dCB0aGUgc3BlY2lmaWNzIG9mIHRoZSBzdHVkeS4gWW91IGNhbiBzZWUgdGhlIHN1cnByaXNlIG9uIHRoZSBmYWNlcyBvZiB0aGUgdmFyaW91cyBwZW9wbGUgYXR0ZW5kaW5nLCBidXQgeW91IGtuZXcgdGhpcyBuZWVkZWQgdG8gYmUgc2FpZC4gWW91IGZpbmlzaC4gSXQncyBkb25lLlwiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJhcnJvdy11cC1mcm9tLWJyYWNrZXRcIixcInRleHRcIjpcIkZpbmlzaFwiLFwibmV4dFwiOlwiZmluaXNoZ29vZFwifV19LFwiZmluaXNoYmFkXCI6e1widGV4dFwiOlwiVGhlIHJlc3Qgb2YgdGhlIGhlYXJpbmcgaXMgZmFpcmx5IGJvcmluZy4gWW91J3JlIG9ubHkgc29ydCBvZiBwYXlpbmcgYXR0ZW50aW9uLCB1bnRpbCB0aGUgbG9iYnlpc3QgeW91IG1ldCBpbiB0aGUgd2FpdGluZyByb29tIGJlZ2lucyB0aGVpciBzZWN0aW9uLiBBdCB0aGF0IHBhcnQsIHlvdSBzdGFydCBsaXN0ZW5pbmcuXFxuVGhleSB0YWxrIGFib3V0IHRoZSB1bnByZWNlbmRlbnQgYW1vdW50IG9mIGhlYXR3YXZlcywgZmxvb2RpbmcsIGFuZCBvdGhlciBleHRyZW1lIGNsaW1hdGUgZXZlbnRzIHRoYXQgaGF2ZSBiZWVuIG9jY3VyaW5nLltkZWxheSA1MDBdXFxuVGhleSB0YWxrIGFib3V0IHRoZSByaXNlIGluIGdsb2JhbCB0ZW1wZXJhdHVyZSwgbmVhcmx5IGV4YWN0bHkgaW4gbGluZSB3aXRoIHBhc3QgcHJlZGljdGlvbnMuW2RlbGF5IDUwMF1cXG5UaGV5IHRhbGsgYWJvdXQgdGhlIGFtb3VudCBvZiBtb25leSBpdCBpcyBjb3N0aW5nIHVzLCBqdXN0IHRvIGNvcGUgd2l0aCB0aGUgY2hhbmdlcy5bZGVsYXkgNTAwXVxcblRoZXkgdGFsayBhYm91dCB0aGUgZHJvcCBpbiBwcmljZXMgZm9yIHJlbmV3YWJsZSBlbmVyZ3ksIHRoYXQgaXMgb25seSBjb250aW51aW5nIHdpdGggZnVydGhlciByZXNlYXJjaC5bZGVsYXkgNTAwXVxcblRoZXkgdGFsayBhYm91dCB0aGUgY2xlYXIgcHVibGljIGludGVyZXN0IGluIHRoZSBjbGltYXRlLCBvbmx5IGdldHRpbmcgc3Ryb25nZXIgZWFjaCBkYXkuW2RlbGF5IDUwMF1cXG5cXFwiRXZlbiBpZiByZW5ld2FibGVzIGNvc3QgdXMgYSBiaXQgbW9yZSwgc3VyZWx5IHRoYXQncyB3b3J0aHdoaWxlIHRvIHNhdmUgb3VyIHBsYW5ldD8gVGhlIGV2aWRlbmNlIHdhcyBjbGVhciAzMCB5ZWFycyBhZ28uIE5vdyBpcyB0aGUgdGltZSBmb3IgYWN0aW9uLiBJIGhvcGUgeW91IGNhbiBhbGwgc2VlIHRoYXQuIFRoYW5rIHlvdS5cXFwiXFxuQW5kIHdpdGggdGhhdCwgdGhlIGhlYXJpbmcgd2FzIG92ZXIuIFRoYW5rcyB3ZXJlIHNhaWQsIGFuZCB0aGUgaGVhcmluZyB3YXMgZGlzbWlzc2VkLiBZb3UgbG9nIG91dCBvZiB0aGUgbWVldGluZy5cXG5Zb3UgcGFzcyB0aGUgY2xpbWF0ZSBhY3RpdmlzbSBsb2JieWlzdCwgYnV0IHRoZXkgZG9uJ3QgbG9vayBhdCB5b3UuXFxuWW91IGhlYWQgaG9tZS4gWW91IHRlbGwgeW91cnNlbGYgdGhhdCB5b3UgZGlkIGEgZ29vZCBqb2IuIFxcbkF0IHRoZSB2ZXJ5IGxlYXN0LCB5b3VyIGVtcGxveWVycyBhcmUgdmVyeSBoYXBweS5cXG5CdXQgc3RpbGwuLi4geW91J3JlIG5vdCBzdXJlIGlmIHlvdSBkaWQgd2hhdCB5b3Ugc2hvdWxkIGhhdmUuXFxuTWF5YmUsIGl0IGNvdWxkIGhhdmUgZ29uZSBhIGRpZmZlcmVudCB3YXkuXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImNpcmNsZS14bWFya1wiLFwidGV4dFwiOlwiRW5kaW5nOiBXcm9uZyBTaWRlIG9mIEhpc3RvcnlcIixcIm5leHRcIjpcIndyb25nc2lkZVwifV19LFwiZmluaXNoZ29vZFwiOntcInRleHRcIjpcIllvdSBjYW4gYmFyZWx5IHdhaXQgZm9yIHRoZSBoZWFyaW5nIHRvIGZpbmlzaC4gRXZlbiB0aG91Z2ggeW91IGNhbid0IHBoeXNpY2FsbHkgc2VlIHBlb3BsZSdzIGV5ZXMgb24geW91LCB5b3Uga25vdyB0aGV5J3JlIGFsbCB0aGlua2luZyBhYm91dCB3aGF0IHlvdSBkaWQuIFNvIGFyZSB5b3UuIFlvdSBjYW4gaGFyZGx5IGJlbGlldmUgaXQuIEl0IGp1c3QuLi4gZmVsdCByaWdodC4gQnV0IG5vdywgeW91J3JlIHJlYWxpemluZyB0aGUgcmVwZXJjdXNzaW9ucy4gWW91J3JlIGRlZmluaXRlbHkgZ29pbmcgdG8gbG9zZSB5b3VyIGpvYi4gV2FzIHRoYXQgd29ydGggaXQ/XFxuVGhlIGxvYmJ5aXN0IHlvdSBtZXQgc2VlbXMgc3VycHJpc2VkIGFzIHRoZXkgZ2l2ZSB0aGVpciB0ZXN0aW1vbnkuIFRoZXkgc3Ryb25nbHkgYWdyZWUgd2l0aCB5b3UsIGFuZCBub3RlIHRoZSBjaGFuZ2UgaW4gY2xpbWF0ZSBzYW1lIGFzIHlvdSwgYWx0aG91Z2ggd2l0aCBtb3JlIGZhY3RzIHRvIGJhY2sgaXQgdXAuIEF0IGxlYXN0IHRoZXkgc2VlbSBoYXBweSBhYm91dCBpdC5cXG5GaW5hbGx5LCB0aGUgaGVhcmluZyBlbmRzLiBZb3UgbG9nIG91dCwgYW5kIGhlYWQgYmFjayBvdXQgaW50byB0aGUgd2FpdGluZyByb29tLlxcbllvdSBzZWUgdGhlIGxvYmJ5aXN0IGFnYWluLiBUaGV5J3JlIHNtaWxpbmcgYXQgeW91LlxcbldoYXQgZG8geW91IGRvP1wiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJjb21tZW50XCIsXCJ0ZXh0XCI6XCJUYWxrIHRvIHRoZSBsb2JieWlzdFwiLFwibmV4dFwiOlwidGFsa2ZpbmFsXCIsXCJpZlwiOlwidGFsa1wifSx7XCJpY29uXCI6XCJob3VzZS1jaGltbmV5XCIsXCJ0ZXh0XCI6XCJHbyBIb21lXCIsXCJuZXh0XCI6XCJob21lXCJ9XX0sXCJ0YWxrZmluYWxcIjp7XCJ0ZXh0XCI6XCJcXFwiT2guIEhpXFxcIiB5b3Ugc2F5LlxcblRoZXkgc21pbGUuIFxcXCJJJ3ZlIGdvdCB0byBzYXksIHlvdSBzdXJwcmlzZWQgbWUgaW4gdGhlcmUuIE1heWJlIHlvdSdyZSBub3QganVzdCBpbiBpdCBmb3IgdGhlIG1vbmV5LlxcXCJcXG5cXFwiV2VsbC4uLiBJIGhhZCBhIGNoYW5nZSBvZiBoZWFydC4gSSdkIGxpa2UgdG8gdHJ5IHRvIGRvIGJldHRlci5cXFwiXFxuXFxcIllvdSBrbm93LCBteSBjb21wYW55IGlzIGhpcmluZy4gSWYgeW91J3JlIGludGVyZXN0ZWQsIG1heWJlIEkgY291bGQgc2V0IHlvdSB1cCBmb3IgYW4gaW50ZXJ2aWV3LiBJJ20gc3VyZSB0aGV5J2QgYmUgaW50ZXJlc3RlZC5cXFwiXFxuWW91IHdlcmVuJ3QgZXhwZWN0aW5nIHRoYXQgZWl0aGVyLiBUaGV5IHJlYWxseSBhcmUgZnVsbCBvZiBzdXJwcmlzZXMuXFxuSG93IGRvIHlvdSByZXNwb25kP1wiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJicmllZmNhc2VcIixcInRleHRcIjpcIlRha2UgdGhlIGpvYlwiLFwibmV4dFwiOlwiam9iXCJ9LHtcImljb25cIjpcImhlYXJ0XCIsXCJ0ZXh0XCI6XCJBc2sgdGhlbSBvdXRcIixcIm5leHRcIjpcImhlYXJ0XCJ9XX0sXCJqb2JcIjp7XCJ0ZXh0XCI6XCJZb3UgdGFrZSB0aGUgam9iLiBBZnRlciBhIHNob3J0IGludGVydmlldyBwcm9jZXNzLCB0aGV5IGdsYWRseSBoaXJlIHlvdS4gVGhleSBuZWVkIGFsbCB0aGUgaGVscCB5b3UgY2FuIGdldC5cXG5CZXR3ZWVuIHlvdXIgdGVzdGltb255IGFuZCB5b3VyIGFjdGl2ZSB3b3JrIGFmdGVyIHRoZSBmYWN0LCBmb3NzaWwgZnVlbCBpbnZlc3RtZW50IHN0YXJ0cyB0byByYXBpZGx5IGR3aW5kbGUuIFxcbllvdSBldmVuIGdldCBpbnZvbHZlZCBpbiBuZXcgbGVnaXNsYXR1cmUgdGhhdCB3b3VsZCBzbG93bHkgcGhhc2Ugb3V0IGZvc3NpbCBmdWVsIHBsYW50cyBpbiBmYXZvciBvZiByZW5ld2FibGVzLlxcbkl0J2xsIHN0aWxsIGJlIGFuIHVwaGlsbCBiYXR0bGUsIGJ1dCBhdCBsZWFzdCB5b3UncmUgcHJldHR5IHN1cmUgeW91J3JlIG9uIHRoZSByaWdodCBzaWRlIG9mIGl0LlwiLFwib3B0aW9uc1wiOlt7XCJpY29uXCI6XCJmaWxlLWxpbmVzXCIsXCJ0ZXh0XCI6XCJDcmVkaXRzXCIsXCJuZXh0XCI6XCJjcmVkaXRzXCJ9XX0sXCJoZWFydFwiOntcInRleHRcIjpcIltiYWNrZ3JvdW5kIHdlZGRpbmcubXAzXVRvIHlvdXIgc3VycHJpc2UsIHRoZXkgYWNjZXB0LiBZb3Ugc3RhcnQgZGF0aW5nLCBhbmQgaXQgZ29lcyB2ZXJ5IHdlbGwuXFxuRXZlbnR1YWxseSwgYWZ0ZXIgYSB3aGlsZSwgeW91IHRpZSB0aGUga25vdC5cXG5Zb3UncmUgYSB2ZXJ5IHN1cHBvcnRpdmUgc3BvdXNlLCBhbmQgeW91J3JlIHN1cmUgeW91IHByb3ZpZGUgZXhjZWxsZW50IG1vcmFsIHN1cHBvcnQuXFxuWW91IG11c3QgaGF2ZSwgYmVjYXVzZSB5b3Ugc2VlIGNsZWFybHkgdGhhdCBmb3NzaWwgZnVlbHMgYXJlIGJlaW5nIHBoYXNlZCBvdXQuXFxuVGhlIHRpZGUgaGFzIHR1cm5lZC4gSXQnbGwgYmUgYSBsb25nIHJvYWQgdG8gY2FyYm9uIG5ldXRyYWxpdHksIGJ1dCBhdCBsZWFzdCB5b3UncmUgb24gaXQuXCIsXCJvcHRpb25zXCI6W3tcImljb25cIjpcImZpbGUtbGluZXNcIixcInRleHRcIjpcIkNyZWRpdHNcIixcIm5leHRcIjpcImNyZWRpdHNcIn1dfSxcImhvbWVcIjp7XCJ0ZXh0XCI6XCJZb3UgaGVhZCBob21lLiBZb3VyIHBob25lIGlzIHJpbmdpbmcgaW5jZXNzYW50bHksIGJ1dCB5b3UgZG9uJ3QgY2hlY2sgaXQuXFxuWW91IGtub3cgaXRzIHlvdXIgZW1wbG95ZXJzLiBPciBhdCBsZWFzdCwgeW91ciBwcmV2aW91cyBlbXBsb3llcnMuIFlvdSBkb24ndCBoYXZlIHRvIGNoZWNrLlxcbkJ1dCwgbG9va2luZyBiYWNrIGF0IHlvdXIgZm9sZGVyLCB5b3UgcmVhbGl6ZSwgbWF5YmUgdGhpcyBpc24ndCBzdWNoIGEgYmFkIHRoaW5nLlxcbkFmdGVyIGFsbCwgeW91IGhhZCB3YW50ZWQgdG8gZ28gYmFjayB0byBzY2hvb2wsIGhhZG4ndCB5b3U/XFxuTWF5YmUgdGhpcyBpcyBqdXN0IHRoZSBvcHBvcnR1bml0eSB5b3UgbmVlZC5cXG5Zb3UgZGVjaWRlIGl0J3Mgbm90IHRvbyBsYXRlLiBZb3UnbGwgc3RhcnQgYXBwbHlpbmcgcmlnaHQgYXdheS5cXG5BdCB0aGUgdmVyeSBsZWFzdCwgeW91J2xsIGNlcnRhaW5seSBoYXZlIGEgcmVwdXRhdGlvbi4gSG9wZWZ1bGx5IGl0IGhlbHBzIHlvdS5cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiZmlsZS1saW5lc1wiLFwidGV4dFwiOlwiQ3JlZGl0c1wiLFwibmV4dFwiOlwiY3JlZGl0c1wifV19LFwid3JvbmdzaWRlXCI6e1widGV4dFwiOlwiVGhlIHJlc3VsdHMgb2YgdGhlIGJ1ZGdldCBoZWFyaW5nIHdlcmUgdWx0aW1hdGVseSBpbiB5b3VyIGZhdm9yLiBUaGV5IGRpdmVydGVkIHZlcnkgbGl0dGxlIG9mIHRoZSBmb3NzaWwgZnVlbCBzdWJzaWRpZXMgdG8gcmVuZXdhYmxlcy5cXG5CdXQgaXQgd2FzIGEgdmVyeSB0ZW1wb3JhcnkgdmljdG9yeS4gVGhlIHllYXIgYWZ0ZXIgdGhhdCwgdGhlIHN1YnNpZGllcyB3ZXJlIHJlYWxsb2NhdGVkIGFueXdheS5cXG5BIGNoYW5nZSBpbiBhZG1pbmlzdHJhdGlvbiwgYW1vbmcgb3RoZXIgdGhpbmdzLiBCdXQgdWx0aW1hdGVseSwgaXQgd2FzIGEgbG9zaW5nIGJhdHRsZS4gVGhlIHB1YmxpYyBvcGluaW9uIHdhcyBzaGlmdGluZy4gSXQgd2FzIG9ubHkgYSBtYXR0ZXIgb2YgdGltZS5cXG5BdCB0aGUgYmFjayBvZiB5b3VyIG1pbmQsIHlvdSB0aGluayBtYXliZSwgeW91IGNvdWxkIGhhdmUgYmVlbiBvbiB0aGUgcmlnaHQgc2lkZS4gQnV0IHRoYXQgdGltZSBwYXNzZWQuXFxuQXQgbGVhc3QgeW91IGdvdCB0aGUgbW9uZXkgdGhvdWdoLCByaWdodD9cIixcIm9wdGlvbnNcIjpbe1wiaWNvblwiOlwiZmlsZS1saW5lc1wiLFwidGV4dFwiOlwiQ3JlZGl0c1wiLFwibmV4dFwiOlwiY3JlZGl0c1wifV19LFwiY3JlZGl0c1wiOntcInRleHRcIjpcIldlYnNpdGUgY3JlYXRlZCBieSA8YSBocmVmPVxcXCJodHRwczovL2dpdGh1Yi5jb20va2Zpc2g2MTAvdGV4dC1hZHZlbnR1cmVcXFwiPktldmluIEZpc2hlcjwvYT4uXFxuV3JpdGluZyBhbmQgUmVzZWFyY2ggYnkgS2V2aW4gRmlzaGVyLCBMZW8gTGVlLCBhbmQgS2V2aW4gWHUuXFxuQ0NTIGluZm9ybWF0aW9uIGZyb20gPGEgaHJlZj1cXFwiaHR0cHM6Ly9kb2kub3JnLzEwLjEwMTYvai5zY2l0b3RlbnYuMjAyMC4xNDMyMDNcXFwiPldpbGJlcmZvcmNlIGV0IGFsLjwvYT5cXG5Db3N0IGVmZmljaWVuY3kgaW5mb3JtYXRpb24gZnJvbSA8YSBocmVmPVxcXCJodHRwczovL2RvaS5vcmcvMTAuMTAxNi9TMTc1MC01ODM2KDA3KTAwMDI0LTJcXFwiPlZpZWJhaG4gZXQgYWwuPC9hPlxcbkFsYXJtIGNsb2NrIHNvdW5kIGVmZmVjdCBmcm9tIDxhIGhyZWY9XFxcImh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL3dhdGNoP3Y9YTBnbkdrbUY4UWtcXFwiPlNvdW5kIEVmZmVjdCBNYXN0ZXI8L2E+LlxcbkZsb29kIGltYWdlIGZyb20gPGEgaHJlZj1cXFwiaHR0cHM6Ly93d3cuZm94N2F1c3Rpbi5jb20vbmV3cy9oaXN0b3JpYy1mbG9vZGluZy1oaXRzLW1pc3Npc3NpcHBpLXRlbm5lc3NlZS13aXRoLW1vcmUtZHJlbmNoaW5nLXJhaW5zLWV4cGVjdGVkXFxcIj5Gb3ggNyBBdXN0aW48L2E+LlxcbkNsaWNrIHNvdW5kIGZyb20gPGEgaHJlZj1cXFwiaHR0cHM6Ly9vcGVuZ2FtZWFydC5vcmcvY29udGVudC9jbGlja1xcXCI+cXVib2R1cCBvbiBPcGVuR2FtZUFydDwvYT4uXFxuSGVsaWNvcHRlciBzb3VuZCBlZmZlY3QgZnJvbSA8YSBocmVmPVxcXCJodHRwczovL3d3dy55b3V0dWJlLmNvbS93YXRjaD92PTJSdERnVG02cm40XFxcIj5PbGF2byBKdW5pb3I8L2E+LlxcblRyYWZmaWMgc291bmQgZWZmZWN0IGZyb20gPGEgaHJlZj1cXFwiaHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1EMWxYUGxnMHN6MFxcXCI+Um95YWx0eUZyZWVTb3VuZHM8L2E+Llxcbkljb25zIGZyb20gPGEgaHJlZj1cXFwiaHR0cHM6Ly9mb250YXdlc29tZS5jb20vXFxcIj5Gb250IEF3ZXNvbWU8L2E+LlxcblxcblRoYW5rIHlvdSBmb3IgcGxheWluZyFcIixcIm9wdGlvbnNcIjpbXX19IiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXVkaW9NYW5hZ2VyIHtcbiAgICBlbGVtZW50ID0gbmV3IEF1ZGlvKCk7XG4gICAgXG4gICAgcGxheShuYW1lOiBTdHJpbmcsIHZvbHVtZTogbnVtYmVyID0gMSkge1xuICAgICAgICB0aGlzLmVsZW1lbnQuc3JjID0gYGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9rZmlzaDYxMC90ZXh0LWFkdmVudHVyZS9tYWluL2Fzc2V0cy8ke25hbWV9YDtcbiAgICAgICAgdGhpcy5lbGVtZW50LnZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5lbGVtZW50LnBsYXkoKTtcbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGF1c2UoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5lbGVtZW50LnBhdXNlKCk7XG4gICAgfVxuXG4gICAgcmVzdW1lKCkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucGxheSgpO1xuICAgIH1cblxuICAgIGxvb3Aoc2hvdWxkTG9vcDogYm9vbGVhbikge1xuICAgICAgICB0aGlzLmVsZW1lbnQubG9vcCA9IHNob3VsZExvb3A7XG4gICAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1YmJsZXMge1xuICAgIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuICAgIGJ1YmJsZXM6IEFycmF5PEJ1YmJsZT4gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5jdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcbiAgICAgICAgdGhpcy5yZXNpemUoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYnViYmxlcy5wdXNoKG5ldyBCdWJibGUoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLmN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy5jdHguY2FudmFzLndpZHRoLCB0aGlzLmN0eC5jYW52YXMuaGVpZ2h0KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYnViYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zcGVlZCA+IDAgJiYgdGhpcy5idWJibGVzW2ldLmxpZmV0aW1lIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0uc3BlZWQgKj0gLTE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS51cGRhdGUoZHQpO1xuICAgICAgICAgICAgaWYgKHRoaXMuYnViYmxlc1tpXS5zaXplIDw9IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXNbaV0gPSBuZXcgQnViYmxlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlc1tpXS5kcmF3KHRoaXMuY3R4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdmFyIGRwciA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIHx8IDE7XG4gICAgICAgIHZhciByZWN0ID0gdGhpcy5jdHguY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy53aWR0aCA9IHJlY3Qud2lkdGggKiBkcHI7XG4gICAgICAgIHRoaXMuY3R4LmNhbnZhcy5oZWlnaHQgPSByZWN0LmhlaWdodCAqIGRwcjtcblxuICAgICAgICAvLyB0aGlzLmN0eC5zY2FsZShkcHIsIGRwcik7XG5cbiAgICAgICAgdGhpcy5jdHguZmlsdGVyID0gXCJibHVyKDUwcHgpXCI7XG4gICAgfVxufVxuXG5jbGFzcyBCdWJibGUge1xuICAgIHNwZWVkOiBudW1iZXI7XG4gICAgeDogbnVtYmVyO1xuICAgIHk6IG51bWJlcjtcbiAgICBzaXplOiBudW1iZXI7XG4gICAgY29sb3I6IHN0cmluZztcbiAgICBsaWZldGltZTogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuc3BlZWQgPSAwLjAyO1xuXG4gICAgICAgIHRoaXMueCA9IE1hdGgucmFuZG9tKCkgKiB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgdGhpcy55ID0gTWF0aC5yYW5kb20oKSAqIHdpbmRvdy5pbm5lckhlaWdodDtcblxuICAgICAgICB0aGlzLnNpemUgPSAxMDtcblxuICAgICAgICBsZXQgdiA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGxldCBodWUgPSB2IDwgMC41ID8gMTUwIDogMjMwO1xuICAgICAgICBsZXQgc2F0ID0gdiA8IDAuNSA/IDUwIDogODU7XG4gICAgICAgIGxldCBsaWdodCA9IHYgPCAwLjUgPyAyNSA6IDQwO1xuICAgICAgICB0aGlzLmNvbG9yID0gXCJoc2xhKFwiICsgaHVlICsgXCIsIFwiICsgc2F0ICsgXCIlLCBcIiArIGxpZ2h0ICsgXCIlLCAyMCUpXCI7XG5cbiAgICAgICAgdGhpcy5saWZldGltZSA9IE1hdGgucmFuZG9tKCkgKiogNSAqIDE2MDAwICsgMjAwMDtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLnNpemUgKz0gdGhpcy5zcGVlZCAqIGR0O1xuICAgICAgICB0aGlzLmxpZmV0aW1lIC09IGR0O1xuICAgIH1cblxuICAgIGRyYXcoY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQpIHtcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuY29sb3I7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4LmFyYyh0aGlzLngsIHRoaXMueSwgdGhpcy5zaXplLCAwLCBNYXRoLlBJICogMik7XG4gICAgICAgIGN0eC5maWxsKCk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RvcnksIE9wdGlvbiB9IGZyb20gJy4vc3RvcnknO1xuXG5sZXQgc3Rvcnk6IFN0b3J5ID0gcmVxdWlyZShcIi4vc3RvcnkuY3NvblwiKTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnV0dG9ucyB7XG4gICAgZWxlbTogSFRNTEVsZW1lbnQ7XG4gICAgc2VsZWN0ZWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIHRleHQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGVuYWJsZWQgPSBmYWxzZTtcbiAgICBidXR0b25zOiBIVE1MQnV0dG9uRWxlbWVudFtdID0gW107XG4gICAgZmlyc3RFeGl0ID0gdHJ1ZTtcbiAgICB0YWxrZWQgPSBmYWxzZTtcblxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuZWxlbSA9IGVsZW07XG4gICAgfVxuXG4gICAgZW5hYmxlKHNjZW5lOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIGxldCBvcHRpb25zOiBPcHRpb25bXTtcbiAgICAgICAgaWYgKHN0b3J5W3NjZW5lXS5vcHRpb25zID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHN0b3J5W3N0b3J5W3NjZW5lXS5sb29wIV0ub3B0aW9ucyE7XG4gICAgICAgICAgICBsZXQgbG9vcGVkT3B0ID0gb3B0aW9ucy5maW5kSW5kZXgobyA9PiBvLnJldHVybiAhPSB1bmRlZmluZWQgPyBvLnJldHVybiA9PSBzY2VuZSA6IG8ubmV4dCA9PSBzY2VuZSk7XG4gICAgICAgICAgICBvcHRpb25zLnNwbGljZShsb29wZWRPcHQsIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHN0b3J5W3NjZW5lXS5vcHRpb25zITtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdGVwID0gb3B0aW9ucy5sZW5ndGggPT0gNCA/IDYgOiAxMi9vcHRpb25zLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb24gPSBvcHRpb25zW2ldO1xuICAgICAgICAgICAgaWYgKG9wdGlvbi5pZiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMudGFsa2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICBzdGVwID0gb3B0aW9ucy5sZW5ndGggPT0gNCA/IDYgOiAxMi9vcHRpb25zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgaS0tO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc05hbWUgPSBcIm92ZXJsYXlcIjtcbiAgICAgICAgICAgIGJ1dHRvbi5pbm5lckhUTUwgPSAgXCI+IDxpIGNsYXNzPVxcXCJmYS1zb2xpZCBmYS1cIisgb3B0aW9uLmljb24gK1wiXFxcIj48L2k+IFwiICsgb3B0aW9uLnRleHQ7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gXCI0IC8gMTBcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5sZW5ndGggPT0gNCkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5zdHlsZS5ncmlkQ29sdW1uID0gaSA8IDIgPyAoaSpzdGVwICsgMSkudG9TdHJpbmcoKSArIFwiIC8gXCIgKyAoKGkrMSkqc3RlcCArIDEpLnRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAoKGktMikqc3RlcCArIDEpLnRvU3RyaW5nKCkgKyBcIiAvIFwiICsgKChpLTEpKnN0ZXAgKyAxKS50b1N0cmluZygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBidXR0b24uc3R5bGUuZ3JpZENvbHVtbiA9IChpKnN0ZXAgKyAxKS50b1N0cmluZygpICsgXCIgLyBcIiArICgoaSsxKSpzdGVwICsgMSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJ1dHRvbi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZpcnN0RXhpdCAmJiBvcHRpb24uaWNvbiA9PSBcImFycm93LXVwLWZyb20tYnJhY2tldFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RFeGl0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50Lm9udmlzaWJpbGl0eWNoYW5nZSEobmV3IEV2ZW50KFwidmlzaWJpbGl0eWNoYW5nZVwiKSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY29uZmlybShcIk9wdGlvbnMgd2l0aCB0aGlzIGljb24gKHRoZSBleGl0aW5nIGFycm93KSBsZWF2ZSBhIHNjZW5lIHBlcm1hbmVudGx5LiBcXFxuVGhpcyBtZWFucyB0aGF0IGlmIHRoZXJlJ3MgYW55IG90aGVyIG9wdGlvbnMgeW91IGhhdmVuJ3QgdHJpZWQgeWV0LCBcXFxuYWZ0ZXIgY2xpY2tpbmcgdGhpcyBvcHRpb24geW91IHdvbid0IGJlIGFibGUgdG8gcmVhZCB0aGVtIHdpdGhvdXQgcmVzdGFydGluZyB0aGUgZ2FtZS4gXFxcbkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBjb250aW51ZT9cIikpIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNjZW5lID09IFwidGFsa1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGFsa2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RlZCA9IG9wdGlvbi5uZXh0O1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dCA9IFwiPGkgY2xhc3M9XFxcImZhLXNvbGlkIGZhLVwiKyBvcHRpb24uaWNvbiArXCJcXFwiPjwvaT4gXCIgKyBvcHRpb24udGV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW0uY2xhc3NOYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW0uaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1dHRvbnMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmVsZW0uYXBwZW5kQ2hpbGQoYnV0dG9uKTtcbiAgICAgICAgICAgIHRoaXMuYnV0dG9ucy5wdXNoKGJ1dHRvbik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbGVtLmNsYXNzTmFtZSA9IFwib3V0XCI7XG4gICAgfVxufSIsImltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuaW1wb3J0IFN0YXRlTWFuYWdlciBmcm9tIFwiLi9zdGF0ZV9tYW5hZ2VyXCI7XG5pbXBvcnQgeyBCZWdpblN0YXRlIH0gZnJvbSBcIi4vc3RhdGVzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEdhbWUge1xuICAgIHRlcm06IFRlcm1pbmFsO1xuICAgIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKHRlcm1pbmFsOiBIVE1MRWxlbWVudCkge1xuICAgICAgICB0ZXJtaW5hbC5zdHlsZS5saW5lSGVpZ2h0ID0gXCIxLjJyZW1cIjtcbiAgICAgICAgdGhpcy50ZXJtID0gbmV3IFRlcm1pbmFsKHRlcm1pbmFsKTtcbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbmV3IFN0YXRlTWFuYWdlcihCZWdpblN0YXRlKTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIudXBkYXRlKGR0LCB0aGlzLnRlcm0pO1xuXG4gICAgICAgIHRoaXMudGVybS51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIHJlc2l6ZSgpIHtcbiAgICAgICAgdGhpcy50ZXJtLnJlc2l6ZSgpO1xuICAgIH1cblxuICAgIGtleWRvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIua2V5ZG93bihlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgU3RhdGVNYW5hZ2VyIGZyb20gXCIuL3N0YXRlX21hbmFnZXJcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhYnN0cmFjdCBjbGFzcyBTdGF0ZSB7XG4gICAgcHJvdGVjdGVkIG1hbmFnZXI6IFN0YXRlTWFuYWdlcjtcblxuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFN0YXRlTWFuYWdlcikge1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIGluaXQodGVybTogVGVybWluYWwpIHt9XG5cbiAgICB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHt9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHt9XG59XG4iLCJpbXBvcnQgU3RhdGUgZnJvbSBcIi4vc3RhdGVcIjtcbmltcG9ydCBUZXJtaW5hbCBmcm9tIFwiLi90ZXJtaW5hbFwiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTdGF0ZU1hbmFnZXIge1xuICAgIHN0YXRlOiBTdGF0ZTtcbiAgICBuZWVkc0luaXQgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IoczogbmV3IChtOiBTdGF0ZU1hbmFnZXIpID0+IFN0YXRlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXcgcyh0aGlzKTtcbiAgICB9XG5cbiAgICBzZXRTdGF0ZShzOiBuZXcgKG06IFN0YXRlTWFuYWdlcikgPT4gU3RhdGUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5ldyBzKHRoaXMpO1xuICAgICAgICB0aGlzLm5lZWRzSW5pdCA9IHRydWU7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0OiBudW1iZXIsIHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIGlmICh0aGlzLm5lZWRzSW5pdCkge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZS5pbml0KHRlcm0pO1xuICAgICAgICAgICAgdGhpcy5uZWVkc0luaXQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUudXBkYXRlKGR0LCB0ZXJtKTtcbiAgICB9XG5cbiAgICBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5rZXlkb3duKGUpO1xuICAgIH1cbn1cbiIsImltcG9ydCBTdGF0ZSBmcm9tIFwiLi9zdGF0ZVwiO1xuaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuL3Rlcm1pbmFsXCI7XG5pbXBvcnQgQnV0dG9ucyBmcm9tIFwiLi9idXR0b25zXCI7XG5pbXBvcnQgeyBTdG9yeSB9IGZyb20gJy4vc3RvcnknO1xuaW1wb3J0IEF1ZGlvTWFuYWdlciBmcm9tIFwiLi9hdWRpb19tYW5hZ2VyXCI7XG5cbmxldCBzdG9yeTogU3RvcnkgPSByZXF1aXJlKFwiLi9zdG9yeS5jc29uXCIpO1xuXG5leHBvcnQgY2xhc3MgQmVnaW5TdGF0ZSBleHRlbmRzIFN0YXRlIHtcbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRlcm0ud3JpdGVMaW5lKFwiUHJlc3MgYW55IGtleSB0byBiZWdpbi4uLlwiKTtcbiAgICB9XG5cbiAgICBvdmVycmlkZSBrZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgdGhpcy5tYW5hZ2VyLnNldFN0YXRlKFdpcGVTdGF0ZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2lwZVN0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHByaXZhdGUgd2lwZVRpbWVyID0gMDtcbiAgICBwcml2YXRlIHdpcGVUaWNrcyA9IDA7XG4gICAgcHJpdmF0ZSB3aXBlTGluZXM6IG51bWJlcjtcblxuICAgIG92ZXJyaWRlIGluaXQodGVybTogVGVybWluYWwpIHtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLm92ZXJmbG93ID0gXCJoaWRkZW5cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnNjcm9sbFNuYXBUeXBlID0gXCJ1bnNldFwiO1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSBcIjEuNnJlbVwiO1xuICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gXCIxLjZyZW1cIjtcbiAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnRleHRJbmRlbnQgPSBcInVuc2V0XCI7XG4gICAgICAgIHRoaXMud2lwZUxpbmVzID0gdGVybS5tYXhMaW5lcztcbiAgICB9XG5cbiAgICBvdmVycmlkZSB1cGRhdGUoZHQ6IG51bWJlciwgdGVybTogVGVybWluYWwpIHtcbiAgICAgICAgaWYgKHRoaXMud2lwZVRpbWVyID4gNTApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndpcGVUaWNrcyA+IDUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVMaW5lcy0tO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpcGVUaWNrcysrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0ZXJtLmZpbGxSYW5kb20odGhpcy53aXBlTGluZXMpO1xuXG4gICAgICAgICAgICB0aGlzLndpcGVUaW1lciA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53aXBlTGluZXMgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy53aXBlVGltZXIgKz0gZHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0ZXJtLnJlc2V0KCk7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUub3ZlcmZsb3cgPSBcIlwiO1xuICAgICAgICAgICAgdGVybS5lbGVtZW50LnN0eWxlLnNjcm9sbFNuYXBUeXBlID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS5wYWRkaW5nTGVmdCA9IFwiXCI7XG4gICAgICAgICAgICB0ZXJtLmVsZW1lbnQuc3R5bGUucGFkZGluZ1JpZ2h0ID0gXCJcIjtcbiAgICAgICAgICAgIHRlcm0uZWxlbWVudC5zdHlsZS50ZXh0SW5kZW50ID0gXCJcIjtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5zZXRTdGF0ZShQbGF5aW5nU3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGxheWluZ1N0YXRlIGV4dGVuZHMgU3RhdGUge1xuICAgIHNjZW5lID0gXCJiZWdpblwiO1xuXG4gICAgcmVtYWluaW5nVGV4dCA9IFwiXCI7XG5cbiAgICBkZWxheSA9IDA7XG5cbiAgICB0ZXh0RGVjb2RlZCA9IC0xO1xuICAgIHRleHRQb3NpdGlvbiA9IC0xO1xuXG4gICAgYnV0dG9ucyA9IG5ldyBCdXR0b25zKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYnV0dG9uc1wiKSEpO1xuXG4gICAgYXVkaW8gPSBuZXcgQXVkaW9NYW5hZ2VyKCk7XG4gICAgYmFja2dyb3VuZCA9IG5ldyBBdWRpb01hbmFnZXIoKTtcblxuICAgIGN1cnJTb3VuZCA9IFwiY2xpY2sud2F2XCI7XG5cbiAgICBsb2NrID0gZmFsc2U7XG4gICAgZW5kID0gZmFsc2U7XG5cbiAgICBvdmVycmlkZSBpbml0KHRlcm06IFRlcm1pbmFsKSB7XG4gICAgICAgIHRoaXMuYXVkaW8ubG9vcChmYWxzZSk7XG4gICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHN0b3J5W3RoaXMuc2NlbmVdLnRleHQ7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jbG9zZScpIS5vbmNsaWNrID0gKGUpID0+IHtcbiAgICAgICAgICAgIHRoaXMubG9jayA9IGZhbHNlO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ltYWdlLWNvbnRhaW5lcicpIS5jbGFzc05hbWUgPSBcIlwiO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIG92ZXJyaWRlIHVwZGF0ZShkdDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBpZiAodGhpcy5sb2NrIHx8IHRoaXMuZW5kKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuYnV0dG9ucy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuYnV0dG9ucy5zZWxlY3RlZCAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmJhY2tncm91bmQuc3RvcCgpO1xuICAgICAgICAgICAgdGVybS53cml0ZUxpbmUodGhpcy5idXR0b25zLnRleHQhKTtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUgPSB0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQ7XG4gICAgICAgICAgICB0aGlzLmJ1dHRvbnMuc2VsZWN0ZWQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gc3RvcnlbdGhpcy5zY2VuZV0udGV4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlbWFpbmluZ1RleHQubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRoaXMuYXVkaW8uc3RvcCgpO1xuICAgICAgICAgICAgdGVybS5icmVhaygpO1xuICAgICAgICAgICAgaWYodGhpcy5zY2VuZSA9PSBcImNyZWRpdHNcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmJ1dHRvbnMuZW5hYmxlKHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZGVsYXkgPD0gMCkge1xuICAgICAgICAgICAgbGV0IFtwb3MsIGluZGV4XSA9IHRoaXMuaW5kZXhPZk1hbnkodGhpcy5yZW1haW5pbmdUZXh0LCBcIjxbIFxcblwiKTtcbiAgICAgICAgICAgIGlmKHBvcyA9PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVTcGVjaWFsKGluZGV4LCB0ZXJtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0ZVRleHQocG9zLCB0ZXJtLCBkdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF5IC09IGR0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpbmRleE9mTWFueShzdHI6IHN0cmluZywgY2hhcnM6IHN0cmluZyk6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IGMgPSBjaGFycy5pbmRleE9mKHN0cltpXSk7XG4gICAgICAgICAgICBpZiAoYyAhPSAtMSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBbaSwgY107XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFstMSwgLTFdO1xuICAgIH1cblxuICAgIHByaXZhdGUgd3JpdGVUZXh0KGxlbjogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCwgZHQ6IG51bWJlcikge1xuICAgICAgICBpZiAobGVuID09IC0xKSB7XG4gICAgICAgICAgICBsZW4gPSB0aGlzLnJlbWFpbmluZ1RleHQubGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudGV4dERlY29kZWQgPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuYXVkaW8ucGxheSh0aGlzLmN1cnJTb3VuZCk7XG4gICAgICAgICAgICB0aGlzLnRleHREZWNvZGVkID0gMDtcbiAgICAgICAgICAgIHRoaXMudGV4dFBvc2l0aW9uID0gdGVybS5nZXRQb3NpdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHRleHQgPVxuICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDAsIHRoaXMudGV4dERlY29kZWQpICtcbiAgICAgICAgICAgIHRlcm0ucmFuZG9tQ2hhcmFjdGVycyhsZW4gLSB0aGlzLnRleHREZWNvZGVkKTtcblxuICAgICAgICB0ZXJtLndyaXRlKHRleHQsIHRoaXMudGV4dFBvc2l0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy50ZXh0RGVjb2RlZCA9PSBsZW4pIHtcbiAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZShsZW4pO1xuICAgICAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCA9IC0xO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50ZXh0RGVjb2RlZCsrO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlU3BlY2lhbChpbmRleDogbnVtYmVyLCB0ZXJtOiBUZXJtaW5hbCkge1xuICAgICAgICBzd2l0Y2ggKGluZGV4KSB7XG4gICAgICAgICAgICBjYXNlIDA6IC8vIDxcbiAgICAgICAgICAgICAgICBsZXQgZW5kVGFnUG9zID0gdGhpcy5yZW1haW5pbmdUZXh0LmluZGV4T2YoXCI+XCIpO1xuICAgICAgICAgICAgICAgIHRlcm0ud3JpdGUodGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDAsIGVuZFRhZ1BvcyArIDEpKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoZW5kVGFnUG9zICsgMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDE6IC8vIFtcbiAgICAgICAgICAgICAgICBsZXQgZW5kQ29tbWFuZFBvcyA9IHRoaXMucmVtYWluaW5nVGV4dC5pbmRleE9mKFwiXVwiKTtcbiAgICAgICAgICAgICAgICBsZXQgY29tbWFuZCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgxLCBlbmRDb21tYW5kUG9zKTtcbiAgICAgICAgICAgICAgICBsZXQgc3BhY2VQb3MgPSBjb21tYW5kLmluZGV4T2YoXCIgXCIpO1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoc3BhY2VQb3MgPT0gLTEgPyBjb21tYW5kIDogY29tbWFuZC5zbGljZSgwLCBzcGFjZVBvcykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImRlbGF5XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlbGF5ID0gcGFyc2VJbnQoY29tbWFuZC5zbGljZShzcGFjZVBvcyArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwibm9ybWFsXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmF1ZGlvLnBsYXkodGhpcy5jdXJyU291bmQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVybS53cml0ZShjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzZXBcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwic291bmRcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY3VyclNvdW5kID0gY29tbWFuZC5zbGljZShzcGFjZVBvcyArIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJiYWNrZ3JvdW5kXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BhY2VQb3MgPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJhY2tncm91bmQuc3RvcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJhY2tncm91bmQucGxheShjb21tYW5kLnNsaWNlKHNwYWNlUG9zICsgMSksIDAuMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImltYWdlXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXJtLndyaXRlKGA8YSBvbmNsaWNrPSdpbWdDbGljaygpJz5DbGljayB0byB2aWV3IGltYWdlPC9hPmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2NrID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5pbWdDbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ltYWdlJykgYXMgSFRNTEltYWdlRWxlbWVudCkuc3JjID0gY29tbWFuZC5zbGljZShzcGFjZVBvcyArIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbWFnZS1jb250YWluZXInKSEuY2xhc3NOYW1lID0gXCJzaG93XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnJlbWFpbmluZ1RleHQgPSB0aGlzLnJlbWFpbmluZ1RleHQuc2xpY2UoZW5kQ29tbWFuZFBvcyArIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAyOiAvLyA8c3BhY2U+XG4gICAgICAgICAgICAgICAgdGVybS53cml0ZShcIiBcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1haW5pbmdUZXh0ID0gdGhpcy5yZW1haW5pbmdUZXh0LnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAzOiAvLyBcXG5cbiAgICAgICAgICAgICAgICB0ZXJtLndyaXRlTGluZShcIlwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRlbGF5ID0gNTAwO1xuICAgICAgICAgICAgICAgIHRoaXMucmVtYWluaW5nVGV4dCA9IHRoaXMucmVtYWluaW5nVGV4dC5zbGljZSgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJJbnZhbGlkIGNoYXIgaW5kZXggXCIgKyBpbmRleCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgICBpbnRlcmZhY2UgV2luZG93IHsgaW1nQ2xpY2s6ICgpID0+IHZvaWQ7IH1cbn1cbiIsImltcG9ydCBMaW5lQ2xhbXAgZnJvbSBcIkB0dmFuYy9saW5lY2xhbXBcIjtcclxuXHJcbmNvbnN0IENVUlNPUl9CTElOS19JTlRFUlZBTCA9IDUwMDtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRlcm1pbmFsIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG5cclxuICAgIGZvbnRTaXplOiBudW1iZXI7XHJcbiAgICB3aWR0aDogbnVtYmVyO1xyXG4gICAgaGVpZ2h0OiBudW1iZXI7XHJcbiAgICBsaW5lSGVpZ2h0OiBudW1iZXI7XHJcblxyXG4gICAgbWF4TGluZXM6IG51bWJlcjtcclxuICAgIGNoYXJzUGVyTGluZTogbnVtYmVyO1xyXG5cclxuICAgIGNvbnRlbnQgPSBcIjxkaXY+PiBcIjtcclxuXHJcbiAgICBwcml2YXRlIGN1cnNvclZpc2libGUgPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBjdXJzb3JFbmFibGVkID0gdHJ1ZTtcclxuICAgIHByaXZhdGUgY3Vyc29yVGlja3MgPSAwO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGVsZW06IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbTtcclxuXHJcbiAgICAgICAgdGhpcy5mb250U2l6ZSA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuZm9udFNpemUuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLndpZHRoID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS53aWR0aC5zbGljZSgwLCAtMilcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gcGFyc2VJbnQoXHJcbiAgICAgICAgICAgIGdldENvbXB1dGVkU3R5bGUodGhpcy5lbGVtZW50KS5oZWlnaHQuc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xyXG4gICAgICAgIGNvbnN0IGNsYW1wID0gbmV3IExpbmVDbGFtcCh0aGlzLmVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMubGluZUhlaWdodCA9IGNsYW1wLmNhbGN1bGF0ZVRleHRNZXRyaWNzKCkuYWRkaXRpb25hbExpbmVIZWlnaHQ7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJcIjtcclxuXHJcbiAgICAgICAgdGhpcy5tYXhMaW5lcyA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgLyB0aGlzLmxpbmVIZWlnaHQpO1xyXG4gICAgICAgIHRoaXMuY2hhcnNQZXJMaW5lID0gTWF0aC5mbG9vcih0aGlzLndpZHRoIC8gKHRoaXMuZm9udFNpemUgKiAwLjYpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXNpemUoKSB7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkud2lkdGguc2xpY2UoMCwgLTIpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHBhcnNlSW50KFxyXG4gICAgICAgICAgICBnZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudCkuaGVpZ2h0LnNsaWNlKDAsIC0yKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMubWF4TGluZXMgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0IC8gdGhpcy5saW5lSGVpZ2h0KTtcclxuICAgICAgICB0aGlzLmNoYXJzUGVyTGluZSA9IE1hdGguZmxvb3IodGhpcy53aWR0aCAvICh0aGlzLmZvbnRTaXplICogMC42KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlKGR0OiBudW1iZXIpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclRpY2tzID49IENVUlNPUl9CTElOS19JTlRFUlZBTCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJzb3JUaWNrcyA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsaXBDdXJzb3IoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3Vyc29yVGlja3MgKz0gZHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc2hvdygpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQuaW5uZXJIVE1MID0gdGhpcy5jb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyKCkge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ID0gXCJcIjtcclxuICAgIH1cclxuXHJcbiAgICBnZXRQb3NpdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb250ZW50Lmxlbmd0aCAtICh0aGlzLmN1cnNvclZpc2libGUgPyAwIDogMSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHV0KHRleHQ6IHN0cmluZywgcG9zPzogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5zZXRDdXJzb3JFbmFibGVkKGZhbHNlKTtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIHBvcyAhPSB1bmRlZmluZWQgJiZcclxuICAgICAgICAgICAgcG9zID49IDAgJiZcclxuICAgICAgICAgICAgcG9zIDw9IHRoaXMuY29udGVudC5sZW5ndGggLSB0ZXh0Lmxlbmd0aFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgPVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZW50LnNsaWNlKDAsIHBvcykgK1xyXG4gICAgICAgICAgICAgICAgdGV4dCArXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQuc2xpY2UocG9zICsgdGV4dC5sZW5ndGgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudCArPSB0ZXh0O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwdXRMaW5lKHRleHQ6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZChmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5jb250ZW50ICs9IHRleHQgKyBcIjwvZGl2PjxkaXY+PiBcIjtcclxuICAgIH1cclxuXHJcbiAgICByZXNldCgpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5wdXQoXCI+IFwiKTtcclxuICAgICAgICB0aGlzLnNob3coKTtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgd3JpdGUodGV4dDogc3RyaW5nLCBwb3M/OiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnB1dCh0ZXh0LCBwb3MpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB3cml0ZUxpbmUodGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5wdXRMaW5lKHRleHQpO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBicmVhaygpIHtcclxuICAgICAgICB0aGlzLnNldEN1cnNvckVuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMuY29udGVudCArPSBcIjwvZGl2Pjxici8+PGRpdj4+IFwiO1xyXG4gICAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgICAgIHRoaXMuc2V0Q3Vyc29yRW5hYmxlZCh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICByYW5kb21DaGFyYWN0ZXJzKGNvdW50OiBudW1iZXIpIHtcclxuICAgICAgICBsZXQgdmFsdWVzID0gbmV3IFVpbnQ4QXJyYXkoY291bnQpO1xyXG4gICAgICAgIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKHZhbHVlcyk7XHJcbiAgICAgICAgY29uc3QgbWFwcGVkVmFsdWVzID0gdmFsdWVzLm1hcCgoeCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBhZGogPSB4ICUgMzY7XHJcbiAgICAgICAgICAgIHJldHVybiBhZGogPCAyNiA/IGFkaiArIDY1IDogYWRqIC0gMjYgKyA0ODtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbWFwcGVkVmFsdWVzKTtcclxuICAgIH1cclxuXHJcbiAgICBmaWxsUmFuZG9tKGxpbmVzOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLmNsZWFyKCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lczsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHV0KHRoaXMucmFuZG9tQ2hhcmFjdGVycyh0aGlzLmNoYXJzUGVyTGluZSkpO1xyXG4gICAgICAgICAgICB0aGlzLnB1dChcIjxiciAvPlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5wdXQodGhpcy5yYW5kb21DaGFyYWN0ZXJzKHRoaXMuY2hhcnNQZXJMaW5lKSk7XHJcbiAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0Q3Vyc29yRW5hYmxlZCh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuY3Vyc29yRW5hYmxlZCA9IHZhbHVlO1xyXG4gICAgICAgIC8vIGlmIHRoZSBjdXJzb3IgbmVlZGVkIHRvIGJlIHR1cm5lZCBvZmYsIGZpeCBpdFxyXG4gICAgICAgIGlmICghdGhpcy5jdXJzb3JFbmFibGVkICYmICF0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgdGhpcy5jb250ZW50ID0gdGhpcy5jb250ZW50LnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yVmlzaWJsZSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZmxpcEN1cnNvcigpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJzb3JFbmFibGVkKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnNvclZpc2libGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCArPSBcIl9cIjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHRoaXMuY29udGVudC5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5jdXJzb3JWaXNpYmxlID0gIXRoaXMuY3Vyc29yVmlzaWJsZTtcclxuICAgICAgICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IEJ1YmJsZXMgZnJvbSBcIi4vYnViYmxlc1wiO1xuaW1wb3J0IEdhbWUgZnJvbSBcIi4vZ2FtZVwiO1xuXG5sZXQgZ2FtZTogR2FtZTtcblxubGV0IGJ1YmJsZXM6IEJ1YmJsZXM7XG5cbmxldCBsYXN0VGltZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbndpbmRvdy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgYnViYmxlcyA9IG5ldyBCdWJibGVzKFxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJhY2tncm91bmRcIikgYXMgSFRNTENhbnZhc0VsZW1lbnRcbiAgICApO1xuICAgIGdhbWUgPSBuZXcgR2FtZShkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRlcm1pbmFsXCIpISk7XG5cbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG59O1xuXG53aW5kb3cub25yZXNpemUgPSAoKSA9PiB7XG4gICAgYnViYmxlcy5yZXNpemUoKTtcbiAgICBnYW1lLnJlc2l6ZSgpO1xufTtcblxuZG9jdW1lbnQub25rZXlkb3duID0gKGUpID0+IHtcbiAgICBnYW1lLmtleWRvd24oZSk7XG59O1xuXG5kb2N1bWVudC5vbnZpc2liaWxpdHljaGFuZ2UgPSAoKSA9PiB7XG4gICAgaWYgKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSA9PSBcInZpc2libGVcIikge1xuICAgICAgICBsYXN0VGltZSA9IG51bGw7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgIC8vIFRoaXMgcmVhbGx5IHNob3VsZG4ndCBiZSBuZWVkZWQgaWYgYnJvd3NlcnMgYXJlIGZvbGxvd2luZyBjb252ZW50aW9uLFxuICAgIC8vIGJ1dCBiZXR0ZXIgc2FmZSB0aGFuIHNvcnJ5XG4gICAgaWYgKGRvY3VtZW50LmhpZGRlbikge1xuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGFzdFRpbWUgPT0gbnVsbCkge1xuICAgICAgICBsYXN0VGltZSA9IC0xO1xuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGxhc3RUaW1lICE9IC0xKSB7XG4gICAgICAgIGxldCBkdCA9IHRpbWUgLSBsYXN0VGltZTtcblxuICAgICAgICBidWJibGVzLnVwZGF0ZShkdCk7XG4gICAgICAgIGdhbWUudXBkYXRlKGR0KTtcbiAgICB9XG5cbiAgICBsYXN0VGltZSA9IHRpbWU7XG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh1cGRhdGUpO1xufVxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9