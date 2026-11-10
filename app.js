(async () => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- loader
  const done = () => document.body.classList.remove('is-loading');
  setTimeout(done, reduce ? 0 : 1100);

  // ---- topographic contour lines (generated, per section)
  function topo(w, h, seed) {
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const blobs = 2 + Math.floor(rnd() * 2), out = [];
    for (let b = 0; b < blobs; b++) {
      const cx = rnd() * w, cy = rnd() * h, p1 = rnd() * 6, p2 = rnd() * 6, p3 = rnd() * 6;
      for (let r = 1; r <= 16; r++) {
        const R = r * Math.min(w, h) * 0.055; let d = '';
        for (let a = 0; a <= 64; a++) {
          const t = a / 64 * Math.PI * 2;
          const k = R * (1 + .22 * Math.sin(3 * t + p1) + .12 * Math.sin(5 * t + p2) + .06 * Math.sin(8 * t + p3 + r * .15));
          d += (a ? 'L' : 'M') + (cx + Math.cos(t) * k * 1.5).toFixed(1) + ' ' + (cy + Math.sin(t) * k).toFixed(1);
        }
        out.push(`<path d="${d}Z"/>`);
      }
    }
    return `<svg class="topo" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${out.join('')}</svg>`;
  }
  $$('.contours').forEach((s, i) => s.insertAdjacentHTML('afterbegin', topo(1440, 900, 7919 + i * 977)));

  // ---- Interactive Facial Age-Morphing Hero (WebGL Shader + SVG Displacement Warp + Timeline Sync)
  (async () => {
    const ERAS = [
      { stage: 1, file: 'media/eras/stage-01.webp?v=3', age: 24, year: 1996, yearDisplay: '1996', label: 'Rookie Wrestler' },
      { stage: 2, file: 'media/eras/stage-02.webp?v=3', age: 29, year: 2001, yearDisplay: '2001', label: 'Early Hollywood' },
      { stage: 3, file: 'media/eras/stage-03.webp?v=3', age: 30, year: 2002, yearDisplay: '2002', label: 'The Rock · WWE' },
      { stage: 4, file: 'media/eras/stage-04.webp?v=3', age: 52, year: 2024, yearDisplay: '2024+', label: 'Hollywood Mogul' }
    ];
    const N = ERAS.length;
    const HOLD_MS = 3500;
    const MORPH_MS = 1500;

    const heroEl = $('#hero');
    const stageEl = $('#stage');
    const stackEl = $('#portraitStack');
    const domImgs = $$('#portraitStack .aging-era-img');
    const cv = $('#morphCanvas');
    const dispEl = $('#morphDisp');
    const turbEl = $('#morphTurb');
    const ageNum = $('#ageNum');
    const ageYear = $('#ageYear');
    const ageLabel = $('#ageLabel');
    const dotBtns = $$('#ageDots button');

    const loadImg = src => new Promise(res => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
    const imgs = await Promise.all(ERAS.map(e => loadImg(e.file)));
    if (!imgs.every(Boolean)) return;

    // Initialize WebGL shader for real-time facial optical warp + alpha blend (with 2D canvas fallback)
    let gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    let glProg = null, glTexs = [], uLocs = {};

    if (gl) {
      const vsSrc = `
        attribute vec2 aPos;
        varying vec2 vUv;
        void main() {
          vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
          gl_Position = vec4(aPos, 0.0, 1.0);
        }
      `;
      const fsSrc = `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexA;
        uniform sampler2D uTexB;
        uniform float uMix;
        uniform float uWarp;
        uniform float uPair;

        void main() {
          // Localize organic morph displacement to the facial region while locking shoulders & head contour
          vec2 faceCenter = vec2(0.50, 0.42);
          vec2 d = (vUv - faceCenter) / vec2(0.22, 0.27);
          float r2 = dot(d, d);
          float faceMask = exp(-r2 * 1.45);

          // Subtle organic warp field so facial features (brows, eyes, smile, jawline) flow smoothly
          float waveX = sin(vUv.y * 22.0 + uMix * 3.14159) * cos(vUv.x * 18.0);
          float waveY = cos(vUv.x * 20.0 - uMix * 3.14159) * sin(vUv.y * 16.0);

          // Directional anatomical shift per era transition (eyebrow raise, jawline/smile shift)
          vec2 flow = vec2(waveX, waveY) * 0.0085 * uWarp * faceMask;
          // Subtle vertical expression flow around eyebrows (y ~ 0.34) and mouth (y ~ 0.53)
          float browMask = exp(-pow((vUv.y - 0.34) / 0.055, 2.0)) * exp(-pow((vUv.x - 0.50) / 0.16, 2.0));
          float mouthMask = exp(-pow((vUv.y - 0.53) / 0.06, 2.0)) * exp(-pow((vUv.x - 0.50) / 0.14, 2.0));
          float dir = (uPair < 2.5) ? 1.0 : -1.0;
          flow.y += dir * (browMask * -0.007 + mouthMask * 0.006) * uWarp;

          vec2 uvA = clamp(vUv - flow * uMix, 0.0, 1.0);
          vec2 uvB = clamp(vUv + flow * (1.0 - uMix), 0.0, 1.0);

          vec4 colA = texture2D(uTexA, uvA);
          vec4 colB = texture2D(uTexB, uvB);

          gl_FragColor = mix(colA, colB, uMix);
        }
      `;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
      };
      const vs = compile(gl.VERTEX_SHADER, vsSrc);
      const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      if (vs && fs) {
        glProg = gl.createProgram();
        gl.attachShader(glProg, vs);
        gl.attachShader(glProg, fs);
        gl.linkProgram(glProg);
        if (gl.getProgramParameter(glProg, gl.LINK_STATUS)) {
          gl.useProgram(glProg);
          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
          const aPos = gl.getAttribLocation(glProg, 'aPos');
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

          glTexs = imgs.map(im => {
            const t = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
            return t;
          });
          uLocs = {
            texA: gl.getUniformLocation(glProg, 'uTexA'),
            texB: gl.getUniformLocation(glProg, 'uTexB'),
            mix: gl.getUniformLocation(glProg, 'uMix'),
            warp: gl.getUniformLocation(glProg, 'uWarp'),
            pair: gl.getUniformLocation(glProg, 'uPair')
          };
          stackEl.classList.add('aging-webgl-ready');
        } else {
          gl = null;
        }
      } else {
        gl = null;
      }
    }
    const ctx2d = !gl ? cv.getContext('2d') : null;

    // Continuous timeline position `pos` in [0, N)
    let pos = 0; // 0 = Stage 1, 1 = Stage 2, 2 = Stage 3, 3 = Stage 4
    let holdProgress = 0; // 0..1 within the 3.5s hold
    let mode = 'auto'; // 'auto' | 'dragging' | 'animating' | 'paused'
    let phase = 'hold'; // 'hold' | 'morph'
    let phaseStart = performance.now();
    let animFrom = 0, animTo = 0, animStart = 0, animDur = MORPH_MS;
    let resumeTimer = null;
    let heroVisible = true;

    const smoothstep = t => t * t * (3 - 2 * t);
    const wrapPos = p => ((p % N) + N) % N;

    function renderAt(rawPos, pillFill = null) {
      pos = wrapPos(rawPos);
      const idxA = Math.floor(pos) % N;
      const idxB = (idxA + 1) % N;
      const frac = pos - Math.floor(pos);
      const e = smoothstep(frac);
      const bell = Math.sin(e * Math.PI); // 0 at keyframes, 1.0 mid-morph

      // 1. Update SVG displacement filter for subtle organic warp during transition
      if (dispEl) {
        const scale = reduce ? 0 : (bell * 6.5);
        dispEl.setAttribute('scale', scale.toFixed(2));
      }
      if (turbEl && bell > 0.01) {
        const bfX = (0.016 + 0.004 * Math.sin(e * Math.PI)).toFixed(4);
        const bfY = (0.022 + 0.004 * Math.cos(e * Math.PI)).toFixed(4);
        turbEl.setAttribute('baseFrequency', `${bfX} ${bfY}`);
      }

      // 2. Render WebGL or 2D Canvas blend + sync stacked DOM images
      if (gl && glProg) {
        gl.viewport(0, 0, cv.width, cv.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, glTexs[idxA]);
        gl.uniform1i(uLocs.texA, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, glTexs[idxB]);
        gl.uniform1i(uLocs.texB, 1);
        gl.uniform1f(uLocs.mix, e);
        gl.uniform1f(uLocs.warp, reduce ? 0 : bell);
        gl.uniform1f(uLocs.pair, idxA);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else if (ctx2d) {
        ctx2d.clearRect(0, 0, cv.width, cv.height);
        ctx2d.globalAlpha = 1;
        ctx2d.drawImage(imgs[idxA], 0, 0, cv.width, cv.height);
        if (e > 0.001) {
          ctx2d.globalAlpha = e;
          ctx2d.drawImage(imgs[idxB], 0, 0, cv.width, cv.height);
        }
        ctx2d.globalAlpha = 1;
      }

      // Keep stacked DOM images synced
      domImgs.forEach((im, k) => {
        const op = k === idxA ? (1 - e) : k === idxB ? e : 0;
        im.style.opacity = op.toFixed(3);
        im.classList.toggle('aging-active', op > 0.5);
      });

      // 3. Synchronize Age Card (AGE count 24 -> 29 -> 40 -> 52 & YEAR 1996 -> 2001 -> 2012 -> 2024+)
      const eraA = ERAS[idxA];
      const eraB = ERAS[idxB];
      const curAge = Math.round(eraA.age + (eraB.age - eraA.age) * e);
      const curYear = Math.round(eraA.year + (eraB.year - eraA.year) * e);
      ageNum.textContent = curAge;

      // Show "2024+" when at or near Stage 4
      const activeIdx = e >= 0.5 ? idxB : idxA;
      if (activeIdx === 3 && (frac < 0.15 || frac > 0.85)) {
        ageYear.textContent = '2024+';
      } else {
        ageYear.textContent = String(curYear);
      }
      ageLabel.textContent = ERAS[activeIdx].label;

      // 4. Update 4-pill neon lime (#D4FF00) progress bar
      dotBtns.forEach((btn, k) => {
        const isCurrent = k === activeIdx;
        btn.classList.toggle('on', isCurrent);
        btn.classList.toggle('aging-passed', k < activeIdx);
        btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
        const fill = btn.querySelector('i');
        if (fill) {
          if (k < activeIdx) fill.style.width = '100%';
          else if (k > activeIdx) fill.style.width = '0%';
          else fill.style.width = `${Math.round((pillFill != null ? pillFill : 1) * 100)}%`;
        }
      });
    }

    function pauseAndScheduleResume(delay = 3200) {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        // Snap gently to nearest stage if stopped mid-transition, then resume auto loop
        const nearest = Math.round(pos) % N;
        if (Math.abs(pos - nearest) > 0.02 && Math.abs(pos - nearest) < 0.98) {
          animateToStage(nearest, true);
        } else {
          pos = nearest;
          mode = 'auto';
          phase = 'hold';
          phaseStart = performance.now();
        }
      }, delay);
    }

    function animateToStage(targetIdx, resumeAutoAfter = true) {
      clearTimeout(resumeTimer);
      mode = 'animating';
      animFrom = pos;
      // Pick shortest forward/backward path across the 4 stages
      let diff = targetIdx - animFrom;
      if (diff > N / 2) diff -= N;
      if (diff < -N / 2) diff += N;
      animTo = animFrom + diff;
      const dist = Math.abs(diff);
      animDur = reduce ? 10 : Math.max(450, Math.min(MORPH_MS, dist * 1100));
      animStart = performance.now();
      if (!resumeAutoAfter) pauseAndScheduleResume(3800);
    }

    // Pill clicks on the Age Card
    dotBtns.forEach((btn, i) => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        animateToStage(i, true);
      });
    });

    // Horizontal Drag Scrubbing across the portrait / hero stage
    let dragStartX = 0, dragStartPos = 0, isDragging = false;
    stageEl.addEventListener('pointerdown', e => {
      if (e.button && e.button !== 0) return;
      isDragging = true;
      mode = 'dragging';
      clearTimeout(resumeTimer);
      dragStartX = e.clientX;
      dragStartPos = pos;
      stageEl.classList.add('hero-dragging');
      stageEl.setPointerCapture?.(e.pointerId);
    });
    stageEl.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const width = Math.max(260, stageEl.clientWidth * 0.65);
      const deltaStages = ((e.clientX - dragStartX) / width) * (N - 1);
      const nextPos = Math.max(0, Math.min(N - 1, dragStartPos + deltaStages));
      renderAt(nextPos, 1);
    });
    const endDrag = e => {
      if (!isDragging) return;
      isDragging = false;
      stageEl.classList.remove('hero-dragging');
      stageEl.releasePointerCapture?.(e.pointerId);
      mode = 'paused';
      pauseAndScheduleResume(2800);
    };
    stageEl.addEventListener('pointerup', endDrag);
    stageEl.addEventListener('pointercancel', endDrag);

    // Wheel / Trackpad Scrubbing on the Hero section
    heroEl.addEventListener('wheel', e => {
      // Allow horizontal trackpad scrubbing at any time, or vertical scrubbing when at top of page
      const isHoriz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const atTop = window.scrollY <= 8;
      const delta = isHoriz ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 1) return;

      // If scrolling vertically at top of page: scrub 0 -> 3; once at Stage 4 (pos >= 2.98) and scrolling down, let page scroll normally
      if (!isHoriz) {
        if (!atTop) return;
        if (delta > 0 && pos >= N - 1 - 0.02) return;
        if (delta < 0 && pos <= 0.02) return;
      }

      e.preventDefault();
      clearTimeout(resumeTimer);
      mode = 'paused';
      const step = delta * 0.0028;
      const nextPos = Math.max(0, Math.min(N - 1, pos + step));
      renderAt(nextPos, 1);
      pauseAndScheduleResume(2600);
    }, { passive: false });

    // Main 60fps loop for seamless 3.5s hold + 1.5s morph auto-play and smooth target animations
    function tick(now) {
      if (heroVisible && !document.hidden) {
        if (mode === 'animating') {
          const p = Math.min(1, (now - animStart) / animDur);
          const cur = animFrom + (animTo - animFrom) * smoothstep(p);
          renderAt(cur, 1);
          if (p >= 1) {
            pos = wrapPos( Math.round(animTo) );
            mode = 'auto';
            phase = 'hold';
            phaseStart = now;
            renderAt(pos, 0);
          }
        } else if (mode === 'auto' && !reduce) {
          const elapsed = now - phaseStart;
          if (phase === 'hold') {
            holdProgress = Math.min(1, elapsed / HOLD_MS);
            renderAt(Math.round(pos) % N, holdProgress);
            if (elapsed >= HOLD_MS) {
              phase = 'morph';
              phaseStart = now;
              animFrom = Math.round(pos) % N;
              animTo = animFrom + 1;
            }
          } else if (phase === 'morph') {
            const p = Math.min(1, elapsed / MORPH_MS);
            renderAt(animFrom + p, 1);
            if (p >= 1) {
              pos = animTo % N;
              phase = 'hold';
              phaseStart = now;
              renderAt(pos, 0);
            }
          }
        }
      }
      requestAnimationFrame(tick);
    }

    new IntersectionObserver(([e]) => {
      heroVisible = e.isIntersecting;
      if (heroVisible && mode === 'auto') phaseStart = performance.now();
    }, { threshold: 0.15 }).observe(heroEl);

    renderAt(0, 0);
    requestAnimationFrame(tick);
  })();

  // ---- menu
  const menu = $('#menu'), mb = $('#menuBtn');
  const setMenu = o => { menu.hidden = !o; mb.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; };
  mb.onclick = () => setMenu(menu.hidden);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  // ---- data
  const { items } = await (await fetch('media.json')).json();
  const videos = items.filter(i => i.type === 'video');
  const photos = items.filter(i => i.type === 'image');
  const byFile = Object.fromEntries(photos.map(p => [p.file, p]));
  const fmt = ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const monthKey = ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const short = ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // hero "new video" card
  const hv = videos.find(v => v.mb < 25) || videos[0];
  if (hv && $('#heroLatest')) {
    const v = $('#heroLatest video'), a = v.parentElement; v.poster = hv.poster;
    const prevSrc = hv.file.replace('/video/', '/preview/');
    v.addEventListener('error', () => { if (v.src && !v.src.endsWith(hv.file)) { v.src = hv.file; v.play().catch(() => {}); } });
    a.addEventListener('mouseenter', () => { if (!v.src) v.src = prevSrc; v.play().catch(() => {}); });
    a.addEventListener('mouseleave', () => v.pause());
  }

  // ---- lightbox (supports both video clips and annotated photo stories)
  let list = [], idx = 0;
  const lb = $('#lb'), stage = $('#lbStage'), cap = $('#lbCap');
  function show(i) {
    idx = (i + list.length) % list.length;
    const it = list[idx]; stage.replaceChildren();
    if (it.type === 'video') {
      const m = el('video'); m.src = it.file.replace('/video/', '/preview/'); m.controls = true; m.autoplay = true; m.playsInline = true;
      m.addEventListener('error', () => { if (m.src && !m.src.endsWith(it.file)) { m.src = it.file; m.play().catch(() => {}); } });
      stage.append(m);
      cap.textContent = `${fmt(it.ts)} · ${idx + 1} / ${list.length}`;
    } else if (it.story) {
      const wrap = el('div', 'photos-lb-wrap');
      const mediaBox = el('div', 'photos-lb-media');
      const im = el('img');
      im.src = it.src;
      im.alt = it.title || 'Dwayne Johnson';
      im.onerror = () => { if (it.fallback && im.src !== it.fallback) im.src = it.fallback; };
      mediaBox.append(im);

      const info = el('div', 'photos-lb-info');
      info.innerHTML = `
        <div class="photos-lb-meta">
          <span class="photos-lb-cat">${it.categoryLabel || 'Archive'}</span>
          <span class="photos-lb-year">${it.date || it.year || ''}</span>
        </div>
        <h3 class="photos-lb-title">${it.title || ''}</h3>
        <p class="photos-lb-loc">📍 ${it.location || ''}</p>
        <p class="photos-lb-story">${it.story}</p>
        <div class="photos-lb-count">Photograph ${idx + 1} of ${list.length} · <a href="photos.html#photos" style="color:#D4FF00;text-decoration:underline">Open Full Visual Archive →</a></div>
      `;
      wrap.append(mediaBox, info);
      stage.append(wrap);
      cap.textContent = '';
    } else {
      const m = el('img'); m.src = it.file || it.src; m.alt = '';
      stage.append(m);
      cap.textContent = it.gallery ? '' : `${it.ts ? fmt(it.ts) + ' · ' : ''}${idx + 1} / ${list.length}`; // gallery photos: picture only
    }
  }
  const open = (l, i) => { list = l; lb.hidden = false; document.body.style.overflow = 'hidden'; show(i); };
  const close = () => { lb.hidden = true; stage.replaceChildren(); document.body.style.overflow = ''; };
  lb.querySelector('.lb-x').onclick = close;
  lb.querySelector('.prev').onclick = () => show(idx - 1);
  lb.querySelector('.next').onclick = () => show(idx + 1);
  lb.addEventListener('click', e => { if (e.target === lb || e.target === stage) close(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });

  // ---- cinema & blockbusters showcase (.movies-*)
  const moviesSection = $('#cinema');
  if (moviesSection) {
    const TRAILER_CATALOG = {
      0: {
        jumanji: {
          year: '2017',
          title: 'Jumanji: Welcome to the Jungle',
          role: 'Role: <strong>Dr. Smolder Bravestone</strong>',
          badge: '$962M worldwide',
          gold: false,
          ytId: '2QKg5SZ_35I',
          desc: 'He plays a nervous teenager stuck in a video-game hero’s body. The remake of the 1995 film took $962 million worldwide and started a new Jumanji series.'
        },
        furious7: {
          year: '2015',
          title: 'Furious 7',
          role: 'Role: <strong>Luke Hobbs</strong>',
          badge: '$1.5B worldwide',
          gold: false,
          ytId: 'yISKeT6sDOg',
          desc: 'His second film as Luke Hobbs, ending in the ambulance-and-minigun finale. It passed $1.5 billion worldwide.'
        }
      },
      1: {
        smashing: {
          year: '2025',
          title: 'The Smashing Machine',
          role: 'Role: <strong>Mark Kerr</strong> · A24 Biopic',
          badge: 'Golden Globe nominee',
          gold: true,
          ytId: 'fEQ4lN1KxXA',
          desc: 'Benny Safdie’s A24 film about UFC fighter Mark Kerr. A quiet, dramatic role under heavy prosthetics, and a long way from Hobbs.'
        },
        moana2026: {
          year: '2026',
          title: 'Moana (Live-Action)',
          role: 'Role: <strong>Maui</strong> · Disney',
          badge: 'Coming 2026',
          gold: false,
          ytId: 'QKYFfYLe5rs',
          desc: 'He plays Maui again, this time in live action. The role ties back to his Samoan grandfather, High Chief Peter Maivia.'
        }
      }
    };

    const slotState = [
      { key: 'jumanji', ytId: '2QKg5SZ_35I', muted: true },
      { key: 'smashing', ytId: 'fEQ4lN1KxXA', muted: true }
    ];
    let stageInView = false;

    const buildEmbedUrl = (ytId, muted) => {
      const m = muted ? 1 : 0;
      return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=${m}&loop=1&controls=1&rel=0&playsinline=1&modestbranding=1&playlist=${ytId}`;
    };

    const syncSlotPlayer = (slotIdx, forceReload = false) => {
      const iframe = $(`#moviesIframe${slotIdx}`);
      if (!iframe) return;
      const st = slotState[slotIdx];
      iframe.parentElement.style.backgroundImage = `url(https://i.ytimg.com/vi/${st.ytId}/hqdefault.jpg)`;
      if (!stageInView) {
        if (iframe.src && iframe.src !== 'about:blank') { iframe.classList.remove('is-ready'); iframe.src = 'about:blank'; }
        return;
      }
      const targetUrl = buildEmbedUrl(st.ytId, st.muted);
      if (forceReload || iframe.src !== targetUrl) {
        iframe.classList.remove('is-ready');
        iframe.onload = () => iframe.classList.add('is-ready');
        iframe.src = targetUrl;
      }
    };

    const updateAudioBtnUI = (slotIdx) => {
      const btn = moviesSection.querySelector(`.movies-audio-btn[data-slot="${slotIdx}"]`);
      if (!btn) return;
      const isMuted = slotState[slotIdx].muted;
      btn.classList.toggle('is-unmuted', !isMuted);
      const icon = btn.querySelector('.movies-audio-icon');
      const label = btn.querySelector('.movies-audio-label');
      if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
      if (label) label.textContent = isMuted ? 'Sound on' : 'Mute';
    };

    // Observe trailer stage for fast page load + automatic muted background loop when in view
    const trailerStage = $('#moviesTrailerStage');
    syncSlotPlayer(0); syncSlotPlayer(1); // paint the cover pictures straight away
    if (trailerStage) {
      const stageIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          stageInView = entry.isIntersecting;
          syncSlotPlayer(0);
          syncSlotPlayer(1);
        });
      }, { threshold: 0.18 });
      stageIO.observe(trailerStage);
    }

    // Switcher pills for Featured Trailer 1 & 2
    $$('.movies-switch-pill', moviesSection).forEach((pill) => {
      pill.addEventListener('click', () => {
        const slotIdx = Number(pill.dataset.slot);
        const filmKey = pill.dataset.film;
        const data = TRAILER_CATALOG[slotIdx]?.[filmKey];
        if (!data) return;

        // Toggle active pill state within this slot
        $$(`.movies-switch-pill[data-slot="${slotIdx}"]`, moviesSection).forEach((p) => {
          const active = p === pill;
          p.classList.toggle('is-on', active);
          p.setAttribute('aria-selected', String(active));
        });

        // Update state & metadata
        slotState[slotIdx].key = filmKey;
        slotState[slotIdx].ytId = data.ytId;

        const yearEl = $(`#moviesYear${slotIdx}`);
        const titleEl = $(`#moviesTitle${slotIdx}`);
        const roleEl = $(`#moviesRole${slotIdx}`);
        const badgeEl = $(`#moviesBadge${slotIdx}`);
        const descEl = $(`#moviesDesc${slotIdx}`);
        const extEl = $(`#moviesExt${slotIdx}`);
        const iframe = $(`#moviesIframe${slotIdx}`);

        if (yearEl) yearEl.textContent = data.year;
        if (titleEl) titleEl.textContent = data.title;
        if (roleEl) roleEl.innerHTML = data.role;
        if (badgeEl) {
          badgeEl.textContent = data.badge;
          badgeEl.classList.toggle('movies-badge-gold', !!data.gold);
        }
        if (descEl) descEl.textContent = data.desc;
        if (extEl) extEl.href = `https://www.youtube.com/watch?v=${data.ytId}`;
        if (iframe) {
          iframe.dataset.ytId = data.ytId;
          iframe.title = `${data.title} Official Trailer`;
        }

        stageInView = true;
        syncSlotPlayer(slotIdx, true);
      });
    });

    // Unmute / Watch Full Trailer buttons
    $$('.movies-audio-btn', moviesSection).forEach((btn) => {
      btn.addEventListener('click', () => {
        const slotIdx = Number(btn.dataset.slot);
        const willUnmute = slotState[slotIdx].muted;
        // If unmuting one trailer, mute the other so audio never clashes
        if (willUnmute) {
          const otherIdx = slotIdx === 0 ? 1 : 0;
          if (!slotState[otherIdx].muted) {
            slotState[otherIdx].muted = true;
            updateAudioBtnUI(otherIdx);
            syncSlotPlayer(otherIdx, true);
          }
        }
        slotState[slotIdx].muted = !willUnmute;
        stageInView = true;
        updateAudioBtnUI(slotIdx);
        syncSlotPlayer(slotIdx, true);
      });
    });

    // (full filmography: movies.html)
  }

  // footer photo
  const fi = byFile['media/img/1783330546_3935182615065044430.jpg'];
  if (fi) ($('#footerImg') || {}).src = fi.thumb;

  // ---- tiles + galleries
  // video tiles play on their own (muted, looping) while on screen; they load as they near the viewport and pause when scrolled away
  const autoplay = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!reduce) v.play().catch(() => {}); } else v.pause();
  }), { rootMargin: '300px 0px', threshold: 0.1 });
  const tile = (it, l, i) => {
    const b = el('button', 'tile'); b.setAttribute('aria-label', it.type === 'video' ? 'Watch video with sound' : 'Open photo');
    if (it.type === 'video') {
      const v = el('video'); v.poster = it.poster; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
      v.dataset.src = it.file.replace('/video/', '/preview/'); v.dataset.full = it.file; v.setAttribute('aria-hidden', 'true');
      v.addEventListener('error', () => { if (v.src && !v.src.endsWith(v.dataset.full)) { v.src = v.dataset.full; v.play().catch(() => {}); } }); // no preview yet: use the full clip
      b.append(v); autoplay.observe(v);
    } else {
      const im = el('img'); im.src = it.thumb; im.loading = 'lazy'; im.alt = ''; im.width = it.w; im.height = it.h;
      b.append(im);
    }
    b.onclick = () => open(l, i);
    return b;
  };
  // home shows one row of the newest videos; "See more" opens the full collection on videos.html
  const vg = $('#videoGrid');
  $('#videoCount').textContent = `${videos.length} videos`;
  const fillRow = () => {
    const cols = Math.max(1, getComputedStyle(vg).gridTemplateColumns.split(' ').filter(Boolean).length);
    if (vg.children.length === cols) return;
    vg.replaceChildren(...videos.slice(0, cols).map((it, i) => tile(it, videos, i)));
  };
  let rowTimer; addEventListener('resize', () => { clearTimeout(rowTimer); rowTimer = setTimeout(fillRow, 150); });
  fillRow();

  // ---- homepage 10 pure portrait photos preview (.photos-preview-*)
  const photoGrid = $('#photoGrid');
  if (photoGrid) {
    try {
      // newest 10 photos of him from the gallery (media/gallery.json); pictures only
      const featuredTen = (await (await fetch('media/gallery.json')).json()).slice(0, 10);
      photoGrid.replaceChildren(...featuredTen.map((p, i) => {
        const card = el('button', 'photos-preview-card');
        card.type = 'button';
        card.setAttribute('aria-label', 'Open photo');
        const im = el('img');
        im.src = p.thumb;
        im.alt = 'Dwayne Johnson';
        im.loading = 'lazy';
        card.append(im);
        card.onclick = () => open(featuredTen, i);
        return card;
      }));
    } catch (err) {
      console.error('Failed to load photos archive preview:', err);
    }
  }

  // nav logo flips color over dark sections
  const navEl = $('#nav'), darkAt = () => {
    const s = document.elementsFromPoint(40, 36).find(e => e.matches('.manifesto,.block.dark,.feature,.footer'));
    navEl.classList.toggle('on-dark', !!s);
  };
  addEventListener('scroll', darkAt, { passive: true }); darkAt();

  // ---- scroll effects: reveal, feature image drift
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .12 });
  $$('.reveal').forEach(e => io.observe(e));
  if (!reduce) {
    const fimgs = $$('.feature-img img'), wide = () => innerWidth > 760;
    let tick = false;
    const run = () => {
      tick = false; const vh = innerHeight;
      if (wide()) {
        fimgs.forEach(img => { const r = img.parentElement.getBoundingClientRect(); const t = (r.top + r.height / 2 - vh / 2) / vh; img.style.transform = `translateY(${-8 - t * 8}%)`; });
      }
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }
})();
