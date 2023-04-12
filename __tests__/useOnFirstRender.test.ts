import { renderHook } from '@testing-library/react';
import { useOnFirstRender } from '../src/internalHooks';
import { wrapper } from './shared';

test('useOnFirstRender', () => {
  const cb = jest.fn();
  const { rerender } = renderHook(() => useOnFirstRender(cb));
  expect(cb).toHaveBeenCalledTimes(1);
  rerender();
  expect(cb).toHaveBeenCalledTimes(1);
});

test('useOnFirstRender (StrictMode)', () => {
  const cb = jest.fn();
  const { rerender } = renderHook(() => useOnFirstRender(cb), { wrapper });
  expect(cb).toHaveBeenCalledTimes(2);
  rerender();
  expect(cb).toHaveBeenCalledTimes(2);
});
