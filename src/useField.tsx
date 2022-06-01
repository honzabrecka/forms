import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  Loadable,
  useRecoilCallback,
  useRecoilState,
  useRecoilValueLoadable,
} from 'recoil';
import { fieldId, $field, $fieldValidation } from './selectors';
import { useFormId } from './hooks';
import {
  useGetBag,
  useGetBagForValidator,
  useFieldRegistration,
} from './internalHooks';
import useCallbackInNextRender from './useCallbackInNextRender';
import useWarnOnChanged from './useWarnOnChanged';
import { success, error } from './validation';
import {
  Callback1,
  Callback2,
  DirtyComparator,
  FieldValidationResult,
  GetBag,
  NamedValidator,
  Validator,
} from './types';

const isPromise = (value: any) =>
  value && typeof value === 'object' && typeof value.then === 'function';

export const emptyValidator = (/* value */) => Promise.resolve(success());

export type ExportTransformer = (value: any) => any;
export type ImportTransformer = (value: any) => any;

const defaultFrom: ExportTransformer = ({ target: { value } }) => value;
const defaultTo: ImportTransformer = <T,>(value: T): T => value;

export type OnFocus = Callback2<{ name: string }, GetBag>;
export type OnBlur = Callback2<{ name: string }, GetBag>;
export type OnChangeEvent = { name: string; value: any };
export type OnChange = Callback2<OnChangeEvent, GetBag>;
export type OnChangeImmediate = Callback1<OnChangeEvent>;

type UseFieldProps = {
  name: string;
  formId?: string;
  initialValue?: any;
  validator?: Validator;
  validateOnMount?: boolean;
  validateOnFocus?: boolean;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  onFocus?: OnFocus;
  onBlur?: OnBlur;
  onChange?: OnChange;
  onChangeImmediate?: OnChangeImmediate;
  from?: ExportTransformer;
  to?: ImportTransformer;
  required?: boolean;
  dirtyComparator?: DirtyComparator;
  preserveStateAfterUnmount?: boolean;
};

export type UseFieldResult = {
  formId: string;
  touched: boolean;
  inited: boolean;
  onChange: (value: any) => void;
  onFocus: () => void;
  onBlur: () => void;
  name: string;
  id: string;
  value: any;
  initialValue?: any;
  dirtyComparator?: DirtyComparator;
  validator: NamedValidator;
  validation: Promise<FieldValidationResult>;
  validationResult: Loadable<FieldValidationResult>;
};

export default function useField({
  name,
  formId: formIdProp,
  initialValue,
  validator = emptyValidator,
  validateOnMount = true,
  validateOnFocus = false,
  validateOnBlur = false,
  validateOnChange = true,
  onFocus: onFocusCb,
  onBlur: onBlurCb,
  onChange: onChangeCb,
  onChangeImmediate,
  from = defaultFrom,
  to = defaultTo,
  dirtyComparator,
  preserveStateAfterUnmount = false,
}: UseFieldProps): UseFieldResult {
  const formId = useFormId(formIdProp);

  useWarnOnChanged('formId', formId);
  useWarnOnChanged('name', name);

  const [inited, setInited] = useState(false);
  const [fieldState, setFieldState] = useRecoilState(
    $field(fieldId(formId, name)),
  );
  const validationResult: Loadable<FieldValidationResult> =
    useRecoilValueLoadable($fieldValidation(fieldId(formId, name)));
  const getBag = useGetBag(formId);
  const getBagForValidator = useGetBagForValidator(formId);
  const registration = useFieldRegistration(formId);

  const delayedOnFocus = useCallbackInNextRender(
    () => onFocusCb && onFocusCb({ name }, getBag),
  );

  const onFocus = useCallback(() => {
    if (validateOnFocus)
      setFieldState((state) => ({
        ...state,
        validation: state.validator(state.value),
      }));
    delayedOnFocus();
  }, [validateOnFocus]);

  const delayedOnBlur = useCallbackInNextRender(
    () => onBlurCb && onBlurCb({ name }, getBag),
  );

  const onBlur = useCallback(() => {
    setFieldState((state) => ({
      ...state,
      touched: true,
      validation: validateOnBlur
        ? state.validator(state.value)
        : state.validation,
    }));
    delayedOnBlur();
  }, [validateOnBlur]);

  const delayedOnChange = useCallbackInNextRender(
    async ({ name, value }: OnChangeEvent) =>
      onChangeCb &&
      onChangeCb(
        {
          name,
          value: isPromise(value) ? await value : value,
        },
        getBag,
      ),
  );

  const onChange = useCallback(
    (value: any) => {
      value = from(value);
      setFieldState((state) => ({
        ...state,
        value,
        validation: validateOnChange
          ? state.validator(value)
          : state.validation,
      }));
      // onChangeImmediate is called at the same render,
      // so updated state is not available yet
      if (onChangeImmediate) onChangeImmediate({ name, value });
      // while onChange is delayed for one render, so updated state is available
      delayedOnChange({ name, value });
    },
    [from, onChangeImmediate, validateOnChange],
  );

  const reset = useRecoilCallback(
    ({ reset }) =>
      () => {
        reset($field(fieldId(formId, name)));
      },
    [],
  );

  useEffect(() => {
    registration.add([name]);

    setFieldState((state) => ({
      ...state,
      inited: true,
      value:
        state.value === undefined && initialValue !== undefined
          ? initialValue
          : state.value,
      initialValue:
        state.initialValue === undefined && initialValue !== undefined
          ? initialValue
          : state.initialValue,
      dirtyComparator,
    }));

    setInited(true);

    return () => {
      if (preserveStateAfterUnmount) {
        return;
      }

      reset();
      registration.remove([name]);
    };
  }, []);

  useEffect(() => {
    setFieldState((state) => {
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
      return {
        ...state,
        validator: wrappedValidator,
        validation:
          // validation runs conditionally on mount
          // or when validator is changed during field's life
          (!inited && validateOnMount) || inited
            ? wrappedValidator(state.value)
            : state.validation,
      };
    });
  }, [validator]);

  const transformedValue = useMemo(
    () => to(fieldState.value),
    [to, fieldState.value],
  );

  return {
    ...fieldState,
    inited,
    value: transformedValue,
    validationResult,
    onFocus,
    onBlur,
    onChange,
  };
}
