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
let loaderVisibleAt = null;
let loaderIsFading = false;
let loaderFadeStart = null;
let loaderFadeResolve = null;

let slideInterval = null;
let hoverHandler = null;
let hoverLeaveBound = false;
let activeImageLoadTarget = null;
let activeImageLoadHandler = null;
let transitionLock = false;
const slideReadinessCache = new Map();
let sliderReady = false;
let pageInitialized = false;

/* swipe */
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let touchCurrentY = 0;
let isTouching = false;
let isDraggingSlider = false;
let swipeLocked = false;
let swipeHintTimer = null;

/* mobile-only runtime */
let mobileDomRewritten = false;

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

function doubleRAF(callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForWindowLoad() {
  if (document.readyState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.addEventListener("load", resolve, { once: true });
  });
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

/* =========================
   MOBILE DOM REWRITE HELPERS
========================= */

function isMobileViewport() {
  return window.innerWidth <= 900;
}

function getMainImage(slide) {
  return slide?.querySelector(".hero-main-image") || null;
}

function getImageSource(img) {
  if (!img) return "";
  return img.getAttribute("src") || img.dataset.src || img.src || "";
}

function ensureImageSource(img) {
  if (!img) return "";
  const currentSrc = img.getAttribute("src");
  if (!currentSrc && img.dataset.src) {
    img.setAttribute("src", img.dataset.src);
  }
  return img.getAttribute("src") || img.src || "";
}

function ensureSlideMainSourceByIndex(index) {
  const img = getMainImage(slides[index]);
  return ensureImageSource(img);
}

function getSlideMainSourceByIndex(index) {
  const img = getMainImage(slides[index]);
  return getImageSource(img);
}

function rewriteHeroDomForMobile() {
  if (mobileDomRewritten || !slides.length) return;

  const keepIndex = slideOrder[0];

  slides.forEach((slide, index) => {
    const img = getMainImage(slide);
    if (!img) return;

    const src = img.getAttribute("src");
    if (!src) return;

    if (index === keepIndex) {
      try {
        img.loading = "eager";
      } catch (e) {}
      try {
        img.fetchPriority = "high";
      } catch (e) {}
      try {
        img.decoding = "async";
      } catch (e) {}
      return;
    }

    img.dataset.src = src;
    img.removeAttribute("src");
  });

  slideReadinessCache.clear();
  mobileDomRewritten = true;
}

function releaseImageToDataSrc(img) {
  if (!img) return;
  const src = img.getAttribute("src");
  if (!src) return;

  if (!img.dataset.src) {
    img.dataset.src = src;
  }

  img.removeAttribute("src");
}

function cleanupMobileOffscreenAssets(activeOrderIndex) {
  if (!slides.length) return;

  const total = slides.length;
  const normalized = getWrappedOrderIndex(activeOrderIndex);

  const keepOrderIndexes = new Set([
    normalized,
    (normalized - 1 + total) % total,
    (normalized + 1) % total,
    (normalized - 2 + total) % total,
    (normalized + 2) % total,
  ]);

  slides.forEach((slide, slideIndex) => {
    const orderIndex = slideOrder.indexOf(slideIndex);
    const mainImg = slide.querySelector(".hero-main-image");

    const previews = [
      slide.querySelector(".hero-preview-left-1"),
      slide.querySelector(".hero-preview-left-2"),
      slide.querySelector(".hero-preview-right-1"),
      slide.querySelector(".hero-preview-right-2"),
    ];

    if (!keepOrderIndexes.has(orderIndex)) {
      releaseImageToDataSrc(mainImg);
    }

    if (orderIndex !== normalized) {
      previews.forEach((img) => {
        if (img) img.removeAttribute("src");
      });
    }
  });
}

function getMobileSlideAssetElementsForOrder(orderIndex) {
  if (!slides.length) return [];

  const total = slides.length;
  const normalizedOrderIndex = getWrappedOrderIndex(orderIndex);

  const prevOrderIndex = (normalizedOrderIndex - 1 + total) % total;
  const prev2OrderIndex = (normalizedOrderIndex - 2 + total) % total;
  const nextOrderIndex = (normalizedOrderIndex + 1) % total;
  const next2OrderIndex = (normalizedOrderIndex + 2) % total;

  const activeIndex = slideOrder[normalizedOrderIndex];
  const prevIndex = slideOrder[prevOrderIndex];
  const prev2Index = slideOrder[prev2OrderIndex];
  const nextIndex = slideOrder[nextOrderIndex];
  const next2Index = slideOrder[next2OrderIndex];

  const slide = slides[activeIndex];
  if (!slide) return [];

  const mainImg = slide.querySelector(".hero-main-image");
  const left1 = slide.querySelector(".hero-preview-left-1");
  const left2 = slide.querySelector(".hero-preview-left-2");
  const right1 = slide.querySelector(".hero-preview-right-1");
  const right2 = slide.querySelector(".hero-preview-right-2");

  ensureImageSource(mainImg);

  const prevImgSrc = getSlideMainSourceByIndex(prevIndex);
  const prev2ImgSrc = getSlideMainSourceByIndex(prev2Index);
  const nextImgSrc = getSlideMainSourceByIndex(nextIndex);
  const next2ImgSrc = getSlideMainSourceByIndex(next2Index);

  if (left1 && prevImgSrc && left1.getAttribute("src") !== prevImgSrc) {
    left1.src = prevImgSrc;
  }
  if (left2 && prev2ImgSrc && left2.getAttribute("src") !== prev2ImgSrc) {
    left2.src = prev2ImgSrc;
  }
  if (right1 && nextImgSrc && right1.getAttribute("src") !== nextImgSrc) {
    right1.src = nextImgSrc;
  }
  if (right2 && next2ImgSrc && right2.getAttribute("src") !== next2ImgSrc) {
    right2.src = next2ImgSrc;
  }

  cleanupMobileOffscreenAssets(normalizedOrderIndex);

  return [mainImg, left1, left2, right1, right2].filter((img) => {
    if (!img) return false;
    const src = img.getAttribute("src") || img.src || "";
    return !!src;
  });
}

function updateSlidesMobile() {
  if (!slides.length) return;

  slides.forEach((slide) => slide.classList.remove("is-active"));

  const activeIndex = slideOrder[currentOrderIndex];
  const activeSlide = slides[activeIndex];
  if (!activeSlide) return;

  const total = slides.length;

  const prevOrderIndex = (currentOrderIndex - 1 + total) % total;
  const prev2OrderIndex = (currentOrderIndex - 2 + total) % total;
  const nextOrderIndex = (currentOrderIndex + 1) % total;
  const next2OrderIndex = (currentOrderIndex + 2) % total;

  const prevIndex = slideOrder[prevOrderIndex];
  const prev2Index = slideOrder[prev2OrderIndex];
  const nextIndex = slideOrder[nextOrderIndex];
  const next2Index = slideOrder[next2OrderIndex];

  ensureSlideMainSourceByIndex(activeIndex);

  const prevImgSrc = getSlideMainSourceByIndex(prevIndex);
  const prev2ImgSrc = getSlideMainSourceByIndex(prev2Index);
  const nextImgSrc = getSlideMainSourceByIndex(nextIndex);
  const next2ImgSrc = getSlideMainSourceByIndex(next2Index);

  const left1 = activeSlide.querySelector(".hero-preview-left-1");
  const left2 = activeSlide.querySelector(".hero-preview-left-2");
  const right1 = activeSlide.querySelector(".hero-preview-right-1");
  const right2 = activeSlide.querySelector(".hero-preview-right-2");

  if (left1 && prevImgSrc && left1.getAttribute("src") !== prevImgSrc) {
    left1.src = prevImgSrc;
  }
  if (left2 && prev2ImgSrc && left2.getAttribute("src") !== prev2ImgSrc) {
    left2.src = prev2ImgSrc;
  }
  if (right1 && nextImgSrc && right1.getAttribute("src") !== nextImgSrc) {
    right1.src = nextImgSrc;
  }
  if (right2 && next2ImgSrc && right2.getAttribute("src") !== next2ImgSrc) {
    right2.src = next2ImgSrc;
  }

  activeSlide.classList.add("is-active");

  cleanupMobileOffscreenAssets(currentOrderIndex);

  requestAnimationFrame(() => {
    updateArrowPositions();
  });
}

function prepareFirstSlideMobile() {
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
    ensureImageSource(firstImg);

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

  updateSlidesMobile();

  requestAnimationFrame(() => {
    slides.forEach((slide) => {
      slide.style.transition = "";
    });
  });
}

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

function bindActiveImageLoadListener() {
  if (window.innerWidth <= 900) return;

  if (activeImageLoadTarget && activeImageLoadHandler) {
    activeImageLoadTarget.removeEventListener("load", activeImageLoadHandler);
  }

  const activeSlide = document.querySelector(".hero-slide.is-active");
  const img = activeSlide?.querySelector(".hero-main-image");

  if (!img) {
    activeImageLoadTarget = null;
    activeImageLoadHandler = null;
    return;
  }

  activeImageLoadHandler = () => {
    requestAnimationFrame(() => {
      updateArrowPositions();
    });
  };

  activeImageLoadTarget = img;
  img.addEventListener("load", activeImageLoadHandler, { once: true });
}

function getWrappedOrderIndex(orderIndex) {
  const total = slides.length;
  return ((orderIndex % total) + total) % total;
}

function getSlideAssetElementsForOrder(orderIndex) {
  if (!slides.length) return [];

  const total = slides.length;
  const normalizedOrderIndex = getWrappedOrderIndex(orderIndex);

  const prevOrderIndex = (normalizedOrderIndex - 1 + total) % total;
  const prev2OrderIndex = (normalizedOrderIndex - 2 + total) % total;
  const nextOrderIndex = (normalizedOrderIndex + 1) % total;
  const next2OrderIndex = (normalizedOrderIndex + 2) % total;

  const activeIndex = slideOrder[normalizedOrderIndex];
  const prevIndex = slideOrder[prevOrderIndex];
  const prev2Index = slideOrder[prev2OrderIndex];
  const nextIndex = slideOrder[nextOrderIndex];
  const next2Index = slideOrder[next2OrderIndex];

  const slide = slides[activeIndex];
  if (!slide) return [];

  const mainImg = slide.querySelector(".hero-main-image");
  const left1 = slide.querySelector(".hero-preview-left-1");
  const left2 = slide.querySelector(".hero-preview-left-2");
  const right1 = slide.querySelector(".hero-preview-right-1");
  const right2 = slide.querySelector(".hero-preview-right-2");

  const prevImgSrc =
    slides[prevIndex]?.querySelector(".hero-main-image")?.src || "";
  const prev2ImgSrc =
    slides[prev2Index]?.querySelector(".hero-main-image")?.src || "";
  const nextImgSrc =
    slides[nextIndex]?.querySelector(".hero-main-image")?.src || "";
  const next2ImgSrc =
    slides[next2Index]?.querySelector(".hero-main-image")?.src || "";

  if (left1 && prevImgSrc && left1.getAttribute("src") !== prevImgSrc) {
    left1.src = prevImgSrc;
  }
  if (left2 && prev2ImgSrc && left2.getAttribute("src") !== prev2ImgSrc) {
    left2.src = prev2ImgSrc;
  }
  if (right1 && nextImgSrc && right1.getAttribute("src") !== nextImgSrc) {
    right1.src = nextImgSrc;
  }
  if (right2 && next2ImgSrc && right2.getAttribute("src") !== next2ImgSrc) {
    right2.src = next2ImgSrc;
  }

  return [mainImg, left1, left2, right1, right2].filter((img) => {
    if (!img) return false;
    const src = img.getAttribute("src") || img.src || "";
    return !!src;
  });
}

function waitForImageElement(img, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const timeoutId = setTimeout(finish, timeoutMs);

    const wrappedFinish = () => {
      clearTimeout(timeoutId);
      finish();
    };

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === "function") {
        img.decode().catch(() => {}).finally(wrappedFinish);
      } else {
        wrappedFinish();
      }
      return;
    }

    img.addEventListener("load", wrappedFinish, { once: true });
    img.addEventListener("error", wrappedFinish, { once: true });
  });
}

