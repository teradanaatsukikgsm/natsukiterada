const menuButton = document.querySelector(".menu-button");
const sideMenu = document.querySelector(".side-menu");
const menuOverlay = document.querySelector(".menu-overlay");
const loadingScreen = document.querySelector(".loading-screen");
const ringLoader = document.querySelector(".dot-ring-loader");
const ringDots = document.querySelectorAll(".dot-ring-loader .ring-dot");

/* =========================
   STATE
========================= */

let loaderRAF = null;
let loaderStart = null;
let loaderFinished = false;
let slideInterval = null;
let hoverHandler = null;
let sliderReady = false;

/* =========================
   LOADER UTILS
========================= */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function smoother(t) {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/* =========================
   MENU
========================= */

if (menuButton && sideMenu && menuOverlay) {
  menuButton.addEventListener("click", () => {
    menuButton.classList.toggle("is-open");
    sideMenu.classList.toggle("is-open");
    menuOverlay.classList.toggle("is-open");
  });

  menuOverlay.addEventListener("click", () => {
    menuButton.classList.remove("is-open");
    sideMenu.classList.remove("is-open");
    menuOverlay.classList.remove("is-open");
  });
}

/* =========================
   HERO SLIDER
========================= */

const slides = document.querySelectorAll(".hero-slide");
const hero = document.querySelector(".hero-slider");
const prevButton = document.querySelector(".hero-arrow-left");
const nextButton = document.querySelector(".hero-arrow-right");

function createShuffledOrder(length) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function findSlideIndexByFileName(fileName) {
  return Array.from(slides).findIndex((slide) => {
    const img = slide.querySelector(".hero-main-image");
    if (!img) return false;

    const src = img.getAttribute("src") || "";
    const actualFileName = src.split("/").pop();

    return actualFileName === fileName;
  });
}

/* 最初の1枚固定 */
const fixedStartIndex = findSlideIndexByFileName("2024-11-17_51.jpg");

const slideOrder = createShuffledOrder(slides.length);

if (fixedStartIndex !== -1) {
  const pos = slideOrder.indexOf(fixedStartIndex);
  if (pos !== -1) {
    [slideOrder[0], slideOrder[pos]] = [slideOrder[pos], slideOrder[0]];
  }
}

let currentOrderIndex = 0;

function showArrows() {
  if (window.innerWidth <= 900) return;

  [prevButton, nextButton].forEach((btn) => {
    if (btn) {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  });
}

function hideArrows() {
  [prevButton, nextButton].forEach((btn) => {
    if (btn) {
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
    }
  });
}

function updateArrowPositions() {
  if (window.innerWidth <= 900) return;

  const activeSlide = document.querySelector(".hero-slide.is-active");
  if (!activeSlide || !hero || !prevButton || !nextButton) return;

  const target =
    activeSlide.querySelector(".hero-image-wrapper") ||
    activeSlide.querySelector(".hero-main-image");

  if (!target) return;

  const heroRect = hero.getBoundingClientRect();
  const imgRect = target.getBoundingClientRect();

  const gap = window.innerWidth <= 1440 ? 22 : 16;
  const arrowSize = window.innerWidth <= 1440 ? 88 : 72;

  const leftPos = imgRect.left - heroRect.left - arrowSize - gap;
  const rightPos = heroRect.right - imgRect.right - arrowSize - gap;

  prevButton.style.left = `${Math.max(12, leftPos)}px`;
  prevButton.style.right = "auto";

  nextButton.style.right = `${Math.max(12, rightPos)}px`;
  nextButton.style.left = "auto";
}

function setupHoverArea() {
  if (window.innerWidth <= 900) {
    hideArrows();
    return;
  }

  hideArrows();

  const activeSlide = document.querySelector(".hero-slide.is-active");
  if (!activeSlide || !hero) return;

  const target =
    activeSlide.querySelector(".hero-image-wrapper") ||
    activeSlide.querySelector(".hero-main-image");

  if (!target) return;

  if (hoverHandler) {
    hero.removeEventListener("mousemove", hoverHandler);
  }

  hoverHandler = (e) => {
    const rect = target.getBoundingClientRect();
    const expandX = 78;
    const expandY = 34;

    const withinX =
      e.clientX >= rect.left - expandX &&
      e.clientX <= rect.right + expandX;

    const withinY =
      e.clientY >= rect.top - expandY &&
      e.clientY <= rect.bottom + expandY;

    if (withinX && withinY) {
      showArrows();
    } else {
      hideArrows();
    }
  };

  hero.addEventListener("mousemove", hoverHandler);
  hero.addEventListener("mouseleave", hideArrows);
}

function updateSlides() {
  if (!slides.length) return;

  slides.forEach((slide) => slide.classList.remove("is-active"));

  const total = slides.length;

  const activeIndex = slideOrder[currentOrderIndex];
  const prevOrderIndex = (currentOrderIndex - 1 + total) % total;
  const nextOrderIndex = (currentOrderIndex + 1) % total;

  const prevIndex = slideOrder[prevOrderIndex];
  const nextIndex = slideOrder[nextOrderIndex];

  const activeSlide = slides[activeIndex];
  activeSlide.classList.add("is-active");

  setupHoverArea();

  requestAnimationFrame(() => {
    updateArrowPositions();
  });
}

function prepareFirstSlide() {
  if (!slides.length) return;
  currentOrderIndex = 0;
  updateSlides();
}

/* 修正済み */
function enableSliderTransitions() {
  if (hero) {
    hero.classList.add("is-initialized");
    hero.classList.add("is-visible");
  }
}

function goToNextSlide() {
  currentOrderIndex = (currentOrderIndex + 1) % slides.length;
  updateSlides();
  showArrows();
}

function goToPrevSlide() {
  currentOrderIndex = (currentOrderIndex - 1 + slides.length) % slides.length;
  updateSlides();
  showArrows();
}

function startSlideShow() {
  clearTimeout(slideInterval);

  let isFirst = true;

  function scheduleNext() {
    const delay = isFirst ? 6300 : 3800;

    slideInterval = setTimeout(() => {
      goToNextSlide();
      isFirst = false;
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

/* =========================
   LOADER
========================= */

function startRingLoader() {
  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.classList.add("is-hidden");
    }

    enableSliderTransitions();
    sliderReady = true;
    startSlideShow();
  }, 1200);
}

/* =========================
   WINDOW LOAD
========================= */

window.addEventListener("load", () => {
  document.body.classList.add("is-loaded");

  prepareFirstSlide();

  if (loadingScreen) {
    startRingLoader();
  } else {
    enableSliderTransitions();
    sliderReady = true;
    startSlideShow();
  }

  updateArrowPositions();
});
