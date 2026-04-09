"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

class Vector2D {
  constructor(public x: number, public y: number) {}
}

class Vector3D {
  constructor(public x: number, public y: number, public z: number) {}
}

class Star {
  private dx: number;
  private dy: number;
  private spiralLocation: number;
  private strokeWeightFactor: number;
  private z: number;
  private angle: number;
  private distance: number;
  private rotationDirection: number;
  private expansionRate: number;
  private finalScale: number;

  constructor(private cameraZ: number, private cameraTravelDistance: number) {
    this.angle = Math.random() * Math.PI * 2;
    this.distance = 24 * Math.random() + 14;
    this.rotationDirection = Math.random() > 0.5 ? 1 : -1;
    this.expansionRate = 1.12 + Math.random() * 0.6;
    this.finalScale = 0.72 + Math.random() * 0.42;
    this.dx = this.distance * Math.cos(this.angle);
    this.dy = this.distance * Math.sin(this.angle);
    this.spiralLocation = (1 - Math.pow(1 - Math.random(), 3)) / 1.3;
    this.z = Star.random(0.5 * cameraZ, cameraTravelDistance + cameraZ);
    this.z = this.lerp(this.z, cameraTravelDistance / 2, 0.3 * this.spiralLocation);
    this.strokeWeightFactor = Math.pow(Math.random(), 2);
  }

  private static random(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  private lerp(start: number, end: number, t: number) {
    return start * (1 - t) + end * t;
  }

  render(p: number, controller: AnimationController) {
    const spiralPos = controller.spiralPath(this.spiralLocation);
    const q = p - this.spiralLocation;

    if (q <= 0) {
      return;
    }

    const displacementProgress = controller.constrain(4 * q, 0, 1);
    const linearEasing = displacementProgress;
    const elasticEasing = controller.easeOutElastic(displacementProgress);
    const powerEasing = Math.pow(displacementProgress, 2);

    let easing = linearEasing;
    if (displacementProgress < 0.3) {
      easing = controller.lerp(linearEasing, powerEasing, displacementProgress / 0.3);
    } else if (displacementProgress < 0.7) {
      const t = (displacementProgress - 0.3) / 0.4;
      easing = controller.lerp(powerEasing, elasticEasing, t);
    } else {
      easing = elasticEasing;
    }

    let screenX = spiralPos.x;
    let screenY = spiralPos.y;

    if (displacementProgress < 0.3) {
      screenX = controller.lerp(spiralPos.x, spiralPos.x + this.dx * 0.3, easing / 0.3);
      screenY = controller.lerp(spiralPos.y, spiralPos.y + this.dy * 0.3, easing / 0.3);
    } else if (displacementProgress < 0.7) {
      const midProgress = (displacementProgress - 0.3) / 0.4;
      const curveStrength = Math.sin(midProgress * Math.PI) * this.rotationDirection * 1.5;
      const baseX = spiralPos.x + this.dx * 0.3;
      const baseY = spiralPos.y + this.dy * 0.3;
      const targetX = spiralPos.x + this.dx * 0.7;
      const targetY = spiralPos.y + this.dy * 0.7;
      const perpX = -this.dy * 0.4 * curveStrength;
      const perpY = this.dx * 0.4 * curveStrength;

      screenX = controller.lerp(baseX, targetX, midProgress) + perpX * midProgress;
      screenY = controller.lerp(baseY, targetY, midProgress) + perpY * midProgress;
    } else {
      const finalProgress = (displacementProgress - 0.7) / 0.3;
      const baseX = spiralPos.x + this.dx * 0.7;
      const baseY = spiralPos.y + this.dy * 0.7;
      const targetDistance = this.distance * this.expansionRate * 1.4;
      const spiralTurns = 1.05 * this.rotationDirection;
      const spiralAngle = this.angle + spiralTurns * finalProgress * Math.PI;
      const targetX = spiralPos.x + targetDistance * Math.cos(spiralAngle);
      const targetY = spiralPos.y + targetDistance * Math.sin(spiralAngle);
      screenX = controller.lerp(baseX, targetX, finalProgress);
      screenY = controller.lerp(baseY, targetY, finalProgress);
    }

    const vx = (this.z - controller.cameraZ) * screenX / controller.viewZoom;
    const vy = (this.z - controller.cameraZ) * screenY / controller.viewZoom;
    const position = new Vector3D(vx, vy, this.z);

    let sizeMultiplier = 1;
    if (displacementProgress < 0.6) {
      sizeMultiplier = 1 + displacementProgress * 0.18;
    } else {
      const t = (displacementProgress - 0.6) / 0.4;
      sizeMultiplier = 1.18 * (1 - t) + this.finalScale * t;
    }

    const dotSize = 7.4 * this.strokeWeightFactor * sizeMultiplier;
    controller.showProjectedDot(position, dotSize);
  }
}

class AnimationController {
  private timeline: gsap.core.Timeline;
  private stars: Star[] = [];
  public time = 0;
  public readonly changeEventTime = 0.32;
  public readonly cameraZ = -400;
  public readonly cameraTravelDistance = 3200;
  public readonly startDotYOffset = 28;
  public readonly viewZoom = 100;

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private width: number,
    private height: number,
    private particleColor: string,
    private trailLength: number,
    private starCount: number
  ) {
    this.timeline = gsap.timeline({ repeat: -1 });
    this.seedRandomStars();
    this.setupTimeline();
  }

