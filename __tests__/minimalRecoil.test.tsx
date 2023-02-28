import React from 'react';
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
  useRecoilCallback,
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

  user.click(screen.getByText('inc'));

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

  user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('2');
  });

  user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('3');
  });
});

test('recoil: selectorFamily', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => 1,
  });
  const selector = selectorFamily({
    key: 'selector',
    get:
      () =>
      ({ get }) =>
        get(atom('x')) * 2,
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
  });

  user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('2');
    expect(screen.getByTestId('computed-state')).toHaveTextContent('4');
  });

  user.click(screen.getByText('inc'));

  await waitFor(() => {
    expect(screen.getByTestId('state')).toHaveTextContent('3');
    expect(screen.getByTestId('computed-state')).toHaveTextContent('6');
  });
});

test('recoil: useRecoilCallback', async () => {
  const atom = atomFamily({
    key: 'atom',
    default: () => 1,
  });
  const selector = selectorFamily({
    key: 'selector',
    get:
      () =>
      ({ get }) =>
        get(atom('x')) * 2,
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

  user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(1, 2);
  });

  user.click(screen.getByText('inc'));
  user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(2, 4);
  });

  user.click(screen.getByText('inc'));
  user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith(3, 6);
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

  user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith({ x: 1, y: 10 }, 6);
    expect(selector1Spy).toHaveBeenCalledTimes(1);
    expect(selector2Spy).toHaveBeenCalledTimes(1);
  });

  user.click(screen.getByText('incy'));
  user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith({ x: 1, y: 11 }, 6);
    expect(selector1Spy).toHaveBeenCalledTimes(2);
    expect(selector2Spy).toHaveBeenCalledTimes(1);
  });

  user.click(screen.getByText('incx'));
  user.click(screen.getByText('cb'));

  await waitFor(() => {
    expect(cb).toHaveBeenLastCalledWith({ x: 2, y: 11 }, 12);
    expect(selector1Spy).toHaveBeenCalledTimes(3);
    expect(selector2Spy).toHaveBeenCalledTimes(2);
  });
});