function waitForImageElementMobile(img, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let done = false;

    ensureImageSource(img);

    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const timeoutId = setTimeout(finish, timeoutMs);

    const wrappedFinish = () => {
      clearTimeout(timeoutId);
      finish();
    };

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === "function") {
        img.decode().catch(() => {}).finally(wrappedFinish);
      } else {
        wrappedFinish();
      }
      return;
    }

    img.addEventListener("load", wrappedFinish, { once: true });
    img.addEventListener("error", wrappedFinish, { once: true });
  });
}

function ensureSlideReady(orderIndex, options = {}) {
  const normalizedOrderIndex = getWrappedOrderIndex(orderIndex);

  if (slideReadinessCache.has(normalizedOrderIndex)) {
    return slideReadinessCache.get(normalizedOrderIndex);
  }

  const promise = (async () => {
    const images = getSlideAssetElementsForOrder(normalizedOrderIndex);
    if (!images.length) return;

    const mainTimeout = options.mainTimeout ?? 10000;
    const sideTimeout = options.sideTimeout ?? 7000;

    await Promise.all(
      images.map((img, index) => {
        if (index === 0) {
          try {
            img.fetchPriority = "high";
          } catch (e) {}
        }

        try {
          img.decoding = "async";
        } catch (e) {}

        return waitForImageElement(img, index === 0 ? mainTimeout : sideTimeout);
      })
    );

    await new Promise((resolve) => doubleRAF(resolve));
  })();

  slideReadinessCache.set(normalizedOrderIndex, promise);
  return promise;
}

