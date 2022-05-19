import React, { useEffect, Suspense } from 'react';
import { useFormReady } from './hooks';
import { Callback0 } from './types';

export type OnFormReadyProps = {
  formId: string;
  cb: Callback0;
};

const OnFormReadyInner = ({ cb, formId }: OnFormReadyProps) => {
  useFormReady(formId);

  useEffect(() => {
    cb();
  }, []);

  return null;
};

const OnFormReady = ({ cb, formId }: OnFormReadyProps) => (
  <Suspense fallback={null}>
    <OnFormReadyInner cb={cb} formId={formId} />
  </Suspense>
);

export default OnFormReady;
