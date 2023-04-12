import { renderHook, act, waitFor } from '@testing-library/react';
import { wrapper, expectFormViaGetBag, expectIsLoadableValue } from './shared';
import {
  useForm,
  useField,
  useFieldValidationLoadable,
  useFormValidationLoadable,
  useFormDirtyLoadable,
  useFieldDirtyLoadable,
  success,
  warning,
  error,
  isSuccess,
  isWarning,
  isError,
  createNestedName,
} from '../src/index';

const htmlEvent = (value: any) => ({ target: { value } });

test('forms: initial values', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm({
        initialValues: { a: 1, c: 4 },
      });
      const a = useField({ formId: form.formId, name: 'a', initialValue: 2 });
      const b = useField({ formId: form.formId, name: 'b', initialValue: 3 });
      const c = useField({ formId: form.formId, name: 'c' });
      return { form, a, b, c };
    },
    { wrapper },
  );

  await waitFor(() => {
    // form.initialValues has precedence over field.initialValue
    expect(result.current.a.value).toEqual(1);
    expect(result.current.b.value).toEqual(3);
    expect(result.current.c.value).toEqual(4);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a', 'b', 'c'],
    initialValues: { a: 1, b: 3, c: 4 },
    touched: false,
    touchedFieldIds: new Set(),
    values: { a: 1, b: 3, c: 4 },
  });
});

test('forms: setValues', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({ formId: form.formId, name: 'a' });
      const b = useField({ formId: form.formId, name: 'b' });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.form.setValues({ a: 2 });
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(2);
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.value).toEqual(undefined);
    expect(result.current.b.touched).toEqual(false);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a', 'b'],
    touched: false,
    touchedFieldIds: new Set(),
    values: { a: 2, b: undefined },
  });
});

test('forms: setValues with equal', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({
        formId: form.formId,
        name: 'a',
        initialValue: { id: 'foo', x: 'bar' },
      });
      return { form, a };
    },
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ id: 'foo', x: 'bar' });
  });

  act(() => {
    result.current.form.setValues(
      { a: { id: 'foo', x: 'baz' } },
      { equal: (a, b) => a.id === b.id },
    );
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a'],
    touched: false,
    touchedFieldIds: new Set(),
    values: { a: { id: 'foo', x: 'bar' } },
  });

  act(() => {
    result.current.form.setValues(
      { a: { id: 'new', x: 'baz' } },
      { equal: (a, b) => a.id === b.id },
    );
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ id: 'new', x: 'baz' });
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a'],
    touched: false,
    touchedFieldIds: new Set(),
    values: { a: { id: 'new', x: 'baz' } },
  });
});

test('forms: setValues with validator', async () => {
  const validator = jest.fn().mockReturnValue(success());
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({ formId: form.formId, name: 'a', validator });
      return { form, a };
    },
    { wrapper },
  );
  act(() => {
    result.current.form.setValues({ a: Promise.resolve(2) });
  });
  await waitFor(async () => {
    // NOTE (react 18) in dev mode it mounts 2x
    expect(await validator.mock.calls[2][0]).toBe(2);
  });
  const bag = await validator.mock.calls[2][1]();
  expect(bag).toMatchObject({
    fieldIds: ['a'],
    values: { a: 2 },
    touched: false,
    touchedFieldIds: new Set(),
    initialValues: {},
    dirty: true,
    dirtyFieldIds: new Set(['a']),
  });
  expect(bag).not.toHaveProperty('validation');
  expect(await validator.mock.calls[2][2]).toBe(undefined);
});

test('forms: setTouched', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({ formId: form.formId, name: 'a' });
      const b = useField({ formId: form.formId, name: 'b' });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.form.setTouched({ a: true });
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(undefined);
    expect(result.current.a.touched).toEqual(true);
    expect(result.current.b.value).toEqual(undefined);
    expect(result.current.b.touched).toEqual(false);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a', 'b'],
    values: { a: undefined, b: undefined },
    touched: true,
    touchedFieldIds: new Set(['a']),
  });
});

