import { useState, useEffect } from 'react';
import ResearchForm from './components/ResearchForm';
import ProgressState from './components/ProgressState';
import ReportView from './components/ReportView';
import { startResearch } from './api/research';
import { ResearchResponse } from './types';

type AppState = 'idle' | 'loading' | 'done' | 'error';

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');

  // Advance progress steps while loading
  useEffect(() => {
    if (state !== 'loading') return;
    setStep(0);
    const timings = [2000, 6000, 12000]; // ms to advance to steps 1, 2, 3
    const timers = timings.map((ms, i) =>
      setTimeout(() => setStep(i + 1), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [state]);

  const handleSubmit = async (question: string) => {
    setCurrentQuestion(question);
    setState('loading');
    setError('');
    setResult(null);
    try {
      const data = await startResearch(question);
      setResult(data);
      setState('done');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Something went wrong');
      setError(msg);
      setState('error');
    }
  };

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setError('');
    setCurrentQuestion('');
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-700/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 bg-fuchsia-700/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-700/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12 space-y-10">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-gray-400 font-medium mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Powered by Gemini
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold gradient-text leading-tight">
            AI Research Agent
          </h1>
          <p className="text-gray-400 text-base max-w-lg mx-auto">
            Ask any research question. Get a comprehensive report with cited sources — instantly.
          </p>
        </header>

        {/* Form or Reset */}
        {state !== 'loading' && (
          <section aria-label="Research input">
            <ResearchForm onSubmit={handleSubmit} isLoading={false} />
          </section>
        )}

        {/* Progress */}
        {state === 'loading' && (
          <section aria-label="Research progress">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-400">
                Researching: <span className="text-violet-300 font-medium">{currentQuestion}</span>
              </p>
            </div>
            <ProgressState currentStep={step} />
          </section>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="glass rounded-2xl p-5 border border-red-500/30 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-300">Research Failed</p>
                <p className="text-sm text-gray-400 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Report */}
        {state === 'done' && result && (
          <section aria-label="Research report">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Research Complete</p>
                <p className="text-gray-200 font-medium mt-1">{currentQuestion}</p>
              </div>
              <button
                id="new-research-btn"
                onClick={handleReset}
                className="text-sm px-4 py-2 rounded-xl glass text-gray-300 hover:text-violet-300 hover:border-violet-500/40 transition-all duration-200"
              >
                + New Research
              </button>
            </div>
            <ReportView data={result} />
          </section>
        )}
      </div>
    </div>
  );
}
