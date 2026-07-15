(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");
  const overlayHint = document.getElementById("overlay-hint");
  const scoreEl = document.getElementById("score");
  const fragmentsEl = document.getElementById("fragments");
  const livesEl = document.getElementById("lives");
  const universeNameEl = document.getElementById("universe-name");
  const statusEl = document.getElementById("status");
  const shiftCdEl = document.getElementById("shift-cd");

  const W = canvas.width;
  const H = canvas.height;
  const FRAGMENTS_PER_WORLD = 5;
  const SHIFT_COOLDOWN = 2.2;
  const INVULN_TIME = 1.2;

  const UNIVERSES = [
    {
      id: "prime",
      name: "Prime",
      bg: ["#0a0820", "#1a1040"],
      accent: "#7b5cff",
      playerSpeed: 220,
      enemySpeed: 90,
      gravity: 0,
      drift: 0,
      particleHue: 260,
    },
    {
      id: "neon",
      name: "Neon Tide",
      bg: ["#001018", "#003040"],
      accent: "#00f0ff",
      playerSpeed: 260,
      enemySpeed: 120,
      gravity: 0,
      drift: 35,
      particleHue: 185,
    },
    {
      id: "ember",
      name: "Ember Fold",
      bg: ["#1a0804", "#3a1408"],
      accent: "#ff6b3d",
      playerSpeed: 200,
      enemySpeed: 140,
      gravity: 0,
      drift: -20,
      particleHue: 18,
    },
    {
      id: "void",
      name: "Void Mirror",
      bg: ["#040408", "#120818"],
      accent: "#ff4d9a",
      playerSpeed: 240,
      enemySpeed: 160,
      gravity: 0,
      drift: 0,
      particleHue: 320,
    },
    {
      id: "crystal",
      name: "Crystal Lattice",
      bg: ["#061018", "#0c2840"],
      accent: "#3dff9a",
      playerSpeed: 210,
      enemySpeed: 100,
      gravity: 0,
      drift: 15,
      particleHue: 150,
    },
  ];

  const keys = new Set();
  let state = "menu"; // menu | playing | paused | won | lost
  let lastTime = 0;
  let universeIndex = 0;
  let score = 0;
  let lives = 3;
  let shiftTimer = 0;
  let invuln = 0;
  let flash = 0;
  let message = "";
  let messageTimer = 0;
  let stars = [];
  let particles = [];
  let player;
  let enemies = [];
  let fragments = [];
  let hazards = [];
  let worldsCleared = new Set();
  let animId = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function currentUniverse() {
    return UNIVERSES[universeIndex];
  }

  function resetPlayer() {
    player = {
      x: W * 0.5,
      y: H * 0.5,
      r: 14,
      vx: 0,
      vy: 0,
    };
  }

  function spawnStars() {
    stars = Array.from({ length: 80 }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      z: rand(0.2, 1.4),
      tw: rand(0, Math.PI * 2),
    }));
  }

  function spawnWorldContent() {
    const u = currentUniverse();
    fragments = [];
    enemies = [];
    hazards = [];
    particles = [];

    for (let i = 0; i < FRAGMENTS_PER_WORLD; i++) {
      fragments.push({
        x: rand(60, W - 60),
        y: rand(60, H - 60),
        r: 10,
        phase: rand(0, Math.PI * 2),
        collected: false,
      });
    }

    // Keep fragments away from player spawn
    fragments.forEach((f) => {
      if (dist(f, player) < 90) {
        f.x = rand(60, W - 60);
        f.y = rand(60, H - 60);
      }
    });

    const enemyCount = 3 + universeIndex + (worldsCleared.size > 2 ? 1 : 0);
    for (let i = 0; i < enemyCount; i++) {
      let ex, ey, tries = 0;
      do {
        ex = rand(40, W - 40);
        ey = rand(40, H - 40);
        tries++;
      } while (Math.hypot(ex - player.x, ey - player.y) < 140 && tries < 20);

      enemies.push({
        x: ex,
        y: ey,
        r: rand(12, 18),
        angle: rand(0, Math.PI * 2),
        spin: rand(-2, 2),
        kind: pick(["seeker", "orbiter", "drifter"]),
        t: rand(0, 10),
      });
    }

    // Universe-specific hazards
    if (u.id === "ember") {
      for (let i = 0; i < 4; i++) {
        hazards.push({
          type: "flame",
          x: rand(80, W - 80),
          y: rand(80, H - 80),
          r: rand(28, 42),
          phase: rand(0, Math.PI * 2),
        });
      }
    } else if (u.id === "void") {
      for (let i = 0; i < 3; i++) {
        hazards.push({
          type: "well",
          x: rand(100, W - 100),
          y: rand(100, H - 100),
          r: 50,
          pull: 90,
        });
      }
    } else if (u.id === "crystal") {
      for (let i = 0; i < 5; i++) {
        hazards.push({
          type: "spike",
          x: rand(40, W - 40),
          y: rand(40, H - 40),
          r: 16,
          rot: rand(0, Math.PI),
        });
      }
    } else if (u.id === "neon") {
      for (let i = 0; i < 3; i++) {
        hazards.push({
          type: "wave",
          y: rand(80, H - 80),
          amp: rand(30, 70),
          speed: rand(1.2, 2.2),
          phase: rand(0, Math.PI * 2),
          thick: 10,
        });
      }
    }
  }

  function burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 180);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.3, 0.8),
        max: 0.8,
        color,
        r: rand(2, 4),
      });
    }
  }

  function updateHUD() {
    const collected = fragments.filter((f) => f.collected).length;
    scoreEl.textContent = String(score);
    fragmentsEl.textContent = `${collected} / ${FRAGMENTS_PER_WORLD}`;
    livesEl.textContent = "♥".repeat(Math.max(0, lives)) || "—";
    universeNameEl.textContent = currentUniverse().name;

    if (shiftTimer > 0) {
      shiftCdEl.textContent = `Shift in ${shiftTimer.toFixed(1)}s`;
      shiftCdEl.className = "cooling";
    } else {
      shiftCdEl.textContent = "Shift ready";
      shiftCdEl.className = "ready";
    }
  }

  function showMessage(text, time = 1.6) {
    message = text;
    messageTimer = time;
  }

  function startGame() {
    state = "playing";
    universeIndex = 0;
    score = 0;
    lives = 3;
    shiftTimer = 0;
    invuln = 0;
    flash = 0;
    worldsCleared = new Set();
    resetPlayer();
    spawnStars();
    spawnWorldContent();
    overlay.classList.add("hidden");
    statusEl.textContent = "Shifting active";
    showMessage("Welcome to Prime", 1.4);
    updateHUD();
    lastTime = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function endGame(won) {
    state = won ? "won" : "lost";
    overlay.classList.remove("hidden");
    const title = overlay.querySelector("h1");
    const blurb = overlay.querySelector(".blurb");
    const kicker = overlay.querySelector(".kicker");
    if (won) {
      kicker.textContent = "All Realities Stabilized";
      title.innerHTML = "MULTIVERSE<br />SECURED";
      blurb.innerHTML = `You stitched the realms together.<br /><strong>Final score: ${score}</strong>`;
      startBtn.textContent = "Play Again";
      overlayHint.textContent = "Every universe cleared";
      statusEl.textContent = "Victory";
    } else {
      kicker.textContent = "Collapse Complete";
      title.innerHTML = "YOU WERE<br />UNRAVELED";
      blurb.innerHTML = `The multiverse closed around you.<br /><strong>Score: ${score}</strong>`;
      startBtn.textContent = "Try Again";
      overlayHint.textContent = "Press Enter or click to restart";
      statusEl.textContent = "Game over";
    }
  }

  function tryShift() {
    if (state !== "playing" || shiftTimer > 0) return;

    const collected = fragments.filter((f) => f.collected).length;
    if (collected >= FRAGMENTS_PER_WORLD) {
      worldsCleared.add(currentUniverse().id);
      score += 250;
    }

    // Prefer uncleared worlds, else cycle
    const uncleared = UNIVERSES.map((u, i) => i).filter(
      (i) => !worldsCleared.has(UNIVERSES[i].id)
    );

    if (uncleared.length === 0) {
      score += 1000;
      updateHUD();
      endGame(true);
      return;
    }

    let next;
    if (uncleared.length === 1) {
      next = uncleared[0];
    } else {
      const options = uncleared.filter((i) => i !== universeIndex);
      next = pick(options.length ? options : uncleared);
    }

    universeIndex = next;
    shiftTimer = SHIFT_COOLDOWN;
    invuln = 0.6;
    flash = 0.35;
    resetPlayer();
    spawnWorldContent();
    score += 50;
    showMessage(`Shifted → ${currentUniverse().name}`);
    statusEl.textContent = `In ${currentUniverse().name}`;
    updateHUD();
    burst(player.x, player.y, currentUniverse().accent, 20);
  }

  function hitPlayer() {
    if (invuln > 0) return;
    lives -= 1;
    invuln = INVULN_TIME;
    flash = 0.25;
    burst(player.x, player.y, "#ff4d6d", 16);
    score = Math.max(0, score - 40);
    updateHUD();
    if (lives <= 0) {
      endGame(false);
      return;
    }
    showMessage("Reality sting! -1 life");
    player.x = W * 0.5;
    player.y = H * 0.5;
  }

  function update(dt) {
    if (state !== "playing") return;

    const u = currentUniverse();
    shiftTimer = Math.max(0, shiftTimer - dt);
    invuln = Math.max(0, invuln - dt);
    flash = Math.max(0, flash - dt);
    messageTimer = Math.max(0, messageTimer - dt);

    // Input
    let ax = 0;
    let ay = 0;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) ax -= 1;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) ax += 1;
    if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) ay -= 1;
    if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) ay += 1;

    if (ax || ay) {
      const len = Math.hypot(ax, ay) || 1;
      ax /= len;
      ay /= len;
    }

    const speed = u.playerSpeed;
    player.vx = ax * speed + u.drift;
    player.vy = ay * speed;
    player.x = clamp(player.x + player.vx * dt, player.r, W - player.r);
    player.y = clamp(player.y + player.vy * dt, player.r, H - player.r);

    // Stars parallax
    stars.forEach((s) => {
      s.x += (u.drift * 0.15 + player.vx * 0.02) * s.z * dt;
      s.y += player.vy * 0.015 * s.z * dt;
      s.tw += dt * 2;
      if (s.x < 0) s.x += W;
      if (s.x > W) s.x -= W;
      if (s.y < 0) s.y += H;
      if (s.y > H) s.y -= H;
    });

    // Fragments
    fragments.forEach((f) => {
      if (f.collected) return;
      f.phase += dt * 3;
      if (dist(player, f) < player.r + f.r) {
        f.collected = true;
        score += 100;
        burst(f.x, f.y, u.accent, 14);
        const left = fragments.filter((x) => !x.collected).length;
        if (left === 0) {
          showMessage("All fragments secured — shift when ready!");
          score += 150;
        }
        updateHUD();
      }
    });

    // Enemies
    enemies.forEach((e) => {
      e.t += dt;
      e.angle += e.spin * dt;

      if (e.kind === "seeker") {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * u.enemySpeed * dt;
        e.y += (dy / d) * u.enemySpeed * dt;
      } else if (e.kind === "orbiter") {
        const ox = W * 0.5 + Math.cos(e.t * 0.9 + e.spin) * (120 + e.r * 4);
        const oy = H * 0.5 + Math.sin(e.t * 1.1) * (90 + e.r * 3);
        e.x += (ox - e.x) * 2 * dt;
        e.y += (oy - e.y) * 2 * dt;
      } else {
        e.x += Math.cos(e.angle) * u.enemySpeed * 0.7 * dt;
        e.y += Math.sin(e.angle) * u.enemySpeed * 0.7 * dt;
        if (e.x < e.r || e.x > W - e.r) e.angle = Math.PI - e.angle;
        if (e.y < e.r || e.y > H - e.r) e.angle = -e.angle;
      }

      e.x = clamp(e.x, e.r, W - e.r);
      e.y = clamp(e.y, e.r, H - e.r);

      if (dist(player, e) < player.r + e.r * 0.85) hitPlayer();
    });

    // Hazards
    hazards.forEach((h) => {
      if (h.type === "flame") {
        h.phase += dt * 4;
        const pulse = h.r + Math.sin(h.phase) * 8;
        if (dist(player, h) < player.r + pulse * 0.55) hitPlayer();
      } else if (h.type === "well") {
        const d = dist(player, h);
        if (d < h.r + 40 && d > 1) {
          const pull = h.pull / d;
          player.x += ((h.x - player.x) / d) * pull * dt;
          player.y += ((h.y - player.y) / d) * pull * dt;
        }
        if (d < h.r * 0.35) hitPlayer();
      } else if (h.type === "spike") {
        h.rot += dt * 1.5;
        if (dist(player, h) < player.r + h.r) hitPlayer();
      } else if (h.type === "wave") {
        h.phase += dt * h.speed;
        // approximate collision with sine band
        for (let x = 0; x < W; x += 24) {
          const y = h.y + Math.sin(h.phase + x * 0.02) * h.amp;
          if (Math.hypot(player.x - x, player.y - y) < player.r + h.thick) {
            hitPlayer();
            break;
          }
        }
      }
    });

    // Particles
    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      return p.life > 0;
    });

    // Soft score tick while exploring
    score += Math.floor(dt * 2);
    if (Math.random() < dt * 2) updateHUD();
  }

  function drawBackground(u) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, u.bg[0]);
    g.addColorStop(1, u.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Vignette grid
    ctx.save();
    ctx.strokeStyle = `${u.accent}18`;
    ctx.lineWidth = 1;
    const step = u.id === "crystal" ? 36 : 48;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    stars.forEach((s) => {
      const a = 0.35 + 0.45 * Math.abs(Math.sin(s.tw));
      ctx.fillStyle = `hsla(${u.particleHue}, 80%, 80%, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.z * 1.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlayer(u) {
    const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(player.x, player.y);

    // Glow
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
    glow.addColorStop(0, `${u.accent}aa`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.rotate(Math.atan2(player.vy, player.vx || 1) * 0.15);
    ctx.fillStyle = "#f4f2ff";
    ctx.strokeStyle = u.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, 11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawFragments(u, t) {
    fragments.forEach((f) => {
      if (f.collected) return;
      const bob = Math.sin(f.phase) * 4;
      ctx.save();
      ctx.translate(f.x, f.y + bob);
      ctx.rotate(f.phase * 0.5);

      ctx.shadowColor = u.accent;
      ctx.shadowBlur = 12;
      ctx.fillStyle = u.accent;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? f.r : f.r * 0.55;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  }

  function drawEnemies(u) {
    enemies.forEach((e) => {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);

      if (e.kind === "seeker") {
        ctx.fillStyle = "#ff4d6d";
        ctx.strokeStyle = "#ffb3c1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.r, 0);
        ctx.lineTo(-e.r * 0.7, e.r * 0.7);
        ctx.lineTo(-e.r * 0.3, 0);
        ctx.lineTo(-e.r * 0.7, -e.r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.kind === "orbiter") {
        ctx.fillStyle = "#ffb347";
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff0c8";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#a78bfa";
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const x = Math.cos(a) * e.r;
          const y = Math.sin(a) * e.r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });
  }

  function drawHazards(u, t) {
    hazards.forEach((h) => {
      if (h.type === "flame") {
        const pulse = h.r + Math.sin(h.phase) * 8;
        const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, pulse);
        g.addColorStop(0, "rgba(255, 220, 120, 0.9)");
        g.addColorStop(0.5, "rgba(255, 90, 40, 0.55)");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, pulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.type === "well") {
        const g = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, h.r);
        g.addColorStop(0, "rgba(255, 77, 154, 0.85)");
        g.addColorStop(0.4, "rgba(80, 20, 90, 0.5)");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 120, 180, 0.5)";
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r * 0.55 + Math.sin(t * 3) * 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (h.type === "spike") {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rot);
        ctx.fillStyle = u.accent;
        ctx.beginPath();
        ctx.moveTo(0, -h.r);
        ctx.lineTo(h.r * 0.7, h.r * 0.6);
        ctx.lineTo(-h.r * 0.7, h.r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (h.type === "wave") {
        ctx.strokeStyle = `${u.accent}cc`;
        ctx.lineWidth = h.thick;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y = h.y + Math.sin(h.phase + x * 0.02) * h.amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
  }

  function drawParticles() {
    particles.forEach((p) => {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawUIOverlay(t) {
    if (messageTimer > 0 && message) {
      ctx.save();
      ctx.globalAlpha = clamp(messageTimer * 2, 0, 1);
      ctx.font = "600 18px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = currentUniverse().accent;
      ctx.shadowBlur = 12;
      ctx.fillText(message, W / 2, 48);
      ctx.restore();
    }

    // Mini progress rings for cleared worlds
    const n = UNIVERSES.length;
    const startX = W / 2 - ((n - 1) * 18) / 2;
    UNIVERSES.forEach((u, i) => {
      const x = startX + i * 18;
      const y = H - 22;
      const cleared = worldsCleared.has(u.id);
      const active = i === universeIndex;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = cleared ? u.accent : "rgba(255,255,255,0.15)";
      ctx.fill();
      if (active) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (state === "paused") {
      ctx.fillStyle = "rgba(5,4,12,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "700 32px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", W / 2, H / 2);
      ctx.font = "16px Share Tech Mono, monospace";
      ctx.fillStyle = "#9a94c4";
      ctx.fillText("Press P to resume", W / 2, H / 2 + 32);
    }
  }

  function draw(t) {
    const u = currentUniverse();
    drawBackground(u);
    drawHazards(u, t);
    drawFragments(u, t);
    drawEnemies(u);
    drawParticles();
    if (state === "playing" || state === "paused") drawPlayer(u);
    drawUIOverlay(t);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
    lastTime = now;

    if (state === "playing") update(dt);
    draw(now / 1000);

    if (state === "playing" || state === "paused") {
      animId = requestAnimationFrame(loop);
    } else {
      // Keep rendering end state briefly
      draw(now / 1000);
    }
  }

  function onKeyDown(e) {
    keys.add(e.key);

    if (e.key === "Enter" && (state === "menu" || state === "won" || state === "lost")) {
      e.preventDefault();
      startGame();
      return;
    }

    if (state === "playing" || state === "paused") {
      if (e.key === "p" || e.key === "P") {
        if (state === "playing") {
          state = "paused";
          statusEl.textContent = "Paused";
        } else {
          state = "playing";
          statusEl.textContent = `In ${currentUniverse().name}`;
          lastTime = performance.now();
        }
      }
      if ((e.key === " " || e.key === "e" || e.key === "E") && state === "playing") {
        e.preventDefault();
        tryShift();
      }
    }
  }

  function onKeyUp(e) {
    keys.delete(e.key);
  }

  startBtn.addEventListener("click", startGame);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Idle preview render
  spawnStars();
  resetPlayer();
  universeIndex = 0;
  draw(0);
  statusEl.textContent = "Ready";
  updateHUD();
})();
