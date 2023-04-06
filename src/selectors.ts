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

const getPartitionFromId = (id: string) => {
  const [partition] = id.split(fieldIdSeparator);
  return partition;
};

export const fieldId = (formId: string, name: string) =>
  `${formId}${fieldIdSeparator}${name}`;

export const defaultReadyDelayTimeout = 100;

export const $form = atomFamily<FormState>({
  key: `form`,
  default: (id: string) => ({
    id,
    fieldIds: [],
    submission: Promise.resolve(null),
    readyDelayKey: 0,
    readyDelay: delay(defaultReadyDelayTimeout),
    errorBannerMessage: null,
  }),
  getPartitionFromId,
});

export const $formSubmission = selectorFamily<FormSubmission>({
  key: 'form/submission',
  get:
    (id) =>
    ({ get }) =>
      get($form(id)).submission,
  getPartitionFromId,
});

export const $field = atomFamily<FieldState>({
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
  getPartitionFromId,
});

export const $fieldChildren = selectorFamily<string[]>({
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
  getPartitionFromId,
});

export const $fieldValue = selectorFamily<any>({
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
  getPartitionFromId,
});

export const $fieldInitialValue = selectorFamily<any>({
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
  getPartitionFromId,
});

const $listValidation = selectorFamily<any>({
  key: 'field/listValidation',
  get:
    (id: string) =>
    ({ get }) => {
      const field = get($field(id));
      if (field.type !== FieldType.list) return undefined;
      return field.validation;
    },
  getPartitionFromId,
});

export const $fieldValidation = selectorFamily<FieldValidationResult>({
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
  getPartitionFromId,
});

export const $formValidation = selectorFamily<FormValidationResult>({
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
  getPartitionFromId,
});

export const $fields = selectorFamily({
  key: 'form/fields',
  get:
    (formId: string) =>
    ({ get }) => {
      const { fieldIds } = get($form(formId));
      return fieldIds.map((id) => get($field(fieldId(formId, id))));
    },
});

export const $values = selectorFamily<any>({
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
  getPartitionFromId,
});

export const $initialValues = selectorFamily<any>({
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
  getPartitionFromId,
});

export const $fieldTouched = selectorFamily<boolean>({
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
  getPartitionFromId,
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
  getPartitionFromId,
});

const fieldsToIds = (fields: FieldState[]) => fields.map(({ name }) => name);

export const $fieldIds = selectorFamily({
  key: 'form/fieldIds',
  get:
    (formId: string) =>
    ({ get }) =>
      fieldsToIds(get($fields(formId))),
  getPartitionFromId,
});

export const $allFieldIds = selectorFamily<string[]>({
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
  getPartitionFromId,
});

const isNotEqual = (a: any = null, b: any = null) => !isEqual(a, b);

export const $fieldDirty = selectorFamily<any>({
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
  getPartitionFromId,
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
  getPartitionFromId,
});

export const $formReadyDelay = selectorFamily<Promise<any>>({
  key: 'form/readyDelay',
  get:
    (id: string) =>
    ({ get }) =>
      get($form(id)).readyDelay,
  getPartitionFromId,
});

export const $formReadyDelayKey = selectorFamily<string>({
  key: 'form/readyDelayKey',
  get:
    (id: string) =>
    ({ get }) =>
      get($form(id)).readyDelayKey,
  getPartitionFromId,
});

export const $errorBannerMessage = selectorFamily<string | null>({
  key: 'form/errorBannerMessage',
  get:
    (id: string) =>
    ({ get }) =>
      get($form(id)).errorBannerMessage,
  getPartitionFromId,
});
