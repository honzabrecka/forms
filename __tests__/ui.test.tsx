/* eslint-disable react/jsx-props-no-spreading */
import React, { Fragment, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  wrapper,
  expectBag,
  Field,
  LazyField,
  AsyncField,
  identity,
  SubmitButton,
} from './shared';
import {
  useForm,
  useDependentField,
  List,
  Validator,
  error,
  success,
  useFormIsSubmitting,
  Dict,
  OnChange,
} from '../src/index';
import { clearStore } from '../src/minimalRecoil';

beforeEach(() => {
  clearStore();
});

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
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      touched: true,
      touchedFieldIds: new Set(['name']),
      initialValues: {},
      dirty: true,
      dirtyFieldIds: new Set(['name']),
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: double click is ignored', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const { Form } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <Field name="name" label="Name" />
        <SubmitButton>submit</SubmitButton>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.dblClick(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
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
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      values: { name: 'John Doe' },
      touched: true,
      touchedFieldIds: new Set(['name']),
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
  let rowBag: any;
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
          {({ rows, add, remove, removeAll, replaceAll }) => (
            <>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <Field label="Name" {...row.fieldProps('name')} />
                  <button type="button" onClick={() => remove(row.id)}>
                    remove
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      rowBag = row.getBag();
                    }}
                  >
                    get bag
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
                onClick={() => replaceAll([{ name: 'users' }, { name: 'bar' }])}
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
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 1 }, { name: 2 }] },
      touched: false,
      touchedFieldIds: new Set(),
      initialValues: { users: [{ name: 1 }, { name: 2 }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('add'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 1 }, { name: 2 }, { name: 'John Doe' }] },
      touched: true,
      touchedFieldIds: new Set(['users']),
      initialValues: { users: [{ name: 1 }, { name: 2 }] },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getAllByText('get bag')[2]);
  await waitFor(async () => {
    expect(await rowBag).toMatchObject({
      value: { name: 'John Doe' },
      touched: false,
      initialValue: { name: 'John Doe' },
      dirty: false,
    });
  });

  await user.click(screen.getAllByText('remove')[2]);

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(3);
    expectBag(onSubmit.mock.calls[2][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 1 }, { name: 2 }] },
      touched: true,
      touchedFieldIds: new Set(['users']),
      initialValues: { users: [{ name: 1 }, { name: 2 }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('fill'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(4);
    expectBag(onSubmit.mock.calls[3][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 'users' }, { name: 'bar' }] },
      touched: false,
      touchedFieldIds: new Set(),
      initialValues: { users: [{ name: 'users' }, { name: 'bar' }] },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('clear'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    expectBag(onSubmitInvalid.mock.calls[0][0], {
      fieldIds: ['users'],
      values: { users: [] },
      touched: true,
      touchedFieldIds: new Set(['users']),
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
          {({ rows, add, remove }) => (
            <>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <Field label="Name" {...row.fieldProps('name')} />
                  <button type="button" onClick={() => remove(row.id)}>
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
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 1 }, { name: 2 }] },
      touched: false,
      touchedFieldIds: new Set(),
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
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['users'],
      values: { users: [{ name: undefined }, { name: undefined }] },
      touched: true,
      touchedFieldIds: new Set(['users']),
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
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      touched: true,
      touchedFieldIds: new Set(['name']),
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
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['name'],
      touched: true,
      touchedFieldIds: new Set(['name']),
      initialValues: {},
      values: { name: 'John Doe' },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: field state is not preserved in between mounts with flag', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const [key, setKey] = useState(1);
    const { Form } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <Field
          name="name"
          label="Name"
          key={key}
          initialValue="John"
          preserveStateAfterUnmount={false}
        />
        <button type="submit">submit</button>
        <button type="button" onClick={() => setKey((k) => k + 1)}>
          change key
        </button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Name'), ' Doe');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      touched: true,
      touchedFieldIds: new Set(['name']),
      initialValues: { name: 'John' },
      values: { name: 'John Doe' },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('change key'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['name'],
      touched: false,
      touchedFieldIds: new Set(),
      initialValues: { name: 'John' },
      values: { name: 'John' },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: field state is reset', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const [key, setKey] = useState(1);
    const { Form, resetFields } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <Field name="name" label="Name" key={key} />
        <button type="submit">submit</button>
        <button
          type="button"
          onClick={() => {
            resetFields(['name']);
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
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      touched: true,
      touchedFieldIds: new Set(['name']),
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
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['name'],
      touched: false,
      touchedFieldIds: new Set(),
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
          {({ rows, add, remove, removeAll }) => (
            <>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <AsyncField
                    from={identity}
                    label="Name"
                    {...row.fieldProps('name')}
                  />
                  <button type="button" onClick={() => remove(row.id)}>
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
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 'John Doe' }] },
      touched: true,
      touchedFieldIds: new Set(['users']),
      initialValues: {},
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('revalidate'));
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['users'],
      values: { users: [{ name: 'John Doe' }] },
      touched: true,
      touchedFieldIds: new Set(['users']),
      initialValues: {},
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getByText('clear'));
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    expectBag(onSubmitInvalid.mock.calls[0][0], {
      fieldIds: ['users'],
      values: { users: [] },
      touched: true,
      touchedFieldIds: new Set(['users']),
      initialValues: {},
      dirty: false,
      validation: { isValid: false, isValidStrict: false },
    });
  });
});

