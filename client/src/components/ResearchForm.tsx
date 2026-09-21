import { useState } from 'react';

interface Props {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}

const EXAMPLES = [
  'What are the current techniques used to reduce LLM hallucinations?',
  'How does retrieval-augmented generation improve AI accuracy?',
  'What are the latest advances in multimodal AI models?',
];

export default function ResearchForm({ onSubmit, isLoading }: Props) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length >= 10) onSubmit(question.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="relative">
        <textarea
          id="research-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter your research question…"
          rows={3}
          disabled={isLoading}
          className="w-full resize-none rounded-2xl glass px-5 py-4 text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60 transition-all duration-200 disabled:opacity-50"
        />
        <div className="absolute bottom-3 right-3 text-xs text-gray-600">
          {question.length}/500
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setQuestion(ex)}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-full glass text-gray-400 hover:text-violet-300 hover:border-violet-500/40 transition-all duration-200 disabled:opacity-40"
          >
            {ex.length > 50 ? ex.slice(0, 50) + '…' : ex}
          </button>
        ))}
      </div>

      <button
        id="start-research-btn"
        type="submit"
        disabled={isLoading || question.trim().length < 10}
        className="w-full py-3.5 rounded-2xl font-semibold text-base bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-violet-900/30"
      >
        {isLoading ? 'Researching…' : 'Start Research'}
      </button>
    </form>
  );
}
