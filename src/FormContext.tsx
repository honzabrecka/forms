import React, { createContext, ReactNode, FormEvent } from 'react';
import { GetBag, FormControls } from './types';

type Form = FormControls & {
  formId: string;
  revalidate: (fieldIds?: string[]) => void;
  getBag: GetBag;
  submitting: boolean;
  submit: (...args: any[]) => Promise<void>;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const FormContext = createContext<Form | undefined>(undefined);

export type FormProviderProps = {
  children: ReactNode;
  form: Form;
};

export const FormContextProvider = ({ form, children }: FormProviderProps) => {
  return <FormContext.Provider value={form}>{children}</FormContext.Provider>;
};
