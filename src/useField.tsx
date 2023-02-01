import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  Loadable,
  useRecoilState,
  useRecoilValueLoadable,
  useResetRecoilState,
} from 'recoil';
import { fieldId, $field, $fieldValidation } from './selectors';
import { useFormId } from './hooks';
import {
  useGetBag,
  useGetBagForValidator,
  useFieldRegistration,
  useEventCallback,
  useWarnOnChanged,
  useCallbackInNextRender,
} from './internalHooks';
import { success, error } from './validation';
import {
  FieldValidationResult,
  NamedValidator,
  FromTransformer,
  ToTransformer,
  OnChangeEvent,
  UseFieldProps,
  UseFieldResult,
} from './types';

const isPromise = (value: any) =>
  value && typeof value === 'object' && typeof value.then === 'function';

export const emptyValidator = (/* value */) => Promise.resolve(success());

const noop = () => undefined;

const getEventTargetValue: FromTransformer = ({ target: { value } }) => value;
const identity: ToTransformer = <T,>(value: T): T => value;

export default function useField({
  name,
  formId: formIdProp,
  initialValue,
  // NOTE: should be memoized - when its ref changed -> revalidate
  validator = emptyValidator,
  validateOnMount = true,
  validateOnFocus = false,
  validateOnBlur = false,
  validateOnChange = true,
  onFocus: onFocusCb = noop,
  onBlur: onBlurCb = noop,
  onChange: onChangeCb = noop,
  onChangeImmediate = noop,
  from = getEventTargetValue,
  // NOTE: called only when value has changed
  to = identity,
  // NOTE: should be unchanged - used only when initializing, any other update has no effect
  dirtyComparator,
  preserveStateAfterUnmount = true,
}: UseFieldProps): UseFieldResult {
  const formId = useFormId(formIdProp);

  useWarnOnChanged('formId', formId);
  useWarnOnChanged('name', name);

  const onChangeImmediateStable = useEventCallback(onChangeImmediate);
  const fromStable = useEventCallback(from);
  const toStable = useEventCallback(to);

  const [inited, setInited] = useState(false);
  const [fieldState, setFieldState] = useRecoilState(
    $field(fieldId(formId, name)),
  );
  const reset = useResetRecoilState($field(fieldId(formId, name)));
  const validationResult: Loadable<FieldValidationResult> =
    useRecoilValueLoadable($fieldValidation(fieldId(formId, name)));
  const getBag = useGetBag(formId);
  const getBagForValidator = useGetBagForValidator(formId);
  const registration = useFieldRegistration(formId);

  const delayedOnFocus = useCallbackInNextRender(() =>
    onFocusCb({ name }, getBag),
  );

  const onFocus = useCallback(() => {
    if (validateOnFocus)
      setFieldState((state) => ({
        ...state,
        validation: state.validator(state.value),
      }));
    delayedOnFocus();
  }, [validateOnFocus]);

  const delayedOnBlur = useCallbackInNextRender(() =>
    onBlurCb({ name }, getBag),
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
      value = fromStable(value);
      setFieldState((state) => ({
        ...state,
        value,
        validation: validateOnChange
          ? state.validator(value)
          : state.validation,
      }));
      // onChangeImmediate is called at the same render,
      // so updated state is not available yet
      onChangeImmediateStable({ name, value });
      // while onChange is delayed for one render, so updated state is available
      delayedOnChange({ name, value });
    },
    [validateOnChange],
  );

  useEffect(() => {
    registration.add([name]);

    setFieldState((state) => ({
      ...state,
      inited: true,
      value: state.value === undefined ? initialValue : state.value,
      initialValue:
        state.initialValue === undefined ? initialValue : state.initialValue,
      dirtyComparator,
    }));

    setInited(true);

    return () => {
      if (!preserveStateAfterUnmount) {
        reset();
      }
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
    () => toStable(fieldState.value),
    [fieldState.value],
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