test('forms: setErrors', async () => {
  const onSubmit = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm({
        onSubmit,
      });
      const a = useField({
        formId: form.formId,
        name: 'a',
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
      });
      const validation = useFormValidationLoadable(form.formId);
      return { form, a, b, validation };
    },
    { wrapper },
  );

  // check that form.setErrors() works
  act(() => {
    result.current.form.setErrors({ a: error('fail'), b: warning('fail') });
  });

  await waitFor(() => {
    expect(result.current.validation.state).toBe('loading');
  });

  await waitFor(() => {
    const bag = result.current;
    if (expectIsLoadableValue(bag.validation)) {
      expect(bag.validation.contents.isValid).toEqual(false);
      expect(bag.validation.contents.isValidStrict).toEqual(false);
      expect(bag.validation.contents.errors.length).toEqual(1);
      expect(bag.validation.contents.warnings.length).toEqual(1);
      expect(bag.validation.contents.result[0].name).toBe('a');
    }
  });
});

test('forms: setTouched + resetTouched', async () => {
  const onSubmit = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm({
        onSubmit,
      });
      const a = useField({
        formId: form.formId,
        name: 'a',
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
      });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.form.setTouched({ b: true });
  });

  await waitFor(() => {
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.touched).toEqual(true);
  });

  act(() => {
    result.current.form.resetTouched();
  });

  await waitFor(() => {
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.touched).toEqual(false);
  });
});

test('forms: setAllToTouched', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({ formId: form.formId, name: 'a' });
      const b = useField({ formId: form.formId, name: 'b' });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.form.setAllToTouched();
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(undefined);
    expect(result.current.a.touched).toEqual(true);
    expect(result.current.b.value).toEqual(undefined);
    expect(result.current.b.touched).toEqual(true);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a', 'b'],
    values: { a: undefined, b: undefined },
    touched: true,
    touchedFieldIds: new Set(['a', 'b']),
  });
});

test('forms > field: onChange', async () => {
  const onChange = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({
        formId: form.formId,
        name: 'a',
        onChange,
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
        onChange,
      });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.a.onChange(htmlEvent(2));
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(2);
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.value).toEqual(undefined);
    expect(result.current.b.touched).toEqual(false);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a', 'b'],
    values: { a: 2, b: undefined },
    touched: false,
    touchedFieldIds: new Set(),
  });

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0]).toEqual({ name: 'a', value: 2 });
  expect(await onChange.mock.calls[0][1]()).toMatchObject({
    values: { a: 2 },
    touched: false,
    touchedFieldIds: new Set(),
    validation: { isValid: true },
  });
});

test('forms > field: onChange with an async value', async () => {
  const value = Promise.resolve(2);
  const onChange = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({ formId: form.formId, name: 'a', onChange });
      const b = useField({ formId: form.formId, name: 'b', onChange });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.a.onChange(htmlEvent(value));
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(value);
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.value).toEqual(undefined);
    expect(result.current.b.touched).toEqual(false);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a', 'b'],
    touched: false,
    touchedFieldIds: new Set(),
    values: { a: 2, b: undefined },
  });

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0]).toEqual({ name: 'a', value: 2 });
  expect(await onChange.mock.calls[0][1]()).toMatchObject({
    values: { a: 2 },
    touched: false,
    touchedFieldIds: new Set(),
    validation: { isValid: true },
  });
});

test('forms > field: onBlur', async () => {
  const onBlur = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({ formId: form.formId, name: 'a', onBlur });
      const b = useField({ formId: form.formId, name: 'b', onBlur });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.a.onBlur();
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(undefined);
    expect(result.current.a.touched).toEqual(true);
    expect(result.current.b.value).toEqual(undefined);
    expect(result.current.b.touched).toEqual(false);
  });

  expect(onBlur).toHaveBeenCalledTimes(1);
  expect(onBlur.mock.calls[0][0]).toEqual({ name: 'a' });
  expect(await onBlur.mock.calls[0][1]()).toMatchObject({
    values: {},
    touched: true,
    touchedFieldIds: new Set(['a']),
    validation: { isValid: true },
  });
});

test('forms > field: onFocus', async () => {
  const onFocus = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({ formId: form.formId, name: 'a', onFocus });
      const b = useField({ formId: form.formId, name: 'b', onFocus });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.a.onFocus();
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(undefined);
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.value).toEqual(undefined);
    expect(result.current.b.touched).toEqual(false);
  });

  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onFocus.mock.calls[0][0]).toEqual({ name: 'a' });
  expect(await onFocus.mock.calls[0][1]()).toMatchObject({
    values: {},
    touched: false,
    touchedFieldIds: new Set(),
    validation: { isValid: true },
  });
});

