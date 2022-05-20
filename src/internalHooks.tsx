import { useRecoilCallback, useSetRecoilState } from 'recoil';
import {
  fieldId,
  $field,
  $form,
  $fieldIds,
  $values,
  $allValues,
  $formValidation,
  $touched,
  $initialValues,
  $formDirty,
} from './selectors';
import { FieldType } from './types';

export function useGetBag(formId: string) {
  return useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const [
          fieldIds,
          values,
          allValues,
          validation,
          touched,
          initialValues,
          dirty,
        ] = await Promise.all([
          snapshot.getPromise($fieldIds(formId)),
          snapshot.getPromise($values(formId)),
          snapshot.getPromise($allValues(formId)),
          snapshot.getPromise($formValidation(formId)),
          snapshot.getPromise($touched(formId)),
          snapshot.getPromise($initialValues(formId)),
          snapshot.getPromise($formDirty(formId)),
        ]);
        return {
          values,
          allValues,
          initialValues,
          touched,
          fieldIds,
          validation,
          ...dirty,
        };
      },
    [],
  );
}

// same as getBag, but does not return "validation"
export function useGetBagForValidator(formId: string) {
  return useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const [fieldIds, values, allValues, touched, initialValues, dirty] =
          await Promise.all([
            snapshot.getPromise($fieldIds(formId)),
            snapshot.getPromise($values(formId)),
            snapshot.getPromise($allValues(formId)),
            snapshot.getPromise($touched(formId)),
            snapshot.getPromise($initialValues(formId)),
            snapshot.getPromise($formDirty(formId)),
          ]);
        return {
          values,
          allValues,
          initialValues,
          touched,
          fieldIds,
          ...dirty,
        };
      },
    [],
  );
}

const take = <T,>(n: number, xs: T[]) => xs.slice(0, n);
const dropRight = <T,>(n: number, xs: T[]) => xs.slice(0, xs.length - n);

const nestedName = (i: number, ns: string[]) => take(i, ns).join('.');

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
  const setFormState = useSetRecoilState($form(formId));

  const addFieldToForm = (name: string) => {
    setFormState((state) => {
      const { fieldIds } = state;
      return {
        ...state,
        // it might be already registered (via useForm.addFieldIds() function for example)
        fieldIds: addOnlyIfUnique(fieldIds, name),
      };
    });
  };

  const removeFieldFromForm = (name: string) => {
    setFormState((state) => ({
      ...state,
      fieldIds: state.fieldIds.filter((id) => id !== name),
    }));
  };

  const removeFromParentField = useRecoilCallback(
    ({ set }) =>
      (name: string) => {
        const parent = dropRight(1, name.split('.')).join('.');
        set($field(fieldId(formId, parent)), (state) => ({
          ...state,
          children: state.children.filter((id) => id !== name),
        }));
      },
    [],
  );

  const add = useRecoilCallback(
    ({ set }) =>
      (name: string) => {
        const ns = name.split('.');

        addFieldToForm(ns[0]);

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
      },
    [],
  );

  const remove = (name: string) => {
    if (name.includes('.')) {
      removeFromParentField(name);
    }
    removeFieldFromForm(name);
  };

  return {
    add,
    remove,
  };
}
