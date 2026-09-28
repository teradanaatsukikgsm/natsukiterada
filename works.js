(() => {
  'use strict';
  const grid = document.querySelector('.works-grid');
  const workItems = [...grid.querySelectorAll('.work-item')];
  workItems.forEach((item, index) => {
    item.style.setProperty('--reveal-delay', `${index * 100}ms`);
    item.classList.add('is-revealing');
  });
  let layoutKey = '';
  function balanceWorkRows() {
    const style = getComputedStyle(grid);
    const columns = Number(style.getPropertyValue('--works-columns'));
    const gap = parseFloat(style.columnGap);
    const width = grid.getBoundingClientRect().width;
    const nextKey = `${width}:${columns}:${gap}`;
    if (nextKey === layoutKey) return;
    layoutKey = nextKey;
    const portraitWidth = (width - (columns - 1) * gap) / columns;
    const rows = [];
    let row = { items: [], width: 0, landscape: false };
    workItems.forEach(item => {
      const landscape = item.classList.contains('work-item--landscape');
      const itemWidth = portraitWidth * (landscape ? 1.5 : 1);
      if (row.items.length && row.width + gap + itemWidth > width + .1) {
        rows.push(row);
        row = { items: [], width: 0, landscape: false };
      }
      row.width += (row.items.length ? gap : 0) + itemWidth;
      row.items.push(item);
      row.landscape ||= landscape;
    });
    if (row.items.length) rows.push(row);
    // Justify complete landscape rows; keep ordinary and partial rows on the fixed columns.
    rows.forEach(current => {
      const extraGap = columns === 5 && current.landscape && current.items.length === 4
        ? Math.max(0, Math.floor((width - current.width) / 3 * 64) / 64)
        : 0;
      current.items.forEach((item, index) => {
        item.style.setProperty('--row-extra-gap', `${index < current.items.length - 1 ? extraGap : 0}px`);
      });
    });
  }
  balanceWorkRows();
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(balanceWorkRows).observe(grid);
  } else {
    window.addEventListener('resize', balanceWorkRows);
  }
  const projects = new Map(JSON.parse(document.querySelector('#works-data').textContent).map(project => [project.id, project]));
  const menu = document.querySelector('#site-menu');
  const menuButton = document.querySelector('.menu-button');
  const viewer = document.querySelector('#project-viewer');
  const image = document.querySelector('.viewer-image');
  const title = document.querySelector('#viewer-title');
  const count = document.querySelector('.viewer-count');
  const previous = document.querySelector('.viewer-prev');
  const next = document.querySelector('.viewer-next');
  const error = document.querySelector('.viewer-error');
  let currentProject = null;
  let currentImage = 0;
  let touchStart = null;
  const syncScroll = () => document.body.classList.toggle('has-dialog', menu.open || viewer.open);

  if (typeof menu.showModal !== 'function') return;
  menuButton.hidden = false;
  menuButton.addEventListener('click', () => {
    menu.showModal();
    menuButton.setAttribute('aria-expanded', 'true');
    syncScroll();
  });
  document.querySelector('.menu-close').addEventListener('click', () => menu.close());
  menu.querySelector('[aria-current="page"]').addEventListener('click', event => {
    event.preventDefault();
    menu.close();
  });
  menu.addEventListener('click', event => {
    if (event.target !== menu) return;
    const rect = menu.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) menu.close();
  });
  menu.addEventListener('close', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    syncScroll();
  });

  function showImage(index) {
    currentImage = (index + currentProject.images.length) % currentProject.images.length;
    const src = currentProject.images[currentImage];
    title.textContent = currentProject.title;
    count.textContent = currentProject.images.length > 1 ? `${currentImage + 1} / ${currentProject.images.length}` : '';
    previous.disabled = next.disabled = currentProject.images.length < 2;
    error.hidden = true;
    image.hidden = false;
    image.classList.add('is-loading');
    image.alt = `${currentProject.title} — ${currentImage + 1} of ${currentProject.images.length}`;
    document.querySelector('.viewer-original').href = currentProject.originals[currentImage];
    image.src = src;
    if (image.complete && image.naturalWidth) image.classList.remove('is-loading');
  }
  image.addEventListener('load', () => image.classList.remove('is-loading'));
  image.addEventListener('error', () => {
    image.hidden = true;
    image.classList.remove('is-loading');
    error.hidden = false;
  });
  document.querySelectorAll('.work-card').forEach(card => {
    card.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const project = projects.get(card.dataset.project);
      if (!project) return;
      event.preventDefault();
      currentProject = project;
      showImage(0);
      viewer.showModal();
      syncScroll();
    });
  });
  document.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', syncScroll);
  previous.addEventListener('click', () => showImage(currentImage - 1));
  next.addEventListener('click', () => showImage(currentImage + 1));
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showImage(currentImage - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showImage(currentImage + 1); }
  });
  const stage = document.querySelector('.viewer-stage');
  stage.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const deltaX = event.changedTouches[0].clientX - touchStart.x;
    const deltaY = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) showImage(currentImage + (deltaX < 0 ? 1 : -1));
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
})();
