
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  speed: number;
  brightness: number;
  color: string;
  sparkle: boolean;
};

const darkColors = [
  "125, 190, 255",
  "75, 220, 235",
  "165, 145, 255",
  "220, 235, 255",
  "95, 155, 255",
];

const lightColors = [
  "45, 105, 195",
  "20, 145, 175",
  "115, 85, 185",
  "75, 115, 165",
];

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    const motionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    let reducedMotion = motionQuery.matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let previousTime = 0;
    let particles: Particle[] = [];

    const pointer = { x: -1000, y: -1000 };

    function isDarkTheme() {
      const rootTheme =
        document.documentElement.dataset.theme;

      return rootTheme === "dark" ||
        (rootTheme !== "light" &&
          document.documentElement.classList.contains("dark"));
    }

    function createParticles() {
      const isMobile = window.innerWidth < 768;

      const count = isMobile
        ? 32
        : Math.min(
            90,
            Math.max(55, Math.floor(window.innerWidth / 17))
          );

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        radius: 0.7 + Math.random() * 1.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.7,
        brightness: 0.4 + Math.random() * 0.6,
        color: "",
        sparkle: Math.random() < 0.18,
      }));
    }

    function resize() {
      if (!canvas || !context) return;

      const previousWidth = width;
      const previousHeight = height;

      width = window.innerWidth;
      height = window.innerHeight;

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!particles.length) {
        createParticles();
      } else {
        const scaleX = previousWidth
          ? width / previousWidth
          : 1;

        const scaleY = previousHeight
          ? height / previousHeight
          : 1;

        particles.forEach((particle) => {
          particle.x *= scaleX;
          particle.y *= scaleY;
        });
      }
    }

    function draw(time: number) {
      if (!context) return;

      context.clearRect(0, 0, width, height);

      const dark = isDarkTheme();
      const colors = dark ? darkColors : lightColors;
      const delta = previousTime
        ? Math.min((time - previousTime) / 16.67, 2)
        : 1;

      previousTime = time;

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];

        if (!reducedMotion) {
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;

          if (particle.x < -12) particle.x = width + 12;
          if (particle.x > width + 12) particle.x = -12;
          if (particle.y < -12) particle.y = height + 12;
          if (particle.y > height + 12) particle.y = -12;

          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy);

          if (distance > 0 && distance < 130) {
            const force = (130 - distance) / 130;

            particle.x +=
              (dx / distance) * force * 0.45 * delta;

            particle.y +=
              (dy / distance) * force * 0.45 * delta;
          }
        }

        const color = colors[i % colors.length];

        const pulse = reducedMotion
          ? 0.75
          : 0.7 +
            0.25 *
              Math.sin(
                time * 0.001 * particle.speed +
                  particle.phase
              );

        const sparkle =
          !reducedMotion && particle.sparkle
            ? Math.pow(
                Math.max(
                  0,
                  Math.sin(
                    time * 0.0023 * particle.speed +
                      particle.phase
                  )
                ),
                12
              )
            : 0;

        const alpha = Math.min(
          1,
          particle.brightness * pulse +
            sparkle * 0.65
        );

        const glowRadius =
          particle.radius * (sparkle > 0.5 ? 11 : 7);

        const gradient = context.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          glowRadius
        );

        gradient.addColorStop(
          0,
          `rgba(${color}, ${0.5 * alpha})`
        );

        gradient.addColorStop(
          0.35,
          `rgba(${color}, ${0.16 * alpha})`
        );

        gradient.addColorStop(
          1,
          `rgba(${color}, 0)`
        );

        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          glowRadius,
          0,
          Math.PI * 2
        );
        context.fillStyle = gradient;
        context.fill();

        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.radius,
          0,
          Math.PI * 2
        );

        context.fillStyle = `rgba(${color}, ${alpha})`;
        context.shadowColor = `rgba(${color}, 0.8)`;
        context.shadowBlur = dark ? 12 : 7;
        context.fill();
        context.shadowBlur = 0;
      }

      if (!reducedMotion) {
        for (let i = 0; i < particles.length; i++) {
          const first = particles[i];

          for (let j = i + 1; j < particles.length; j++) {
            const second = particles[j];

            const distance = Math.hypot(
              first.x - second.x,
              first.y - second.y
            );

            if (distance >= 135) continue;

            const opacity =
              (1 - distance / 135) *
              (dark ? 0.12 : 0.08);

            context.beginPath();
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);
            context.strokeStyle = dark
              ? `rgba(125, 175, 255, ${opacity})`
              : `rgba(55, 105, 170, ${opacity})`;
            context.lineWidth = 0.65;
            context.stroke();
          }
        }
      }

      if (!reducedMotion) {
        frame = window.requestAnimationFrame(draw);
      }
    }

    function restart() {
      window.cancelAnimationFrame(frame);
      previousTime = 0;

      if (reducedMotion) {
        draw(0);
      } else {
        frame = window.requestAnimationFrame(draw);
      }
    }

    function onMotionChange(
      event: MediaQueryListEvent
    ) {
      reducedMotion = event.matches;
      restart();
    }

    function onPointerMove(event: PointerEvent) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }

    function onPointerLeave() {
      pointer.x = -1000;
      pointer.y = -1000;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
      } else {
        restart();
      }
    }

    resize();
    restart();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("blur", onPointerLeave);
    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    motionQuery.addEventListener(
      "change",
      onMotionChange
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener(
        "pointermove",
        onPointerMove
      );
      window.removeEventListener(
        "blur",
        onPointerLeave
      );
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
      motionQuery.removeEventListener(
        "change",
        onMotionChange
      );
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen opacity-70"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    />,
    document.body
  );
}