test('forms: OnFormReady', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const { Form, reset } = useForm({
      onSubmit,
      onReady: async ({ getBag, setInitialValues, submit }) => {
        const { values } = await getBag();
        console.log({ values });
        setInitialValues(values);
        submit();
      },
    });
    return (
      <Form>
        <AsyncField
          from={identity}
          name="name"
          label="Name"
          delayedResolve="foo"
        />
        <button type="button" onClick={() => reset()}>
          reset
        </button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['name'],
      values: { name: 'foo' },
      touched: true,
      touchedFieldIds: new Set(['name']),
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

  await user.click(screen.getByText('reset'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['name'],
      values: { name: 'foo' },
      // field is not remounted -> inner inputs does not call it's onMount effect
      touched: false,
      touchedFieldIds: new Set(),
      initialValues: { name: 'foo' },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.type(screen.getByLabelText('Name'), 'Melisa Woo');

  // onFormReady callback is called just once (again)
  await waitFor(
    () => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    },
    { interval: 2200, timeout: 2500 },
  );
});

const isRequired: Validator = (value) =>
  value && value.length !== 0 ? success() : error('required');

test('forms: dependent field', async () => {
  const onSubmit = jest.fn();
  const onSubmitInvalid = jest.fn();
  const App = () => {
    const { Form, formId, handleDependentFields } = useForm({
      onSubmit,
      onSubmitInvalid,
    });
    const [hasA, compareAValue] = useDependentField<string>({
      formId,
      name: 'a',
      compare: (value) => value !== undefined && value !== '',
    });
    const [hasB, compareBValue] = useDependentField<string>({
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
          onChange={({ value }) =>
            compareAValue(value)
              ? handleDependentFields(['b'], ['c'])
              : handleDependentFields([], ['b', 'c'])
          }
        />
        {hasA && (
          <LazyField
            name="b"
            label="B"
            validator={isRequired}
            onChange={({ value }) =>
              compareBValue(value)
                ? handleDependentFields(['c'], [])
                : handleDependentFields([], ['c'])
            }
          />
        )}
        {hasB && <LazyField name="c" label="C" validator={isRequired} />}
        <button type="submit">submit</button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    expectBag(onSubmitInvalid.mock.calls[0][0], {
      fieldIds: ['a'],
      values: {},
    });
  });

  await user.type(screen.getByLabelText('A'), 'foo');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(2);
    expectBag(onSubmitInvalid.mock.calls[1][0], {
      fieldIds: ['a', 'b'],
      values: { a: 'foo' },
    });
  });

  await user.type(screen.getByLabelText('B'), 'bar');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['a', 'b'],
      values: { a: 'foo', b: 'bar' },
    });
  });

  await user.clear(screen.getByLabelText('A'));

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(3);
    expectBag(onSubmitInvalid.mock.calls[2][0], {
      fieldIds: ['a'],
      values: { a: '' },
    });
  });

  await user.type(screen.getByLabelText('A'), 'baz');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(4);
    expectBag(onSubmitInvalid.mock.calls[3][0], {
      fieldIds: ['a', 'b'],
      values: { a: 'baz', b: undefined },
    });
  });

  await user.clear(screen.getByLabelText('B'));
  await user.type(screen.getByLabelText('B'), 'xxx');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(5);
    expectBag(onSubmitInvalid.mock.calls[4][0], {
      fieldIds: ['a', 'b', 'c'],
      values: { a: 'baz', b: 'xxx', c: undefined },
    });
  });
});

