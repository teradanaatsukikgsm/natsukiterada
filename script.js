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
let loaderOutroStart = null;
let slideInterval = null;
let hoverHandler = null;
let sliderReady = false;
let pageInitialized = false;
let loaderFallbackTimer = null;
let firstImageReady = false;
let firstImagePrimeTimer = null;

/* swipe */
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let touchCurrentY = 0;
let isTouching = false;
let isDraggingSlider = false;
let swipeLocked = false;
let swipeHintTimer = null;

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
const swipeHint = document.querySelector(".swipe-hint");

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

/* 最初の1枚目を固定 */
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
  const prev2OrderIndex = (currentOrderIndex - 2 + total) % total;
  const nextOrderIndex = (currentOrderIndex + 1) % total;
  const next2OrderIndex = (currentOrderIndex + 2) % total;

  const prevIndex = slideOrder[prevOrderIndex];
  const prev2Index = slideOrder[prev2OrderIndex];
  const nextIndex = slideOrder[nextOrderIndex];
  const next2Index = slideOrder[next2OrderIndex];

  const activeSlide = slides[activeIndex];
  if (!activeSlide) return;

  activeSlide.classList.add("is-active");

  const prevImgSrc =
    slides[prevIndex]?.querySelector(".hero-main-image")?.src || "";
  const prev2ImgSrc =
    slides[prev2Index]?.querySelector(".hero-main-image")?.src || "";
  const nextImgSrc =
    slides[nextIndex]?.querySelector(".hero-main-image")?.src || "";
  const next2ImgSrc =
    slides[next2Index]?.querySelector(".hero-main-image")?.src || "";

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

function prepareFirstSlide() {
  if (!slides.length) return;

  currentOrderIndex = 0;

  slides.forEach((slide) => {
    slide.classList.remove("is-active");
    slide.style.transition = "none";
  });

  const activeIndex = slideOrder[currentOrderIndex];
  const activeSlide = slides[activeIndex];

  if (activeSlide) {
    activeSlide.classList.add("is-active");
  }

  const firstImg = activeSlide?.querySelector(".hero-main-image");
  if (firstImg) {
    try {
      firstImg.loading = "eager";
    } catch (e) {}
    try {
      firstImg.fetchPriority = "high";
    } catch (e) {}
    try {
      firstImg.decoding = "async";
    } catch (e) {}
  }

  updateSlides();

  requestAnimationFrame(() => {
    slides.forEach((slide) => {
      slide.style.transition = "";
    });
  });
}

function enableSliderTransitions() {
  if (hero) {
    hero.classList.add("is-initialized");
    hero.classList.add("is-visible");
  }
}

function goToNextSlide() {
  if (!slides.length) return;
  currentOrderIndex = (currentOrderIndex + 1) % slides.length;
  updateSlides();
  showArrows();
}

function goToPrevSlide() {
  if (!slides.length) return;
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
  if (!sliderReady) return;
  startSlideShow();
}

/* =========================
   MOBILE SWIPE + HINT
========================= */

function showSwipeHintBriefly() {
  if (!swipeHint || window.innerWidth > 900) return;

  clearTimeout(swipeHintTimer);

  swipeHint.classList.remove("is-visible", "is-hidden");
  swipeHint.style.animation = "none";
  void swipeHint.offsetWidth;

  swipeHint.classList.add("is-visible");
  swipeHint.style.animation = "swipeHintOnlyFinal 1.2s ease-out 1";

  swipeHintTimer = setTimeout(() => {
    swipeHint.style.animation = "none";
    swipeHint.classList.remove("is-visible");
    swipeHint.classList.add("is-hidden");
  }, 2200);
}

function handleSwipe(deltaX) {
  if (!sliderReady || swipeLocked || Math.abs(deltaX) < 46) return;

  swipeLocked = true;

  if (deltaX < 0) {
    goToNextSlide();
  } else {
    goToPrevSlide();
  }

  resetSlideShow();

  setTimeout(() => {
    swipeLocked = false;
  }, 450);
}

