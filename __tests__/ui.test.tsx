import React, { Fragment, useEffect, useState } from 'react';
import { RecoilRoot } from 'recoil';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useField, List } from '../src/index';

const wrapper = ({ children }: any) => <RecoilRoot>{children}</RecoilRoot>;

const Field = ({ label, ...props }: any) => {
  const { inited, onChange, onFocus, onBlur, name, id, value } =
    useField(props);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {inited ? (
        <input
          type="text"
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
        />
      ) : null}
    </>
  );
};

const delay = (t: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), t);
  });

const AsyncInput = ({ value, onChange, onBlur, ...props }: any) => {
  const [state, setState] = useState('');

  useEffect(() => {
    setState(value);
  }, [value]);

  return (
    <input
      // eslint-disable-next-line
      {...props}
      value={state}
      onChange={({ target: { value } }) => setState(value)}
      onBlur={() => {
        onChange(delay(250).then(() => state));
        onBlur();
      }}
    />
  );
};

const AsyncField = ({ label, ...props }: any) => {
  const { inited, onChange, onFocus, onBlur, name, id, value } =
    useField(props);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {inited ? (
        <AsyncInput
          type="text"
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
        />
      ) : null}
    </>
  );
};

const identity = (x: any) => x;

const expectFormBag = (bag: any, expected: any) => {
  expect(bag).toHaveProperty('values');
  expect(bag).toHaveProperty('allValues');
  expect(bag).toHaveProperty('touched');
  expect(bag).toHaveProperty('fieldIds');
  expect(bag).toHaveProperty('validation');
  expect(bag).toHaveProperty('initialValues');
  expect(bag).toHaveProperty('dirty');
  expect(bag).toHaveProperty('dirtyFieldIds');
  expect(bag).toMatchObject(expected);
};

test('forms: basic', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const { Form } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <Field name="name" label="Name" />
        <button type="submit">submit</button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Name'), 'John Doe');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      values: { name: 'John Doe' },
      allValues: { name: 'John Doe' },
      touched: { name: true },
      initialValues: {},
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: blur & async & submit', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const { Form } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <AsyncField from={identity} name="name" label="Name" />
        <button type="submit">submit</button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Name'), 'John Doe');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      values: { name: 'John Doe' },
      allValues: { name: 'John Doe' },
      touched: { name: true },
      initialValues: {},
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: List', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const { Form, setValues } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <List name="foo">
          {({ fields, add, remove, removeAll, createRows }) => (
            <>
              {fields.map((field, i) => (
                <Fragment key={field}>
                  <Field name={`${field}.x`} label="x" />
                  <button type="button" onClick={() => remove(i)}>
                    remove
                  </button>
                </Fragment>
              ))}
              <button type="button" onClick={add}>
                add
              </button>
              <button type="button" onClick={removeAll}>
                clear
              </button>
              <button
                type="button"
                onClick={() => {
                  removeAll();
                  setValues(createRows([{ x: 'foo' }, { x: 'bar' }]));
                }}
              >
                fill
              </button>
            </>
          )}
        </List>
        <button type="submit">submit</button>
      </Form>
    );
  };

  render(<App />, {
    wrapper,
  });

  const user = userEvent.setup();

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['foo'],
      values: { foo: [] },
      allValues: { foo: [] },
      touched: { foo: false },
      initialValues: {},
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('add'));

  await user.type(screen.getByLabelText('x'), 'John Doe');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['foo'],
      values: { foo: [{ x: 'John Doe' }] },
      allValues: { foo: [{ x: 'John Doe' }] },
      touched: { foo: true },
      initialValues: {},
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('remove'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(3);
    expectFormBag(onSubmit.mock.calls[2][0], {
      fieldIds: ['foo'],
      values: { foo: [] },
      allValues: { foo: [] },
      touched: { foo: false },
      initialValues: {},
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('fill'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(4);
    expectFormBag(onSubmit.mock.calls[3][0], {
      fieldIds: ['foo'],
      values: { foo: [{ x: 'foo' }, { x: 'bar' }] },
      allValues: { foo: [{ x: 'foo' }, { x: 'bar' }] },
      touched: { foo: false },
      initialValues: {},
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('clear'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(5);
    expectFormBag(onSubmit.mock.calls[4][0], {
      fieldIds: ['foo'],
      values: { foo: [] },
      allValues: { foo: [] },
      touched: { foo: false },
      initialValues: {},
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});
