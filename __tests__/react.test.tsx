import React, { useEffect, StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';

export const strictWrapper = ({ children }: any) => (
  <StrictMode>{children}</StrictMode>
);

test('react: call order in StrictMode', async () => {
  const order = jest.fn();

  const Child = () => {
    useEffect(() => {
      order('Child Effect');
      return () => {
        order('Child Cleanup');
      };
    }, []);
    return null;
  };

  const Parent = () => {
    useEffect(() => {
      order('Parent Effect');
      return () => {
        order('Parent Cleanup');
      };
    }, []);
    return <Child />;
  };

  const { unmount } = render(<Parent />, { wrapper: strictWrapper });
  unmount();

  await waitFor(() => {
    expect(order.mock.calls).toEqual([
      ['Child Effect'],
      ['Parent Effect'],
      ['Child Cleanup'],
      ['Parent Cleanup'],
      ['Child Effect'],
      ['Parent Effect'],
      ['Parent Cleanup'],
      ['Child Cleanup'],
    ]);
  });
});

test('react: call order in non StrictMode', async () => {
  const order = jest.fn();

  const Child = () => {
    useEffect(() => {
      order('Child Effect');
      return () => {
        order('Child Cleanup');
      };
    }, []);
    return null;
  };

  const Parent = () => {
    useEffect(() => {
      order('Parent Effect');
      return () => {
        order('Parent Cleanup');
      };
    }, []);
    return <Child />;
  };

  const { unmount } = render(<Parent />);
  unmount();

  await waitFor(() => {
    expect(order.mock.calls).toEqual([
      ['Child Effect'],
      ['Parent Effect'],
      ['Parent Cleanup'],
      ['Child Cleanup'],
    ]);
  });
});
