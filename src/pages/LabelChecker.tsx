import { useCallback, useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import { analyzeLabelText } from '../lib/classify';
import type { LabelAnalysis } from '../types';
import { LabelResults } from '../components/IngredientResult';
import { Disclaimer } from '../components/Disclaimer';

const SAMPLE = `Ingredients: Water, Rice Flour, Cheddar Cheese (milk, salt, cultures, enzymes), Butter, Salt, Onion Powder, Garlic Powder, Lactic Acid, Annatto.`;

export function LabelChecker() {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<LabelAnalysis | null>(null);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const runAnalyze = useCallback((value: string) => {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Paste an ingredient list or scan a label photo first.');
      setAnalysis(null);
      return;
    }
    setAnalysis(analyzeLabelText(trimmed));
  }, []);

  const onOcrFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setOcrProgress('Starting OCR…');
    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setOcrProgress(`Reading label… ${Math.round(m.progress * 100)}%`);
          } else if (m.status) {
            setOcrProgress(m.status);
          }
        },
      });
      const result = await worker.recognize(file);
      await worker.terminate();
      const raw = result.data.text || '';
      setText((prev) => (prev ? `${prev}\n${raw}` : raw));
      setOcrProgress(null);
      if (raw.trim()) runAnalyze(raw);
      else setError('OCR did not find readable text. Try better lighting or paste the ingredients.');
    } catch (e) {
      console.error(e);
      setOcrProgress(null);
      setError('OCR failed. You can still paste the ingredient list manually.');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Label checker</h1>
        <p>Paste an ingredient list or photograph a pack label. We classify each item for elimination.</p>
      </header>

      <div className="card">
        <label className="field-label" htmlFor="ingredients">
          Ingredient text
        </label>
        <textarea
          id="ingredients"
          className="input textarea"
          rows={7}
          placeholder="Paste ingredients here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => runAnalyze(text)}>
            Check ingredients
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setText(SAMPLE);
              runAnalyze(SAMPLE);
            }}
          >
            Try sample
          </button>
          <button type="button" className="btn ghost" onClick={() => { setText(''); setAnalysis(null); setError(null); }}>
            Clear
          </button>
        </div>

        <div className="btn-row wrap">
          <button type="button" className="btn secondary" onClick={() => cameraRef.current?.click()}>
            📷 Camera / photo
          </button>
          <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()}>
            🖼️ Upload image
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => onOcrFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onOcrFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {ocrProgress && <p className="status-line">{ocrProgress}</p>}
        {error && <p className="error-line">{error}</p>}
      </div>

      {analysis && <LabelResults analysis={analysis} />}
      <Disclaimer compact />
    </div>
  );
}
