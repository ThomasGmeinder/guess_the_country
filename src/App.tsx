import { useCallback, useEffect, useState } from 'react';
import Globe from './Globe';
import GuessModal from './components/GuessModal';
import type { GeoJSONFeature } from './data/types';
import type { GeoJSONFeatureCollection } from './data/types';
import { buildPointsMap } from './data/scoring';
import { checkGuess } from './gameLogic';

const GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

// Mapping for countries that have ISO_A2 = -99 in Natural Earth
const ISO_CODE_MAP: { [key: string]: string } = {
  'France': 'FR',
  'Norway': 'NO',
  'Somaliland': 'SL',
  'Northern Cyprus': 'XC',
  'Siachen Glacier': 'SK',
  'Aksai Chin': 'AK',
  'Arunachal Pradesh': 'AP',
};

export default function App() {
  const [features, setFeatures] = useState<GeoJSONFeature[]>([]);
  const [score, setScore] = useState(0);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<GeoJSONFeature | null>(null);
  const [guessResult, setGuessResult] = useState<'pending' | 'correct' | 'wrong' | null>(null);
  const [pointsMap, setPointsMap] = useState<Map<string, number>>(new Map());
  const [correctSpelling, setCorrectSpelling] = useState<string | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [hadSpellingMistake, setHadSpellingMistake] = useState(false);

  useEffect(() => {
    console.log(`[APP] Fetching from: ${GEOJSON_URL}`);
    fetch(GEOJSON_URL)
      .then((res) => {
        console.log(`[APP] Fetch response status: ${res.status}`);
        return res.json();
      })
      .then((data: GeoJSONFeatureCollection) => {
        console.log(`[APP] Raw GeoJSON has ${data.features.length} features`);
        console.log(`[APP] First feature ISO: ${data.features[0]?.properties.ISO_A2}`);
        
        // Fix countries with -99 ISO codes using the name mapping
        const fixedFeatures = data.features.map(f => {
          if (f.properties.ISO_A2 === '-99') {
            const name = f.properties.ADMIN;
            const correctISO = ISO_CODE_MAP[name];
            if (correctISO) {
              return {
                ...f,
                properties: {
                  ...f.properties,
                  ISO_A2: correctISO,
                }
              };
            }
          }
          return f;
        });
        
        // Check for FR and NO in fixed data
        const frFixed = fixedFeatures.filter(f => f.properties.ISO_A2 === 'FR');
        const noFixed = fixedFeatures.filter(f => f.properties.ISO_A2 === 'NO');
        console.log(`[APP] FR in fixed data: ${frFixed.length}, NO in fixed data: ${noFixed.length}`);
        
        const list = fixedFeatures.filter(
          (f) => f.properties.ISO_A2 && f.properties.ISO_A2 !== 'AQ'
        );
        console.log(`[APP] After filter: ${list.length}`);
        const frCount = list.filter(f => f.properties.ISO_A2 === 'FR').length;
        const noCount = list.filter(f => f.properties.ISO_A2 === 'NO').length;
        console.log(`[APP] FR count after filter: ${frCount}, NO count after filter: ${noCount}`);
        
        setFeatures(list);
        setPointsMap(buildPointsMap(list));
      })
      .catch((err) => console.error('Failed to load countries', err));
  }, []);

  const handleCountryClick = useCallback((feature: GeoJSONFeature) => {
    setSelectedFeature(feature);
    setGuessResult('pending');
    setLastPoints(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedFeature(null);
    setGuessResult(null);
    setLastPoints(null);
    setCorrectSpelling(null);
    setUsedHint(false);
    setHadSpellingMistake(false);
  }, []);

  const handleSubmitGuess = useCallback(
    (guess: string, hintUsed: boolean) => {
      if (!selectedFeature) return;
      const result = checkGuess(guess, selectedFeature);
      if (result.correct) {
        let pts = pointsMap.get(selectedFeature.properties.ISO_A2) ?? 25;
        
        // Half points if spelling mistake or hint was used
        if (result.hadSpellingMistake || hintUsed) {
          pts = Math.ceil(pts / 2);
        }
        
        setScore((s) => s + pts);
        setLastPoints(pts);
        setCorrectSpelling(result.correctSpelling ?? null);
        setUsedHint(hintUsed);
        setHadSpellingMistake(result.hadSpellingMistake);
        setGuessResult('correct');
      } else {
        setGuessResult('wrong');
      }
    },
    [selectedFeature, pointsMap]
  );

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
          color: '#fff',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 18 }}>Score: {score}</span>
        <span style={{ marginLeft: 16, opacity: 0.9 }}>Click a country to guess.</span>
      </div>

      <Globe features={features} onCountryClick={handleCountryClick} selectedFeature={selectedFeature} />

      <GuessModal
        isOpen={selectedFeature !== null}
        onClose={handleCloseModal}
        onSubmit={handleSubmitGuess}
        result={guessResult}
        pointsEarned={lastPoints}
        selectedFeature={selectedFeature}
        correctSpelling={correctSpelling}
        usedHint={usedHint}
        hadSpellingMistake={hadSpellingMistake}
      />
    </>
  );
}