test('forms: List row values manipulation', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const { Form, setValues } = useForm({
      onSubmit,
    });
    return (
      <Form>
        <List
          name="users"
          initialValue={[
            { firstName: 'John', lastName: 'Doe' },
            { firstName: 'Melissa', lastName: 'Woo' },
          ]}
        >
          {({ rows, getFieldName }) => (
            <>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <Field label="First Name" {...row.fieldProps('firstName')} />
                  <Field label="Last Name" {...row.fieldProps('lastName')} />
                  <button
                    type="button"
                    onClick={async () => {
                      const { value } = await row.getBag();
                      setValues(
                        Object.entries(value).reduce<Dict<any>>(
                          (acc, [name, value]) => {
                            acc[getFieldName(row.id, name)] = `saved: ${value}`;
                            return acc;
                          },
                          {},
                        ),
                      );
                    }}
                  >
                    save
                  </button>
                </Fragment>
              ))}
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
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['users'],
      values: {
        users: [
          { firstName: 'John', lastName: 'Doe' },
          { firstName: 'Melissa', lastName: 'Woo' },
        ],
      },
      touched: false,
      touchedFieldIds: new Set(),
      initialValues: {
        users: [
          { firstName: 'John', lastName: 'Doe' },
          { firstName: 'Melissa', lastName: 'Woo' },
        ],
      },
      dirty: false,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.click(screen.getAllByText('save')[0]);

  await waitFor(() => {
    expect(
      screen.getAllByLabelText<HTMLInputElement>('First Name')[0].value,
    ).toBe('saved: John');
    expect(
      screen.getAllByLabelText<HTMLInputElement>('Last Name')[0].value,
    ).toBe('saved: Doe');
  });

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['users'],
      values: {
        users: [
          { firstName: 'saved: John', lastName: 'saved: Doe' },
          { firstName: 'Melissa', lastName: 'Woo' },
        ],
      },
      // setValues does not set touched to true (it's up to developer to call setTouched)
      touched: false,
      touchedFieldIds: new Set(),
      initialValues: {
        users: [
          { firstName: 'John', lastName: 'Doe' },
          { firstName: 'Melissa', lastName: 'Woo' },
        ],
      },
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: lazy cross validation', async () => {
  const onSubmit = jest.fn();
  const onSubmitInvalid = jest.fn();
  const validator: Validator = async (_value, getBag) => {
    const { values } = await getBag();
    return ['a', 'b'].some((name) => values[name])
      ? success()
      : error('missing field');
  };
  const App = () => {
    const { Form, setValues } = useForm({
      onSubmit,
      onSubmitInvalid,
    });
    const onChange: OnChange = ({ name }) => {
      // reset other field
      setValues({ [name === 'a' ? 'b' : 'a']: null });
    };
    return (
      <Form>
        <LazyField
          name="a"
          label="A"
          onChange={onChange}
          validator={validator}
        />
        <LazyField
          name="b"
          label="B"
          onChange={onChange}
          validator={validator}
        />
        <button type="submit">submit</button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
  });

  await user.type(screen.getByLabelText('B'), 'y');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['a', 'b'],
      values: { a: null, b: 'y' },
      touched: true,
      // "a" as well because previous invalid submit marks all fields as touched
      touchedFieldIds: new Set(['a', 'b']),
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });

  await user.type(screen.getByLabelText('A'), 'x');

  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['a', 'b'],
      values: { a: 'x', b: null },
      touched: true,
      touchedFieldIds: new Set(['a', 'b']),
      dirty: true,
      validation: { isValid: true, isValidStrict: true },
    });
  });
});

test('forms: isSubmitting', async () => {
  const onSubmit = jest.fn();
  const App = () => {
    const { Form, formId } = useForm({
      onSubmit,
    });
    const isSubmitting = useFormIsSubmitting(formId);
    return (
      <Form>
        <AsyncField from={identity} name="name" label="Name" />
        <button type="submit" disabled={isSubmitting}>
          submit
        </button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await waitFor(() => {
    expect(screen.getByText('submit')).toBeEnabled();
  });

  await user.type(screen.getByLabelText('Name'), 'John Doe');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(screen.getByText('submit')).toBeDisabled();
  });

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  await waitFor(() => {
    expect(screen.getByText('submit')).toBeEnabled();
  });
});