test('forms > field: from/to transformers', async () => {
  const from = ({ selectedValue }: any) => selectedValue;
  const to = (value: any) => ({ selectedValue: value });
  const onChange = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({
        formId: form.formId,
        name: 'a',
        onChange,
        from,
        to,
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
        onChange,
        from,
        to,
      });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.a.onChange({ selectedValue: 2 });
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ selectedValue: 2 });
    expect(result.current.b.value).toEqual({ selectedValue: undefined });
  });

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0]).toEqual({ name: 'a', value: 2 });
  expect(await onChange.mock.calls[0][1]()).toMatchObject({
    values: { a: 2 },
    touched: false,
    touchedFieldIds: new Set(),
    validation: { isValid: true },
  });
});

test('forms > field: onChange validation', async () => {
  const validatorA = jest.fn().mockReturnValue(error('fail'));
  const validatorB = jest.fn().mockReturnValue(error('fail'));
  const { result, rerender } = renderHook(
    ({ validateOnChange, validatorA, validatorB }) => {
      const form = useForm();
      const a = useField({
        formId: form.formId,
        name: 'a',
        validateOnMount: false,
        validateOnChange,
        validator: validatorA,
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
        validateOnMount: false,
        validateOnChange,
        validator: validatorB,
      });
      const validation = useFieldValidationLoadable({
        formId: form.formId,
        name: 'a',
      });
      return { form, a, b, validation };
    },
    {
      wrapper,
      initialProps: { validateOnChange: true, validatorA, validatorB },
    },
  );

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.validation)) {
      expect(isSuccess(result.current.validation.contents)).toEqual(true);
    }
  });

  act(() => {
    result.current.a.onChange(htmlEvent(2));
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.validation)) {
      expect(isError(result.current.validation.contents)).toEqual(true);
    }
  });

  expect(validatorA).toHaveBeenCalledTimes(1);
  expect(validatorA.mock.calls[0][0]).toEqual(2);
  expect(await validatorA.mock.calls[0][1]()).toMatchObject({
    values: { a: 2 },
    touched: false,
    touchedFieldIds: new Set(),
  });
  expect(validatorB).toHaveBeenCalledTimes(0);

  // disable validation so validator + validation result stay untouched
  rerender({ validateOnChange: false, validatorA, validatorB });
  act(() => {
    result.current.a.onChange(htmlEvent(3));
  });

  expect(validatorA).toHaveBeenCalledTimes(1);
  expect(validatorB).toHaveBeenCalledTimes(0);

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.validation)) {
      expect(isError(result.current.validation.contents)).toEqual(true);
    }
  });

  // change of the validator reruns validation
  const validatorA2 = jest.fn().mockReturnValue(warning('fail'));
  rerender({
    validateOnChange: false,
    validatorA: validatorA2,
    validatorB,
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.validation)) {
      expect(isWarning(result.current.validation.contents)).toEqual(true);
    }
  });

  expect(validatorA).toHaveBeenCalledTimes(1);
  expect(validatorA2).toHaveBeenCalledTimes(1);
  expect(validatorA2.mock.calls[0][0]).toEqual(3);
  expect(await validatorA2.mock.calls[0][1]()).toMatchObject({
    values: { a: 3 },
    touched: false,
    touchedFieldIds: new Set(),
  });
  expect(validatorB).toHaveBeenCalledTimes(0);
});

test('forms: submit invalid form + call onSubmitInvalid', async () => {
  const onSubmit = jest.fn();
  const onSubmitInvalid = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm({
        onSubmit,
        onSubmitInvalid,
      });
      const a = useField({
        formId: form.formId,
        name: 'a',
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
      });
      const validation = useFormValidationLoadable(form.formId);
      return { form, a, b, validation };
    },
    { wrapper },
  );

  act(() => {
    result.current.form.setErrors({ a: error('whatever reason') });
  });

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(0);
  });

  act(() => {
    result.current.form.submit();
  });

  await waitFor(() => {
    // onSubmit is not called when form is invalid
    expect(onSubmit).toHaveBeenCalledTimes(0);
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
  });

  // but all fields should be set to touched=true
  expect(result.current.a.touched).toBe(true);
  expect(result.current.b.touched).toBe(true);

  if (expectIsLoadableValue(result.current.validation)) {
    expect(result.current.validation.contents.isValid).toEqual(false);
    expect(result.current.validation.contents.isValidStrict).toEqual(false);
    expect(result.current.validation.contents.errors.length).toEqual(1);
    expect(result.current.validation.contents.warnings.length).toEqual(0);
  }
});

