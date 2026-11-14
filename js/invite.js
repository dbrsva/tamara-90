/* Приглашение на юбилей — скрипт.
   Без библиотек. Работает и в самостоятельной версии, и внутри блока «HTML-код» Taplink. */
(function () {
  "use strict";

  function init() {
    var root = document.getElementById("jb");
    if (!root || root.getAttribute("data-ready")) return;
    root.setAttribute("data-ready", "1");
    root.classList.add("jb-js");

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    initReveal(root, reduceMotion);
    initRibbons(root, reduceMotion);
    initRunningPause(root);
    initGallery(root, reduceMotion);
    initCountdown(root);
    initRsvp(root);
  }

  /* ───────── Плавное появление при прокрутке ───────── */
  function initReveal(root, reduceMotion) {
    var items = root.querySelectorAll("[data-reveal]");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add("is-in");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        // кадры галереи проявляются вместе — иначе выглядывающие края соседних фото остаются пустыми
        var group = e.target.classList.contains("jb-gallery__item")
          ? e.target.parentNode.querySelectorAll(".jb-gallery__item")
          : [e.target];
        for (var k = 0; k < group.length; k++) {
          group[k].classList.add("is-in");
          io.unobserve(group[k]);
        }
      });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.12 });
    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }

  /* ───────── Бегущая строка «90 саас» ─────────
     В разметке — один фрагмент. Повторяем его, пока группа не станет шире экрана,
     затем дублируем группу целиком: сдвиг на −50% даёт бесшовный круг. */
  function initRibbons(root, reduceMotion) {
    var ribbons = root.querySelectorAll(".jb-ribbon");
    var SPEED = 24; // пикселей в секунду — медленно и спокойно

    function build(ribbon) {
      var track = ribbon.querySelector(".jb-ribbon__track");
      var groups = track.querySelectorAll(".jb-ribbon__group");
      for (var g = 1; g < groups.length; g++) track.removeChild(groups[g]);
      var group = groups[0];
      if (!group.__unit) group.__unit = group.innerHTML;
      group.innerHTML = group.__unit;
      var need = ribbon.clientWidth + 40, guard = 0;
      while (group.scrollWidth < need && guard++ < 40) group.insertAdjacentHTML("beforeend", group.__unit);
      if (reduceMotion) { ribbon.classList.remove("is-ready"); return; }
      track.appendChild(group.cloneNode(true));
      ribbon.style.setProperty("--dur", Math.max(20, Math.round(group.scrollWidth / SPEED)) + "s");
      ribbon.classList.add("is-ready");
    }

    function buildAll() { for (var i = 0; i < ribbons.length; i++) build(ribbons[i]); }
    buildAll();
    // после загрузки шрифтов ширина текста меняется — пересчитываем
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildAll);

    var lastW = root.clientWidth, t = null;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (Math.abs(root.clientWidth - lastW) > 40) { lastW = root.clientWidth; buildAll(); }
      }, 250);
    });
  }

  /* Бегущие ленты двигаются, только пока видны на экране */
  function initRunningPause(root) {
    var els = root.querySelectorAll(".jb-run, .jb-ribbon");
    if (!("IntersectionObserver" in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add("is-on");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle("is-on", e.isIntersecting); });
    }, { rootMargin: "120px 0px" });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }

  /* ───────── Галерея: свайп с привязкой, точки, активный кадр ───────── */
  function initGallery(root, reduceMotion) {
    var track = root.querySelector(".jb-gallery__track");
    if (!track) return;
    var slides = track.querySelectorAll(".jb-gallery__item");
    var dots = root.querySelectorAll(".jb-gallery__dots button");
    var active = -1;
    var ticking = false;

    function setActive(idx) {
      if (idx === active) return;
      active = idx;
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.toggle("is-active", i === idx);
        if (dots[i]) dots[i].setAttribute("aria-current", i === idx ? "true" : "false");
      }
    }

    function update() {
      ticking = false;
      var mid = track.scrollLeft + track.clientWidth / 2;
      var best = 0, bestDist = Infinity;
      for (var i = 0; i < slides.length; i++) {
        var c = slides[i].offsetLeft + slides[i].offsetWidth / 2;
        var d = Math.abs(c - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      setActive(best);
    }

    track.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    function goTo(i) {
      var s = slides[i];
      if (!s) return;
      var left = s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2;
      try {
        track.scrollTo({ left: left, behavior: reduceMotion ? "auto" : "smooth" });
      } catch (err) {
        track.scrollLeft = left;
      }
    }

    for (var d = 0; d < dots.length; d++) {
      (function (i) { dots[i].addEventListener("click", function () { goTo(i); }); })(d);
    }

    // клавиатура: стрелки листают кадры
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(Math.min(active + 1, slides.length - 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(Math.max(active - 1, 0)); }
    });

    // на телефоне первым показываем центральный кадр (основное фото), без анимации
    function start() {
      var isCarousel = track.scrollWidth > track.clientWidth + 4;
      root.classList.toggle("jb-no-carousel", !isCarousel);
      if (isCarousel && active === -1) {
        var mid = slides[1];
        if (mid) track.scrollLeft = mid.offsetLeft - (track.clientWidth - mid.offsetWidth) / 2;
      }
      update();
    }
    start();
    window.addEventListener("resize", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; start(); }); }
    });
  }

  /* ───────── Обратный отсчёт до начала торжества ───────── */
  function initCountdown(root) {
    var box = root.querySelector(".jb-countdown");
    var target = Date.parse(root.getAttribute("data-event") || "");
    if (!box || isNaN(target)) return;
    var cells = {
      d: box.querySelector('[data-u="d"]'),
      h: box.querySelector('[data-u="h"]'),
      m: box.querySelector('[data-u="m"]'),
      s: box.querySelector('[data-u="s"]')
    };
    var timer = null;

    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) {
        box.hidden = true;
        if (timer) clearInterval(timer);
        return false;
      }
      var s = Math.floor(diff / 1000);
      cells.d.textContent = Math.floor(s / 86400);
      cells.h.textContent = pad(Math.floor((s % 86400) / 3600));
      cells.m.textContent = pad(Math.floor((s % 3600) / 60));
      cells.s.textContent = pad(s % 60);
      return true;
    }
    if (tick()) {
      box.hidden = false;
      timer = setInterval(tick, 1000);
    }
  }

  /* ───────── Анкета гостя ───────── */
  function initRsvp(root) {
    var form = root.querySelector(".jb-form");
    if (!form) return;
    var card = form.parentNode;
    var thanks = card.querySelector(".jb-thanks");
    var btn = form.querySelector(".jb-submit");
    var btnText = btn.querySelector(".jb-submit__text");
    var status = form.querySelector(".jb-status");
    var guestsWrap = form.querySelector("[data-guests]");
    var guests = form.querySelector('input[name="guests"]');
    var nameInput = form.querySelector('input[name="name"]');
    var radios = form.querySelectorAll('input[name="attendance"]');
    var endpoint = (root.getAttribute("data-rsvp-endpoint") || "").trim();
    var sending = false;
    var submissionId = makeId();

    function makeId() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    function attendance() {
      for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i];
      return null;
    }

    function fieldOf(el) { return el.closest(".jb-field"); }

    function syncChoices() {
      var a = attendance();
      for (var i = 0; i < radios.length; i++) {
        radios[i].closest(".jb-choice").classList.toggle("is-checked", radios[i].checked);
      }
      var open = !!a && a.value === "yes";
      guestsWrap.classList.toggle("is-open", open);
      guests.disabled = !open;
      guestsWrap.querySelectorAll("button").forEach(function (b) { b.disabled = !open; });
      if (a) fieldOf(radios[0]).classList.remove("is-invalid");
    }

    for (var r = 0; r < radios.length; r++) radios[r].addEventListener("change", syncChoices);
    syncChoices();

    nameInput.addEventListener("input", function () {
      if (nameInput.value.trim()) fieldOf(nameInput).classList.remove("is-invalid");
    });

    // счётчик гостей
    function clampGuests(v) {
      v = parseInt(v, 10);
      if (isNaN(v)) v = 1;
      return Math.max(1, Math.min(10, v));
    }
    form.querySelectorAll("[data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        guests.value = clampGuests(guests.value) + parseInt(b.getAttribute("data-step"), 10);
        guests.value = clampGuests(guests.value);
      });
    });
    guests.addEventListener("blur", function () { guests.value = clampGuests(guests.value); });

    function validate() {
      var ok = true, firstBad = null;
      if (!nameInput.value.trim()) {
        fieldOf(nameInput).classList.add("is-invalid");
        ok = false; firstBad = firstBad || nameInput;
      }
      if (!attendance()) {
        fieldOf(radios[0]).classList.add("is-invalid");
        ok = false; firstBad = firstBad || radios[0];
      }
      if (firstBad) {
        try { firstBad.focus({ preventScroll: true }); } catch (e) { firstBad.focus(); }
        var f = fieldOf(firstBad);
        if (f && f.scrollIntoView) f.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return ok;
    }

    function setBusy(busy) {
      sending = busy;
      btn.disabled = busy;
      btn.setAttribute("aria-busy", busy ? "true" : "false");
      btnText.textContent = btnText.getAttribute(busy ? "data-busy" : "data-idle");
    }

    function showThanks() {
      form.hidden = true;
      thanks.hidden = false;
      try { thanks.focus({ preventScroll: true }); } catch (e) { /* старые браузеры */ }
      var top = card.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) card.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;                    // защита от двойного нажатия
      status.textContent = "";
      if (!validate()) return;

      if (form.elements.website && form.elements.website.value) { showThanks(); return; } // бот

      if (!endpoint) {
        status.textContent = status.getAttribute("data-unconfigured");
        return;
      }

      var a = attendance();
      var coming = a.value === "yes";
      var data = new URLSearchParams();
      data.append("id", submissionId);
      data.append("name", nameInput.value.trim());
      data.append("attendance", a.value);
      data.append("attendanceText", a.closest(".jb-choice").querySelector(".jb-choice__text").textContent.trim());
      data.append("guests", coming ? String(clampGuests(guests.value)) : "0");
      data.append("comment", form.elements.comment.value.trim());
      data.append("page", location.href.split("#")[0]);

      setBusy(true);
      var ctrl = "AbortController" in window ? new AbortController() : null;
      var timeout = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);

      fetch(endpoint, {
        method: "POST",
        body: data,                     // x-www-form-urlencoded — «простой» запрос без preflight
        redirect: "follow",
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (json) {
          if (!json || json.ok !== true) throw new Error((json && json.error) || "bad response");
          submissionId = makeId();
          showThanks();
        })
        .catch(function () {
          // данные формы остаются на месте — гость может просто нажать ещё раз;
          // тот же id не даст записать дубль, если первый запрос всё-таки дошёл
          status.textContent = status.getAttribute("data-error");
        })
        .then(function () {
          clearTimeout(timeout);
          setBusy(false);
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
