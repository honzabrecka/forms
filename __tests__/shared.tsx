/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useState, useCallback, StrictMode } from 'react';
import {
  useField,
  UseFieldProps,
  useFormId,
  useFormIsSubmitting,
} from '../src/index';
import { Loadable, ValueLoadable } from '../src/minimalRecoil';

export const wrapper = ({ children }: any) => (
  <StrictMode>{children}</StrictMode>
);

export type FieldProps = {
  label: string;
} & UseFieldProps;

export const Field = ({ label, ...props }: FieldProps) => {
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
          value={value || ''}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
        />
      ) : null}
    </>
  );
};

export const LazyField = ({ label, ...props }: FieldProps) => {
  const { inited, onChange, onFocus, onBlur, name, id, value } =
    useField(props);
  const [state, setState] = useState<string>(value || '');
  const localOnBlur = useCallback(() => {
    onChange({ target: { value: state } });
    onBlur();
  }, [state, onChange, onBlur]);
  useEffect(() => {
    setState(value || '');
  }, [value]);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {inited ? (
        <input
          type="text"
          id={id}
          name={name}
          value={state}
          onChange={(event) => setState(event.target.value)}
          onBlur={localOnBlur}
          onFocus={onFocus}
        />
      ) : null}
    </>
  );
};

export const delay = (t: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), t);
  });

export const AsyncInput = ({
  value,
  onChange,
  onBlur,
  delayedResolve,
  ...props
}: any) => {
  const [state, setState] = useState(delayedResolve);

  useEffect(() => {
    setState(value);
  }, [value]);

  useEffect(() => {
    if (delayedResolve) {
      setState(delayedResolve);
      onChange(delay(250).then(() => delayedResolve));
      onBlur();
    }
  }, [delayedResolve]);

  return (
    <input
      // eslint-disable-next-line
      {...props}
      value={state || ''}
      onChange={({ target: { value } }) => setState(value)}
      onBlur={() => {
        onChange(delay(250).then(() => state));
        onBlur();
      }}
    />
  );
};

export type AsyncFieldProps = {
  delayedResolve?: string;
} & FieldProps;

export const AsyncField = ({
  label,
  delayedResolve,
  ...props
}: AsyncFieldProps) => {
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
          delayedResolve={delayedResolve}
        />
      ) : null}
    </>
  );
};

export const SubmitButton = ({ children }: any) => {
  const isSubmitting = useFormIsSubmitting(useFormId());
  return (
    <button disabled={isSubmitting} type="submit">
      {children}
    </button>
  );
};

export const identity = <T,>(x: T): T => x;

export const expectBag = (bag: any, expected: any) => {
  expect(bag).toHaveProperty('values');
  expect(bag).toHaveProperty('initialValues');
  expect(bag).toHaveProperty('fieldIds');
  expect(bag).toHaveProperty('validation');
  expect(bag).toHaveProperty('touched');
  expect(bag).toHaveProperty('touchedFieldIds');
  expect(bag).toHaveProperty('dirty');
  expect(bag).toHaveProperty('dirtyFieldIds');
  expect(bag).toMatchObject(expected);
};

export const expectFormViaGetBag = async (result: any, expected: any) =>
  expectBag(await result.current.form.getBag(), expected);

export const expectIsLoadableValue = <T,>(
  value: Loadable<T>,
): value is ValueLoadable<T> => {
  expect(value.state).toBe('hasValue');
  return value.state === 'hasValue';
};
