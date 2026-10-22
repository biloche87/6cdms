import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  key?: React.Key;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isDynamicImportError =
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.name === 'ChunkLoadError';

      const handleRetry = () => {
        if (isDynamicImportError) {
          window.location.reload();
        } else {
          this.setState({ hasError: false, error: null });
        }
      };

      return (
        <div className="p-8 my-6 bg-red-950/40 border border-red-800/80 rounded-2xl max-w-xl mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-900/60 border border-red-700 mx-auto flex items-center justify-center text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">
            {isDynamicImportError
              ? 'Mise à jour des modules requise'
              : "Une erreur d'affichage est survenue"}
          </h2>
          <p className="text-xs text-red-200/80">
            {isDynamicImportError
              ? 'Une nouvelle version des composants a été déployée ou le réseau a été interrompu. Cliquez sur "Recharger" pour actualiser les données.'
              : this.state.error?.message || 'Erreur inattendue lors du rendu du composant.'}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isDynamicImportError ? 'Recharger la page' : 'Réessayer'}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
