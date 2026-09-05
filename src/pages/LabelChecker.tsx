import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeCleanedLabelText, analyzeLabelText } from '../lib/classify';
import { cleanLabelText } from '../lib/ocrCleanup';
import { scanLabelImage } from '../lib/ocrScan';
import type { LabelAnalysis } from '../types';
import { LabelResults } from '../components/IngredientResult';
import { Disclaimer } from '../components/Disclaimer';

const SAMPLE = `Ingredients: Water, Rice Flour, Cheddar Cheese (milk, salt, cultures, enzymes), Butter, Salt, Onion Powder, Garlic Powder, Lactic Acid, Annatto.`;

export function LabelChecker() {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<LabelAnalysis | null>(null);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ocrQuality, setOcrQuality] = useState<'good' | 'fair' | 'poor' | null>(null);
  const [fromOcr, setFromOcr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const skipDebounce = useRef(false);

  const runAnalyze = useCallback(
    (
      value: string,
      opts?: { alreadyCleaned?: boolean; quality?: 'good' | 'fair' | 'poor'; warnings?: string[]; allowEmpty?: boolean },
    ) => {
      setError(null);
      const trimmed = value.trim();
      if (!trimmed) {
        if (!opts?.allowEmpty) setError('Paste an ingredient list or scan a label photo first.');
        setAnalysis(null);
        return;
      }
      const result = opts?.alreadyCleaned
        ? analyzeCleanedLabelText(trimmed, { ocrQuality: opts.quality ?? undefined, warnings: opts.warnings })
        : analyzeLabelText(trimmed);
      setAnalysis(result);
      if (result.warnings?.length) setWarnings(result.warnings);
      if (result.ocrQuality) setOcrQuality(result.ocrQuality);
    },
    [],
  );

  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false;
      return;
    }
    if (!text.trim()) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      runAnalyze(text, {
        alreadyCleaned: fromOcr,
        quality: ocrQuality ?? undefined,
        warnings: warnings.length ? warnings : undefined,
      });
    }, 550);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text, fromOcr, ocrQuality, warnings, runAnalyze]);

  const onOcrFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setAnalysis(null);
    setOcrProgress('Preparing scan…');
    try {
      const scanned = await scanLabelImage(file, setOcrProgress);
      setOcrProgress(null);
      setFromOcr(true);
      setOcrQuality(scanned.quality);
      setWarnings(scanned.warnings);

      if (scanned.rejected) {
        skipDebounce.current = true;
        setText('');
        setAnalysis(null);
        setError(scanned.rejectReason || 'Couldn’t read ingredients clearly.');
        return;
      }

      skipDebounce.current = true;
      setText(scanned.text);
      runAnalyze(scanned.text, {
        alreadyCleaned: true,
        quality: scanned.quality,
        warnings: scanned.warnings,
      });
    } catch (e) {
      console.error(e);
      setOcrProgress(null);
      setError('OCR failed. Photograph just the INGREDIENTS line, or paste the list manually.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Label checker</h1>
        <p>Paste an ingredient list or photograph the INGREDIENTS block (not the whole package).</p>
      </header>

      <div className="card tip-card">
        <strong>For best OCR</strong>
        <ul className="checklist">
          <li>Fill the frame with the line that starts with <em>INGREDIENTS:</em></li>
          <li>Avoid Nutrition Facts, QR codes, barcodes, and glossy glare</li>
          <li>If the scan looks like nonsense, we will ask you to retry or paste text — we will not guess foods</li>
        </ul>
      </div>

      <div className="card">
        <label className="field-label" htmlFor="ingredients">
          Ingredient text {fromOcr ? <span className="label-hint">(editable — fix OCR mistakes here)</span> : null}
        </label>
        <textarea
          id="ingredients"
          className={`input textarea ${ocrQuality === 'poor' ? 'textarea-warn' : ''}`}
          rows={8}
          placeholder="Paste ingredients here, or scan a tight crop of the ingredients line…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFromOcr(true);
          }}
        />

        {ocrQuality && text && (
          <p className={`ocr-quality ocr-${ocrQuality}`}>
            {ocrQuality === 'good' && 'Text quality looks good.'}
            {ocrQuality === 'fair' && 'Text quality is fair — skim for misread words before deciding.'}
            {ocrQuality === 'poor' && 'Text quality is poor — correct it above before trusting results.'}
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} className="warn-line">
            {w}
          </p>
        ))}

        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              skipDebounce.current = true;
              const cleaned = cleanLabelText(text);
              if (cleaned.looksLikeGarbage && !cleaned.text) {
                setOcrQuality('poor');
                setWarnings(cleaned.warnings);
                setError('That text still looks like OCR noise. Paste the real ingredient list.');
                setAnalysis(null);
                return;
              }
              setText(cleaned.text || text);
              setWarnings(cleaned.warnings);
              setOcrQuality(cleaned.quality);
              setFromOcr(true);
              runAnalyze(cleaned.text || text, {
                alreadyCleaned: true,
                quality: cleaned.quality,
                warnings: cleaned.warnings,
              });
            }}
          >
            Check ingredients
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              skipDebounce.current = true;
              setFromOcr(false);
              setText(SAMPLE);
              setWarnings([]);
              setOcrQuality('good');
              setError(null);
              runAnalyze(SAMPLE);
            }}
          >
            Try sample
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              skipDebounce.current = true;
              setText('');
              setAnalysis(null);
              setError(null);
              setWarnings([]);
              setOcrQuality(null);
              setFromOcr(false);
            }}
          >
            Clear
          </button>
        </div>

        <div className="btn-row wrap">
          <button type="button" className="btn secondary" onClick={() => cameraRef.current?.click()}>
            Camera / photo
          </button>
          <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()}>
            Upload image
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
        <p className="muted tiny">
          After a good scan, fix any misread words above — analysis re-runs automatically. Unknowns stay UNKNOWN.
        </p>
      </div>

      {analysis && <LabelResults analysis={analysis} />}
      <Disclaimer compact />
    </div>
  );
}
