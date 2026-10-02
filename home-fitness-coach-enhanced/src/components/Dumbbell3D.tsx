import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * A genuine, real-time-rendered 3D dumbbell — built entirely from
 * procedural geometry (no external model/texture files, so it ships at
 * near-zero size and works fully offline). Uses actual WebGL depth,
 * lighting and perspective via three.js rather than a flat icon or CSS
 * approximation. Auto-rotates slowly; respects prefers-reduced-motion and
 * cleans up its GL context on unmount so mounting many of these (library
 * cards, onboarding, hero banners) never leaks memory.
 */
export default function Dumbbell3D({
  size = 96,
  accent = "#00e5a0",
  className = "",
}: {
  size?: number;
  accent?: string;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.35, 5.2);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // WebGL unavailable — the caller's fallback icon/markup stays visible.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    // ---- Lighting: a soft key + rim light for a premium metallic look ----
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 1.4);
    rim.position.set(-4, -1, -3);
    scene.add(rim);

    // ---- Procedural dumbbell: bar + two hex-plate stacks ----
    const group = new THREE.Group();
    const barMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.85, roughness: 0.25 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x14171c, metalness: 0.4, roughness: 0.45 });
    const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), metalness: 0.3, roughness: 0.35, emissive: new THREE.Color(accent), emissiveIntensity: 0.25 });

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 24), barMat);
    bar.rotation.z = Math.PI / 2;
    group.add(bar);

    const gripAccent = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.3, 24), accentMat);
    gripAccent.rotation.z = Math.PI / 2;
    group.add(gripAccent);

    [-1, 1].forEach((side) => {
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.34, 6), plateMat);
      outer.rotation.z = Math.PI / 2;
      outer.position.x = side * 1.28;
      group.add(outer);

      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.4, 24), plateMat);
      inner.rotation.z = Math.PI / 2;
      inner.position.x = side * 0.95;
      group.add(inner);
    });

    group.rotation.x = 0.15;
    scene.add(group);

    let raf = 0;
    let angle = 0;
    const animate = () => {
      if (!reduceMotion) {
        angle += 0.012;
        group.rotation.y = angle;
        group.position.y = Math.sin(angle * 1.3) * 0.06;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [size, accent]);

  return <div ref={mountRef} className={className} style={{ width: size, height: size, lineHeight: 0 }} aria-hidden="true" />;
}
