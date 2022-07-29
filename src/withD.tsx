/* eslint-disable react/jsx-props-no-spreading */
import React, { useCallback } from 'react';
import { useFormId, useFieldValueLoadable } from './hooks';
import { success } from './validation';
import { Validator, ValidatorD } from './types';

type FieldDProps = {
  validator?: ValidatorD;
  validatorDependsOn?: string[];
};

type FieldDInnerProps = {
  formId?: string;
  Field: any; // TODO
  validatorDependsOn: string[];
  validator?: ValidatorD;
};

const FieldDInner = ({
  Field,
  formId: formIdProp,
  validatorDependsOn,
  validator,
  ...props
}: FieldDInnerProps) => {
  const formId = useFormId(formIdProp);
  const reactiveValues = validatorDependsOn.map((name) =>
    useFieldValueLoadable({ formId, name }),
  );
  const reactiveValidator = useCallback<Validator>(
    async (value, getBag) =>
      validator
        ? validator(
            value,
            getBag,
            await Promise.all(reactiveValues.map((x) => x.toPromise())),
          )
        : success(),
    (reactiveValues as any).concat(validator),
  );
  return <Field {...props} validator={reactiveValidator} />;
};

export default function withD<P extends object>(Field: React.ComponentType<P>) {
  return function FieldWithD({
    validatorDependsOn = [],
    ...props
  }: Omit<P, 'validator'> & FieldDProps) {
    return (
      <FieldDInner
        {...props}
        Field={Field}
        validatorDependsOn={validatorDependsOn}
        key={validatorDependsOn.join('/')}
      />
    );
  };
}
