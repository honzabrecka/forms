import isEqual from 'lodash.isequal';
import { atomFamily, selectorFamily, waitForAll } from './minimalRecoil';
import { success, multi, isError, isWarning } from './validation';
import {
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

const fieldIdSeparator = '/';

export const fieldId = (formId: string, name: string) =>
  `${formId}${fieldIdSeparator}${name}`;

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
  key: 'field',
  default: (id) => {
    const [formId, name] = id.split(fieldIdSeparator);
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
  key: 'field/children',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));

      if (field.type === FieldType.field) {
        return [];
      }

      const result: string[] = get(
        waitForAll(
          field.children.map((id: string) =>
            $fieldChildren(fieldId(field.formId, id)),
          ),
        ),
      );

      return field.children.concat(...result);
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $fieldValue = selectorFamily<any, string>({
  key: 'field/value',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.list) {
        return get(
          waitForAll(
            field.children.map((id: string) =>
              $fieldValue(fieldId(field.formId, id)),
            ),
          ),
        );
      }
      if (field.type === FieldType.map) {
        const result = get(
          waitForAll(
            field.children.map((id: string) =>
              $fieldValue(fieldId(field.formId, id)),
            ),
          ),
        );
        return result.reduce((acc, value, i) => {
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
  key: 'field/initialValue',
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

const $listValidation = selectorFamily<any, string>({
  key: 'field/listValidation',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));
      if (field.type !== FieldType.list) return undefined;
      return field.validation;
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

export const $fieldValidation = selectorFamily<any, string>({
  key: 'field/validation',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));
      if (field.type === FieldType.map) {
        const result = get(
          waitForAll(
            field.children.map((id) =>
              $fieldValidation(fieldId(field.formId, id)),
            ),
          ),
        );
        return { ...multi(result), name: field.name };
      }
      if (field.type === FieldType.list) {
        const result: any[] = get(
          waitForAll(
            field.children.map((id) =>
              $fieldValidation(fieldId(field.formId, id)),
            ),
          ),
        );
        return {
          ...multi([get($listValidation(id)), ...result]),
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
          fieldIds.reduce((acc, id) => {
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
          fieldIds.reduce((acc, id) => {
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
  key: 'field/touched',
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
      const result = get(
        waitForAll(fieldIds.map((id) => $fieldChildren(fieldId(formId, id)))),
      );
      return fieldIds.concat(...result);
    },
  cachePolicy_UNSTABLE: {
    eviction: 'most-recent',
  },
});

const isNotEqual = (a: any = null, b: any = null) => !isEqual(a, b);

export const $fieldDirty = selectorFamily<any, string>({
  key: 'field/dirty',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));
      const { dirtyComparator = isNotEqual } = field;
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
        return dirtyComparator(result, field.initialValue);
      }
      return dirtyComparator(get($fieldValue(id)), get($fieldInitialValue(id)));
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