test('forms: submit invalid form (strict) + call onSubmitInvalid', async () => {
  const onSubmit = jest.fn();
  const onSubmitInvalid = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm({
        onSubmit,
        onSubmitInvalid,
        isValidProp: 'isValidStrict',
      });
      const a = useField({
        formId: form.formId,
        name: 'a',
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
      });
      const validation = useFormValidationLoadable(form.formId);
      return { form, a, b, validation };
    },
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.validation.state).toBe('loading');
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(undefined);
    expect(result.current.b.value).toEqual(undefined);

    if (expectIsLoadableValue(result.current.validation)) {
      expect(result.current.validation.contents.isValid).toEqual(true);
    }
  });

  act(() => {
    result.current.form.setErrors({ a: warning('whatever reason') });
  });

  await waitFor(() => {
    expect(result.current.validation.state).toBe('loading');
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.a.validationResult)) {
      expect(isWarning(result.current.a.validationResult.contents)).toBe(true);
    }
    if (expectIsLoadableValue(result.current.b.validationResult)) {
      expect(isSuccess(result.current.b.validationResult.contents)).toBe(true);
    }
  });

  await waitFor(() => {
    expect(result.current.validation.state).toBe('hasValue');
    if (expectIsLoadableValue(result.current.validation)) {
      expect(result.current.validation.contents.isValid).toBe(true);
    }
  });

  await waitFor(() => {
    expect(onSubmitInvalid).toHaveBeenCalledTimes(0);
    if (expectIsLoadableValue(result.current.validation)) {
      expect(result.current.validation.contents.isValid).toBe(true);
    }
  });

  act(() => {
    result.current.form.submit();
  });

  await waitFor(() => {
    // onSubmit is not called when form is invalid
    expect(onSubmit).toHaveBeenCalledTimes(0);
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
    if (expectIsLoadableValue(result.current.validation)) {
      expect(result.current.validation.contents.isValid).toBe(true);
    }
  });

  await waitFor(() => {
    // but all fields should be set to touched=true
    expect(result.current.a.touched).toBe(true);
    expect(result.current.b.touched).toBe(true);
  });

  const bag = result.current;
  if (expectIsLoadableValue(bag.validation)) {
    expect(bag.validation.contents.isValid).toEqual(true);
    expect(bag.validation.contents.isValidStrict).toEqual(false);
    expect(bag.validation.contents.errors.length).toEqual(0);
    expect(bag.validation.contents.warnings.length).toEqual(1);
  }
});

test('forms: submit valid form', async () => {
  const onSubmit = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm({ onSubmit });
      const a = useField({ formId: form.formId, name: 'a' });
      const b = useField({ formId: form.formId, name: 'b' });
      return { form, a, b };
    },
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current).not.toBe(null);
  });

  act(() => {
    result.current.a.onChange(htmlEvent(2));
  });

  // check that form.submit() works
  act(() => {
    result.current.form.submit('foo', 'bar');
  });

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  const bag = onSubmit.mock.calls[0][0];
  expect(bag.values).toEqual({ a: 2, b: undefined });
  expect(bag.touched).toEqual(false);
  expect(bag.fieldIds).toEqual(['a', 'b']);
  expect(bag.args).toEqual(['foo', 'bar']);

  // check that bag.setValues() works
  act(() => {
    bag.setValues({ b: 3 });
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual(2);
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.value).toEqual(3);
    expect(result.current.b.touched).toEqual(false);
  });

  // check that bag.setTouched() works
  act(() => {
    bag.setTouched({ b: true });
  });

  await waitFor(() => {
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.touched).toEqual(true);
  });

  // check that bag.resetTouched() works
  act(() => {
    bag.resetTouched();
  });

  await waitFor(() => {
    expect(result.current.a.touched).toEqual(false);
    expect(result.current.b.touched).toEqual(false);
  });

  // check that bag.setAllToTouched() works
  act(() => {
    bag.setAllToTouched();
  });

  await waitFor(() => {
    expect(result.current.a.touched).toEqual(true);
    expect(result.current.b.touched).toEqual(true);
  });
});

