import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { wrapper } from './shared';
import {
  clearStore,
  atomFamily,
  selectorFamily,
  useRecoilState,
  useSetRecoilState,
  useRecoilValue,
  useRecoilValueLoadable,
  useRecoilCallback,
  /* eslint-disable-next-line camelcase */
  useRecoilTransaction_UNSTABLE,
} from '../src/minimalRecoil';

beforeEach(() => {
  clearStore();
});

test('recoil: single atomFamily', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => 1,
  });
  const App = () => {
    const [state, setState] = useRecoilState(atom('x')) as any;
    return (
      <>
        <div data-testid="state">{state}</div>
        <button type="button" onClick={() => setState(2)}>
          inc
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('1');
  });

  await user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('2');
  });
});

test('recoil: single atomFamily', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => 1,
  });
  const App = () => {
    const [state, setState] = useRecoilState(atom('x')) as any;
    return (
      <>
        <div data-testid="state">{state}</div>
        <button
          type="button"
          onClick={() => setState((state: number) => state + 1)}
        >
          inc
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('1');
  });

  await user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('2');
  });

  await user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('3');
  });
});

test('recoil: selectorFamily', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => 1,
  });
  const selectorSpy = jest.fn();
  const selector = selectorFamily({
    key: 'selector',
    get:
      () =>
      ({ get }) => {
        selectorSpy();
        return get(atom('x')) * 2;
      },
  });
  const App = () => {
    const [state, setState] = useRecoilState(atom('x')) as any;
    const computedState = useRecoilValue(selector('x')) as any;
    return (
      <>
        <div data-testid="state">{state}</div>
        <div data-testid="computed-state">{computedState}</div>
        <button type="button" onClick={() => setState((x: number) => x + 1)}>
          inc
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('1');
    expect(screen.getByTestId('computed-state')).toHaveTextContent('2');
    expect(selectorSpy).toHaveBeenCalledTimes(1);
  });

  await user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('2');
    expect(screen.getByTestId('computed-state')).toHaveTextContent('4');
    expect(selectorSpy).toHaveBeenCalledTimes(2);
  });

  await user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('3');
    expect(screen.getByTestId('computed-state')).toHaveTextContent('6');
    expect(selectorSpy).toHaveBeenCalledTimes(3);
  });
});

test('recoil: useRecoilCallback', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => 1,
  });
  const selectorSpy = jest.fn();
  const selector = selectorFamily({
    key: 'selector',
    get:
      () =>
      ({ get }) => {
        selectorSpy();
        return get(atom('x')) * 2;
      },
  });
  const cb = jest.fn();
  const App = () => {
    const setState = useSetRecoilState(atom('x')) as any;
    const recoilCb = useRecoilCallback(
      ({ snapshot }: any) =>
        () => {
          cb(
            snapshot.getLoadable(atom('x')).contents,
            snapshot.getLoadable(selector('x')).contents,
          );
        },
      [],
    );
    return (
      <>
        <button type="button" onClick={() => recoilCb()}>
          cb
        </button>
        <button type="button" onClick={() => setState((x: number) => x + 1)}>
          inc
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(1, 2);
    expect(selectorSpy).toHaveBeenCalledTimes(1);
  });

  await user.click(screen.getByText('inc'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(2, 4);
    expect(selectorSpy).toHaveBeenCalledTimes(2);
  });

  await user.click(screen.getByText('inc'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(3, 6);
    expect(selectorSpy).toHaveBeenCalledTimes(3);
  });
});

test('recoil: reactive computation', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => ({ x: 1, y: 10 }),
  });
  const selector1Spy = jest.fn();
  const selector1 = selectorFamily({
    key: 'selector1',
    get:
      () =>
      ({ get }) => {
        selector1Spy();
        return get(atom('x')).x * 2;
      },
  });
  const selector2Spy = jest.fn();
  const selector2 = selectorFamily({
    key: 'selector2',
    get:
      () =>
      ({ get }) => {
        selector2Spy();
        return get(selector1('x')) * 3;
      },
  });
  const cb = jest.fn();
  const App = () => {
    const setState = useSetRecoilState(atom('x')) as any;
    const recoilCb = useRecoilCallback(
      ({ snapshot }: any) =>
        () => {
          cb(
            snapshot.getLoadable(atom('x')).contents,
            snapshot.getLoadable(selector2('x')).contents,
          );
        },
      [],
    );
    return (
      <>
        <div data-testid="state">{useRecoilValue(selector2('x'))}</div>
        <button type="button" onClick={() => recoilCb()}>
          cb
        </button>
        <button
          type="button"
          onClick={() =>
            setState((state: any) => ({ ...state, x: state.x + 1 }))
          }
        >
          incx
        </button>
        <button
          type="button"
          onClick={() =>
            setState((state: any) => ({ ...state, y: state.y + 1 }))
          }
        >
          incy
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith({ x: 1, y: 10 }, 6);
    expect(screen.getByTestId('state')).toHaveTextContent('6');
    expect(selector1Spy).toHaveBeenCalledTimes(1);
    expect(selector2Spy).toHaveBeenCalledTimes(1);
  });

  await user.click(screen.getByText('incy'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith({ x: 1, y: 11 }, 6);
    expect(screen.getByTestId('state')).toHaveTextContent('6');
    expect(selector1Spy).toHaveBeenCalledTimes(2);
    expect(selector2Spy).toHaveBeenCalledTimes(1);
  });

  await user.click(screen.getByText('incx'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith({ x: 2, y: 11 }, 12);
    expect(screen.getByTestId('state')).toHaveTextContent('12');
    expect(selector1Spy).toHaveBeenCalledTimes(3);
    expect(selector2Spy).toHaveBeenCalledTimes(2);
  });
});

