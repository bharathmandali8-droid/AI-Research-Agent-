const STEPS = [
  { label: 'Generating sub-questions', icon: '🧠' },
  { label: 'Searching the web', icon: '🔍' },
  { label: 'Analyzing sources', icon: '📑' },
  { label: 'Writing report', icon: '✍️' },
];

interface Props {
  currentStep: number; // 0-3
}

export default function ProgressState({ currentStep }: Props) {
  return (
    <div className="w-full glass rounded-2xl p-6 space-y-4">
      <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">
        Research in progress…
      </p>
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div
              key={step.label}
              className={`flex items-center gap-3 transition-all duration-300 ${
                done ? 'opacity-60' : active ? 'opacity-100' : 'opacity-25'
              }`}
            >
              <span className="text-xl">{step.icon}</span>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-sm font-medium ${active ? 'text-violet-300' : 'text-gray-300'}`}>
                    {step.label}
                  </span>
                  {done && <span className="text-green-400 text-xs">✓ Done</span>}
                  {active && (
                    <span className="text-xs text-violet-400 animate-pulse">Running…</span>
                  )}
                </div>
                {active && (
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-[progress_2s_ease-in-out_infinite]" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
