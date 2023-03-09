/* eslint-disable camelcase */
import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import {
  useRecoilTransaction_UNSTABLE,
  useRecoilCallback,
  useSetRecoilState,
} from './recoilOrMinimalRecoil';
import {
  fieldId,
  $field,
  $fieldValue,
  $form,
  $allFieldIds,
  createNamedValidation,
  delay,
  defaultReadyDelayTimeout,
} from './selectors';
import {
  useGetBag,
  useFieldRegistration,
  useEventCallback,
  useWarnOnChanged,
} from './internalHooks';
import {
  Dict,
  UseFormProps,
  SetValuesOptions,
  FormState,
  FieldState,
  ValidationResult,
  FieldType,
} from './types';
import uid from './uid';
import { FormContextProvider } from './FormContext';
import { createNestedName } from './nested';
import { error } from './validation';
import OnFormReady from './OnFormReady';

const onFieldTypeOnly =
  (f: (state: FieldState) => FieldState) => (state: FieldState) =>
    state.type === FieldType.field ? f(state) : state;

const noop = () => undefined;

const alwaysFalse = () => false;

export default function useForm({
  onSubmit = noop,
  onSubmitInvalid = noop,
  onReady = noop,
  initialValues = {},
  isValidProp = 'isValid',
  errorBannerMessage = null,
}: UseFormProps = {}) {
  const [formId] = useState<string>(() => `form/${uid()}`);

  useWarnOnChanged('formId', formId);

  const setForm = useSetRecoilState($form(formId));

  const getBag = useGetBag(formId);
  const registration = useFieldRegistration(formId);

  const onSubmitStable = useEventCallback(onSubmit);
  const onSubmitInvalidStable = useEventCallback(onSubmitInvalid);

  // NOTE: can cause memory leaks as it can set any field,
  // but only those registered to form are getting cleared
  const setValues = useRecoilTransaction_UNSTABLE(
    ({ get, set }) =>
      (
        values: Dict<any>,
        {
          validate = true,
          equal = alwaysFalse,
          // for optimization: setValues(v) + setInitialValues(v) => setValues(v, { asInitialValues })
          asInitialValues = false,
        }: SetValuesOptions = {},
      ) => {
        const updater = (values: Dict<any>) => {
          Object.keys(values).forEach((id) => {
            const atom = $field(fieldId(formId, id));
            const field = get(atom);
            const value = values[id];

            if (field.type === FieldType.field) {
              set(atom, (state) =>
                equal(state.value, value)
                  ? state
                  : {
                      ...state,
                      value,
                      validation: validate
                        ? state.validator(value, state.meta)
                        : state.validation,
                      initialValue: asInitialValues
                        ? value
                        : state.initialValue,
                    },
              );
            } else if (field.type === FieldType.map) {
              const newValues = Object.entries(value).reduce<Dict<any>>(
                (acc, [k, v]) => {
                  acc[createNestedName(id, k)] = v;
                  return acc;
                },
                {},
              );
              updater(newValues);
            } else if (field.type === FieldType.list) {
              throw new Error(
                `setValues: unsupported operation: [${id}] is list`,
              );
            }
          });
        };
        updater(values);
      },
    [],
  );

  // NOTE: can cause memory leaks as it can set any field,
  // but only those registered to form are getting cleared
  const setInitialValues = useRecoilTransaction_UNSTABLE(
    ({ get, set }) =>
      (values: Dict<any>) => {
        const updater = (values: Dict<any>) => {
          Object.keys(values).forEach((id) => {
            const atom = $field(fieldId(formId, id));
            const field = get(atom);
            const value = values[id];

            if (field.type === FieldType.field) {
              set(atom, (state) => ({
                ...state,
                initialValue: value,
              }));
            } else if (field.type === FieldType.map) {
              const newValues = Object.entries(value).reduce<Dict<any>>(
                (acc, [k, v]) => {
                  acc[createNestedName(id, k)] = v;
                  return acc;
                },
                {},
              );
              updater(newValues);
            } else if (field.type === FieldType.list) {
              throw new Error(
                `setValues: unsupported operation: [${id}] is list`,
              );
            }
          });
        };
        updater(values);
      },
    [],
  );

  // NOTE: can cause memory leaks as it can set any field,
  // but only those registered to form are getting cleared
  const setErrors = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      (errors: Dict<ValidationResult>) => {
        Object.keys(errors).forEach((name) => {
          set($field(fieldId(formId, name)), (state) => ({
            ...state,
            validation: createNamedValidation(name, errors[name]),
          }));
        });
      },
    [],
  );

  // NOTE: can cause memory leaks as it can set any field,
  // but only those registered to form are getting cleared
  const setTouched = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      (touched: Dict<boolean>) => {
        Object.keys(touched).forEach((id) =>
          set(
            $field(fieldId(formId, id)),
            onFieldTypeOnly((state) => ({
              ...state,
              touched: touched[id] as boolean,
            })),
          ),
        );
      },
    [],
  );

  const resetTouched = useRecoilCallback(
    ({ snapshot, transact_UNSTABLE }) =>
      () => {
        const fieldIds = snapshot.getLoadable($allFieldIds(formId)).contents;
        transact_UNSTABLE(({ set }) => {
          fieldIds.forEach((id: string) =>
            set(
              $field(fieldId(formId, id)),
              onFieldTypeOnly((state) => ({
                ...state,
                touched: false,
              })),
            ),
          );
        });
      },
    [],
  );

  const setAllToTouched = useRecoilCallback(
    ({ snapshot, transact_UNSTABLE }) =>
      () => {
        const fieldIds = snapshot.getLoadable($allFieldIds(formId)).contents;
        transact_UNSTABLE(({ set }) => {
          fieldIds.forEach((id: string) =>
            set(
              $field(fieldId(formId, id)),
              onFieldTypeOnly((state) => ({
                ...state,
                touched: true,
              })),
            ),
          );
        });
      },
    [],
  );

  // NOTE: can cause memory leaks as it can set any field,
  // but only those registered to form are getting cleared
  const resetFields = useRecoilCallback(
    ({ snapshot, transact_UNSTABLE }) =>
      (fieldIds: string[]) => {
        const fieldIdsToReset =
          fieldIds.length > 0
            ? fieldIds
            : snapshot.getLoadable($allFieldIds(formId)).contents;
        transact_UNSTABLE(({ set }) => {
          fieldIdsToReset.forEach((id: string) =>
            set(
              $field(fieldId(formId, id)),
              onFieldTypeOnly((state) => {
                const value = state.initialValue;
                console.log('>>', state);
                return {
                  ...state,
                  value,
                  touched: false,
                  validation: state.validator(value, undefined),
                };
              }),
            ),
          );
        });
      },
    [],
  );

  // NOTE: can cause memory leaks as it can set any field,
  // but only those registered to form are getting cleared
  const revalidate = useRecoilCallback(
    ({ snapshot, set }) =>
      (fieldIds: string[] = []) => {
        const fieldIdsToValidate =
          fieldIds.length > 0
            ? fieldIds
            : snapshot.getLoadable($allFieldIds(formId)).contents;
        fieldIdsToValidate.forEach((id: string) =>
          set($field(fieldId(formId, id)), (state) => {
            if (state.type === FieldType.field) {
              return {
                ...state,
                validation: state.validator(state.value, state.meta),
              };
            }
            if (state.type === FieldType.list) {
              return {
                ...state,
                validation: state.validator(
                  snapshot.getPromise($fieldValue(fieldId(formId, id))),
                  state.meta,
                ),
              };
            }
            return state;
          }),
        );
      },
    [],
  );

  const clear = useRecoilCallback(
    ({ snapshot, transact_UNSTABLE }) =>
      () => {
        const fieldIds = snapshot.getLoadable($allFieldIds(formId)).contents;
        transact_UNSTABLE(({ reset }) => {
          reset($form(formId));
          fieldIds.forEach((id: string) => reset($field(fieldId(formId, id))));
        });
      },
    [],
  );

  useEffect(() => {
    setValues(initialValues, { asInitialValues: true });
    return () => {
      clear();
    };
  }, []);

  return useMemo(() => {
    const addFields = (names: string[]) => {
      registration.add(names);
    };

    const removeFields = (names: string[]) => {
      registration.remove(names);
    };

    const handleDependentFields = (
      requiredInNextStep: string[],
      namesToRemove: string[],
      errorValue = 'not ready',
    ) => {
      removeFields(namesToRemove);
      if (requiredInNextStep.length > 0) {
        addFields(requiredInNextStep);
        resetFields(requiredInNextStep);
        setErrors(
          requiredInNextStep.reduce<Dict<ValidationResult>>((acc, name) => {
            acc[name] = error(errorValue);
            return acc;
          }, {}),
        );
      }
    };

    // NOTE: can cause memory leaks as it can set any field,
    // but only those registered to form are getting cleared
    const reset = (fieldIds: string[] = []) => {
      setForm((state: FormState) => ({
        ...state,
        submission: Promise.resolve(null),
        readyDelayKey: state.readyDelayKey + 1,
        readyDelay: delay(defaultReadyDelayTimeout),
      }));
      resetFields(fieldIds);
    };

    const setErrorBannerMessage = (message: string | null) => {
      setForm((state: FormState) => ({
        ...state,
        errorBannerMessage: message,
      }));
    };

    const submit = async (...args: any[]) => {
      const bag = {
        ...(await getBag()),
        setValues,
        setErrors,
        setTouched,
        resetTouched,
        setAllToTouched,
        reset,
        resetFields,
        clear,
        addFields,
        removeFields,
        handleDependentFields,
        setErrorBannerMessage,
        args,
      };

      try {
        if (bag.validation[isValidProp]) {
          await onSubmitStable(bag);
        } else {
          setAllToTouched();
          setErrorBannerMessage(errorBannerMessage);
          await onSubmitInvalidStable(bag);
        }
      } catch (error) {
        // ignore
      }

      await delay(500); // to prevent double submit

      return bag.validation;
    };

    const createSubmitPromise = (...args: any[]) => {
      const submission = submit(...args);
      setForm((state: FormState) => ({
        ...state,
        errorBannerMessage: null,
        submission,
      }));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      createSubmitPromise(event);
    };

    const form = {
      formId,
      setValues,
      setInitialValues,
      setErrors,
      setTouched,
      resetTouched,
      setAllToTouched,
      reset,
      resetFields,
      revalidate,
      clear,
      getBag,
      submit: createSubmitPromise,
      handleSubmit,
      addFields,
      removeFields,
      handleDependentFields,
      setErrorBannerMessage,
    };

    const Form = ({ children }: { children: React.ReactNode }) => {
      return (
        <FormContextProvider form={form}>
          <form onSubmit={handleSubmit}>
            <OnFormReady cb={() => onReady(form)} />
            {children}
          </form>
        </FormContextProvider>
      );
    };

    return {
      ...form,
      Form,
    };
  }, [isValidProp]);
}
