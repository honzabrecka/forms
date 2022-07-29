/* eslint-disable react/jsx-props-no-spreading */
import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { wrapper, expectFormBag, Field as RegularField } from './shared';
import {
  useForm,
  withConditionalValidation,
  success,
  error,
  ConditionalValidator,
} from '../src/index';

const Field = withConditionalValidation(RegularField);

const isSame1: ConditionalValidator = (value, _, values) =>
  values.every((x) => x === value) ? success() : error('do not match');

const isSame2: ConditionalValidator = (value, _, [otherValue]) =>
  value === otherValue ? success() : error(`${value} !== ${otherValue}`);

test('forms: optimized cross validation', async () => {
  const onSubmit = jest.fn();
  const onSubmitInvalid = jest.fn();
  const App = () => {
    const { Form } = useForm({
      onSubmit,
      onSubmitInvalid,
    });
    const [flags, setFlags] = useState<string[]>([]);
    return (
      <Form>
        <Field
          name="a"
          label="A"
          validatorDependsOn={
            flags.includes('dependsOn:regular') ? ['regular'] : ['b', 'c']
          }
          validator={flags.includes('validator:isSame2') ? isSame2 : isSame1}
        />
        <Field
          name="b"
          label="B"
          validatorDependsOn={
            flags.includes('dependsOn:regular') ? ['regular'] : ['a', 'c']
          }
          validator={flags.includes('validator:isSame2') ? isSame2 : isSame1}
        />
        <Field
          name="c"
          label="C"
          validatorDependsOn={
            flags.includes('dependsOn:regular') ? ['regular'] : ['a', 'b']
          }
          validator={flags.includes('validator:isSame2') ? isSame2 : isSame1}
        />
        <Field name="regular" label="Regular" />
        <button type="submit">submit</button>
        <button
          type="button"
          onClick={() => setFlags((state) => [...state, 'dependsOn:regular'])}
        >
          change dependsOn
        </button>
        <button
          type="button"
          onClick={() => setFlags((state) => [...state, 'validator:isSame2'])}
        >
          change validator
        </button>
      </Form>
    );
  };

  render(<App />, { wrapper });

  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Regular'), 'John Doe');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmit.mock.calls[0][0], {
      fieldIds: ['a', 'b', 'c', 'regular'],
      touched: true,
      touchedFieldIds: ['regular'],
      initialValues: {},
      dirty: true,
      dirtyFieldIds: ['regular'],
      validation: {
        isValid: true,
        isValidStrict: true,
        errors: [],
      },
    });
  });

  await user.type(screen.getByLabelText('A'), 'foo');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    expectFormBag(onSubmitInvalid.mock.calls[0][0], {
      fieldIds: ['a', 'b', 'c', 'regular'],
      touched: true,
      touchedFieldIds: ['a', 'regular'],
      initialValues: {},
      dirty: true,
      dirtyFieldIds: ['a', 'regular'],
      validation: {
        isValid: false,
        isValidStrict: false,
        errors: [
          { name: 'a', value: 'do not match' },
          { name: 'b', value: 'do not match' },
          { name: 'c', value: 'do not match' },
        ],
      },
    });
  });

  await user.type(screen.getByLabelText('B'), 'foo');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmitInvalid.mock.calls[1][0], {
      fieldIds: ['a', 'b', 'c', 'regular'],
      touched: true,
      touchedFieldIds: ['a', 'b', 'c', 'regular'],
      initialValues: {},
      dirty: true,
      dirtyFieldIds: ['a', 'b', 'regular'],
      validation: {
        isValid: false,
        isValidStrict: false,
        errors: [
          { name: 'a', value: 'do not match' },
          { name: 'b', value: 'do not match' },
          { name: 'c', value: 'do not match' },
        ],
      },
    });
  });

  await user.type(screen.getByLabelText('C'), 'foo');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expectFormBag(onSubmit.mock.calls[1][0], {
      fieldIds: ['a', 'b', 'c', 'regular'],
      touched: true,
      initialValues: {},
      dirty: true,
      validation: {
        isValid: true,
        isValidStrict: true,
        errors: [],
      },
    });
  });

  await user.click(screen.getByText('change dependsOn'));
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(3);
    expectFormBag(onSubmitInvalid.mock.calls[2][0], {
      touched: true,
      initialValues: {},
      dirty: true,
      validation: {
        isValid: false,
        isValidStrict: false,
        errors: [
          { name: 'a', value: 'do not match' },
          { name: 'b', value: 'do not match' },
          { name: 'c', value: 'do not match' },
        ],
      },
    });
  });

  await user.clear(screen.getByLabelText('Regular'));
  await user.type(screen.getByLabelText('Regular'), 'foo');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(3);
    expectFormBag(onSubmit.mock.calls[2][0], {
      touched: true,
      initialValues: {},
      dirty: true,
      validation: {
        isValid: true,
        isValidStrict: true,
        errors: [],
      },
    });
  });

  await user.clear(screen.getByLabelText('Regular'));
  await user.type(screen.getByLabelText('Regular'), 'bar');
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(4);
    expectFormBag(onSubmitInvalid.mock.calls[3][0], {
      touched: true,
      initialValues: {},
      dirty: true,
      validation: {
        isValid: false,
        isValidStrict: false,
        errors: [
          { name: 'a', value: 'do not match' },
          { name: 'b', value: 'do not match' },
          { name: 'c', value: 'do not match' },
        ],
      },
    });
  });

  await user.click(screen.getByText('change validator'));
  await user.click(screen.getByText('submit'));

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(5);
    expectFormBag(onSubmitInvalid.mock.calls[4][0], {
      touched: true,
      initialValues: {},
      dirty: true,
      validation: {
        isValid: false,
        isValidStrict: false,
        errors: [
          { name: 'a', value: 'foo !== bar' },
          { name: 'b', value: 'foo !== bar' },
          { name: 'c', value: 'foo !== bar' },
        ],
      },
    });
  });
});
