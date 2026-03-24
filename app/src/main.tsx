import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

class RootBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean; message: string }> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: String(error) };
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '1rem' }}>App failed to initialize: {this.state.message}</div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </React.StrictMode>,
);