test('recoil: transaction', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => 1,
  });
  const selectorSpy = jest.fn();
  const selector = selectorFamily({
    key: 'selector',
    get:
      () =>
      ({ get }) => {
        selectorSpy();
        return get(atom('x')) * 2;
      },
  });
  const cb = jest.fn();
  const App = () => {
    const compute = useRecoilTransaction_UNSTABLE(
      ({ set }: any) =>
        () => {
          for (let i = 0; i < 1000; i++) set(atom('x'), (x: number) => x + 1);
        },
      [],
    );
    const recoilCb = useRecoilCallback(
      ({ snapshot }: any) =>
        () => {
          compute();
          cb(
            snapshot.getLoadable(atom('x')).contents,
            snapshot.getLoadable(selector('x')).contents,
          );
        },
      [],
    );
    return (
      <button type="button" onClick={() => recoilCb()}>
        cb
      </button>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(1001, 2002);
    expect(selectorSpy).toHaveBeenCalledTimes(1);
  });

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(2001, 4002);
    expect(selectorSpy).toHaveBeenCalledTimes(2);
  });
});

test('recoil (async): reactive computation', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => ({ x: Promise.resolve(1), y: Promise.resolve(2) }),
  });
  const selector1Spy = jest.fn();
  const selector1 = selectorFamily({
    key: 'selector1',
    get:
      () =>
      ({ get }) => {
        selector1Spy();
        return get(atom('x')).x;
      },
  });
  const selector2Spy = jest.fn();
  const selector2 = selectorFamily({
    key: 'selector2',
    get:
      () =>
      ({ get }) => {
        selector2Spy();
        return get(selector1('x')) * 2;
      },
  });
  const cb = jest.fn();
  const App = () => {
    const setState = useSetRecoilState(atom('x')) as any;
    const recoilCb = useRecoilCallback(
      ({ snapshot }: any) =>
        async () => {
          // if (snapshot !== 1) return;
          const xs = await Promise.all([
            snapshot.getPromise(selector1('x')),
            snapshot.getPromise(selector2('x')),
          ]);
          cb(...xs);
        },
      [],
    );
    return (
      <>
        <button type="button" onClick={() => recoilCb()}>
          cb
        </button>
        <button
          type="button"
          onClick={() =>
            setState((state: any) => ({ ...state, x: Promise.resolve(2) }))
          }
        >
          incx
        </button>
        <button
          type="button"
          onClick={() =>
            setState((state: any) => ({ ...state, y: Promise.resolve(11) }))
          }
        >
          incy
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 1, y: 10 }, */ 1, 2);
    // expect(selector1Spy).toHaveBeenCalledTimes(1);
    // expect(selector2Spy).toHaveBeenCalledTimes(3);
  });

  await user.click(screen.getByText('incy'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 1, y: 11 }, */ 1, 2);
    // expect(selector1Spy).toHaveBeenCalledTimes(2);
    // expect(selector2Spy).toHaveBeenCalledTimes(3);
  });

  await user.click(screen.getByText('incx'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 2, y: 11 }, */ 2, 4);
    // expect(selector1Spy).toHaveBeenCalledTimes(3);
    // expect(selector2Spy).toHaveBeenCalledTimes(5);
  });
});

