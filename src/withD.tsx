/* eslint-disable react/jsx-props-no-spreading */
import React, { useCallback } from 'react';
import { useFormId, useFieldValueLoadable } from './hooks';
import { success } from './validation';
import { Validator, ValidatorD } from './types';

type FieldDInnerProps = {
  formId?: string;
  dependsOn: string[];
  validator?: ValidatorD;
  Field: any; // TODO
};

const FieldDInner = ({
  Field,
  formId: formIdProp,
  dependsOn,
  validator,
  ...props
}: FieldDInnerProps) => {
  const formId = useFormId(formIdProp);
  const reactiveValues = dependsOn.map((name) =>
    useFieldValueLoadable({ formId, name }),
  );
  const reactiveValidator = useCallback<Validator>(
    (value, getBag) =>
      validator ? validator(value, getBag, reactiveValues) : success(),
    (reactiveValues as any).concat(validator),
  );
  return <Field {...props} validator={reactiveValidator} />;
};

type FieldDProps = {
  dependsOn?: string[];
  validator?: ValidatorD;
  name: string;
  label: string;
};

export default function withD(Field: any) {
  return function FieldWithD({ dependsOn = [], ...props }: FieldDProps) {
    return (
      <FieldDInner
        {...props}
        Field={Field}
        dependsOn={dependsOn}
        key={dependsOn.join('/')}
      />
    );
  };
}
