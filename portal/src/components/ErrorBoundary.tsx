import { APP_NAME } from './brand'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { translate as t } from '../data/i18n'

/**
 * If a page crashes, show a way out instead of a white screen – and always a way to save the data.
 * Deliberately has no dependencies on the store, so it works even when the data itself is the problem.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Aftryk crashed:', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating to another page clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  downloadBackup = () => {
    try {
      const raw = localStorage.getItem('forme:v1') ?? '{}'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      a.download = `${APP_NAME.toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
    } catch {
      alert(t('The backup could not be created in this browser.'))
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash" role="alert">
        <div className="crash-box">
          <span className="crash-icon" aria-hidden="true">!</span>
          <h1>{t('Something went wrong.')}</h1>
          <p>
            {t('This page hit an error. Your data is still saved in this browser. Try reloading — and if it keeps happening, download a backup and send it to us together with what you were doing.')}
          </p>
          <div className="crash-actions">
            <button className="btn btn-primary" onClick={() => location.reload()}>{t('Reload the page')}</button>
            <a className="btn" href="/app">{t('Go to the overview')}</a>
            <button className="btn btn-ghost" onClick={this.downloadBackup}>{t('Download backup')}</button>
          </div>
          <details>
            <summary>{t('Technical details')}</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    )
  }
}
