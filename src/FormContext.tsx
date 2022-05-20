import React, { createContext, ReactNode, FormEvent } from 'react';
import { Dict, ValidationResult, GetBag } from './types';

type Form = {
  formId: string;
  setValues: (values: Dict<any>) => void;
  setInitialValues: (values: Dict<any>) => void;
  setErrors: (errors: Dict<ValidationResult>) => void;
  setTouched: (values: Dict<boolean>) => void;
  resetTouched: () => void;
  setAllToTouched: () => void;
  reset: () => void;
  clear: () => void;
  revalidate: (fieldIds?: string[]) => void;
  getBag: GetBag;
  isSubmitting: boolean;
  submit: (...args: any[]) => Promise<void>;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  addFields: (names: string[]) => void;
  removeFields: (names: string[]) => void;
};

export const FormContext = createContext<Form | undefined>(undefined);

export type FormProviderProps = {
  children: ReactNode;
  form: Form;
};

export const FormContextProvider = ({ form, children }: FormProviderProps) => {
  return <FormContext.Provider value={form}>{children}</FormContext.Provider>;
};