function ensureSlideReadyMobile(orderIndex, options = {}) {
  const normalizedOrderIndex = getWrappedOrderIndex(orderIndex);
  const cacheKey = `m-${normalizedOrderIndex}`;

  if (slideReadinessCache.has(cacheKey)) {
    return slideReadinessCache.get(cacheKey);
  }

  const promise = (async () => {
    const images = getMobileSlideAssetElementsForOrder(normalizedOrderIndex);
    if (!images.length) return;

    const mainTimeout = options.mainTimeout ?? 10000;
    const sideTimeout = options.sideTimeout ?? 7000;

    await Promise.all(
      images.map((img, index) => {
        if (index === 0) {
          try {
            img.fetchPriority = "high";
          } catch (e) {}
        }

        try {
          img.decoding = "async";
        } catch (e) {}

        return waitForImageElementMobile(img, index === 0 ? mainTimeout : sideTimeout);
      })
    );

    await new Promise((resolve) => doubleRAF(resolve));
  })();

  slideReadinessCache.set(cacheKey, promise);
  return promise;
}

function primeAdjacentSlides() {
  if (!slides.length) return;

  const nextOrderIndex = getWrappedOrderIndex(currentOrderIndex + 1);
  const prevOrderIndex = getWrappedOrderIndex(currentOrderIndex - 1);

  void ensureSlideReady(nextOrderIndex, {
    mainTimeout: 8000,
    sideTimeout: 5000,
  });

  void ensureSlideReady(prevOrderIndex, {
    mainTimeout: 8000,
    sideTimeout: 5000,
  });
}

