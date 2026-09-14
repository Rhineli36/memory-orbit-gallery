(function () {
  'use strict';
  const photos = window.GALLERY_PHOTOS || [];
  const app = document.getElementById('app');
  const stage = document.getElementById('orbitStage');
  const sphere = document.getElementById('photoSphere');
  const viewer = document.getElementById('viewer');
  const viewerImage = document.getElementById('viewerImage');
  const viewerBg = document.getElementById('viewerBg');
  const details = document.getElementById('details');
  const title = document.getElementById('photoTitle');
  const date = document.getElementById('photoDate');
  const story = document.getElementById('photoStory');
  const storyRow = document.getElementById('storyRow');
  const note = document.getElementById('photoNote');
  const counter = document.getElementById('counter');
  const rotateToggle = document.getElementById('rotateToggle');
  const detailToggle = document.getElementById('detailToggle');

  let mode = 'rows';
  let autoRotate = true;
  let rotationX = -5;
  let rotationY = 0;
  let velocityX = 0;
  let velocityY = .035;
  let dragging = false;
  let dragged = false;
  let pointerX = 0;
  let pointerY = 0;
  let current = 0;
  let radius = 360;
  const elements = [];

  function pointsFor(layout) {
    const result = [];
    if (layout === 'rows') {
      const bands = [5, 7, 8, 8, 7, 6];
      bands.forEach((count, row) => {
        const lat = -58 + row * 23.2;
        for (let j = 0; j < count; j++) result.push({ lat, lon: j * 360 / count + (row % 2) * 360 / count / 2 });
      });
    } else if (layout === 'classic') {
      const bands = [4, 7, 9, 9, 7, 5];
      bands.forEach((count, row) => {
        const lat = -62 + row * 25;
        for (let j = 0; j < count; j++) result.push({ lat, lon: j * 360 / count + (row % 2) * 17 });
      });
    } else {
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < photos.length; i++) {
        const y = 1 - (i / (photos.length - 1)) * 2;
        result.push({ lat: Math.asin(y) * 180 / Math.PI, lon: golden * i * 180 / Math.PI });
      }
    }
    return result.slice(0, photos.length);
  }

  function updateRadius() {
    const box = stage.getBoundingClientRect();
    radius = Math.max(210, Math.min(box.width * .38, box.height * .43, 430));
    if (innerWidth < 850) radius = Math.max(205, Math.min(box.width * .53, box.height * .33, 300));
    layoutPhotos();
  }

  function layoutPhotos() {
    const points = pointsFor(mode);
    elements.forEach((el, i) => {
      const p = points[i];
      const extra = mode === 'cluster' ? 1 + ((i * 17) % 11 - 5) / 48 : 1;
      el.style.transform = `rotateY(${p.lon}deg) rotateX(${-p.lat}deg) translateZ(${radius * extra}px) rotateX(${p.lat}deg) rotateY(${-p.lon}deg)`;
    });
  }

  photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.className = 'orbit-photo';
    button.type = 'button';
    button.setAttribute('aria-label', `查看照片 ${index + 1}`);
    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = photo.title || `照片 ${index + 1}`;
    image.loading = index < 14 ? 'eager' : 'lazy';
    image.decoding = 'async';
    button.appendChild(image);
    button.addEventListener('click', () => {
      if (dragged) return;
      const rect = button.getBoundingClientRect();
      openViewer(index, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    sphere.appendChild(button);
    elements.push(button);
  });

  function renderViewer() {
    const photo = photos[current];
    viewerImage.src = photo.src;
    viewerImage.alt = photo.title || `照片 ${current + 1}`;
    viewerBg.style.backgroundImage = `url("${photo.src}")`;
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
    title.textContent = photo.title || `照片 ${current + 1}`;
    date.textContent = photo.date || '未记录';
    story.textContent = photo.story || '';
    storyRow.hidden = !photo.story;
    note.textContent = photo.note || '未记录';
  }

  function openViewer(index, x, y) {
    current = index;
    viewer.style.setProperty('--origin-x', `${x}px`);
    viewer.style.setProperty('--origin-y', `${y}px`);
    renderViewer();
    viewer.classList.add('is-open');
    viewer.setAttribute('aria-hidden', 'false');
    document.getElementById('closeViewer').focus({ preventScroll: true });
  }

  function closeViewer() {
    viewer.classList.remove('is-open');
    viewer.setAttribute('aria-hidden', 'true');
    viewerImage.removeAttribute('src');
  }

  function move(direction) {
    current = (current + direction + photos.length) % photos.length;
    renderViewer();
  }

  document.getElementById('closeViewer').addEventListener('click', closeViewer);
  document.getElementById('prevPhoto').addEventListener('click', event => { event.stopPropagation(); move(-1); });
  document.getElementById('nextPhoto').addEventListener('click', event => { event.stopPropagation(); move(1); });
  document.getElementById('imageArea').addEventListener('click', event => { if (event.target === event.currentTarget) closeViewer(); });
  viewer.addEventListener('click', event => {
    if (event.target === viewer || event.target === viewerBg) closeViewer();
  });
  details.addEventListener('click', event => event.stopPropagation());
  detailToggle.addEventListener('click', event => {
    event.stopPropagation();
    const hidden = viewer.classList.toggle('details-hidden');
    detailToggle.textContent = hidden ? '显示文字' : '隐藏文字';
    detailToggle.setAttribute('aria-pressed', String(!hidden));
  });

  document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    app.dataset.mode = mode;
    document.querySelectorAll('.mode').forEach(item => item.classList.toggle('is-active', item === button));
    layoutPhotos();
  }));

  rotateToggle.addEventListener('click', () => {
    autoRotate = !autoRotate;
    rotateToggle.classList.toggle('is-active', autoRotate);
    rotateToggle.setAttribute('aria-pressed', String(autoRotate));
    rotateToggle.querySelector('i').textContent = autoRotate ? '开' : '关';
  });

  stage.addEventListener('pointerdown', event => {
    dragging = true;
    dragged = false;
    pointerX = event.clientX;
    pointerY = event.clientY;
    velocityX = velocityY = 0;
    stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', event => {
    if (!dragging) return;
    const dx = event.clientX - pointerX;
    const dy = event.clientY - pointerY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    velocityY = dx * .16;
    velocityX = -dy * .12;
    rotationY += velocityY;
    rotationX = Math.max(-70, Math.min(70, rotationX + velocityX));
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  stage.addEventListener('pointerup', event => {
    dragging = false;
    stage.classList.remove('is-dragging');
    setTimeout(() => { dragged = false; }, 0);
  });
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    rotationY += event.deltaY * .025;
    rotationX = Math.max(-70, Math.min(70, rotationX + event.deltaX * .018));
  }, { passive: false });

  document.addEventListener('keydown', event => {
    if (!viewer.classList.contains('is-open')) return;
    if (event.key === 'Escape') closeViewer();
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  });

  function animate() {
    if (!dragging) {
      rotationX += velocityX;
      rotationY += velocityY + (autoRotate ? .035 : 0);
      velocityX *= .94;
      velocityY *= .94;
    }
    sphere.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
    requestAnimationFrame(animate);
  }

  app.dataset.mode = mode;
  addEventListener('resize', updateRadius);
  updateRadius();
  animate();
})();
