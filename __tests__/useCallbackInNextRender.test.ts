import { useState, useCallback, StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useCallbackInNextRender } from '../src/internalHooks';

describe('useCallbackInNextRender', () => {
  test('returned function executed with args', () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useCallbackInNextRender(cb), {
      wrapper: StrictMode,
    });
    expect(typeof result.current).toBe('function');
    act(() => {
      result.current('foo', 'bar');
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]).toEqual(['foo', 'bar']);
  });

  test('state is up to date in callback', () => {
    const delayedInnerCb = jest.fn();
    const staleInnerCb = jest.fn();
    const { result } = renderHook(
      () => {
        const [state, setState] = useState('foo');
        const stale = useCallback(() => staleInnerCb(state), [state]);
        const delayed = useCallbackInNextRender(() => delayedInnerCb(state));
        return { state, setState, delayed, stale };
      },
      {
        wrapper: StrictMode,
      },
    );
    expect(result.current.state).toEqual('foo');
    act(() => {
      // setting state...
      result.current.setState('bar');
      // ...and reading it "right away"
      result.current.stale();
      result.current.delayed();
    });

    // while staleInnerCb has been called with stale state...
    expect(result.current.state).toEqual('bar');
    expect(staleInnerCb).toHaveBeenCalledTimes(1);
    expect(staleInnerCb.mock.calls[0][0]).toEqual('foo');

    // ...delayedInnerCb has been called with fresh state
    expect(delayedInnerCb).toHaveBeenCalledTimes(1);
    expect(delayedInnerCb.mock.calls[0][0]).toEqual('bar');
  });
});
