/* eslint-disable react/destructuring-assignment */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Layout } from './Layout';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  // eslint-disable-next-line react/state-in-constructor
  public state: State = {
    hasError: false,
  };

  // eslint-disable-next-line no-unused-vars
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Layout>
          <h1 className='h1-text text-center'>An error occurred</h1>
          <p className='text-center mt-2 text-primary-100 font-medium'>
            ⛔ It could be caused by an ad blocker ⛔
          </p>
        </Layout>
      );
    }

    return this.props.children;
  }
}
