import { useEffect, useRef } from "react";

/**
 * Animated neural-wave + particle canvas background.
 * Subtle, GPU-light, respects prefers-reduced-motion.
 */
export function WaveBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const particles = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.00035,
      vy: (Math.random() - 0.5) * 0.00035,
      a: Math.random() * 0.4 + 0.15,
    }));

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      // layered 3D-ish waves
      const layers = 5;
      for (let l = 0; l < layers; l++) {
        const p = l / (layers - 1);
        const baseY = h * (0.55 + p * 0.16);
        const amp = h * 0.055 * (1 - p * 0.45);
        const speed = 0.00018 + l * 0.00006;
        const grad = ctx.createLinearGradient(0, baseY - amp, w, baseY + amp);
        grad.addColorStop(0, `rgba(84,126,255,${0.16 - p * 0.02})`);
        grad.addColorStop(0.5, `rgba(139,106,255,${0.2 - p * 0.025})`);
        grad.addColorStop(1, `rgba(74,196,232,${0.13 - p * 0.02})`);

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 12) {
          const k = x / w;
          const y =
            baseY +
            Math.sin(k * 6.2 + t * speed + l * 0.9) * amp +
            Math.sin(k * 13.5 - t * speed * 1.7 + l) * amp * 0.35;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const k = x / w;
          const y =
            baseY +
            Math.sin(k * 6.2 + t * speed + l * 0.9) * amp +
            Math.sin(k * 13.5 - t * speed * 1.7 + l) * amp * 0.35;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(150,170,255,${0.16 - p * 0.025})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // particles
      for (const pt of particles) {
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.x < 0 || pt.x > 1) pt.vx *= -1;
        if (pt.y < 0 || pt.y > 1) pt.vy *= -1;
        const px = pt.x * w;
        const py = pt.y * h;
        const twinkle = 0.6 + 0.4 * Math.sin(t * 0.001 + pt.x * 12);
        ctx.beginPath();
        ctx.arc(px, py, pt.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,196,255,${pt.a * twinkle})`;
        ctx.fill();
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    if (reduced) draw(0);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="surface-grid absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full bg-primary/20 blur-[140px]" />
      <div className="absolute -right-32 top-24 h-[30rem] w-[30rem] rounded-full bg-violet/20 blur-[150px]" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