async function goToOrderIndex(targetOrderIndex) {
  if (!slides.length || transitionLock) return;

  transitionLock = true;

  try {
    const normalizedOrderIndex = getWrappedOrderIndex(targetOrderIndex);

    await ensureSlideReady(normalizedOrderIndex, {
      mainTimeout: 10000,
      sideTimeout: 7000,
    });

    currentOrderIndex = normalizedOrderIndex;
    updateSlides();
    showArrows();
    return true;
  } finally {
    transitionLock = false;
  }
}

async function goToOrderIndexMobile(targetOrderIndex) {
  if (!slides.length || transitionLock) return;

  transitionLock = true;

  try {
    const normalizedOrderIndex = getWrappedOrderIndex(targetOrderIndex);

    await ensureSlideReadyMobile(normalizedOrderIndex, {
      mainTimeout: 10000,
      sideTimeout: 4500,
    });

    currentOrderIndex = normalizedOrderIndex;
    updateSlidesMobile();
    return true;
  } finally {
    transitionLock = false;
  }
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

  if (!hoverLeaveBound) {
    hero.addEventListener("mouseleave", hideArrows);
    hoverLeaveBound = true;
  }
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

  if (left1 && prevImgSrc && left1.getAttribute("src") !== prevImgSrc) {
    left1.src = prevImgSrc;
  }
  if (left2 && prev2ImgSrc && left2.getAttribute("src") !== prev2ImgSrc) {
    left2.src = prev2ImgSrc;
  }
  if (right1 && nextImgSrc && right1.getAttribute("src") !== nextImgSrc) {
    right1.src = nextImgSrc;
  }
  if (right2 && next2ImgSrc && right2.getAttribute("src") !== next2ImgSrc) {
    right2.src = next2ImgSrc;
  }

  activeSlide.classList.add("is-active");

  bindActiveImageLoadListener();
  setupHoverArea();

  requestAnimationFrame(() => {
    updateArrowPositions();
  });

  primeAdjacentSlides();
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
  if (!hero) return;
  hero.classList.add("is-initialized");
}