test('recoil (async): reactive computation with changing promise (async keyword)', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => ({ x: Promise.resolve(1), y: Promise.resolve(2) }),
  });
  const selector1Spy = jest.fn();
  const selector1 = selectorFamily({
    key: 'selector1',
    get:
      () =>
      // this async breaks Object.is check because new promise instance is always returned
      async ({ get }) => {
        selector1Spy();
        return get(atom('x')).x;
      },
  });
  const selector2Spy = jest.fn();
  const selector2 = selectorFamily({
    key: 'selector2',
    get:
      () =>
      ({ get }) => {
        selector2Spy();
        return get(selector1('x')) * 2;
      },
  });
  const cb = jest.fn();
  const App = () => {
    const setState = useSetRecoilState(atom('x')) as any;
    const recoilCb = useRecoilCallback(
      ({ snapshot }: any) =>
        async () => {
          // if (snapshot !== 1) return;
          const xs = await Promise.all([
            snapshot.getPromise(selector1('x')),
            snapshot.getPromise(selector2('x')),
          ]);
          cb(...xs);
        },
      [],
    );
    return (
      <>
        <button type="button" onClick={() => recoilCb()}>
          cb
        </button>
        <button
          type="button"
          onClick={() =>
            setState((state: any) => ({ ...state, x: Promise.resolve(2) }))
          }
        >
          incx
        </button>
        <button
          type="button"
          onClick={() =>
            setState((state: any) => ({ ...state, y: Promise.resolve(11) }))
          }
        >
          incy
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 1, y: 10 }, */ 1, 2);
    // expect(selector1Spy).toHaveBeenCalledTimes(1);
    // expect(selector2Spy).toHaveBeenCalledTimes(2);
  });

  await user.click(screen.getByText('incy'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 1, y: 11 }, */ 1, 2);
    // expect(selector1Spy).toHaveBeenCalledTimes(2);
    // expect(selector2Spy).toHaveBeenCalledTimes(5);
  });

  await user.click(screen.getByText('incx'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 2, y: 11 }, */ 2, 4);
    // expect(selector1Spy).toHaveBeenCalledTimes(3);
    // expect(selector2Spy).toHaveBeenCalledTimes(8);
  });
});

test('recoil (async): waitForAll', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => ({ x: Promise.resolve(1), y: Promise.resolve(2) }),
  });
  const selector1Spy = jest.fn();
  const selector1 = selectorFamily({
    key: 'selector1',
    get:
      () =>
      ({ get }) => {
        selector1Spy();
        return get(atom('x')).x;
      },
  });
  const selector2Spy = jest.fn();
  const selector2 = selectorFamily({
    key: 'selector2',
    get:
      () =>
      ({ get }) => {
        selector2Spy();
        return get(selector1('x')) * 2;
      },
  });
  const selector3Spy = jest.fn();
  const selector3 = selectorFamily({
    key: 'selector3',
    get:
      () =>
      ({ get }) => {
        selector3Spy();
        return [get(selector1('x')), get(selector2('x'))];
      },
  });

  const cb = jest.fn();

  const Read = () => {
    const state = useRecoilValue(selector2('x'));
    return <div data-testid="state">{state}</div>;
  };

  const App = () => {
    const setState = useSetRecoilState(atom('x')) as any;
    const recoilCb = useRecoilCallback(
      ({ snapshot }: any) =>
        async () => {
          // if (snapshot !== 1) return;
          const xs = await Promise.all([snapshot.getPromise(selector3('x'))]);
          cb(...xs);
        },
      [],
    );

    return (
      <>
        <Suspense fallback={null}>
          <Read />
        </Suspense>
        <button type="button" onClick={() => recoilCb()}>
          cb
        </button>
        <button
          type="button"
          onClick={() =>
            setState((state: any) => ({ ...state, x: Promise.resolve(2) }))
          }
        >
          incx
        </button>
        <button
          type="button"
          onClick={() =>
            setState((state: any) => ({ ...state, y: Promise.resolve(11) }))
          }
        >
          incy
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 1, y: 10 }, */ [1, 2]);
    expect(screen.getByTestId('state')).toHaveTextContent('2');
    // expect(selector1Spy).toHaveBeenCalledTimes(1);
    // expect(selector2Spy).toHaveBeenCalledTimes(2);
    // expect(selector3Spy).toHaveBeenCalledTimes(1);
  });

  await user.click(screen.getByText('incy'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 1, y: 11 }, */ [1, 2]);
    expect(screen.getByTestId('state')).toHaveTextContent('2');
    // expect(selector1Spy).toHaveBeenCalledTimes(2);
    // expect(selector2Spy).toHaveBeenCalledTimes(2);
    // expect(selector3Spy).toHaveBeenCalledTimes(1);
  });

  await user.click(screen.getByText('incx'));
  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(/* { x: 2, y: 11 }, */ [2, 4]);
    expect(screen.getByTestId('state')).toHaveTextContent('4');
    // expect(selector1Spy).toHaveBeenCalledTimes(3);
    // expect(selector2Spy).toHaveBeenCalledTimes(5);
    // expect(selector3Spy).toHaveBeenCalledTimes(7);
  });
});

const createPromise = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = (value) => {
      console.log('>>> resolve', value);
      res(value);
    };
  });
  return [promise, resolve];
};

