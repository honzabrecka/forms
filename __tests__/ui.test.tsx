/* eslint-disable react/jsx-props-no-spreading */
import React, { Fragment, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  wrapper,
  expectFormBag,
  Field,
  LazyField,
  AsyncField,
  identity,
} from './shared';
import {
  useForm,
  useHasValue,
  List,
  Validator,
  error,
  success,
  OnFormReady,
} from '../src/index';

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
      touched: true,
      touchedFieldIds: ['name'],
      initialValues: {},
      dirty: true,
      dirtyFieldIds: ['name'],
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
      touched: true,
      touchedFieldIds: ['name'],
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
          name="users"
          initialValue={[{ name: 1 }, { name: 2 }]}
          validator={notEmptyList}
        >
          {({ fields, add, remove, removeAll, replace }) => (
            <>
              {fields.map(([id, field]) => (
                <Fragment key={id}>
                  <Field label="Name" {...field('name')} />
                  <button type="button" onClick={() => remove(id)}>
                    remove
                  </button>
                </Fragment>
              ))}
              <button type="button" onClick={() => add({ name: 'John Doe' })}>
                add
              </button>
              <button type="button" onClick={removeAll}>
                clear
              </button>
              <button
                type="button"
                onClick={() => replace([{ name: 'users' }, { name: 'bar' }])}
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
      fieldIds: ['users'],
      values: { users: [{ name: 1 }, { name: 2 }] },
      touched: false,
      touchedFieldIds: [],
      initialValues: { users: [{ name: 1 }, { name: 2 }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('add'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 1 }, { name: 2 }, { name: 'John Doe' }] },
      touched: true,
      touchedFieldIds: ['users'],
      initialValues: { users: [{ name: 1 }, { name: 2 }] },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getAllByText('remove')[2]);

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(3);
    expectFormBag(onSubmit.mock.calls[2][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 1 }, { name: 2 }] },
      touched: true,
      touchedFieldIds: ['users'],
      initialValues: { users: [{ name: 1 }, { name: 2 }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('fill'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(4);
    expectFormBag(onSubmit.mock.calls[3][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 'users' }, { name: 'bar' }] },
      touched: false,
      touchedFieldIds: [],
      initialValues: { users: [{ name: 'users' }, { name: 'bar' }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('clear'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmitInvalid.mock.calls[0][0], {
      fieldIds: ['users'],
      values: { users: [] },
      touched: true,
      touchedFieldIds: ['users'],
      initialValues: { users: [{ name: 'users' }, { name: 'bar' }] },
      dirty: true,
      validation: { isValid: false, isValidStrict: false },
    });
  });
});

test('forms: List initialValue', async () => {
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
          name="users"
          initialValue={[{ name: 1 }, { name: 2 }]}
          validator={notEmptyList}
        >
          {({ fields, add, remove }) => (
            <>
              {fields.map(([id, field]) => (
                <Fragment key={id}>
                  <Field label="Name" {...field('name')} />
                  <button type="button" onClick={() => remove(id)}>
                    remove
                  </button>
                </Fragment>
              ))}
              <button type="button" onClick={() => add()}>
                add
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
      fieldIds: ['users'],
      values: { users: [{ name: 1 }, { name: 2 }] },
      touched: false,
      touchedFieldIds: [],
      initialValues: { users: [{ name: 1 }, { name: 2 }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getAllByText('remove')[0]);
  await user.click(screen.getAllByText('remove')[0]);

  await user.click(screen.getByText('add'));
  await user.click(screen.getByText('add'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['users'],
      values: { users: [{ name: undefined }, { name: undefined }] },
      touched: true,
      touchedFieldIds: ['users'],
      initialValues: { users: [{ name: 1 }, { name: 2 }] },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: field state is preserved in between mounts', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const [key, setKey] = useState(1);
    const { Form } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <Field name="name" label="Name" key={key} />
        <button type="submit">submit</button>
        <button type="button" onClick={() => setKey((k) => k + 1)}>
          change key
        </button>
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
      touched: true,
      touchedFieldIds: ['name'],
      initialValues: {},
      values: { name: 'John Doe' },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('change key'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['name'],
      touched: true,
      touchedFieldIds: ['name'],
      initialValues: {},
      values: { name: 'John Doe' },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: field state is cleared', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const [key, setKey] = useState(1);
    const { Form, clearFields } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <Field name="name" label="Name" key={key} />
        <button type="submit">submit</button>
        <button
          type="button"
          onClick={() => {
            clearFields(['name']);
            setKey((k) => k + 1);
          }}
        >
          change key
        </button>
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
      touched: true,
      touchedFieldIds: ['name'],
      initialValues: {},
      values: { name: 'John Doe' },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('change key'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['name'],
      touched: false,
      touchedFieldIds: [],
      initialValues: {},
      values: {},
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

const exactLength: Validator = async (value) =>
  (await value).length === 1 ? success() : error('wrong length');

test('forms: async validation on list', async () => {
  const onSubmit = jest.fn();
  const onSubmitInvalid = jest.fn();
  const App = () => {
    const { Form, revalidate } = useForm({
      onSubmit,
      onSubmitInvalid,
    });
    return (
      <Form>
        <List name="users" validator={exactLength}>
          {({ fields, add, remove, removeAll }) => (
            <>
              {fields.map(([id, field]) => (
                <Fragment key={id}>
                  <AsyncField from={identity} label="Name" {...field('name')} />
                  <button type="button" onClick={() => remove(id)}>
                    remove
                  </button>
                </Fragment>
              ))}
              <button type="button" onClick={() => add()}>
                add
              </button>
              <button type="button" onClick={() => removeAll()}>
                clear
              </button>
              <button type="button" onClick={() => revalidate()}>
                revalidate
              </button>
            </>
          )}
        </List>
        <button type="submit">submit</button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('add'));
  await user.type(screen.getByLabelText('Name'), 'John Doe');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 'John Doe' }] },
      touched: true,
      touchedFieldIds: ['users'],
      initialValues: {},
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('revalidate'));
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 'John Doe' }] },
      touched: true,
      touchedFieldIds: ['users'],
      initialValues: {},
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('clear'));
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmitInvalid.mock.calls[0][0], {
      fieldIds: ['users'],
      values: { users: [] },
      touched: true,
      touchedFieldIds: ['users'],
      initialValues: {},
      dirty: false,
      validation: { isValid: false, isValidStrict: false },
    });
  });
});

