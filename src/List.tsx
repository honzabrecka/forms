import React, { useEffect } from 'react';
import { useSetRecoilState, useRecoilCallback } from 'recoil';
import useList, { UseListProps, UseListResult } from './useList';
import { $field, $fieldValue, fieldId } from './selectors';
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
  const resolvedFormId = useFormId(formId);
  const setFieldState = useSetRecoilState(
    $field(fieldId(resolvedFormId, name)),
  );
  const value = useFieldValueLoadable({ formId: resolvedFormId, name });
  const getBagForValidator = useGetBagForValidator(resolvedFormId);

  useEffect(() => {
    if (value.state === 'hasValue') {
      setFieldState((state) => ({
        ...state,
        validation: state.validator(value.contents),
      }));
    }
  }, [value]);

  const setValidator = useRecoilCallback(
    ({ set, snapshot }) =>
      (validator: NamedValidator) => {
        // do not await on value, validator can wait for it itself
        const value = snapshot.getPromise(
          $fieldValue(fieldId(resolvedFormId, name)),
        );
        set($field(fieldId(resolvedFormId, name)), (state) => ({
          ...state,
          validator,
          validation: validator(value),
        }));
      },
    [],
  );

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
    setValidator(wrappedValidator);
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
