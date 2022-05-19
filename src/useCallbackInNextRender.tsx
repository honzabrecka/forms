import { useEffect, useState, useCallback } from 'react';
import { VariadicCallback } from './types';

export default function useCallbackInNextRender(cb: VariadicCallback) {
  const [args, rerender] = useState<any[] | undefined>();

  useEffect(() => {
    if (args) {
      cb(...args);
    }
  }, [args]);

  return useCallback((...args: any[]) => {
    rerender(args);
  }, []);
}