test('forms: submit waits for async values', async () => {
  const onSubmit = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm({ onSubmit });
      const a = useField({ formId: form.formId, name: 'a' });
      const b = useField({ formId: form.formId, name: 'b' });
      return { form, a, b };
    },
    { wrapper },
  );

  act(() => {
    result.current.a.onChange(htmlEvent(Promise.resolve(2)));
  });
  act(() => {
    result.current.form.submit();
  });

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const bag = onSubmit.mock.calls[0][0];
    expect(bag.values).toEqual({ a: 2, b: undefined });
  });
});

test('forms: validate via useFormValidation - without any argument all fields are revalidated', async () => {
  const validatorA = jest.fn().mockReturnValue(error('fail'));
  const validatorB = jest.fn().mockReturnValue(error('fail'));
  const { result } = renderHook(
    ({ validatorA, validatorB }) => {
      const form = useForm();
      const a = useField({
        formId: form.formId,
        name: 'a',
        validateOnMount: false,
        validator: validatorA,
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
        validateOnMount: false,
        validator: validatorB,
      });
      const validation = useFormValidationLoadable(form.formId);
      return { form, a, b, validation };
    },
    {
      wrapper,
      initialProps: { validatorA, validatorB },
    },
  );

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.validation)) {
      expect(result.current.validation.contents.isValid).toEqual(true);
    }
  });

  act(() => {
    result.current.form.revalidate();
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.validation)) {
      expect(result.current.validation.contents.isValid).toEqual(false);
      expect(result.current.validation.contents.errors.length).toBe(2);
    }
  });
});

test('forms: validate via useFormValidation - only specified field is revalidated', async () => {
  const validatorA = jest.fn().mockReturnValue(error('fail'));
  const validatorB = jest.fn().mockReturnValue(error('fail'));
  const { result } = renderHook(
    ({ validatorA, validatorB }) => {
      const form = useForm();
      const a = useField({
        formId: form.formId,
        name: 'a',
        validateOnMount: false,
        validator: validatorA,
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
        validateOnMount: false,
        validator: validatorB,
      });
      const validation = useFormValidationLoadable(form.formId);
      return { form, a, b, validation };
    },
    {
      wrapper,
      initialProps: { validatorA, validatorB },
    },
  );

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.validation)) {
      expect(result.current.validation.contents.isValid).toEqual(true);
    }
  });

  act(() => {
    result.current.form.revalidate(['b']);
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.validation)) {
      expect(result.current.validation.contents.isValid).toEqual(false);
      expect(result.current.validation.contents.errors.length).toBe(1);
    }
  });
});

test('forms: dirty - field onChange + setInitialValues', async () => {
  const onChange = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm({ initialValues: { a: 3 } });
      const a = useField({ formId: form.formId, name: 'a', onChange });
      const formDirty = useFormDirtyLoadable(form.formId);
      const fieldDirty = useFieldDirtyLoadable({
        formId: form.formId,
        name: 'a',
      });
      return { form, a, formDirty, fieldDirty };
    },
    { wrapper },
  );

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.formDirty)) {
      expect(result.current.formDirty.contents.dirty).toBe(false);
      expect(result.current.formDirty.contents.dirtyFieldIds).toEqual(
        new Set(),
      );
    }
    if (expectIsLoadableValue(result.current.fieldDirty)) {
      expect(result.current.fieldDirty.contents).toBe(false);
    }
  });

  await expectFormViaGetBag(result, {
    dirty: false,
    dirtyFieldIds: new Set(),
    initialValues: { a: 3 },
    values: { a: 3 },
  });

  act(() => {
    result.current.a.onChange(htmlEvent(2));
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.formDirty)) {
      expect(result.current.formDirty.contents.dirty).toBe(true);
      expect(result.current.formDirty.contents.dirtyFieldIds).toEqual(
        new Set(['a']),
      );
    }
    if (expectIsLoadableValue(result.current.fieldDirty)) {
      expect(result.current.fieldDirty.contents).toBe(true);
    }
  });

  await expectFormViaGetBag(result, {
    dirty: true,
    dirtyFieldIds: new Set(['a']),
    initialValues: { a: 3 },
    values: { a: 2 },
  });

  // revert back to initial value
  act(() => {
    result.current.a.onChange(htmlEvent(3));
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.formDirty)) {
      expect(result.current.formDirty.contents.dirty).toBe(false);
      expect(result.current.formDirty.contents.dirtyFieldIds).toEqual(
        new Set(),
      );
    }
    if (expectIsLoadableValue(result.current.fieldDirty)) {
      expect(result.current.fieldDirty.contents).toBe(false);
    }
  });

  await expectFormViaGetBag(result, {
    dirty: false,
    dirtyFieldIds: new Set(),
    initialValues: { a: 3 },
    values: { a: 3 },
  });

  act(() => {
    result.current.form.setInitialValues({ a: 1 });
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.formDirty)) {
      expect(result.current.formDirty.contents.dirty).toBe(true);
      expect(result.current.formDirty.contents.dirtyFieldIds).toEqual(
        new Set(['a']),
      );
    }
    if (expectIsLoadableValue(result.current.fieldDirty)) {
      expect(result.current.fieldDirty.contents).toBe(true);
    }
  });

  await expectFormViaGetBag(result, {
    dirty: true,
    dirtyFieldIds: new Set(['a']),
    initialValues: { a: 1 },
    values: { a: 3 },
  });
});

