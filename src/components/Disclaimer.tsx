export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="disclaimer compact">
        Guidance only — not medical advice. Confirm with the{' '}
        <a href="https://www.monashfodmap.com/ibs-central/i-have-ibs/get-the-app/" target="_blank" rel="noreferrer">
          Monash FODMAP app
        </a>
        .
      </p>
    );
  }
  return (
    <aside className="disclaimer card" role="note">
      <strong>Medical disclaimer</strong>
      <p>
        LowFODMAP Guardian is an educational helper for the strict low-FODMAP <em>elimination</em> phase. It is{' '}
        <strong>not medical advice</strong> and does not replace a registered dietitian or your clinician.
      </p>
      <p>
        The <strong>Monash University FODMAP App</strong> is the gold standard for serving sizes and food ratings.
        Always verify uncertain foods there. Tolerances vary; reintroduce foods only with professional guidance.
      </p>
    </aside>
  );
}
