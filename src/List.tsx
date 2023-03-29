import React, { useEffect } from 'react';
import { useSetRecoilState, useRecoilCallback } from './minimalRecoil';
import useList from './useList';
import { delay, $field, $fieldValue, fieldId } from './selectors';
import { useFieldValueLoadable, useFormId } from './hooks';
import { useGetBagForValidator } from './internalHooks';
import {
  FieldIdentification,
  Validator,
  NamedValidator,
  ListProps,
} from './types';
import { emptyValidator } from './useField';
import { error } from './validation';

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
  const value = useFieldValueLoadable({ formId: resolvedFormId, name }) as any;
  const getBagForValidator = useGetBagForValidator(resolvedFormId);

  useEffect(() => {
    if (value.state === 'hasValue') {
      setFieldState((state) => ({
        ...state,
        validation: state.validator(value.contents, state.meta),
      }));
    }
  }, [value]);

  const setValidator = useRecoilCallback(
    ({ set, snapshot }) =>
      (validator: NamedValidator) => {
        const value = snapshot
          .getLoadable($fieldValue(fieldId(resolvedFormId, name)))
          .valueMaybe();
        set($field(fieldId(resolvedFormId, name)), (state) => ({
          ...state,
          validator,
          validation: validator(value, state.meta),
        }));
      },
    [],
  );

  useEffect(() => {
    const wrappedValidator: NamedValidator = async (value, meta) => {
      try {
        await Promise.resolve(0);
        const result = await validator(value, getBagForValidator, meta);
        await delay(0); // to get fresh bag
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
