import AppFooter from "./components/AppFooter"
import AppHeader from "./components/AppHeader"
import ErrorAlert from "./components/ErrorAlert"
import ProcessingPanel from "./components/ProcessingPanel"
import ResultsPanel from "./components/ResultsPanel"
import UploadPanel from "./components/UploadPanel"
import { useImageAnalysis } from "./hooks/useImageAnalysis"
import { useRuntimeConfig } from "./hooks/useRuntimeConfig"

export default function App() {
  const runtime = useRuntimeConfig()
  const analysis = useImageAnalysis(runtime.runtimeConfig)
  const errorMessage = analysis.error ?? runtime.error

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <AppHeader
        backendStatus={runtime.status}
        showReset={analysis.stage === "done"}
        onReset={analysis.reset}
      />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-4 sm:p-8">
        {errorMessage && (
          <ErrorAlert
            message={errorMessage}
            onRetry={runtime.status === "offline" ? runtime.reload : undefined}
            onDismiss={analysis.error ? analysis.clearError : undefined}
          />
        )}

        {analysis.stage === "idle" && (
          <UploadPanel
            runtimeConfig={runtime.runtimeConfig}
            disabled={runtime.status !== "ready"}
            onFileSelected={analysis.analyze}
          />
        )}

        {analysis.stage === "processing" && analysis.imageUrl && (
          <ProcessingPanel
            imageUrl={analysis.imageUrl}
            progress={analysis.progress}
            onCancel={analysis.reset}
          />
        )}

        {analysis.stage === "done" && analysis.imageUrl && (
          <ResultsPanel
            imageUrl={analysis.imageUrl}
            detections={analysis.detections}
            predictionMeta={analysis.predictionMeta}
            onReset={analysis.reset}
          />
        )}
      </main>

      <AppFooter classCount={runtime.runtimeConfig?.classes.length ?? 0} />
    </div>
  )
}
