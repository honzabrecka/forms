import React, { createContext, ReactNode } from 'react';
import { Form } from './types';

export const FormContext = createContext<Form | undefined>(undefined);

export type FormProviderProps = {
  children: ReactNode;
  form: Form;
};

export const FormContextProvider = ({ form, children }: FormProviderProps) => {
  return <FormContext.Provider value={form}>{children}</FormContext.Provider>;
};
