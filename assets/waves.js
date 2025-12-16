(() => {
    const STORAGE_KEY = "vmodel.waveSettings.v2";
    const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

    const loadSettings = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

    const saveSettings = (settings) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch {
            /* ignore private mode errors */
        }
    };

    const createDOM = () => {
        const container = document.createElement("div");
        container.className = "wave-bg";
        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        container.appendChild(canvas);
        document.body.appendChild(container);

        const controls = document.createElement("section");
        controls.className = "wave-controls";
        controls.setAttribute("aria-label", "Wave background controls");
        controls.innerHTML = `
            <div class="wave-controls__header">
                <div class="wave-controls__title">Ocean Mood</div>
                <div class="wave-controls__toggle">
                    <button type="button" data-action="toggle">Hide</button>
                </div>
            </div>

            <div class="wave-controls__row">
                <label for="wave-wind">Wind</label>
                <div class="wave-controls__value" data-value="wind"></div>
            </div>
            <input id="wave-wind" type="range" min="0" max="100" value="45">

            <div class="wave-controls__row">
                <label for="wave-height">Wave height</label>
                <div class="wave-controls__value" data-value="height"></div>
            </div>
            <input id="wave-height" type="range" min="0" max="100" value="50">

            <div class="wave-controls__row">
                <label for="wave-light">Light</label>
                <div class="wave-controls__value" data-value="light"></div>
            </div>
            <input id="wave-light" type="range" min="0" max="100" value="55">

            <div class="wave-controls__hint">
                Subtle motion mirrors the V字の流れ。値はローカルに保存されます。
            </div>
        `;
        document.body.appendChild(controls);
        return { canvas, controls };
    };

    const prefersReducedMotion = () =>
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    function createRenderer(canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        const state = {
            cssW: 0,
            cssH: 0,
            dpr: 1,
            time: 0,
            running: true,
            settings: {
                wind: 0.45,
                height: 0.5,
                light: 0.55,
                controlsHidden: false,
            },
        };

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            state.dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.max(1, Math.round(rect.width * state.dpr));
            canvas.height = Math.max(1, Math.round(rect.height * state.dpr));
            state.cssW = canvas.width / state.dpr;
            state.cssH = canvas.height / state.dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(state.dpr, state.dpr);
        };

        const drawLayer = (layer, baseY, amplitude, speedFactor, tint) => {
            const w = state.cssW;
            const h = state.cssH;
            const points = [];
            const density = 2.5; // px step
            const freq = layer.frequency;
            const time = state.time * speedFactor + layer.phase;

            for (let x = 0; x <= w; x += density) {
                const progress = x / w;
                const wave =
                    Math.sin(progress * freq + time) +
                    0.45 * Math.sin(progress * (freq * 1.7) + time * 0.8 + layer.phase * 1.3);
                const y = baseY + wave * amplitude * layer.amplitude;
                points.push({ x, y });
            }

            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(0, points[0].y);
            for (const pt of points) ctx.lineTo(pt.x, pt.y);
            ctx.lineTo(w, h);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, baseY - amplitude * 2, 0, h);
            grad.addColorStop(0, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${layer.opacity})`);
            grad.addColorStop(
                1,
                `rgba(${Math.round(tint[0] * 0.5)}, ${Math.round(tint[1] * 0.6)}, ${Math.round(
                    tint[2] * 0.9
                )}, ${layer.opacity * 0.4})`
            );
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = `rgba(255,255,255,${0.015 + layer.opacity * 0.03})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        };

        const render = (dt) => {
            const w = state.cssW;
            const h = state.cssH;
            const { wind, height, light } = state.settings;

            ctx.clearRect(0, 0, w, h);

            // Soft base tint
            const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
            baseGrad.addColorStop(0, "rgba(8, 11, 30, 0.85)");
            baseGrad.addColorStop(1, "rgba(6, 9, 22, 0.6)");
            ctx.fillStyle = baseGrad;
            ctx.fillRect(0, 0, w, h);

            const center = h * 0.72;
            const maxAmp = lerp(45, 160, height);
            const speed = lerp(0.15, 0.9, wind);
            state.time += dt * speed;

            const baseTint = (shift) => {
                const hue = 225 + shift * 15;
                const saturation = 35 + light * 25;
                const lightness = 20 + light * 30 + shift * 6;
                return hslToRgb(hue, saturation / 100, lightness / 100);
            };

            const layers = [
                { frequency: 5.2, amplitude: 0.65, phase: 0.0, opacity: 0.9 },
                { frequency: 3.4, amplitude: 0.9, phase: 1.2, opacity: 0.75 },
                { frequency: 2.1, amplitude: 1.25, phase: 2.4, opacity: 0.6 },
            ];

            layers.forEach((layer, idx) =>
                drawLayer(layer, center + idx * 12, maxAmp, 1 + idx * 0.2, baseTint(idx))
            );

            // Light shimmer
            const shimmer = ctx.createLinearGradient(0, 0, w, 0);
            const glow = 0.15 + light * 0.4;
            shimmer.addColorStop(0, "rgba(255,255,255,0)");
            shimmer.addColorStop(0.5, `rgba(255,255,255,${glow * 0.35})`);
            shimmer.addColorStop(1, "rgba(255,255,255,0)");
            ctx.globalCompositeOperation = "screen";
            ctx.fillStyle = shimmer;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = "source-over";
        };

        const lerp = (a, b, t) => a + (b - a) * t;

        function hslToRgb(h, s, l) {
            const c = (1 - Math.abs(2 * l - 1)) * s;
            const hp = h / 60;
            const x = c * (1 - Math.abs((hp % 2) - 1));
            let [r, g, b] = [0, 0, 0];
            if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
            else if (hp < 2) [r, g, b] = [x, c, 0];
            else if (hp < 3) [r, g, b] = [0, c, x];
            else if (hp < 4) [r, g, b] = [0, x, c];
            else if (hp < 5) [r, g, b] = [x, 0, c];
            else [r, g, b] = [c, 0, x];

            const m = l - c / 2;
            return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
        }

        const step = (ts => {
            let last = ts;
            return function frame(now) {
                const dt = Math.min(0.05, (now - last) / 1000);
                last = now;
                if (state.running) render(dt);
                requestAnimationFrame(frame);
            };
        })(performance.now());

        requestAnimationFrame(step);
        resize();
        window.addEventListener("resize", resize, { passive: true });

        return { state, resize };
    }

    function init() {
        if (!document.body || document.querySelector(".wave-bg")) return;

        const { canvas, controls } = createDOM();
        const renderer = createRenderer(canvas);
        if (!renderer) return;

        const stored = loadSettings();
        if (stored) {
            ["wind", "height", "light"].forEach((key) => {
                if (typeof stored[key] === "number") {
                    renderer.state.settings[key] = clamp(stored[key], 0, 1);
                }
            });
            renderer.state.settings.controlsHidden = !!stored.controlsHidden;
        }

        const setRange = (id, value) => {
            const input = controls.querySelector(id);
            input.value = String(Math.round(value * 100));
        };
        setRange("#wave-wind", renderer.state.settings.wind);
        setRange("#wave-height", renderer.state.settings.height);
        setRange("#wave-light", renderer.state.settings.light);

        const updateDisplay = () => {
            controls.querySelector('[data-value="wind"]').textContent = `${Math.round(
                renderer.state.settings.wind * 100
            )}%`;
            controls.querySelector('[data-value="height"]').textContent = `${Math.round(
                renderer.state.settings.height * 100
            )}%`;
            controls.querySelector('[data-value="light"]').textContent = `${Math.round(
                renderer.state.settings.light * 100
            )}%`;
        };
        updateDisplay();

        ["wind", "height", "light"].forEach((key) => {
            const input = controls.querySelector(`#wave-${key}`);
            input.addEventListener(
                "input",
                () => {
                    renderer.state.settings[key] = Number(input.value) / 100;
                    updateDisplay();
                    saveSettings(renderer.state.settings);
                },
                { passive: true }
            );
        });

        const toggleBtn = controls.querySelector("[data-action='toggle']");
        const applyHidden = () => {
            controls.classList.toggle("is-collapsed", renderer.state.settings.controlsHidden);
            toggleBtn.textContent = renderer.state.settings.controlsHidden ? "Show" : "Hide";
        };
        toggleBtn.addEventListener("click", () => {
            renderer.state.settings.controlsHidden = !renderer.state.settings.controlsHidden;
            applyHidden();
            saveSettings(renderer.state.settings);
        });
        applyHidden();

        if (prefersReducedMotion()) {
            renderer.state.running = false;
            canvas.style.opacity = "0.25";
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
