import { useCallback, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ThreeGlobe from 'three-globe';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import area from '@turf/area';
import type { GeoJSONFeature } from './data/types';

const GLOBE_RADIUS = 100;

function isoToColor(iso: string): string {
  // FNV-1a hash algorithm for better distribution
  let hash = 2166136261;
  for (let i = 0; i < iso.length; i++) {
    hash ^= iso.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // Use unsigned 32-bit
  }
  
  // Distribute hash bits across HSL components
  const h = hash % 360;
  const s = 40 + ((hash >> 8) % 50);
  const l = 45 + ((hash >> 16) % 20);
  
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
  selectedFeature?: GeoJSONFeature | null;
}

export default function Globe({ features, onCountryClick, selectedFeature }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<GeoJSONFeature[]>([]);
  const globeRef = useRef<ThreeGlobe | null>(null);
  const selectedIsoRef = useRef<string | null>(null);
  
  // Keep selected ISO in a ref for access in callbacks
  useEffect(() => {
    selectedIsoRef.current = selectedFeature ? selectedFeature.properties.ISO_A2 : null;
    // Update highlight/elevation if globe is already created
    if (globeRef.current) {
      globeRef.current
        .polygonStrokeColor((d: any) => {
          const featureIso = d.properties?.ISO_A2;
          const selectedIso = selectedIsoRef.current;
          return selectedIso && featureIso === selectedIso ? '#ff0000' : '#333';
        })
        .polygonAltitude((d: any) => {
          const featureIso = d.properties?.ISO_A2;
          const selectedIso = selectedIsoRef.current;
          return selectedIso && featureIso === selectedIso ? 0.05 : 0.01;
        });
    }
  }, [selectedFeature]);
  
  // Filter out -99 (invalid/water polygons) to prevent them from being selected
  const validFeatures = useMemo(() => features.filter(f => f.properties.ISO_A2 !== '-99'), [features]);
  featuresRef.current = validFeatures;

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
        let isContained = false;
        
        if (geom.type === 'Polygon') {
          const poly = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: geom.coordinates as unknown as GeoJSON.Position[][] } };
          isContained = booleanPointInPolygon(pt, poly);
        } else if (geom.type === 'MultiPolygon') {
          for (const ring of geom.coordinates) {
            const poly = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: ring as unknown as GeoJSON.Position[][] } };
            if (booleanPointInPolygon(pt, poly)) {
              isContained = true;
              break;
            }
          }
        }
        
        if (isContained) {
          containing.push(feature);
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

    console.log(`[GLOBE] validFeatures.length: ${validFeatures.length}`);
    console.log(`[GLOBE] Sample: FR=${validFeatures.find(f => f.properties.ISO_A2 === 'FR') ? 'found' : 'MISSING'}, NO=${validFeatures.find(f => f.properties.ISO_A2 === 'NO') ? 'found' : 'MISSING'}`);
    
    // Log first few countries to verify data
    const firstFew = validFeatures.slice(0, 5).map(f => f.properties.ISO_A2).join(', ');
    console.log(`[GLOBE] First few countries: ${firstFew}`);
    
    globe
      .polygonsData(validFeatures)
      .polygonCapColor(((d: GeoJSONFeature) => {
        const iso = d.properties.ISO_A2;
        const color = isoToColor(iso);
        if (iso === 'FR' || iso === 'NO' || iso === 'US' || iso === 'CA') {
          console.log(`[COLOR] ${iso}: ${color}`);
        }
        return color;
      }) as (obj: object) => string)
      .polygonSideColor(() => 'rgba(0,0,0,0.1)')
      .polygonStrokeColor((d: any) => {
        const featureIso = d.properties?.ISO_A2;
        const selectedIso = selectedIsoRef.current;
        return selectedIso && featureIso === selectedIso ? '#ff0000' : '#333';
      })
      .polygonAltitude((d: any) => {
        const featureIso = d.properties?.ISO_A2;
        const selectedIso = selectedIsoRef.current;
        return selectedIso && featureIso === selectedIso ? 0.05 : 0.01;
      });

    globeRef.current = globe;

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
  }, [handleClick, validFeatures]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
