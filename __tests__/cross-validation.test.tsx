import React, { useCallback } from 'react';
import { RecoilRoot } from 'recoil';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useForm,
  useField,
  useFieldValue,
  success,
  error,
  Validator,
} from '../src/index';

const wrapper = ({ children }: any) => <RecoilRoot>{children}</RecoilRoot>;

test('forms: cross field validation', async () => {
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

  await act(() => {
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

  await act(() => {
    result.current.form.setValues({ b: 'xyz' });
  });

  await waitFor(async () => {
    expect(result.current.b.value).toEqual('xyz');
  });

  await waitFor(async () => {
    console.log(result.current.av, result.current.bv);
    // console.log((await result.current.form.getBag()).validation);
    expect((await result.current.form.getBag()).validation).toMatchObject({
      isValid: true,
    });
  });

  await act(() => {
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

  await act(() => {
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