  private seedRandomStars() {
    const originalRandom = Math.random;
    let seed = 1234;
    Math.random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    this.stars = [];
    for (let i = 0; i < this.starCount; i++) {
      this.stars.push(new Star(this.cameraZ, this.cameraTravelDistance));
    }
    Math.random = originalRandom;
  }

  private setupTimeline() {
    this.timeline.to(this, {
      time: 1,
      duration: 15,
      repeat: -1,
      ease: "none",
      onUpdate: () => this.render(),
    });
  }

  public updateDimensions(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.render();
  }

  public ease(p: number, g: number) {
    return p < 0.5 ? 0.5 * Math.pow(2 * p, g) : 1 - 0.5 * Math.pow(2 * (1 - p), g);
  }

  public easeOutElastic(x: number) {
    const c4 = (2 * Math.PI) / 4.5;
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return Math.pow(2, -8 * x) * Math.sin((x * 8 - 0.75) * c4) + 1;
  }

  public map(value: number, start1: number, stop1: number, start2: number, stop2: number) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
  }

  public constrain(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  public lerp(start: number, end: number, t: number) {
    return start * (1 - t) + end * t;
  }

  public spiralPath(p: number) {
    const limited = this.constrain(1.2 * p, 0, 1);
    const eased = this.ease(limited, 1.8);
    const theta = 2 * Math.PI * 6 * Math.sqrt(eased);
    const r = 170 * Math.sqrt(eased);
    return new Vector2D(r * Math.cos(theta), r * Math.sin(theta) + this.startDotYOffset);
  }

  public showProjectedDot(position: Vector3D, sizeFactor: number) {
    const t2 = this.constrain(this.map(this.time, this.changeEventTime, 1, 0, 1), 0, 1);
    const newCameraZ = this.cameraZ + this.ease(Math.pow(t2, 1.2), 1.8) * this.cameraTravelDistance;

    if (position.z <= newCameraZ) {
      return;
    }

    const dotDepthFromCamera = position.z - newCameraZ;
    const x = this.viewZoom * position.x / dotDepthFromCamera;
    const y = this.viewZoom * position.y / dotDepthFromCamera;
    const sw = 400 * sizeFactor / dotDepthFromCamera;

    this.ctx.lineWidth = sw;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 0.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawTrail(t1: number) {
    for (let i = 0; i < this.trailLength; i++) {
      const f = this.map(i, 0, this.trailLength, 1.1, 0.1);
      const sw = (1.2 * (1 - t1) + 2.8 * Math.sin(Math.PI * t1)) * f;
      const pathTime = t1 - 0.00018 * i;
      const position = this.spiralPath(pathTime);

      this.ctx.fillStyle = this.particleColor;
      this.ctx.globalAlpha = 0.08 + f * 0.75;
      this.ctx.beginPath();
      this.ctx.arc(position.x, position.y, sw / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  private drawStartDot() {
    if (this.time <= this.changeEventTime) {
      return;
    }
    const dy = this.cameraZ * this.startDotYOffset / this.viewZoom;
    const position = new Vector3D(0, dy, this.cameraTravelDistance);
    this.showProjectedDot(position, 2.2);
  }

  public render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    const t1 = this.constrain(this.map(this.time, 0, this.changeEventTime + 0.25, 0, 1), 0, 1);
    const t2 = this.constrain(this.map(this.time, this.changeEventTime, 1, 0, 1), 0, 1);
    this.ctx.rotate(-Math.PI * this.ease(t2, 2.7));

    this.drawTrail(t1);
    this.ctx.fillStyle = this.particleColor;
    for (const star of this.stars) {
      star.render(t1, this);
    }
    this.drawStartDot();
    this.ctx.restore();
  }

  public destroy() {
    this.timeline.kill();
  }
}

interface SpiralAnimationProps {
  className?: string;
  particleColor?: string;
  trailLength?: number;
  starCount?: number;
}

export function SpiralAnimation({
  className,
  particleColor = "rgba(191, 145, 255, 0.92)",
  trailLength = 54,
  starCount = 1500,
}: SpiralAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationController | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      if (animationRef.current) {
        animationRef.current.updateDimensions(width, height);
      } else {
        animationRef.current = new AnimationController(
          canvas,
          ctx,
          width,
          height,
          particleColor,
          trailLength,
          starCount
        );
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [particleColor, starCount, trailLength]);

  return (
    <div ref={wrapperRef} className={cn("relative h-full w-full overflow-hidden", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
