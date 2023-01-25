import { renderHook } from '@testing-library/react';
import { useEventCallback } from '../src/internalHooks';

test('useEventCallback', () => {
  const { result, rerender } = renderHook(() =>
    useEventCallback((x: number) => x + 1),
  );
  const ref = result.current;
  rerender();
  // ref is stable even though passed fn is not
  expect(result.current).toBe(ref);
  // pass args and returns result of inner cb
  expect(result.current(2)).toBe(3);
});
