import { atomFamily, selectorFamily, waitForAll } from 'recoil';
import { success, multi, isError, isWarning } from './validation';
import {
  Dict,
  FieldValidationResult,
  FieldState,
  FormState,
  FormSubmission,
  FormValidationResult,
  ValidationResult,
  FieldType,
} from './types';
import { nestedFieldSeparator } from './nested';

const last = <T>(xs: T[]) => xs[xs.length - 1];

export const delay = (t: number) =>
  new Promise((res) => {
    setTimeout(res, t);
  });

export const createNamedValidation = (
  name: string,
  result: ValidationResult,
): Promise<FieldValidationResult> => Promise.resolve({ name, ...result });

export const fieldId = (formId: string, name: string) => `${formId}:${name}`;

export const defaultReadyDelayTimeout = 100;

export const $form = atomFamily<FormState, string>({
  key: `form`,
  default: (id: string) => ({
    id,
    fieldIds: [],
    submission: Promise.resolve(null),
    readyDelayKey: 0,
    readyDelay: delay(defaultReadyDelayTimeout),
  }),
});

export const $formSubmission = selectorFamily<FormSubmission, string>({
  key: 'form/submission',
  get:
    (id) =>
    ({ get }) =>
      get($form(id)).submission,
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $field = atomFamily<FieldState, string>({
  key: 'form_field',
  default: (id) => {
    const [formId, name] = id.split(':');
    const validationResult = createNamedValidation(name, success());
    return {
      id,
      formId,
      type: FieldType.field,
      name,
      children: [],
      value: undefined,
      meta: undefined,
      initialValue: undefined,
      dirtyComparator: undefined,
      touched: false,
      validation: validationResult,
      validator: (/* value */) => validationResult,
    };
  },
});

export const $fieldChildren = selectorFamily<string[], string>({
  key: 'form_field/children',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));

      if (field.type === FieldType.field) {
        return [];
      }

      const result: string[] = get(
        waitForAll(
          field.children.map((id) => $fieldChildren(fieldId(field.formId, id))),
        ) as any,
      );
      return field.children.concat(...result);
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $fieldValue = selectorFamily<any, string>({
  key: 'form_field/value',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.list) {
        const result: any[] = get(
          waitForAll(
            field.children.map((id) => $fieldValue(fieldId(field.formId, id))),
          ),
        );
        return result;
      }
      if (field.type === FieldType.map) {
        const result: any[] = get(
          waitForAll(
            field.children.map((id) => $fieldValue(fieldId(field.formId, id))),
          ),
        );
        return result.reduce<Dict<any>>((acc, value, i) => {
          const id = last(
            field.children[i].split(nestedFieldSeparator),
          ) as string;
          acc[id] = value;
          return acc;
        }, {});
      }
      return field.value;
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $fieldInitialValue = selectorFamily<any, string>({
  key: 'form_field/initialValue',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.map) {
        const result: any[] = get(
          waitForAll(
            field.children.map((id) =>
              $fieldInitialValue(fieldId(field.formId, id)),
            ),
          ),
        );
        return result.reduce<any>((acc, value, i) => {
          const id = last(
            field.children[i].split(nestedFieldSeparator),
          ) as string;
          acc[id] = value;
          return acc;
        }, {});
      }
      return field.initialValue;
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $fieldValidation = selectorFamily<FieldValidationResult, string>({
  key: 'form_field/validation',
  get:
    (id: string) =>
    async ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.map) {
        const result: FieldValidationResult[] = get(
          waitForAll(
            field.children.map((id) =>
              $fieldValidation(fieldId(field.formId, id)),
            ),
          ),
        );
        return { ...multi(result), name: field.name };
      }
      if (field.type === FieldType.list) {
        const result: FieldValidationResult[] = get(
          waitForAll(
            field.children.map((id) =>
              $fieldValidation(fieldId(field.formId, id)),
            ),
          ),
        );
        return {
          ...multi([await field.validation, ...result]),
          name: field.name,
        };
      }
      return field.validation;
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $formValidation = selectorFamily<FormValidationResult, string>({
  key: 'form/validation',
  get:
    (formId: string) =>
    ({ get }) => {
      const { fieldIds } = get($form(formId));
      const result: FieldValidationResult[] = get(
        waitForAll(fieldIds.map((id) => $fieldValidation(fieldId(formId, id)))),
      );
      const errors = result.filter(isError);
      const warnings = result.filter(isWarning);
      return {
        isValid: errors.length === 0,
        isValidStrict: errors.length === 0 && warnings.length === 0,
        errors,
        warnings,
        result,
      };
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $fields = selectorFamily({
  key: 'form/fields',
  get:
    (formId: string) =>
    ({ get }) => {
      const { fieldIds } = get($form(formId));
      return fieldIds.map((id) => get($field(fieldId(formId, id))));
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $values = selectorFamily<any, string>({
  key: 'form/values',
  get:
    (formId: string) =>
    ({ get }) => {
      const { fieldIds } = get($form(formId));
      const values = get(
        waitForAll(
          fieldIds.reduce<Dict<any>>((acc, id) => {
            acc[id] = $fieldValue(fieldId(formId, id));
            return acc;
          }, {}),
        ),
      );
      return values;
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $initialValues = selectorFamily<any, string>({
  key: 'form/initialValues',
  get:
    (formId: string) =>
    ({ get }) => {
      const { fieldIds } = get($form(formId));
      const values = get(
        waitForAll(
          fieldIds.reduce<Dict<any>>((acc, id) => {
            acc[id] = $fieldInitialValue(fieldId(formId, id));
            return acc;
          }, {}),
        ),
      );
      return values;
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $fieldTouched = selectorFamily<boolean, string>({
  key: 'form_field/touched',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.map) {
        const result: boolean[] = get(
          waitForAll(
            field.children.map((id) =>
              $fieldTouched(fieldId(field.formId, id)),
            ),
          ),
        );
        return result.reduce((acc: boolean, x: boolean) => acc || x, false);
      }
      if (field.type === FieldType.list) {
        const result: boolean[] = get(
          waitForAll(
            field.children.map((id) =>
              $fieldTouched(fieldId(field.formId, id)),
            ),
          ),
        );
        return result.reduce(
          (acc: boolean, x: boolean) => acc || x,
          field.touched,
        );
      }
      return field.touched;
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $formTouched = selectorFamily({
  key: 'form/touched',
  get:
    (formId: string) =>
    ({ get }) => {
      const { fieldIds } = get($form(formId));
      const results = get(
        waitForAll(fieldIds.map((id) => $fieldTouched(fieldId(formId, id)))),
      );
      const touchedFieldIds = results.reduce<string[]>((acc, result, i) => {
        if (result === true) {
          acc.push(fieldIds[i]);
        }
        return acc;
      }, []);
      return {
        touched: touchedFieldIds.length > 0,
        touchedFieldIds,
      };
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

const fieldsToIds = (fields: FieldState[]) => fields.map(({ name }) => name);

export const $fieldIds = selectorFamily({
  key: 'form/fieldIds',
  get:
    (formId: string) =>
    ({ get }) =>
      fieldsToIds(get($fields(formId))),
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $allFieldIds = selectorFamily<string[], string>({
  key: 'form/allFieldIds',
  get:
    (formId: string) =>
    ({ get }) => {
      const fieldIds = get($fieldIds(formId));
      const result = get(
        waitForAll(fieldIds.map((id) => $fieldChildren(fieldId(formId, id)))),
      );
      return fieldIds.concat(...result);
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

const isNotEqual = async (a: any = null, b: any = null) =>
  JSON.stringify(await a) !== JSON.stringify(b);

export const $fieldDirty = selectorFamily<boolean, string>({
  key: 'form_field/dirty',
  get:
    (id: string) =>
    async ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.map) {
        const result: boolean[] = get(
          waitForAll(
            field.children.map((id) => $fieldDirty(fieldId(field.formId, id))),
          ),
        );
        return result.reduce<boolean>((acc, x) => acc || x, false);
      }
      if (field.type === FieldType.list) {
        const result: any[] = get(
          waitForAll(
            field.children.map((id) => $fieldValue(fieldId(field.formId, id))),
          ),
        );
        const { dirtyComparator = isNotEqual, initialValue } = field;
        return dirtyComparator(result, initialValue);
      }
      const { dirtyComparator = isNotEqual, initialValue, value } = field;
      return dirtyComparator(value, initialValue);
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $formDirty = selectorFamily({
  key: 'form/dirty',
  get:
    (formId: string) =>
    ({ get }) => {
      const { fieldIds } = get($form(formId));
      const results = get(
        waitForAll(fieldIds.map((id) => $fieldDirty(fieldId(formId, id)))),
      );
      const dirtyFieldIds = results.reduce<string[]>((acc, result, i) => {
        if (result === true) {
          acc.push(fieldIds[i]);
        }
        return acc;
      }, []);
      return {
        dirty: dirtyFieldIds.length > 0,
        dirtyFieldIds,
      };
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $formReadyDelay = selectorFamily({
  key: 'form/readyDelay',
  get:
    (id: string) =>
    ({ get }) =>
      get($form(id)).readyDelay,
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $formReadyDelayKey = selectorFamily({
  key: 'form/readyDelayKey',
  get:
    (id: string) =>
    ({ get }) =>
      get($form(id)).readyDelayKey,
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});
