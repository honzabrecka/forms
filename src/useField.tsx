import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  // Loadable,
  useRecoilState,
  useRecoilValueLoadable,
} from './minimalRecoil';
import {
  fieldId,
  $field,
  $fieldValidation,
  oneTickToGetFreshData,
} from './selectors';
import { useFormId } from './hooks';
import {
  useGetBag,
  useGetBagForValidator,
  useFieldRegistration,
  useEventCallback,
  useWarnOnChanged,
} from './internalHooks';
import { success, error } from './validation';
import {
  // FieldValidationResult,
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
  from = getEventTargetValue,
  // NOTE: called only when value has changed
  to = identity,
  // NOTE: should be unchanged - used only when initializing, any other update has no effect
  dirtyComparator,
}: UseFieldProps): UseFieldResult {
  const formId = useFormId(formIdProp);

  useWarnOnChanged('formId', formId);
  useWarnOnChanged('name', name);

  const fromStable = useEventCallback(from);
  const toStable = useEventCallback(to);

  const [inited, setInited] = useState(false);
  const [fieldState, setFieldState] = useRecoilState(
    $field(fieldId(formId, name)),
  );
  const validationResult = useRecoilValueLoadable(
    $fieldValidation(fieldId(formId, name)),
  );
  const getBag = useGetBag(formId);
  const getBagForValidator = useGetBagForValidator(formId);
  const registration = useFieldRegistration(formId);

  const onFocusStable = useEventCallback(() => onFocusCb({ name }, getBag));

  const onFocus = useCallback(() => {
    if (validateOnFocus)
      setFieldState((state) => ({
        ...state,
        validation: state.validator(state.value, state.meta),
      }));
    onFocusStable();
  }, [validateOnFocus]);

  const onBlurStable = useEventCallback(() => onBlurCb({ name }, getBag));

  const onBlur = useCallback(() => {
    setFieldState((state) => ({
      ...state,
      touched: true,
      validation: validateOnBlur
        ? state.validator(state.value, state.meta)
        : state.validation,
    }));
    onBlurStable();
  }, [validateOnBlur]);

  const onChangeStable = useEventCallback(
    async ({ name, value, meta }: OnChangeEvent) =>
      onChangeCb(
        {
          name,
          value: isPromise(value) ? await value : value,
          meta: isPromise(meta) ? await meta : meta,
        },
        getBag,
      ),
  );

  const onChange = useCallback(
    (value: any, meta: any) => {
      value = fromStable(value);
      setFieldState((state) => ({
        ...state,
        value,
        meta,
        validation: validateOnChange
          ? state.validator(value, meta)
          : state.validation,
      }));
      onChangeStable({ name, value, meta });
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
      registration.remove([name]);
    };
  }, []);

  useEffect(() => {
    setFieldState((state) => {
      const wrappedValidator: NamedValidator = async (value, meta) => {
        try {
          await oneTickToGetFreshData();
          const result = await validator(value, getBagForValidator, meta);
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
            ? wrappedValidator(state.value, state.meta)
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
