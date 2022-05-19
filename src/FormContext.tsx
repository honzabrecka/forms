import React, { createContext, ReactNode } from 'react';

export const FormIdContext = createContext<string>('_');

export type FormIdProviderProps = {
  children: ReactNode;
  formId: string;
};

export const FormIdProvider = ({ formId, children }: FormIdProviderProps) => {
  return (
    <FormIdContext.Provider value={formId}>{children}</FormIdContext.Provider>
  );
};
