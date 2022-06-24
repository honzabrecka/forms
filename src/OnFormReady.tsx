import { useEffect, useRef } from 'react';
import { useFormReadyLoadable } from './hooks';
import { Callback0 } from './types';

export type OnFormReadyProps = {
  formId?: string;
  cb: Callback0;
};

const OnFormReady = ({ cb, formId }: OnFormReadyProps) => {
  const ready = useFormReadyLoadable(formId);
  const run = useRef(false);

  useEffect(() => {
    if (ready && !run.current) {
      cb();
      run.current = true;
    }
  }, [ready]);

  return null;
};

export default OnFormReady;