function setupMobileSwipe() {
  if (!hero) return;

  hero.addEventListener(
    "touchstart",
    (e) => {
      if (window.innerWidth > 900) return;
      if (!e.touches || e.touches.length !== 1) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchCurrentX = touch.clientX;
      touchCurrentY = touch.clientY;
      isTouching = true;
      isDraggingSlider = false;
    },
    { passive: true }
  );

  hero.addEventListener(
    "touchmove",
    (e) => {
      if (window.innerWidth > 900) return;
      if (!isTouching || !e.touches || e.touches.length !== 1) return;

      const touch = e.touches[0];
      touchCurrentX = touch.clientX;
      touchCurrentY = touch.clientY;

      const deltaX = touchCurrentX - touchStartX;
      const deltaY = touchCurrentY - touchStartY;

      if (
        !isDraggingSlider &&
        Math.abs(deltaX) > 12 &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        isDraggingSlider = true;
      }

      if (isDraggingSlider) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  hero.addEventListener(
    "touchend",
    () => {
      if (window.innerWidth > 900) return;
      if (!isTouching) return;

      const deltaX = touchCurrentX - touchStartX;
      const deltaY = touchCurrentY - touchStartY;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        handleSwipe(deltaX);
      }

      isTouching = false;
      isDraggingSlider = false;
    },
    { passive: true }
  );

  hero.addEventListener(
    "touchcancel",
    () => {
      isTouching = false;
      isDraggingSlider = false;
    },
    { passive: true }
  );
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

window.addEventListener("resize", () => {
  updateArrowPositions();

  if (window.innerWidth <= 900) {
    hideArrows();
  }
});

slides.forEach((slide) => {
  const img = slide.querySelector(".hero-main-image");
  if (img) {
    img.addEventListener("load", updateArrowPositions);
  }
});

/* =========================
   FIRST IMAGE PRIME
========================= */

function setFirstImageReady() {
  if (firstImageReady) return;
  firstImageReady = true;
  clearTimeout(firstImagePrimeTimer);
}

function primeActiveSlideImage() {
  const activeSlide =
    slides[slideOrder[currentOrderIndex]] ||
    document.querySelector(".hero-slide.is-active");

  const img = activeSlide?.querySelector(".hero-main-image");

  firstImageReady = false;
  clearTimeout(firstImagePrimeTimer);

  if (!img) {
    setFirstImageReady();
    return;
  }

  try {
    img.loading = "eager";
  } catch (e) {}
  try {
    img.fetchPriority = "high";
  } catch (e) {}
  try {
    img.decoding = "async";
  } catch (e) {}

  const done = () => {
    setFirstImageReady();
    requestAnimationFrame(() => {
      updateArrowPositions();
    });
  };

  firstImagePrimeTimer = setTimeout(done, 2600);

  if (img.complete && img.naturalWidth > 0) {
    if (typeof img.decode === "function") {
      img.decode().catch(() => {}).finally(done);
    } else {
      done();
    }
    return;
  }

  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", done, { once: true });
}

/* =========================
   SMOOTH ARC LOADER
========================= */

function finishLoadingExperience() {
  if (sliderReady) return;

  clearTimeout(loaderFallbackTimer);
  clearTimeout(firstImagePrimeTimer);

  if (loadingScreen) {
    loadingScreen.classList.add("is-hidden");
  }

  enableSliderTransitions();
  sliderReady = true;
  startSlideShow();
  showSwipeHintBriefly();

  requestAnimationFrame(() => {
    updateArrowPositions();
  });
}

function animateRingLoader(timestamp) {
  if (!ringLoader || ringDots.length !== 8 || loaderFinished) return;

  if (!loaderStart) loaderStart = timestamp;

  const intro = 0.8;
  const hold = 0.5;
  const outro = 0.8;
  const total = intro + hold + outro;
  const holdEnd = intro + hold;

  const baseElapsed = (timestamp - loaderStart) / 1000;

  let renderElapsed;

  if (!firstImageReady) {
    loaderOutroStart = null;
    renderElapsed = Math.min(baseElapsed, holdEnd - 0.001);
  } else {
    if (!loaderOutroStart) {
      loaderOutroStart = timestamp;
    }
    renderElapsed = holdEnd + (timestamp - loaderOutroStart) / 1000;
  }

  const baseSpeed = 0.56;
  const baseAngle =
    baseElapsed * Math.PI * 2 * baseSpeed +
    Math.sin(baseElapsed * 1.05) * 0.08 +
    Math.sin(baseElapsed * 2.0 + 1.1) * 0.03;

  const radius = 22;
  const arcSpan = Math.PI * 1.28;
  const count = ringDots.length;

  const outroElapsed = renderElapsed - holdEnd;

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
    const introRaw = (renderElapsed - introDelay) / introSpan;
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

  if (firstImageReady && renderElapsed >= total) {
    loaderFinished = true;
    finishLoadingExperience();
    cancelAnimationFrame(loaderRAF);
    return;
  }

  loaderRAF = requestAnimationFrame(animateRingLoader);
}

function startRingLoader() {
  if (!ringLoader) {
    finishLoadingExperience();
    return;
  }

  cancelAnimationFrame(loaderRAF);
  loaderStart = null;
  loaderFinished = false;
  loaderOutroStart = null;
  loaderRAF = requestAnimationFrame(animateRingLoader);
}

function startLoaderFallback() {
  clearTimeout(loaderFallbackTimer);

  loaderFallbackTimer = setTimeout(() => {
    setFirstImageReady();
    if (!loaderRAF && !sliderReady) {
      finishLoadingExperience();
    }
  }, 5000);
}

/* =========================
   INIT
========================= */

function initializePage() {
  if (pageInitialized) return;
  pageInitialized = true;

  const isHomeWithLoader = !!loadingScreen && !!hero && slides.length > 0;

  if (isHomeWithLoader) {
    document.body.classList.add("home-with-loader");
    document.body.classList.add("is-loaded");

    prepareFirstSlide();
    setupMobileSwipe();
    updateArrowPositions();
    primeActiveSlideImage();
    startLoaderFallback();
    startRingLoader();
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add("is-loaded");
      });
    });

    if (hero && slides.length) {
      prepareFirstSlide();
      setupMobileSwipe();
      enableSliderTransitions();
      sliderReady = true;
      startSlideShow();

      requestAnimationFrame(() => {
        updateArrowPositions();
      });
    }
  }

  setTimeout(() => {
    showSwipeHintBriefly();
  }, 250);
}

document.addEventListener("DOMContentLoaded", initializePage);

window.addEventListener("load", () => {
  updateArrowPositions();

  setTimeout(() => {
    showSwipeHintBriefly();
  }, 250);
});

window.addEventListener("pageshow", () => {
  setTimeout(() => {
    showSwipeHintBriefly();
  }, 250);
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