async function showHeroSlider() {
  if (!hero) return;

  enableSliderTransitions();

  hero.classList.remove("is-first-reveal");
  hero.classList.remove("is-reveal-prep");

  const activeSlide = document.querySelector(".hero-slide.is-active");

  hero.classList.add("is-reveal-prep");
  void hero.offsetWidth;

  hero.classList.add("is-visible");
  hero.style.visibility = "visible";

  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!activeSlide) {
          hero.classList.remove("is-reveal-prep");
          resolve();
          return;
        }

        let finished = false;

        const finish = () => {
          if (finished) return;
          finished = true;
          hero.classList.remove("is-first-reveal");
          hero.classList.remove("is-reveal-prep");
          resolve();
        };

        activeSlide.addEventListener("animationend", finish, { once: true });

        hero.classList.add("is-first-reveal");
        hero.classList.remove("is-reveal-prep");

        setTimeout(finish, 1450);
      });
    });
  });
}

async function goToNextSlide() {
  return await goToOrderIndex(currentOrderIndex + 1);
}

async function goToPrevSlide() {
  return await goToOrderIndex(currentOrderIndex - 1);
}

async function goToNextSlideMobile() {
  return await goToOrderIndexMobile(currentOrderIndex + 1);
}

async function goToPrevSlideMobile() {
  return await goToOrderIndexMobile(currentOrderIndex - 1);
}

