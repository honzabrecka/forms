import { atomFamily, selectorFamily } from './recoilOrMinimalRecoil';
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
    setTimeout(() => {
      res(undefined);
    }, t);
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
    errorBannerMessage: null,
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

      const result: string[] = field.children.map((id) =>
        get($fieldChildren(fieldId(field.formId, id))),
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
        const result: any[] = field.children.map((id) =>
          get($fieldValue(fieldId(field.formId, id))),
        );
        return result;
      }
      if (field.type === FieldType.map) {
        const result: any[] = field.children.map((id) =>
          get($fieldValue(fieldId(field.formId, id))),
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
        const result: any[] = field.children.map((id) =>
          get($fieldInitialValue(fieldId(field.formId, id))),
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

export const $fieldValidation = selectorFamily<any, string>({
  key: 'form_field/validation',
  get:
    (id: string) =>
    async ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.map) {
        const result: FieldValidationResult[] = field.children.map((id) =>
          get($fieldValidation(fieldId(field.formId, id))),
        );
        return { ...multi(result), name: field.name };
      }
      if (field.type === FieldType.list) {
        const result: FieldValidationResult[] = field.children.map((id) =>
          get($fieldValidation(fieldId(field.formId, id))),
        );
        return {
          ...multi([await field.validation, ...result]),
          name: field.name,
        };
      }
      // console.log(field);
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
      const result: FieldValidationResult[] = fieldIds.map((id) =>
        get($fieldValidation(fieldId(formId, id))),
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
      const values = fieldIds.reduce(
        /* <Dict<any>> */ (acc, id) => {
          acc[id] = get($fieldValue(fieldId(formId, id)));
          return acc;
        },
        {},
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
      const values = fieldIds.reduce(
        /* <Dict<any>> */ (acc, id) => {
          acc[id] = get($fieldInitialValue(fieldId(formId, id)));
          return acc;
        },
        {},
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
        const result: boolean[] = field.children.map((id) =>
          get($fieldTouched(fieldId(field.formId, id))),
        );
        return result.reduce((acc: boolean, x: boolean) => acc || x, false);
      }
      if (field.type === FieldType.list) {
        const result: boolean[] = field.children.map((id) =>
          get($fieldTouched(fieldId(field.formId, id))),
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
      const results = fieldIds.map((id) =>
        get($fieldTouched(fieldId(formId, id))),
      );
      const touchedFieldIds = results.reduce((acc, result, i) => {
        if (result === true) {
          acc.add(fieldIds[i]);
        }
        return acc;
      }, new Set<string>());
      return {
        touched: touchedFieldIds.size > 0,
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
      const result = fieldIds.map((id) =>
        get($fieldChildren(fieldId(formId, id))),
      );

      return fieldIds.concat(...result);
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

const isNotEqual = async (a: any = null, b: any = null) =>
  JSON.stringify(await a) !== JSON.stringify(b);

export const $fieldDirty = selectorFamily<any, string>({
  key: 'form_field/dirty',
  get:
    (id: string) =>
    async ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.map) {
        const result: boolean[] = field.children.map((id) =>
          get($fieldDirty(fieldId(field.formId, id))),
        );

        return result.reduce<boolean>((acc, x) => acc || x, false);
      }
      if (field.type === FieldType.list) {
        const result: any[] = field.children.map((id) =>
          get($fieldValue(fieldId(field.formId, id))),
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
      const results = fieldIds.map((id) =>
        get($fieldDirty(fieldId(formId, id))),
      );
      const dirtyFieldIds = results.reduce((acc, result, i) => {
        if (result === true) {
          acc.add(fieldIds[i]);
        }
        return acc;
      }, new Set<string>());
      return {
        dirty: dirtyFieldIds.size > 0,
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

export const $errorBannerMessage = selectorFamily({
  key: 'form/errorBannerMessage',
  get:
    (id: string) =>
    ({ get }) =>
      get($form(id)).errorBannerMessage,
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});
