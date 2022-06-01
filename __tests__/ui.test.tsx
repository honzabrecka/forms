/* eslint-disable react/jsx-props-no-spreading */
import React, { Fragment, useEffect, useState, StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RecoilRoot,
  useForm,
  useField,
  List,
  Validator,
  error,
  success,
} from '../src/index';

const wrapper = ({ children }: any) => (
  <StrictMode>
    <RecoilRoot>{children}</RecoilRoot>
  </StrictMode>
);

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

const notEmptyList: Validator = (value) =>
  value.length ? success() : error('empty list');

test('forms: List', async () => {
  const onSubmit = jest.fn();
  const onSubmitInvalid = jest.fn();
  const App = () => {
    const { Form } = useForm({
      onSubmit,
      onSubmitInvalid,
    });
    return (
      <Form>
        <List
          name="foo"
          initialValue={[{ x: 1 }, { x: 2 }]}
          validator={notEmptyList}
        >
          {({ fields, fieldProps, add, remove, removeAll, replace }) => (
            <>
              {fields.map((field, i) => (
                <Fragment key={field}>
                  <Field {...fieldProps(i, 'x')} label="x" />
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
                onClick={() => replace([{ x: 'foo' }, { x: 'bar' }])}
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
      values: { foo: [{ x: 1 }, { x: 2 }] },
      allValues: { foo: [{ x: 1 }, { x: 2 }] },
      touched: { foo: false },
      initialValues: { foo: [{ x: 1 }, { x: 2 }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('add'));

  await user.type(screen.getAllByLabelText('x')[2], 'John Doe');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['foo'],
      values: { foo: [{ x: 1 }, { x: 2 }, { x: 'John Doe' }] },
      allValues: { foo: [{ x: 1 }, { x: 2 }, { x: 'John Doe' }] },
      touched: { foo: true },
      initialValues: { foo: [{ x: 1 }, { x: 2 }] },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getAllByText('remove')[2]);

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(3);
    expectFormBag(onSubmit.mock.calls[2][0], {
      fieldIds: ['foo'],
      values: { foo: [{ x: 1 }, { x: 2 }] },
      allValues: { foo: [{ x: 1 }, { x: 2 }] },
      touched: { foo: true },
      initialValues: { foo: [{ x: 1 }, { x: 2 }] },
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
      initialValues: { foo: [{ x: 'foo' }, { x: 'bar' }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('clear'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmitInvalid.mock.calls[0][0], {
      fieldIds: ['foo'],
      values: { foo: [] },
      allValues: { foo: [] },
      touched: { foo: true },
      initialValues: { foo: [{ x: 'foo' }, { x: 'bar' }] },
      dirty: true,
      validation: { isValid: false, isValidStrict: false },
    });
  });
});