function startSlideShow() {
  clearTimeout(slideInterval);

  let isFirst = true;

  function scheduleNext() {
    const delay = isFirst ? 6500 : 3800;

    slideInterval = setTimeout(async () => {
      await goToNextSlide();
      isFirst = false;
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

function startSlideShowMobile() {
  clearTimeout(slideInterval);

  let isFirst = true;

  function scheduleNext() {
    const delay = isFirst ? 6500 : 3800;

    slideInterval = setTimeout(async () => {
      await goToNextSlideMobile();
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

function resetSlideShowMobile() {
  if (!sliderReady) return;
  startSlideShowMobile();
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

async function handleSwipe(deltaX) {
  if (!sliderReady || swipeLocked || transitionLock || Math.abs(deltaX) < 46) {
    return;
  }

  swipeLocked = true;
  clearTimeout(slideInterval);

  try {
    let moved = false;

    if (deltaX < 0) {
      moved = await goToNextSlide();
    } else {
      moved = await goToPrevSlide();
    }

    if (moved) {
      resetSlideShow();
    }
  } finally {
    swipeLocked = false;
  }
}

async function handleSwipeMobile(deltaX) {
  if (!sliderReady || swipeLocked || transitionLock || Math.abs(deltaX) < 46) {
    return;
  }

  swipeLocked = true;
  clearTimeout(slideInterval);

  try {
    let moved = false;

    if (deltaX < 0) {
      moved = await goToNextSlideMobile();
    } else {
      moved = await goToPrevSlideMobile();
    }

    if (moved) {
      resetSlideShowMobile();
    }
  } finally {
    swipeLocked = false;
  }
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

      if (isDraggingSlider && Math.abs(deltaX) > Math.abs(deltaY)) {
        void handleSwipe(deltaX);
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

function setupMobileSwipeLite() {
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

      if (isDraggingSlider && Math.abs(deltaX) > Math.abs(deltaY)) {
        void handleSwipeMobile(deltaX);
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
    void goToPrevSlide();
    resetSlideShow();
  });
}

if (nextButton) {
  nextButton.addEventListener("click", () => {
    if (window.innerWidth <= 900) return;
    void goToNextSlide();
    resetSlideShow();
  });
}

window.addEventListener("resize", () => {
  updateArrowPositions();

  if (window.innerWidth <= 900) {
    hideArrows();
  }
});

/* =========================
   FIRST IMAGE WAIT
========================= */

async function waitForActiveSlideImage() {
  await ensureSlideReady(currentOrderIndex, {
    mainTimeout: 10000,
    sideTimeout: 7000,
  });
}

async function waitForActiveSlideImageMobile() {
  await ensureSlideReadyMobile(currentOrderIndex, {
    mainTimeout: 10000,
    sideTimeout: 7000,
  });
}

/* =========================
   LOADER
========================= */

function animateRingLoader(timestamp) {
  if (!ringLoader || ringDots.length !== 8) return;

  if (!loaderStart) loaderStart = timestamp;

  const elapsed = (timestamp - loaderStart) / 1000;

  const baseSpeed = 0.56;
  const baseAngle =
    elapsed * Math.PI * 2 * baseSpeed +
    Math.sin(elapsed * 1.05) * 0.08 +
    Math.sin(elapsed * 2.0 + 1.1) * 0.03;

  const radius = 22;
  const arcSpan = Math.PI * 1.28;
  const count = ringDots.length;

  const fadeDelayPerDot = 0.085;
  const fadeDuration = 0.24;

  ringDots.forEach((dot, i) => {
    const t = i / (count - 1);
    const angle = baseAngle - t * arcSpan;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const scale = 1.06 - t * 0.34;
    const gray = Math.floor(18 + Math.pow(t, 1.4) * 205);
    const color = `rgb(${gray}, ${gray}, ${gray})`;
    const baseOpacity = 0.96 - t * 0.56;
    const blur = 0.1 + t * 0.55;

    const appear = smoother((elapsed - t * 0.18) / 0.45);

    let fadeMultiplier = 1;

    if (loaderIsFading) {
      if (!loaderFadeStart) loaderFadeStart = timestamp;

      const fadeElapsed = (timestamp - loaderFadeStart) / 1000;
      const fadeProgress = smoother(
        (fadeElapsed - t * fadeDelayPerDot) / fadeDuration
      );

      fadeMultiplier = 1 - clamp(fadeProgress, 0, 1);
    }

    dot.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    dot.style.opacity = `${clamp(
      baseOpacity * clamp(appear, 0, 1) * fadeMultiplier,
      0,
      1
    )}`;
    dot.style.background = color;
    dot.style.filter = `blur(${blur}px)`;
  });

  if (loaderIsFading) {
    const totalFadeTime =
      fadeDuration + fadeDelayPerDot * (count - 1) + 0.04;
    const fadeElapsed = loaderFadeStart
      ? (timestamp - loaderFadeStart) / 1000
      : 0;

    if (fadeElapsed >= totalFadeTime) {
      ringDots.forEach((dot) => {
        dot.style.opacity = "0";
      });

      cancelAnimationFrame(loaderRAF);
      loaderRAF = null;
      loaderIsFading = false;
      loaderFadeStart = null;

      if (loaderFadeResolve) {
        const resolve = loaderFadeResolve;
        loaderFadeResolve = null;
        resolve();
      }
      return;
    }
  }

  loaderRAF = requestAnimationFrame(animateRingLoader);
}

function startRingLoader() {
  if (!ringLoader) return;

  cancelAnimationFrame(loaderRAF);
  loaderStart = null;
  loaderVisibleAt = performance.now();
  loaderIsFading = false;
  loaderFadeStart = null;
  loaderFadeResolve = null;
  loaderRAF = requestAnimationFrame(animateRingLoader);
}

function startLoaderFadeOut() {
  if (!ringLoader) return Promise.resolve();

  if (loaderIsFading) {
    return new Promise((resolve) => {
      if (!loaderFadeResolve) {
        resolve();
        return;
      }

      const previousResolve = loaderFadeResolve;
      loaderFadeResolve = () => {
        previousResolve();
        resolve();
      };
    });
  }

  loaderIsFading = true;
  loaderFadeStart = null;

  return new Promise((resolve) => {
    loaderFadeResolve = resolve;
  });
}

/* =========================
   HOME BOOT
========================= */

async function bootHomeWhenReady() {
  try {
    const firstViewReady = waitForActiveSlideImage();
    void waitForWindowLoad();

    await firstViewReady;

    const minLoaderMs = 1200;
    const elapsed = loaderVisibleAt ? performance.now() - loaderVisibleAt : 0;
    const remaining = Math.max(0, minLoaderMs - elapsed);

    if (remaining > 0) {
      await wait(remaining);
    }

    await startLoaderFadeOut();

    if (loadingScreen) {
      loadingScreen.classList.add("is-fading");
      await wait(300);

      if (loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }

    await showHeroSlider();

    await Promise.all([
      ensureSlideReady(currentOrderIndex + 1, {
        mainTimeout: 10000,
        sideTimeout: 7000,
      }),
      ensureSlideReady(currentOrderIndex - 1, {
        mainTimeout: 10000,
        sideTimeout: 7000,
      }),
    ]);
     
    sliderReady = true;
    startSlideShow();
    showSwipeHintBriefly();

    requestAnimationFrame(() => {
      updateArrowPositions();
    });
  } finally {
    // no-op
  }
}

async function bootMobileHomeWhenReady() {
  try {
    const firstViewReady = waitForActiveSlideImageMobile();
    void waitForWindowLoad();

    await firstViewReady;

    const minLoaderMs = 1200;
    const elapsed = loaderVisibleAt ? performance.now() - loaderVisibleAt : 0;
    const remaining = Math.max(0, minLoaderMs - elapsed);

    if (remaining > 0) {
      await wait(remaining);
    }

    await startLoaderFadeOut();

    if (loadingScreen) {
      loadingScreen.classList.add("is-fading");
      await wait(300);

      if (loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }

    await showHeroSlider();

    sliderReady = true;
    startSlideShowMobile();
    showSwipeHintBriefly();
    cleanupMobileOffscreenAssets(currentOrderIndex);

    requestAnimationFrame(() => {
      updateArrowPositions();
    });
  } finally {
    // no-op
  }
}

/* =========================
   INIT
========================= */

function initializeDesktopHome() {
  document.body.classList.add("home-with-loader");

  if (hero) {
    hero.style.visibility = "hidden";
  }

  prepareFirstSlide();
  setupMobileSwipe();
  startRingLoader();
  bootHomeWhenReady();
}

function initializeMobileHome() {
  rewriteHeroDomForMobile();

  document.body.classList.add("home-with-loader");

  if (hero) {
    hero.style.visibility = "hidden";
  }

  prepareFirstSlideMobile();
  setupMobileSwipeLite();
  startRingLoader();
  bootMobileHomeWhenReady();
}

function initializePage() {
  if (pageInitialized) return;
  pageInitialized = true;

  const isHomeWithLoader = !!loadingScreen && !!hero && slides.length > 0;

  if (isHomeWithLoader) {
    if (isMobileViewport()) {
      initializeMobileHome();
    } else {
      initializeDesktopHome();
    }
    return;
  }

  doubleRAF(() => {
    document.body.classList.add("is-loaded");
  });

  if (hero && slides.length) {
    prepareFirstSlide();
    setupMobileSwipe();
    enableSliderTransitions();
    hero.style.visibility = "visible";
    hero.classList.add("is-visible");
    sliderReady = true;
    startSlideShow();

    requestAnimationFrame(() => {
      updateArrowPositions();
    });
  }

  setTimeout(() => {
    showSwipeHintBriefly();
  }, 250);
}

document.addEventListener("DOMContentLoaded", initializePage);

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
