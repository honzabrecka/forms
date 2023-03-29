import { useContext, useState } from 'react';
import { useRecoilValue, useRecoilValueLoadable } from 'recoil';
import { FormContext } from './FormContext';
import {
  fieldId,
  $fieldValue,
  $formSubmission,
  $formValidation,
  $fieldValidation,
  $formTouched,
  $fieldDirty,
  $formDirty,
  $errorBannerMessage,
} from './selectors';
import { FieldIdentification, FieldValidationResult, Validator } from './types';

export function useFormId(formId?: string) {
  const form = useContext(FormContext);
  return formId || form?.formId || '_';
}

export function useFormSubmission(formId?: string) {
  return useRecoilValue($formSubmission(useFormId(formId)));
}

export function useFormSubmissionLoadable(formId?: string) {
  return useRecoilValueLoadable($formSubmission(useFormId(formId)));
}

export function useFormIsSubmitting(formId?: string) {
  const { state } = useFormSubmissionLoadable(formId);
  return state === 'loading';
}

export function useFormValidation(formId?: string) {
  return useRecoilValue($formValidation(useFormId(formId)));
}

export function useFormValidationLoadable(formId?: string) {
  return useRecoilValueLoadable($formValidation(useFormId(formId)));
}

export function useFormTouchedLoadable(formId?: string) {
  return useRecoilValueLoadable($formTouched(useFormId(formId)));
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

export function useFieldValue<T>({ formId, name }: FieldIdentification) {
  return useRecoilValue<T | undefined>(
    $fieldValue(fieldId(useFormId(formId), name)),
  );
}

export function useFieldValueLoadable<T>({
  formId,
  name,
}: FieldIdentification) {
  return useRecoilValueLoadable<T | undefined>(
    $fieldValue(fieldId(useFormId(formId), name)),
  );
}

export function useErrorBannerMessage(formId?: string) {
  return useRecoilValue($errorBannerMessage(useFormId(formId)));
}

export type CompareFieldValue<T> = (value: T | undefined) => boolean;

export function useDependentField<T>({
  formId,
  name,
  compare,
}: FieldIdentification & { compare: CompareFieldValue<T> }): [
  boolean,
  CompareFieldValue<T>,
  T | undefined,
] {
  const value = useRecoilValueLoadable<T>(
    $fieldValue(fieldId(useFormId(formId), name)),
  );
  const valueMaybe = value.valueMaybe();
  return [compare(valueMaybe), compare, valueMaybe];
}

export function useRefreshableValidator(
  validator: Validator,
): [Validator, () => void] {
  const [state, setState] = useState({ validator });
  const revalidate = () => setState({ validator });
  return [state.validator, revalidate];
}
