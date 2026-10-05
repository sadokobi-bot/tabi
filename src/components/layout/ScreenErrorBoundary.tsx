import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Contains a crash to the screen that threw, so the tab bar and the other tabs keep working.
 * Also catches failed lazy-chunk loads (e.g. flaky connection mid-trip). Reloading is the reliable
 * recovery there, because React caches a rejected lazy import.
 */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ScreenErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div role="alert" className="grid h-full min-h-80 place-items-center p-8">
        <div className="surface max-w-xs rounded-3xl p-6 text-center">
          <p className="font-semibold">משהו השתבש במסך הזה</p>
          <p className="mt-1 text-sm text-muted">ייתכן שהחיבור לאינטרנט נקטע. נסו לטעון מחדש.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-fg active:scale-95"
          >
            טעינה מחדש
          </button>
        </div>
      </div>
    )
  }
}
