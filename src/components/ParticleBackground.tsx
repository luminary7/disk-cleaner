import { useRef, useEffect } from 'react';
import gsap from 'gsap';

type Phase = 'idle' | 'scanning' | 'scan-done' | 'cleaning' | 'clean-done' | 'error';

interface Props {
  phase: Phase;
}

// ---- 粒子接口 ----
interface Particle {
  x: number;
  y: number;
  size: number;
  baseSize: number;
  alpha: number;
  baseAlpha: number;
  glowIntensity: number;
  baseVx: number;
  baseVy: number;
}

// ---- 阶段配置 ----
interface PhaseConfig {
  speed: number;
  vxMul: number;
  vyBias: number;
  mouseRadius: number;
  mouseForce: number;
  scanline?: boolean;
  scanSpeed?: number;
  glowDecay?: number;
  spreadOut?: number;
  rebirth?: boolean;
  rebirthRate?: number;
  maxAlpha?: number;
  fadeOut?: number;
  shake?: number;
  burst?: boolean;
}

const CFG: Record<Phase, PhaseConfig> = {
  idle: {
    speed: 0.3,
    vxMul: 0.6, vyBias: 0,
    mouseRadius: 150, mouseForce: 0.5,
  },
  scanning: {
    speed: 0.6,
    vxMul: 0.8, vyBias: -0.05,
    mouseRadius: 180, mouseForce: 1.0,
    scanline: true,
    scanSpeed: 0.4,
    glowDecay: 0.97,
  },
  'scan-done': {
    speed: 0.35,
    vxMul: 0.15, vyBias: 0,
    mouseRadius: 130, mouseForce: 0.4,
    spreadOut: 0.003,
    rebirth: true,
    rebirthRate: 0.0006,
    maxAlpha: 0.55,
  },
  cleaning: {
    speed: 1.2,
    vxMul: 0.5, vyBias: 1.2,
    mouseRadius: 180, mouseForce: 1.5,
    fadeOut: 0.005,
  },
  'clean-done': {
    speed: 0.3,
    vxMul: 2, vyBias: -0.5,
    mouseRadius: 250, mouseForce: 3,
    burst: true,
  },
  error: {
    speed: 2.5,
    vxMul: 3, vyBias: 0,
    mouseRadius: 100, mouseForce: 4,
    shake: 2,
  },
};

const PARTICLE_COUNT = 55;
const CONNECT_DIST = 130;

function createParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 3 + 1.5,
    baseSize: Math.random() * 3 + 1.5,
    alpha: Math.random() * 0.4 + 0.25,
    baseAlpha: Math.random() * 0.4 + 0.25,
    glowIntensity: 0,
    baseVx: (Math.random() - 0.5) * 0.4,
    baseVy: (Math.random() - 0.5) * 0.4 - 0.1,
  };
}

function rebornParticle(p: Particle, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * 40;
  p.x = cx + Math.cos(angle) * dist;
  p.y = cy + Math.sin(angle) * dist;
  p.alpha = 0;
  p.glowIntensity = 0.4;
  p.size = 1;
  p.baseVx = Math.cos(angle) * (Math.random() * 0.4 + 0.2);
  p.baseVy = Math.sin(angle) * (Math.random() * 0.4 + 0.2);
}