test('recoil (async): override pending promise', async () => {
  const [x, resolveX] = createPromise();
  const atom = atomFamily({
    key: 'atom',
    default: () => ({ x }),
  });
  const selector1Spy = jest.fn();
  const selector1 = selectorFamily({
    key: 'selector1',
    get:
      () =>
      ({ get }) => {
        selector1Spy();
        return get(atom('x')).x;
      },
  });
  const selector2Spy = jest.fn();
  const selector2 = selectorFamily({
    key: 'selector2',
    get:
      () =>
      ({ get }) => {
        selector2Spy();
        return get(selector1('x')) * 2;
      },
  });
  const cb = jest.fn();
  const App = () => {
    const setState = useSetRecoilState(atom('x')) as any;
    const { state, contents } = useRecoilValueLoadable(selector2('x')) as any;
    const recoilCb = useRecoilCallback(
      ({ snapshot }: any) =>
        async () => {
          // if (snapshot !== 1) return;
          const xs = await Promise.all([
            snapshot.getPromise(selector1('x')),
            snapshot.getPromise(selector2('x')),
          ]);
          cb(...xs);
        },
      [],
    );
    return (
      <>
        <div data-testid="state">
          {state === 'hasValue' ? contents : 'loading'}
        </div>
        <button type="button" onClick={() => recoilCb()}>
          cb
        </button>
        <button
          type="button"
          onClick={() => {
            console.log('click override');
            setState((state: any) => ({ ...state, x: Promise.resolve(2) }));
          }}
        >
          override
        </button>
        <button
          type="button"
          onClick={() => {
            console.log('click resolve');
            resolveX(5);
          }}
        >
          resolveX
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
  });

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(0);
  });

  await user.click(screen.getByText('override'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith(/* { x: 1, y: 11 }, */ 2, 4);
    // expect(selector1Spy).toHaveBeenCalledTimes(2);
    // expect(selector2Spy).toHaveBeenCalledTimes(3);
  });

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('4');
  });

  await user.click(screen.getByText('resolveX'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(1);
  });

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(/* { x: 2, y: 11 }, */ 2, 4);
    // expect(selector1Spy).toHaveBeenCalledTimes(3);
    // expect(selector2Spy).toHaveBeenCalledTimes(5);
  });

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('4');
  });
});

test('recoil (async): override pending promise 2', async () => {
  const [x, resolveX] = createPromise();
  const [y, resolveY] = createPromise();
  const atom = atomFamily({
    key: 'atom',
    default: () => ({ x }),
  });
  const selector1Spy = jest.fn();
  const selector1 = selectorFamily({
    key: 'selector1',
    get:
      () =>
      ({ get }) => {
        selector1Spy();
        return get(atom('x')).x;
      },
  });
  const selector2Spy = jest.fn();
  const selector2 = selectorFamily({
    key: 'selector2',
    get:
      () =>
      ({ get }) => {
        selector2Spy();
        return get(selector1('x')) * 2;
      },
  });
  const cb = jest.fn();
  const App = () => {
    const setState = useSetRecoilState(atom('x')) as any;
    const { state, contents } = useRecoilValueLoadable(selector2('x')) as any;
    const recoilCb = useRecoilCallback(
      ({ snapshot }: any) =>
        async () => {
          // if (snapshot !== 1) return;
          const xs = await Promise.all([
            snapshot.getPromise(selector1('x')),
            snapshot.getPromise(selector2('x')),
          ]);
          cb(...xs);
        },
      [],
    );
    return (
      <>
        <div data-testid="state">
          {state === 'hasValue' ? contents : 'loading'}
        </div>
        <button type="button" onClick={() => recoilCb()}>
          cb
        </button>
        <button
          type="button"
          onClick={() => {
            console.log('click override');
            setState((state: any) => ({ ...state, x: y }));
          }}
        >
          override
        </button>
        <button
          type="button"
          onClick={() => {
            console.log('click resolve x');
            resolveX(5);
          }}
        >
          resolveX
        </button>
        <button
          type="button"
          onClick={() => {
            console.log('click resolve y');
            resolveY(10);
          }}
        >
          resolveY
        </button>
      </>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
  });

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(0);
  });

  await user.click(screen.getByText('override'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(0);
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
  });

  await user.click(screen.getByText('resolveX'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(0);
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
  });

  await user.click(screen.getByText('resolveY'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith(/* { x: 2, y: 11 }, */ 10, 20);
    expect(screen.getByTestId('state')).toHaveTextContent('20');
  });

  await user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(/* { x: 2, y: 11 }, */ 10, 20);
    // expect(selector1Spy).toHaveBeenCalledTimes(3);
    // expect(selector2Spy).toHaveBeenCalledTimes(5);
  });

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('20');
  });
});
