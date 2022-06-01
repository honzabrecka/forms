import React, { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import useList, { UseListProps, UseListResult } from './useList';
import { $field, fieldId } from './selectors';
import { useFieldValueLoadable, useFormId } from './hooks';
import { useGetBagForValidator } from './internalHooks';
import { FieldIdentification, Validator, NamedValidator } from './types';
import { emptyValidator } from './useField';
import { error } from './validation';

export type ListProps = UseListProps & {
  children: (list: UseListResult) => JSX.Element;
  validator?: Validator;
};

type ReactiveValdiatorProps = FieldIdentification & {
  validator: Validator;
};

const ReactiveValidator = ({
  formId,
  name,
  validator,
}: ReactiveValdiatorProps) => {
  const setFieldState = useSetRecoilState(
    $field(fieldId(useFormId(formId), name)),
  );
  const value = useFieldValueLoadable({ formId, name });
  const getBagForValidator = useGetBagForValidator(useFormId(formId));

  useEffect(() => {
    if (value.state === 'hasValue') {
      setFieldState((state) => ({
        ...state,
        validation: state.validator(value.contents),
      }));
    }
  }, [value]);

  useEffect(() => {
    const wrappedValidator: NamedValidator = async (value) => {
      try {
        const result = await validator(value, getBagForValidator);
        return {
          name,
          ...result,
        };
      } catch (err) {
        return {
          name,
          ...error(`${err}`),
        };
      }
    };
    setFieldState((state) => ({
      ...state,
      validator: wrappedValidator,
      // TODO async value might not be ready yet
      validation: wrappedValidator(value.contents),
    }));
  }, [validator]);

  return null;
};

const List = ({ children, validator = emptyValidator, ...rest }: ListProps) => {
  const { formId, name } = rest;
  return (
    <>
      <ReactiveValidator formId={formId} name={name} validator={validator} />
      {children(useList(rest))}
    </>
  );
};

export default List;
