"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

interface ShaderAnimationProps {
  className?: string;
}

export function ShaderAnimation({ className }: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    camera: THREE.Camera;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    uniforms: {
      time: { value: number };
      resolution: { value: THREE.Vector2 };
    };
    geometry: THREE.PlaneGeometry;
    material: THREE.ShaderMaterial;
    animationId: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      void main(void) {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= resolution.x / resolution.y;

        float t = time * 0.28;
        vec3 base = mix(
          vec3(0.014, 0.02, 0.055),
          vec3(0.07, 0.03, 0.14),
          uv.x * 0.52 + uv.y * 0.28
        );

        vec3 ribbons = vec3(0.0);

        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          float waveA = sin((p.x * 1.3 + p.y * (0.55 + fi * 0.06)) * 5.8 + t * (1.02 + fi * 0.09) + fi * 1.2);
          float waveB = sin((p.x * -0.95 + p.y * (0.82 + fi * 0.05)) * 5.1 - t * (0.84 + fi * 0.06) + fi * 1.7);
          float drift = sin(t * 0.42 + p.x * 1.15 - p.y * 0.9 + fi) * 0.05;
          float curve = waveA * 0.18 + waveB * 0.14 + drift + p.y * 0.22 - (fi - 2.5) * 0.07;
          float ribbon = smoothstep(0.18, 0.0, abs(curve));

          vec3 tint = mix(
            vec3(0.18, 0.32, 0.95),
            vec3(0.96, 0.36, 0.62),
            fract(fi * 0.31 + uv.y * 0.26)
          );

          ribbons += tint * ribbon * (0.12 + fi * 0.04);
        }

        float vignette = smoothstep(1.5, 0.28, length(p * vec2(0.92, 0.84)));
        vec3 color = base + ribbons * vignette;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      time: { value: 1.0 },
      resolution: { value: new THREE.Vector2() },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: true,
      });
    } catch (error) {
      console.warn("Falling back to static shader background:", error);
      geometry.dispose();
      material.dispose();
      return;
    }

    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const onWindowResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const renderScale = reduceMotion ? 0.42 : width < 768 ? 0.58 : 0.72;
      const cappedDpr = Math.min(window.devicePixelRatio || 1, 1.15);

      renderer.setPixelRatio(cappedDpr * renderScale);
      renderer.setSize(width, height, false);
      uniforms.resolution.value.x = renderer.domElement.width;
      uniforms.resolution.value.y = renderer.domElement.height;
    };

    onWindowResize();
    window.addEventListener("resize", onWindowResize, false);

      const animate = () => {
        const animationId = window.requestAnimationFrame(animate);

        if (!document.hidden) {
          uniforms.time.value += reduceMotion ? 0.006 : 0.026;
          renderer.render(scene, camera);
        }

      if (sceneRef.current) {
        sceneRef.current.animationId = animationId;
      }
    };

    sceneRef.current = {
      camera,
      scene,
      renderer,
      uniforms,
      geometry,
      material,
      animationId: 0,
    };

    animate();

    return () => {
      window.removeEventListener("resize", onWindowResize);

      if (sceneRef.current) {
        window.cancelAnimationFrame(sceneRef.current.animationId);

        if (container.contains(sceneRef.current.renderer.domElement)) {
          container.removeChild(sceneRef.current.renderer.domElement);
        }

        sceneRef.current.renderer.dispose();
        sceneRef.current.geometry.dispose();
        sceneRef.current.material.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full overflow-hidden", className)}
      style={{
        background:
          "radial-gradient(circle at 24% 30%, rgba(96, 165, 250, 0.12), transparent 30%), radial-gradient(circle at 74% 22%, rgba(168, 85, 247, 0.14), transparent 32%), linear-gradient(135deg, rgba(8, 12, 22, 0.98), rgba(18, 8, 42, 0.96) 52%, rgba(4, 10, 18, 0.98))",
      }}
    />
  );
}
