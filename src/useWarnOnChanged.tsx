import { useRef, useEffect } from 'react';

export default function useWarnOnChanged(name: string, value: any) {
  const original = useRef(value);

  useEffect(() => {
    // TODO use invariant or DEV only
    if (original.current !== value) {
      console.warn(
        `property ${name} should not be changed from ${original.current} to ${value}`,
      );
    }
  }, [value]);
}
