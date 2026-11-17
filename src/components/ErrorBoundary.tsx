import { Component, type ReactNode } from 'react';
import { Alert, Button } from './ui';

interface Props {
  /** Shown in the message, e.g. the tool's name. */
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  attempt: number;
}

/** Keeps one tool's crash from blanking the whole app; "Reset" mounts the tool fresh. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  render() {
    const { error, attempt } = this.state;
    if (!error) return <div key={attempt}>{this.props.children}</div>;
    return (
      <Alert tone="error">
        <p className="font-semibold">{this.props.name} stopped working.</p>
        <p className="mt-1 font-mono">{error.message}</p>
        <p className="mt-2">The other tools are unaffected. Resetting this tool clears its input.</p>
        <Button className="mt-3" onClick={() => this.setState({ error: null, attempt: attempt + 1 })}>
          Reset {this.props.name}
        </Button>
      </Alert>
    );
  }
}
