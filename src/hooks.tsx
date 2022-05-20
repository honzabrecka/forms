import { useContext } from 'react';
import { useRecoilValue, useRecoilValueLoadable } from 'recoil';
import { FormContext } from './FormContext';
import {
  fieldId,
  $fieldValue,
  $formSubmission,
  $formValidation,
  $fieldValidation,
  $allValues,
  $touched,
  $formReadyDelay,
  $fieldDirty,
  $formDirty,
} from './selectors';
import { FieldIdentification, FieldValidationResult } from './types';

export function useFormId(formId?: string) {
  const formIdCtx = useContext(FormContext)?.formId;
  return formId || formIdCtx || '_';
}

export function useFormSubmission(formId?: string) {
  return useRecoilValue($formSubmission(useFormId(formId)));
}

export function useFormSubmissionLoadable(formId?: string) {
  return useRecoilValueLoadable($formSubmission(useFormId(formId)));
}

export function useFormValidation(formId?: string) {
  return useRecoilValue($formValidation(useFormId(formId)));
}

export function useFormValidationLoadable(formId?: string) {
  return useRecoilValueLoadable($formValidation(useFormId(formId)));
}

export function useFormTouchedLoadable(formId?: string) {
  return useRecoilValueLoadable($touched(useFormId(formId)));
}

export function useFormDirty(formId?: string) {
  return useRecoilValue($formDirty(useFormId(formId)));
}

export function useFormDirtyLoadable(formId?: string) {
  return useRecoilValueLoadable($formDirty(useFormId(formId)));
}

export function useFieldDirty({ formId, name }: FieldIdentification) {
  return useRecoilValue($fieldDirty(fieldId(useFormId(formId), name)));
}

export function useFieldDirtyLoadable({ formId, name }: FieldIdentification) {
  return useRecoilValueLoadable($fieldDirty(fieldId(useFormId(formId), name)));
}

export function useFieldValidation({ formId, name }: FieldIdentification) {
  return useRecoilValue<FieldValidationResult>(
    $fieldValidation(fieldId(useFormId(formId), name)),
  );
}

export function useFieldValidationLoadable({
  formId,
  name,
}: FieldIdentification) {
  return useRecoilValueLoadable(
    $fieldValidation(fieldId(useFormId(formId), name)),
  );
}

export function useFieldValue({ formId, name }: FieldIdentification) {
  return useRecoilValue($fieldValue(fieldId(useFormId(formId), name)));
}

export function useFormReady(formId?: string) {
  formId = useFormId(formId);
  useRecoilValue($formReadyDelay(formId));
  useRecoilValue($allValues(formId));
}

// TODO types
// export function useRefreshableValidator(validator) {
//   const [key, revalidate] = useReducer((key) => key + 1, 0);
//   return useMemo(
//     () => ({
//       validator: (...args) => validator(...args),
//       revalidate: () => revalidate(),
//     }),
//     [validator, key]
//   );
// }
