import { useCallback, useEffect, useState } from 'react';
import Globe from './Globe';
import GuessModal from './components/GuessModal';
import type { GeoJSONFeature } from './data/types';
import type { GeoJSONFeatureCollection } from './data/types';
import { buildPointsMap } from './data/scoring';
import { checkGuess } from './gameLogic';

const GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

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
    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((data: GeoJSONFeatureCollection) => {
        const list = data.features.filter(
          (f) => f.properties.ISO_A2 && f.properties.ISO_A2 !== 'AQ'
        );
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

      <Globe features={features} onCountryClick={handleCountryClick} />

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
