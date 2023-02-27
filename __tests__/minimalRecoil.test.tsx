import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { wrapper } from './shared';
import {
  clearStore,
  atomFamily,
  selectorFamily,
  useRecoilState,
  useRecoilValue,
} from '../src/minimalRecoil';

beforeEach(() => {
  clearStore();
});

test('recoil: single atomFamily', async () => {
  const atom = atomFamily({
    key: 'atom/foo',
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
    key: 'atom/foo',
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
    key: 'atom/foo',
    default: () => 1,
  });
  const selector = selectorFamily({
    key: 'selector/foo',
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