export default function ParticleBackground({ phase }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>(phase);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const scanLineYRef = useRef(0);
  const centerPulseRef = useRef(0);
  // 同步 phase 到 ref，并在 phase 切换时触发特效
  useEffect(() => {
    const prev = phaseRef.current;
    phaseRef.current = phase;

    // scanning 进入时重置扫描线
    if (phase === 'scanning') {
      scanLineYRef.current = sizeRef.current.h + 20;
    }

    // clean-done 绽放特效
    if (phase === 'clean-done' && prev !== phase) {
      const cx = sizeRef.current.w / 2;
      const cy = sizeRef.current.h / 2;
      particlesRef.current.forEach((p) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 300 + 100;
        gsap.to(p, {
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          duration: 1.2,
          ease: 'power2.out',
          overwrite: 'auto',
        });
        gsap.to(p, {
          size: p.baseSize * 4,
          duration: 0.6,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          overwrite: 'auto',
        });
      });
    }
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ---- 尺寸 + DPR ----
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      sizeRef.current = { w, h };
    };
    resize();
    window.addEventListener('resize', resize);

    // ---- 初始化粒子 ----
    const { w, h } = sizeRef.current;
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(w, h));

    // ---- 鼠标事件 ----
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    // ---- 动画循环 ----
    function tick(_time: number, deltaTime: number) {
      const dt = Math.min(deltaTime / 16, 3);
      const cfg = CFG[phaseRef.current];
      const { w: W, h: H } = sizeRef.current;
      const cx = W / 2;
      const cy = H / 2;
      const { x: mx, y: my } = mouseRef.current;
      const particles = particlesRef.current;

      // 更新粒子
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let vx = p.baseVx * cfg.vxMul;
        let vy = p.baseVy * cfg.vxMul + cfg.vyBias;

        if (cfg.spreadOut) {
          vx += (p.x - cx) * cfg.spreadOut;
          vy += (p.y - cy) * cfg.spreadOut;
        }

        if (cfg.fadeOut) {
          p.alpha = Math.max(0, p.alpha - cfg.fadeOut * dt);
          if (p.alpha <= 0) {
            p.x = Math.random() * W;
            p.y = -10;
            p.alpha = p.baseAlpha;
          }
        } else {
          p.alpha += (p.baseAlpha - p.alpha) * 0.02 * dt;
        }

        if (cfg.shake) {
          vx += (Math.random() - 0.5) * cfg.shake;
          vy += (Math.random() - 0.5) * cfg.shake;
        }

        // 鼠标交互
        const mdx = p.x - mx;
        const mdy = p.y - my;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < cfg.mouseRadius && mdist > 0) {
          const force = (1 - mdist / cfg.mouseRadius) * cfg.mouseForce;
          vx += (mdx / mdist) * force;
          vy += (mdy / mdist) * force;
        }

        p.x += vx * dt * cfg.speed;
        p.y += vy * dt * cfg.speed;

        // 边界环绕
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;
      }

      // ---- 扫描线 (scanning) ----
      if (cfg.scanline && cfg.scanSpeed && cfg.glowDecay) {
        scanLineYRef.current -= cfg.scanSpeed * dt;
        if (scanLineYRef.current < -20) {
          scanLineYRef.current = H + 20;
        }

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const distToLine = Math.abs(p.y - scanLineYRef.current);
          if (distToLine < 40) {
            const intensity = 1 - distToLine / 40;
            p.glowIntensity = Math.min(1, p.glowIntensity + intensity * 0.3);
            p.alpha = Math.min(1, p.baseAlpha + intensity * 0.6);
            p.x += (Math.random() - 0.5) * 0.3 * intensity;
            p.y += (Math.random() - 0.5) * 0.3 * intensity;
          }
          p.glowIntensity *= cfg.glowDecay;
          p.alpha = Math.min(1, p.baseAlpha + p.glowIntensity * 0.7);
        }
      }

      // ---- 重生 (scan-done) ----
      if (cfg.rebirth && cfg.rebirthRate && cfg.maxAlpha) {
        const threshold = Math.max(W, H) * 0.5;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > threshold && Math.random() < cfg.rebirthRate * dt) {
            rebornParticle(p, W, H);
          }
          if (p.alpha < cfg.maxAlpha) {
            p.alpha = Math.min(cfg.maxAlpha, p.alpha + 0.02 * dt);
          }
          if (p.size < p.baseSize) {
            p.size = Math.min(p.baseSize, p.size + 0.05 * dt);
          }
          p.glowIntensity *= 0.98;
        }
        centerPulseRef.current += 0.03 * dt;
      } else {
        centerPulseRef.current = 0;
      }

      // ---- 绘制 ----
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);

      // scan-done 中心呼吸光晕
      if (cfg.rebirth && centerPulseRef.current > 0) {
        const pulse = Math.sin(centerPulseRef.current * 2) * 0.15 + 0.3;
        const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 120);
        grad.addColorStop(0, `rgba(22, 119, 255, ${pulse * 0.3})`);
        grad.addColorStop(1, 'rgba(22, 119, 255, 0)');
        ctx!.beginPath();
        ctx!.arc(cx, cy, 120, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();
      }

      // 粒子间连线
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const glowAvg = (a.glowIntensity + b.glowIntensity) / 2;
            const lineAlpha = (1 - dist / CONNECT_DIST) * (0.2 + glowAvg * 0.5);
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.strokeStyle = `rgba(22, 119, 255, ${lineAlpha})`;
            ctx!.lineWidth = 0.6 + glowAvg * 1.5;
            ctx!.stroke();
          }
        }
      }

      // 粒子
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const alpha = Math.min(1, Math.max(0, p.alpha));
        const radius = p.size + p.glowIntensity * 3;

        // 发光光晕
        if (p.glowIntensity > 0.05) {
          const grad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4);
          grad.addColorStop(0, `rgba(22, 119, 255, ${p.glowIntensity * 0.3})`);
          grad.addColorStop(1, 'rgba(22, 119, 255, 0)');
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, radius * 4, 0, Math.PI * 2);
          ctx!.fillStyle = grad;
          ctx!.fill();
        }

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(22, 119, 255, ${alpha})`;
        ctx!.fill();

        if (p.glowIntensity > 0.1) {
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, radius * 0.5, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(255, 255, 255, ${p.glowIntensity * 0.6})`;
          ctx!.fill();
        }
      }

      // 扫描线绘制
      if (cfg.scanline) {
        const slY = scanLineYRef.current;
        const grad = ctx!.createLinearGradient(0, slY - 30, 0, slY + 30);
        grad.addColorStop(0, 'rgba(22, 119, 255, 0)');
        grad.addColorStop(0.5, `rgba(22, 119, 255, 0.15)`);
        grad.addColorStop(1, 'rgba(22, 119, 255, 0)');
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, slY - 30, W, 60);

        ctx!.beginPath();
        ctx!.moveTo(0, slY);
        ctx!.lineTo(W, slY);
        ctx!.strokeStyle = 'rgba(22, 119, 255, 0.25)';
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }
    }

    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
