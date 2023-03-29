/* eslint-disable react/jsx-props-no-spreading */
import React, { Suspense } from 'react';

import { useErrorBannerMessage, useFormSubmission } from './hooks';

type ComponentProps = {
  message: string;
};

type ErrorBannerProps = {
  formId?: string;
  Component: React.ComponentType<ComponentProps>;
};

const ErrorBannerInner = ({ formId, Component }: ErrorBannerProps) => {
  const validationAfterSubmit = useFormSubmission(formId);
  const message = useErrorBannerMessage(formId);

  if (!validationAfterSubmit || message === null) {
    return null;
  }

  return <Component message={message} />;
};

const ErrorBanner = (props: ErrorBannerProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBannerInner {...props} />
    </Suspense>
  );
};

export default ErrorBanner;
