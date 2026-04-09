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
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time * 0.05;
        float lineWidth = 0.002;

        vec3 color = vec3(0.0);
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 5; i++) {
            color[j] += lineWidth * float(i * i) /
              abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
          }
        }

        vec3 tuned = vec3(color.r * 0.45, color.g * 0.36, color.b * 0.88);
        gl_FragColor = vec4(tuned, 1.0);
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

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });

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
        uniforms.time.value += reduceMotion ? 0.005 : 0.02;
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
      style={{ background: "#000" }}
    />
  );
}