test('forms: dirty - setValues + setInitialValues', async () => {
  const onChange = jest.fn();
  const { result } = renderHook(
    () => {
      const form = useForm({ initialValues: { a: 3 } });
      const a = useField({ formId: form.formId, name: 'a', onChange });
      const dirty = useFormDirtyLoadable(form.formId);
      return { form, a, dirty };
    },
    { wrapper },
  );

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.dirty)) {
      expect(result.current.dirty.contents.dirty).toBe(false);
      expect(result.current.dirty.contents.dirtyFieldIds).toEqual(new Set());
    }
  });

  await expectFormViaGetBag(result, {
    dirty: false,
    dirtyFieldIds: new Set(),
    values: { a: 3 },
    initialValues: { a: 3 },
  });

  act(() => {
    result.current.form.setValues({ a: 2 });
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.dirty)) {
      expect(result.current.dirty.contents.dirty).toBe(true);
      expect(result.current.dirty.contents.dirtyFieldIds).toEqual(
        new Set(['a']),
      );
    }
  });

  await expectFormViaGetBag(result, {
    dirty: true,
    dirtyFieldIds: new Set(['a']),
    values: { a: 2 },
    initialValues: { a: 3 },
  });

  // revert back to initial value
  act(() => {
    result.current.form.setValues({ a: 3 });
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.dirty)) {
      expect(result.current.dirty.contents.dirty).toBe(false);
      expect(result.current.dirty.contents.dirtyFieldIds).toEqual(new Set());
    }
  });

  await expectFormViaGetBag(result, {
    dirty: false,
    dirtyFieldIds: new Set(),
    values: { a: 3 },
    initialValues: { a: 3 },
  });

  act(() => {
    result.current.form.setInitialValues({ a: 1 });
  });

  await waitFor(() => {
    if (expectIsLoadableValue(result.current.dirty)) {
      expect(result.current.dirty.contents.dirty).toBe(true);
      expect(result.current.dirty.contents.dirtyFieldIds).toEqual(
        new Set(['a']),
      );
    }
  });

  await expectFormViaGetBag(result, {
    dirty: true,
    dirtyFieldIds: new Set(['a']),
    values: { a: 3 },
    initialValues: { a: 1 },
  });
});

test('forms: dirty - default dirtyComparator compares by value (lodash.isEqual)', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm({
        initialValues: { a: { foo: 'bar' } },
      });
      const a = useField({ formId: form.formId, name: 'a' });
      return { form, a };
    },
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ foo: 'bar' });
  });

  act(() => {
    // new reference
    result.current.form.setValues({ a: { foo: 'bar' } });
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ foo: 'bar' });
  });

  await expectFormViaGetBag(result, {
    dirty: false,
    dirtyFieldIds: new Set(),
  });

  act(() => {
    // new value
    result.current.form.setValues({ a: { foo: 'baz' } });
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ foo: 'baz' });
  });

  await expectFormViaGetBag(result, {
    dirty: true,
    dirtyFieldIds: new Set(['a']),
  });
});

type WithY = { y: number };

