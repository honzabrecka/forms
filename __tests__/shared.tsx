/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useState, StrictMode } from 'react';
import { RecoilRoot, useField, UseFieldProps } from '../src/index';

export const wrapper = ({ children }: any) => (
  <StrictMode>
    <RecoilRoot>{children}</RecoilRoot>
  </StrictMode>
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
  const [state, setState] = useState(delayedResolve || '');

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
      value={state}
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

export const identity = <T,>(x: T): T => x;

export const expectFormBag = (bag: any, expected: any) => {
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
