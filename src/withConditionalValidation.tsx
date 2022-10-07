/* eslint-disable react/jsx-props-no-spreading */
import React, { useCallback } from 'react';
import { useFormId, useFieldValueLoadable } from './hooks';
import { success } from './validation';
import { Validator, ConditionalValidator } from './types';

type FieldWithConditionalValidationInnerProps<P extends object> = {
  formId?: string;
  Field: React.ComponentType<P>;
  validatorDependsOn: string[];
  validator?: Validator | ConditionalValidator;
};

type FieldWithConditionalValidationProps = {
  validator?: Validator | ConditionalValidator;
  validatorDependsOn?: string[];
};

const FieldWithConditionalValidationInner = <P extends object>({
  Field,
  formId: formIdProp,
  validatorDependsOn,
  validator,
  ...props
}: FieldWithConditionalValidationInnerProps<P>) => {
  const formId = useFormId(formIdProp);
  const reactiveValues = validatorDependsOn.map((name) =>
    useFieldValueLoadable({ formId, name }),
  );
  const reactiveValidator = useCallback<Validator>(async (value, getBag) => {
    if (!validator) return success();
    if (validator.length === 2) return (validator as Validator)(value, getBag);
    return (validator as ConditionalValidator)(
      value,
      getBag,
      await Promise.all(reactiveValues.map((x) => x.toPromise())),
    );
  }, (reactiveValues as any).concat(validator));
  return <Field {...(props as P)} validator={reactiveValidator} />;
};

export default function withConditionalValidation<
  P extends { validator?: Validator },
>(Field: React.ComponentType<P>) {
  return function FieldWithConditionalValidationHOC({
    validatorDependsOn = [],
    ...props
  }: Omit<P, 'validator'> & FieldWithConditionalValidationProps) {
    return (
      <FieldWithConditionalValidationInner
        {...props}
        Field={Field}
        validatorDependsOn={validatorDependsOn}
        key={validatorDependsOn.join('/')}
      />
    );
  };
}
