export interface CountryProperties {
  ADMIN: string;
  NAME_EN?: string;
  ISO_A2: string;
  POP_EST?: number;
}

export interface GeoJSONGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][] | number[][][];
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: CountryProperties;
  geometry: GeoJSONGeometry;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface CountryInfo {
  name: string;
  iso: string;
  points: number;
}
