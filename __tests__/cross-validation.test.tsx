import { useCallback } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { wrapper } from './shared';
import {
  useForm,
  useField,
  useFieldValue,
  success,
  error,
  Validator,
  useRefreshableValidator,
} from '../src/index';

test('static cross field validation', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm();
      const av = useFieldValue({ formId: form.formId, name: 'a' });
      const bv = useFieldValue({ formId: form.formId, name: 'b' });
      const validatorA = useCallback<Validator>(
        (value) => (value === bv ? success() : error('do not match')),
        [bv],
      );
      const validatorB = useCallback<Validator>(
        (value) => (value === av ? success() : error('do not match')),
        [av],
      );
      const a = useField({
        formId: form.formId,
        name: 'a',
        validator: validatorA,
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
        validator: validatorB,
      });
      return { form, a, b, av, bv };
    },
    { wrapper },
  );

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: true,
    });
  });

  act(() => {
    result.current.form.setValues({ a: 'xyz' });
  });

  await waitFor(async () => {
    expect(result.current.a.value).toEqual('xyz');
  });

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: false,
    });
  });

  act(() => {
    result.current.form.setValues({ b: 'xyz' });
  });

  await waitFor(async () => {
    expect(result.current.b.value).toEqual('xyz');
  });

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: true,
    });
  });

  act(() => {
    result.current.form.setValues({ b: '123' });
  });

  await waitFor(async () => {
    expect(result.current.b.value).toEqual('123');
  });

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: false,
    });
  });

  act(() => {
    result.current.form.setValues({ a: '123' });
  });

  await waitFor(async () => {
    expect(result.current.a.value).toEqual('123');
  });

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: true,
    });
  });
});

test('dynamic cross field validation', async () => {
  const { result } = renderHook(
    () => {
      const form = useForm();
      const [validator, revalidate] = useRefreshableValidator(
        async (_, getBag) => {
          const { values } = await getBag();
          return values.a === values.b ? success() : error('do not match');
        },
      );
      const a = useField({
        formId: form.formId,
        name: 'a',
        validator,
        onChange: revalidate,
      });
      const b = useField({
        formId: form.formId,
        name: 'b',
        validator,
        onChange: revalidate,
      });
      return { form, a, b, revalidate };
    },
    { wrapper },
  );

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: true,
    });
  });

  act(() => {
    result.current.form.setValues({ a: 'xyz' });
    result.current.revalidate();
  });

  await waitFor(async () => {
    expect(result.current.a.value).toEqual('xyz');
  });

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: false,
    });
  });

  act(() => {
    result.current.form.setValues({ b: 'xyz' });
    result.current.revalidate();
  });

  await waitFor(async () => {
    expect(result.current.b.value).toEqual('xyz');
  });

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: true,
    });
  });

  act(() => {
    result.current.form.setValues({ b: '123' });
    result.current.revalidate();
  });

  await waitFor(async () => {
    expect(result.current.b.value).toEqual('123');
  });

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: false,
    });
  });

  act(() => {
    result.current.form.setValues({ a: '123' });
    result.current.revalidate();
  });

  await waitFor(async () => {
    expect(result.current.a.value).toEqual('123');
  });

  await waitFor(async () => {
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: true,
    });
  });
});
