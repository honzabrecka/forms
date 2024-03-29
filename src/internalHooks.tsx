import { useCallback, useRef, useEffect } from 'react';
import {
  useRecoilCallback,
  /* eslint-disable-next-line camelcase */
  useRecoilTransaction_UNSTABLE,
} from './minimalRecoil';
import {
  fieldId,
  $field,
  $form,
  $fieldIds,
  $values,
  $formValidation,
  $formTouched,
  $initialValues,
  $formDirty,
  oneTickToGetFreshData,
} from './selectors';
import { FieldType, Bag } from './types';
import { nestedFieldSeparator } from './nested';

export function useGetBag(formId: string) {
  return useRecoilCallback<[], Promise<Bag>>(
    ({ snapshot }) =>
      async () => {
        await oneTickToGetFreshData();
        const fieldIds = snapshot.getValue($fieldIds(formId));
        const touched = snapshot.getValue($formTouched(formId));
        const [values, validation, initialValues, dirty] = await Promise.all([
          snapshot.getPromise($values(formId)),
          snapshot.getPromise($formValidation(formId)),
          snapshot.getPromise($initialValues(formId)),
          snapshot.getPromise($formDirty(formId)),
        ]);
        return {
          formId,
          values,
          initialValues,
          fieldIds,
          ...touched,
          ...dirty,
          validation,
        };
      },
    [],
  );
}

// same as getBag, but does not wait on "validation"
export function useGetBagForValidator(formId: string) {
  return useRecoilCallback<[], Promise<Omit<Bag, 'validation'>>>(
    ({ snapshot }) =>
      async () => {
        await oneTickToGetFreshData();
        const fieldIds = snapshot.getValue($fieldIds(formId));
        const touched = snapshot.getValue($formTouched(formId));
        const [values, initialValues, dirty] = await Promise.all([
          snapshot.getPromise($values(formId)),
          snapshot.getPromise($initialValues(formId)),
          snapshot.getPromise($formDirty(formId)),
        ]);
        return {
          formId,
          values,
          initialValues,
          fieldIds,
          ...touched,
          ...dirty,
        };
      },
    [],
  );
}

const take = <T,>(n: number, xs: T[]) => xs.slice(0, n);
const dropRight = <T,>(n: number, xs: T[]) => xs.slice(0, xs.length - n);

const nestedName = (i: number, ns: string[]) =>
  take(i, ns).join(nestedFieldSeparator);

const addOnlyIfUnique = <T,>(xs: T[], x: T) => {
  const set = new Set(xs);
  return set.has(x) ? xs : [...xs, x];
};

/**
 * Register field to form.
 * In case the field is nested (name contains ., eg "a.b.c"),
 * then "a" is registered to form and "a" and "b" nodes are created
 * where "a" points to "b" and "b" points to "c"
 */
export function useFieldRegistration(formId: string) {
  const add = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      (names: string[]) => {
        const toAdd: string[] = [];

        names.forEach((name) => {
          const ns = name.split(nestedFieldSeparator);

          toAdd.push(ns[0]);

          for (let i = 0; i < ns.length - 1; i++) {
            const currentNodeName = nestedName(i + 1, ns);
            set($field(fieldId(formId, currentNodeName)), (state) =>
              state.type === FieldType.field
                ? {
                    ...state,
                    type: FieldType.map,
                  }
                : state,
            );
            set($field(fieldId(formId, currentNodeName)), (state) =>
              state.type !== FieldType.field
                ? {
                    ...state,
                    children: addOnlyIfUnique(
                      state.children,
                      nestedName(i + 2, ns),
                    ),
                  }
                : state,
            );
          }
        });

        // add fields to form
        set($form(formId), (state) => {
          const { fieldIds } = state;
          const ids = new Set(fieldIds);
          return {
            ...state,
            // it might be already registered via useField on mount effect
            fieldIds: fieldIds.concat(toAdd.filter((id) => !ids.has(id))),
          };
        });
      },
    [],
  );

  const remove = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      (names: string[]) => {
        // remove fields from form
        const ids = new Set(names);
        set($form(formId), (state) => ({
          ...state,
          fieldIds: state.fieldIds.filter((id) => !ids.has(id)),
        }));

        names.forEach((name) => {
          // remove from parent field
          if (name.includes(nestedFieldSeparator)) {
            const parent = dropRight(1, name.split(nestedFieldSeparator)).join(
              nestedFieldSeparator,
            );
            set($field(fieldId(formId, parent)), (state) => ({
              ...state,
              children: state.children.filter((id) => id !== name),
            }));
          }
        });
      },
    [],
  );

  return {
    add,
    remove,
  };
}

export function useWarnOnChanged(name: string, value: any) {
  const original = useRef(value);

  useEffect(() => {
    // TODO use invariant or DEV only
    if (original.current !== value) {
      console.warn(
        `property ${name} should not be changed from ${original.current} to ${value}`,
      );
    }
  }, [value]);
}

export function useEventCallback(cb: any) {
  const cbRef = useRef(cb);

  useEffect(() => {
    cbRef.current = cb;
  });

  return useCallback((...args: any[]) => cbRef.current(...args), []);
}
