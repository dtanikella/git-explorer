interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'Analyzing repository...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div
        className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
        role="status"
        aria-label="Loading"
      ></div>
      <p className="mt-4 text-gray-600" aria-live="polite">
        {message}
      </p>
    </div>
  );
}