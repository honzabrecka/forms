import { renderHook } from '@testing-library/react';
import { useEventCallback } from '../src/internalHooks';

test('useEventCallback', () => {
  const { result, rerender } = renderHook(
    ({ y }) => useEventCallback((x: number) => y + x + 1),
    { initialProps: { y: 0 } },
  );
  const ref = result.current;
  rerender({ y: 10 });
  // ref is stable even though passed fn is not
  expect(result.current).toBe(ref);
  // pass args and returns result of inner cb
  // and inner cb uses latest props (is not stale)
  expect(result.current(2)).toBe(13);
});
