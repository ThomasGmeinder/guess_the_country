import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ThreeGlobe from 'three-globe';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import area from '@turf/area';
import type { GeoJSONFeature } from './data/types';

const GLOBE_RADIUS = 100;

function isoToColor(iso: string): string {
  let hash = 0;
  for (let i = 0; i < iso.length; i++) hash = (hash << 5) - hash + iso.charCodeAt(i);
  const h = Math.abs(hash % 360);
  const s = 55 + (Math.abs(hash) % 25);
  const l = 45 + (Math.abs(hash >> 8) % 15);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Inverse of three-globe's polar2Cartesian (lat,lng → xyz). Must match their coordinate system. */
function cartesianToLngLat(p: THREE.Vector3): [number, number] {
  const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || GLOBE_RADIUS;
  const phi = Math.acos(Math.max(-1, Math.min(1, p.y / r)));
  const theta = Math.atan2(p.z, p.x);
  const lat = 90 - (phi * 180) / Math.PI;
  let lng = 90 - (theta * 180) / Math.PI;
  if (theta < -Math.PI / 2) lng -= 360;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return [lng, lat];
}

export interface GlobeProps {
  features: GeoJSONFeature[];
  onCountryClick: (feature: GeoJSONFeature) => void;
}

export default function Globe({ features, onCountryClick }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<GeoJSONFeature[]>([]);
  featuresRef.current = features;

  const handleClick = useCallback(
    (raycaster: THREE.Raycaster, mouse: THREE.Vector2, globe: THREE.Group, pickSphere: THREE.Mesh) => {
      raycaster.setFromCamera(mouse, raycaster.camera!);
      const intersects = raycaster.intersectObject(pickSphere);
      if (intersects.length === 0) return;
      const point = intersects[0].point.clone();
      point.applyMatrix4(globe.matrixWorld.clone().invert());
      const pt = cartesianToLngLat(point) as [number, number];

      const containing: GeoJSONFeature[] = [];
      for (const feature of featuresRef.current) {
        const geom = feature.geometry;
        if (geom.type === 'Polygon') {
          const poly = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: geom.coordinates as unknown as GeoJSON.Position[][] } };
          if (booleanPointInPolygon(pt, poly)) containing.push(feature);
        } else if (geom.type === 'MultiPolygon') {
          for (const ring of geom.coordinates) {
            const poly = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: ring as unknown as GeoJSON.Position[][] } };
            if (booleanPointInPolygon(pt, poly)) {
              containing.push(feature);
              break;
            }
          }
        }
      }
      if (containing.length === 0) return;
      if (containing.length === 1) {
        onCountryClick(containing[0]);
        return;
      }
      const featureCollection = { type: 'FeatureCollection' as const, features: containing.map((f) => ({ type: 'Feature' as const, properties: {}, geometry: f.geometry })) };
      const areas = containing.map((_, i) => area(featureCollection.features[i]));
      let minIdx = 0;
      for (let i = 1; i < areas.length; i++) if (areas[i] < areas[minIdx]) minIdx = i;
      onCountryClick(containing[minIdx]);
    },
    [onCountryClick]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 1000);
    camera.position.z = 350;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 150;
    controls.maxDistance = 500;

    const globe = new ThreeGlobe();
    globe.showGlobe(true);
    globe.showAtmosphere(true);
    globe.atmosphereColor('rgba(100, 150, 200, 0.4)');
    globe.globeImageUrl(null as unknown as string);

    const pickSphereGeom = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const pickSphereMat = new THREE.MeshBasicMaterial({ visible: false });
    const pickSphere = new THREE.Mesh(pickSphereGeom, pickSphereMat);
    globe.add(pickSphere);

    globe
      .polygonsData(features)
      .polygonCapColor(((d: GeoJSONFeature) => isoToColor(d.properties.ISO_A2)) as (obj: object) => string)
      .polygonSideColor(() => 'rgba(0,0,0,0.1)')
      .polygonStrokeColor(() => '#333')
      .polygonAltitude(0.01);

    scene.add(globe);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.6));

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerClick = (e: MouseEvent) => {
      raycaster.camera = camera;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      handleClick(raycaster, mouse, globe as unknown as THREE.Group, pickSphere);
    };
    renderer.domElement.addEventListener('click', onPointerClick);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let frameId: number;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onPointerClick);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [handleClick, features]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
