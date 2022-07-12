import { useEffect, useRef } from 'react';
import { useRecoilValueLoadable } from 'recoil';
import { useFormId } from './hooks';
import { Callback0 } from './types';
import { $values, $formReadyDelay } from './selectors';

function useFormReadyLoadable(formId?: string) {
  formId = useFormId(formId);
  return [
    useRecoilValueLoadable($formReadyDelay(formId)),
    useRecoilValueLoadable($values(formId)),
  ].reduce((acc, { state }) => acc && state === 'hasValue', true);
}

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
