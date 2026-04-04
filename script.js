const menuButton = document.querySelector(".menu-button");
const sideMenu = document.querySelector(".side-menu");
const menuOverlay = document.querySelector(".menu-overlay");
const loadingScreen = document.querySelector(".loading-screen");
const ringLoader = document.querySelector(".dot-ring-loader");
const ringDots = document.querySelectorAll(".dot-ring-loader .ring-dot");

let loaderRAF = null;
let loaderStart = null;
let loaderFinished = false;

/* =========================
   LOADER UTILS
========================= */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function smooth(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
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

let slideInterval = null;
let hoverHandler = null;
let sliderInitialized = false;

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

const startCandidates = ["2024-11-17_51.jpg", "4.jpg"];

const availableStartCandidates = startCandidates.filter((fileName) => {
  return findSlideIndexByFileName(fileName) !== -1;
});

let fixedStartIndex = -1;

if (availableStartCandidates.length > 0) {
  const selectedFile =
    availableStartCandidates[
      Math.floor(Math.random() * availableStartCandidates.length)
    ];

  fixedStartIndex = findSlideIndexByFileName(selectedFile);
}

const slideOrder = createShuffledOrder(slides.length);

if (fixedStartIndex !== -1) {
  const pos = slideOrder.indexOf(fixedStartIndex);
  if (pos !== -1) {
    [slideOrder[0], slideOrder[pos]] = [slideOrder[pos], slideOrder[0]];
  }
}

let currentOrderIndex = 0;

function showArrows() {
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
  const prev2OrderIndex = (currentOrderIndex - 2 + total) % total;
  const nextOrderIndex = (currentOrderIndex + 1) % total;
  const next2OrderIndex = (currentOrderIndex + 2) % total;

  const prevIndex = slideOrder[prevOrderIndex];
  const prev2Index = slideOrder[prev2OrderIndex];
  const nextIndex = slideOrder[nextOrderIndex];
  const next2Index = slideOrder[next2OrderIndex];

  const activeSlide = slides[activeIndex];
  activeSlide.classList.add("is-active");

  const prevImgSrc =
    slides[prevIndex].querySelector(".hero-main-image")?.src || "";
  const prev2ImgSrc =
    slides[prev2Index].querySelector(".hero-main-image")?.src || "";
  const nextImgSrc =
    slides[nextIndex].querySelector(".hero-main-image")?.src || "";
  const next2ImgSrc =
    slides[next2Index].querySelector(".hero-main-image")?.src || "";

  const left1 = activeSlide.querySelector(".hero-preview-left-1");
  const left2 = activeSlide.querySelector(".hero-preview-left-2");
  const right1 = activeSlide.querySelector(".hero-preview-right-1");
  const right2 = activeSlide.querySelector(".hero-preview-right-2");

  if (left1) left1.src = prevImgSrc;
  if (left2) left2.src = prev2ImgSrc;
  if (right1) right1.src = nextImgSrc;
  if (right2) right2.src = next2ImgSrc;

  setupHoverArea();

  requestAnimationFrame(() => {
    updateArrowPositions();
  });
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
    const delay = isFirst ? 6500 : 3800;

    slideInterval = setTimeout(() => {
      goToNextSlide();
      isFirst = false;
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

function resetSlideShow() {
  if (!sliderInitialized) return;
  startSlideShow();
}

function initSlider() {
  if (sliderInitialized || !slides.length) return;

  sliderInitialized = true;
  currentOrderIndex = 0;
  updateSlides();
  startSlideShow();
}

if (prevButton) {
  prevButton.addEventListener("click", () => {
    if (window.innerWidth <= 900) return;
    goToPrevSlide();
    resetSlideShow();
  });
}

if (nextButton) {
  nextButton.addEventListener("click", () => {
    if (window.innerWidth <= 900) return;
    goToNextSlide();
    resetSlideShow();
  });
}

window.addEventListener("resize", updateArrowPositions);

slides.forEach((slide) => {
  const img = slide.querySelector(".hero-main-image");
  if (img) {
    img.addEventListener("load", updateArrowPositions);
  }
});

/* =========================
   SMOOTH ARC LOADER
========================= */

function animateRingLoader(timestamp) {
  if (!ringLoader || ringDots.length !== 8 || loaderFinished) return;

  if (!loaderStart) loaderStart = timestamp;

  const elapsed = (timestamp - loaderStart) / 1000;

  const intro = 0.8;
  const hold = 0.5;
  const outro = 0.8;
  const total = intro + hold + outro;

  const baseSpeed =
    0.56;
  const baseAngle =
    elapsed * Math.PI * 2 * baseSpeed +
    Math.sin(elapsed * 1.05) * 0.08 +
    Math.sin(elapsed * 2.0 + 1.1) * 0.03;

  const radius = 22;
  const arcSpan = Math.PI * 1.28;
  const count = ringDots.length;

  const outroStart = intro + hold;
  const outroElapsed = elapsed - outroStart;

  ringDots.forEach((dot, i) => {
    const t = i / (count - 1);

    const angle = baseAngle - t * arcSpan;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const scale = 1.06 - t * 0.34;

    const gray = Math.floor(18 + Math.pow(t, 1.4) * 205);
    const color = `rgb(${gray}, ${gray}, ${gray})`;

    const baseOpacity = 0.96 - t * 0.56;

    const introDelay = t * 1.5;
    const introSpan = 0.5;
    const introRaw = (elapsed - introDelay) / introSpan;
    const introP = smoother(introRaw);

    const outroDelay = t * 0.62;
    const outroSpan = 0.52;
    const outroP = 1 - smoother((outroElapsed - outroDelay) / outroSpan);

    const opacity = baseOpacity * clamp(introP, 0, 1) * clamp(outroP, 0, 1);
    const blur = 0.1 + t * 0.55;

    dot.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    dot.style.opacity = `${clamp(opacity, 0, 1)}`;
    dot.style.background = color;
    dot.style.filter = `blur(${blur}px)`;
  });

  if (elapsed >= total) {
    loaderFinished = true;

    setTimeout(() => {
      if (loadingScreen) {
        loadingScreen.style.transition =
          "opacity 1.15s ease, visibility 1.15s ease";
        loadingScreen.classList.add("is-hidden");
      }

      initSlider();
    }, 180);

    cancelAnimationFrame(loaderRAF);
    return;
  }

  loaderRAF = requestAnimationFrame(animateRingLoader);
}

function startRingLoader() {
  if (!ringLoader) {
    initSlider();
    return;
  }

  cancelAnimationFrame(loaderRAF);
  loaderStart = null;
  loaderFinished = false;
  loaderRAF = requestAnimationFrame(animateRingLoader);
}

function stopRingLoader() {
  loaderFinished = true;
  cancelAnimationFrame(loaderRAF);
}

/* =========================
   WINDOW LOAD
========================= */

window.addEventListener("load", () => {
  document.body.classList.add("is-loaded");

  if (loadingScreen) {
    startRingLoader();
  } else {
    initSlider();
  }

  updateArrowPositions();
});

/* =========================
   IMAGE PROTECTION
========================= */

document.addEventListener("contextmenu", (e) => {
  if (e.target.tagName === "IMG") {
    e.preventDefault();
  }
});

document.addEventListener("dragstart", (e) => {
  if (e.target.tagName === "IMG") {
    e.preventDefault();
  }
});

document.querySelectorAll("img").forEach((img) => {
  img.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
});

document.querySelectorAll(".image-blocker").forEach((blocker) => {
  blocker.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  blocker.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });
});

/* =========================
   ACTIVE MENU LINK
========================= */

const currentPath = window.location.pathname.split("/").pop() || "index.html";

document.querySelectorAll(".menu-links a").forEach((link) => {
  const href = link.getAttribute("href");
  if (!href) return;

  if (href === currentPath) {
    link.classList.add("active");
  }

  if ((currentPath === "" || currentPath === "/") && href === "index.html") {
    link.classList.add("active");
  }
});