test('forms: OnFormReady', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const { Form, getBag, setInitialValues, submit } = useForm({
      onSubmit,
    });
    const onReady = async () => {
      const { values } = await getBag();
      setInitialValues(values);
      submit();
    };
    return (
      <Form>
        <OnFormReady cb={onReady} />
        <AsyncField
          from={identity}
          name="name"
          label="Name"
          delayedResolve="foo"
        />
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      values: { name: 'foo' },
      touched: true,
      touchedFieldIds: ['name'],
      initialValues: { name: 'foo' },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.type(screen.getByLabelText('Name'), 'John Doe');

  // onFormReady callback is called just once
  await waitFor(
    () => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    },
    { interval: 2200, timeout: 2500 },
  );
});

const isRequired: Validator = (value) =>
  value && value.length !== 0 ? success() : error('required');

test.only('forms: dependent field', async () => {
  const onSubmit = jest.fn();
  const onSubmitInvalid = jest.fn();
  const App = () => {
    const { Form, formId, handleDependentFields } = useForm({
      onSubmit,
      onSubmitInvalid,
    });
    const a = useHasValue({ formId, name: 'a' });
    const b = useHasValue({
      formId,
      name: 'b',
      compare: (value) => value === 'xxx',
    });
    return (
      <Form>
        <LazyField
          name="a"
          label="A"
          validator={isRequired}
          onChangeImmediate={({ value }) =>
            value !== undefined && value !== ''
              ? handleDependentFields(['b'], ['c'])
              : handleDependentFields([], ['b', 'c'])
          }
        />
        {a && (
          <LazyField
            name="b"
            label="B"
            validator={isRequired}
            onChangeImmediate={({ value }) =>
              value === 'xxx'
                ? handleDependentFields(['c'])
                : handleDependentFields([], ['c'])
            }
          />
        )}
        {b && <LazyField name="c" label="C" validator={isRequired} />}
        <button type="submit">submit</button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmitInvalid.mock.calls[0][0], {
      fieldIds: ['a'],
      values: {},
    });
  });

  await user.type(screen.getByLabelText('A'), 'foo');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmitInvalid.mock.calls[1][0], {
      fieldIds: ['a', 'b'],
      values: { a: 'foo' },
    });
  });

  await user.type(screen.getByLabelText('B'), 'bar');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['a', 'b'],
      values: { a: 'foo', b: 'bar' },
    });
  });

  await user.clear(screen.getByLabelText('A'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(3);
    expectFormBag(onSubmitInvalid.mock.calls[2][0], {
      fieldIds: ['a'],
      values: { a: '' },
    });
  });

  await user.type(screen.getByLabelText('A'), 'baz');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(4);
    expectFormBag(onSubmitInvalid.mock.calls[3][0], {
      fieldIds: ['a', 'b'],
      values: { a: 'baz', b: undefined },
    });
  });

  await user.clear(screen.getByLabelText('B'));
  await user.type(screen.getByLabelText('B'), 'xxx');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(5);
    expectFormBag(onSubmitInvalid.mock.calls[4][0], {
      fieldIds: ['a', 'b', 'c'],
      values: { a: 'baz', b: 'xxx', c: undefined },
    });
  });
});
