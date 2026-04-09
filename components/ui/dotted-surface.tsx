"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

type DottedSurfaceProps = Omit<React.ComponentProps<"div">, "ref">;

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    geometry: THREE.BufferGeometry;
    material: THREE.PointsMaterial;
    points: THREE.Points;
    animationId: number;
    resizeObserver?: ResizeObserver;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const separation = 126;
    const amountX = 34;
    const amountY = 48;
    const count = amountX * amountY;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070b13, 900, 4200);

    const camera = new THREE.PerspectiveCamera(58, 1, 1, 7000);
    camera.position.set(0, 300, 1120);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: true,
      });
    } catch (error) {
      console.warn("Falling back to static dotted surface:", error);
      return;
    }

    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();

    let i = 0;
    for (let ix = 0; ix < amountX; ix++) {
      for (let iy = 0; iy < amountY; iy++) {
        const x = ix * separation - (amountX * separation) / 2;
        const z = iy * separation - (amountY * separation) / 2;

        positions[i * 3] = x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;

        const blend = iy / Math.max(amountY - 1, 1);
        const color = new THREE.Color().setHSL(0.58 + blend * 0.1, 0.58, 0.66 - blend * 0.12);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        i++;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: reduceMotion ? 5 : 6.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.rotation.x = -0.92;
    points.rotation.z = -0.08;
    points.position.y = -40;
    scene.add(points);

    const resize = () => {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      const cappedDpr = Math.min(window.devicePixelRatio || 1, reduceMotion ? 1 : 1.15);
      const renderScale = reduceMotion ? 0.66 : width < 768 ? 0.82 : 0.96;

      renderer.setPixelRatio(cappedDpr * renderScale);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener("resize", resize);

    let phase = 0;
    const animate = () => {
      const animationId = window.requestAnimationFrame(animate);

      if (!document.hidden) {
        const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
        const array = positionAttribute.array as Float32Array;

        let cursor = 0;
        for (let ix = 0; ix < amountX; ix++) {
          for (let iy = 0; iy < amountY; iy++) {
            const index = cursor * 3 + 1;
            array[index] =
              Math.sin(ix * 0.34 + phase) * 48 +
              Math.cos(iy * 0.42 + phase * 1.18) * 42 +
              Math.sin((ix + iy) * 0.16 + phase * 0.62) * 18;
            cursor++;
          }
        }

        positionAttribute.needsUpdate = true;
        points.rotation.y = Math.sin(phase * 0.18) * 0.08;
        renderer.render(scene, camera);
        phase += reduceMotion ? 0.012 : 0.021;
      }

      if (sceneRef.current) {
        sceneRef.current.animationId = animationId;
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            resize();
          })
        : undefined;

    resizeObserver?.observe(container);

    sceneRef.current = {
      scene,
      camera,
      renderer,
      geometry,
      material,
      points,
      animationId: 0,
      resizeObserver,
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);

      if (sceneRef.current) {
        sceneRef.current.resizeObserver?.disconnect();
        window.cancelAnimationFrame(sceneRef.current.animationId);

        sceneRef.current.scene.remove(sceneRef.current.points);
        sceneRef.current.geometry.dispose();
        sceneRef.current.material.dispose();
        sceneRef.current.renderer.dispose();

        if (container.contains(sceneRef.current.renderer.domElement)) {
          container.removeChild(sceneRef.current.renderer.domElement);
        }

        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{
        background:
          "radial-gradient(circle at 50% 32%, rgba(74, 107, 173, 0.18), transparent 28%), linear-gradient(180deg, rgba(8, 11, 18, 0.68), rgba(5, 8, 14, 0.92))",
      }}
      {...props}
    />
  );
}