test('forms: dirty - custom dirtyComparator', async () => {
  const dirtyComparator = (value: WithY, initialValue: WithY) =>
    value.y !== initialValue.y;
  const { result } = renderHook(
    () => {
      const form = useForm({
        initialValues: { a: { x: 1, y: 2, z: 3 } },
      });
      const a = useField({
        formId: form.formId,
        name: 'a',
        dirtyComparator,
      });
      return { form, a };
    },
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ x: 1, y: 2, z: 3 });
  });

  act(() => {
    result.current.form.setValues({ a: { x: 5, y: 6, z: 7 } });
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ x: 5, y: 6, z: 7 });
  });

  await expectFormViaGetBag(result, {
    dirty: true,
    dirtyFieldIds: new Set(['a']),
  });

  act(() => {
    result.current.form.setValues({ a: { x: 5, y: 2, z: 7 } });
  });

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ x: 5, y: 2, z: 7 });
  });

  await expectFormViaGetBag(result, {
    dirty: false,
    dirtyFieldIds: new Set(),
  });
});

test('forms: dirty - async values + custom dirtyComparator', async () => {
  const dirtyComparator = async (value: WithY, initialValue: WithY) =>
    (await value).y !== initialValue.y;
  const { result } = renderHook(
    () => {
      const form = useForm({
        initialValues: { a: { x: 1, y: 2, z: 3 } },
      });
      const a = useField({
        formId: form.formId,
        name: 'a',
        dirtyComparator,
      });
      return { form, a };
    },
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.a.value).toEqual({ x: 1, y: 2, z: 3 });
  });

  act(() => {
    result.current.form.setValues({ a: Promise.resolve({ x: 5, y: 6, z: 7 }) });
  });

  await waitFor(() => {
    expect(typeof result.current.a.value).toEqual('object');
  });

  await expectFormViaGetBag(result, {
    dirty: true,
    dirtyFieldIds: new Set(['a']),
  });

  act(() => {
    result.current.form.setValues({ a: Promise.resolve({ x: 5, y: 2, z: 7 }) });
  });

  await waitFor(() => {
    expect(typeof result.current.a.value).toEqual('object');
  });

  await expectFormViaGetBag(result, {
    dirty: false,
    dirtyFieldIds: new Set(),
  });
});

test('forms: validator that throws is converted to one that returns error', async () => {
  const validator = () => {
    throw new Error('fail');
  };
  const { result } = renderHook(
    () => {
      const form = useForm();
      const a = useField({
        formId: form.formId,
        name: 'a',
        validator,
      });
      return { form, a };
    },
    {
      wrapper,
    },
  );

  await waitFor(async () => {
    expect(result.current.a.inited).toBe(true);
  });

  const bag = await result.current.form.getBag();
  expect(bag.validation.isValid).toBe(false);
  expect(bag.validation.result[0]).toMatchObject({
    name: 'a',
    value: 'Error: fail',
  });
});

test('forms: manually added/removed field', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm();
      return { form };
    },
    {
      wrapper,
    },
  );

  await expectFormViaGetBag(result, {
    fieldIds: [],
  });

  act(() => {
    result.current.form.setValues({ a: 'foo' });
  });

  await expectFormViaGetBag(result, {
    fieldIds: [],
    values: {},
  });

  act(() => {
    result.current.form.addFields(['a']);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a'],
    values: { a: 'foo' },
  });

  act(() => {
    result.current.form.removeFields(['a']);
  });

  await expectFormViaGetBag(result, {
    fieldIds: [],
    values: {},
  });

  // id is added just once
  // and its value is preserved
  act(() => {
    result.current.form.addFields(['a']);
    result.current.form.addFields(['a']);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a'],
    values: { a: 'foo' },
  });
});

test('forms: manually added/removed nested field', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm({ formId: 'whatever' });
      return { form };
    },
    {
      wrapper,
    },
  );

  await expectFormViaGetBag(result, {
    fieldIds: [],
  });

  act(() => {
    result.current.form.setValues({ [createNestedName('a', 'b', 'c')]: 'foo' });
  });

  await expectFormViaGetBag(result, {
    fieldIds: [],
    values: {},
  });

  act(() => {
    result.current.form.addFields([createNestedName('a', 'b', 'c')]);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a'],
    values: { a: { b: { c: 'foo' } } },
  });

  act(() => {
    result.current.form.removeFields(['a']);
  });

  await expectFormViaGetBag(result, {
    fieldIds: [],
    values: {},
  });

  // id is added just once
  // and its value is preserved
  act(() => {
    result.current.form.addFields([createNestedName('a', 'b', 'c')]);
    result.current.form.addFields([createNestedName('a', 'b', 'c')]);
  });

  await expectFormViaGetBag(result, {
    fieldIds: ['a'],
    values: { a: { b: { c: 'foo' } } },
  });
});
