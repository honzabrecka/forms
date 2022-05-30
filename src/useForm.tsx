/* eslint-disable camelcase */
import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import {
  useRecoilTransaction_UNSTABLE,
  useRecoilCallback,
  useRecoilValueLoadable,
  useSetRecoilState,
} from 'recoil';
import {
  fieldId,
  $field,
  $form,
  $formSubmission,
  $allFieldIds,
  createNamedValidation,
} from './selectors';
import { useGetBag, useFieldRegistration } from './internalHooks';
import useWarnOnChanged from './useWarnOnChanged';
import {
  Dict,
  OnSubmitBag,
  SetValuesOptions,
  FormState,
  FieldState,
  ValidationResult,
  FieldType,
} from './types';
import uid from './uid';
import { FormContextProvider } from './FormContext';

export type OnSubmit = (bag: OnSubmitBag) => any;

export type UseFormProps = {
  formId?: string;
  onSubmit?: OnSubmit;
  onSubmitInvalid?: OnSubmit;
  initialValues?: Dict<any>;
  isValidProp?: 'isValid' | 'isValidStrict';
};

const onFieldTypeOnly =
  (f: (state: FieldState) => FieldState) => (state: FieldState) =>
    state.type === FieldType.field ? f(state) : state;

const dummyOnSubmit: OnSubmit = () => undefined;

const alwaysFalse = () => false;

export default function useForm({
  onSubmit = dummyOnSubmit,
  onSubmitInvalid = dummyOnSubmit,
  initialValues = {},
  isValidProp = 'isValid',
}: UseFormProps = {}) {
  const [formId] = useState<string>(() => `form/${uid()}`);

  useWarnOnChanged('formId', formId);

  const setForm = useSetRecoilState($form(formId));
  const isSubmitting = useRecoilValueLoadable($formSubmission(formId));

  const getBag = useGetBag(formId);
  const registration = useFieldRegistration(formId);

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
                        ? state.validator(value)
                        : state.validation,
                      initialValue: asInitialValues
                        ? value
                        : state.initialValue,
                    },
              );
            } else if (field.type === FieldType.map) {
              const newValues = Object.entries(value).reduce<Dict<any>>(
                (acc, [k, v]) => {
                  acc[`${id}.${k}`] = v;
                  return acc;
                },
                {},
              );
              updater(newValues);
            } else if (field.type === FieldType.list) {
              // unsupported
            }
          });
        };
        updater(values);
      },
    [],
  );

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
                  acc[`${id}.${k}`] = v;
                  return acc;
                },
                {},
              );
              updater(newValues);
            } else if (field.type === FieldType.list) {
              // unsupported
            }
          });
        };
        updater(values);
      },
    [],
  );

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
      async () => {
        const fieldIds = await snapshot.getPromise($allFieldIds(formId));
        transact_UNSTABLE(({ set }) => {
          fieldIds.forEach((id: string) =>
            set(
              $field(fieldId(formId, id)),
              onFieldTypeOnly((state) => ({
                ...state,
                touched: false,
                touchedAfterSubmit: false,
              })),
            ),
          );
        });
      },
    [],
  );

  const setAllToTouched = useRecoilCallback(
    ({ snapshot, transact_UNSTABLE }) =>
      async () => {
        const fieldIds = await snapshot.getPromise($allFieldIds(formId));
        transact_UNSTABLE(({ set }) => {
          fieldIds.forEach((id: string) =>
            set(
              $field(fieldId(formId, id)),
              onFieldTypeOnly((state) => ({
                ...state,
                touched: true,
                touchedAfterSubmit: true,
              })),
            ),
          );
        });
      },
    [],
  );

  const reset = useRecoilCallback(
    ({ snapshot, transact_UNSTABLE }) =>
      async () => {
        const fieldIds = await snapshot.getPromise($allFieldIds(formId));
        transact_UNSTABLE(({ set }) => {
          set($form(formId), (state: FormState) => ({
            ...state,
            submission: Promise.resolve(null),
          }));
          fieldIds.forEach((id: string) =>
            set(
              $field(fieldId(formId, id)),
              onFieldTypeOnly((state) => {
                const value = state.initialValue;
                return {
                  ...state,
                  value,
                  touched: false,
                  touchedAfterSubmit: false,
                  validation: state.validator(value),
                };
              }),
            ),
          );
        });
      },
    [],
  );

  const revalidate = useRecoilCallback(
    ({ snapshot, transact_UNSTABLE }) =>
      async (fieldIds: string[] = []) => {
        const fieldIdsToValidate =
          fieldIds.length > 0
            ? fieldIds
            : await snapshot.getPromise($allFieldIds(formId));
        transact_UNSTABLE(({ set }) => {
          fieldIdsToValidate.forEach((id: string) =>
            set(
              $field(fieldId(formId, id)),
              onFieldTypeOnly((state) => ({
                ...state,
                validation: state.validator(state.value),
              })),
            ),
          );
        });
      },
    [],
  );

  const clear = useRecoilCallback(
    ({ snapshot, transact_UNSTABLE }) =>
      async () => {
        const fieldIds = await snapshot.getPromise($allFieldIds(formId));
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

    const submit = async (...args: any[]) => {
      const bag = {
        ...(await getBag()),
        setValues,
        setErrors,
        setTouched,
        resetTouched,
        setAllToTouched,
        reset,
        clear,
        addFields,
        removeFields,
        args,
      };

      if (!bag.validation[isValidProp]) {
        setAllToTouched();
        await onSubmitInvalid(bag);
        return;
      }

      await onSubmit(bag);
    };

    const createSubmitPromise = (...args: any[]) => {
      const submission = submit(...args);
      setForm((state: FormState) => ({ ...state, submission }));
      return submission;
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
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
      clear,
      revalidate,
      getBag,
      isSubmitting: isSubmitting.state === 'loading',
      submit: createSubmitPromise,
      handleSubmit,
      addFields,
      removeFields,
    };

    const Form = ({ children }: { children: React.ReactNode }) => {
      return (
        <FormContextProvider form={form}>
          <form onSubmit={handleSubmit}>{children}</form>
        </FormContextProvider>
      );
    };

    return {
      ...form,
      Form,
    };
  }, [onSubmit, onSubmitInvalid, isValidProp]);
}
