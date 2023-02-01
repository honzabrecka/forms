import { FormEvent } from 'react';
import { Loadable } from 'recoil';
import { ERROR, SUCCESS, WARNING } from './validation';

export type Dict<T> = { [K in string]: T };

export type Callback0 = () => void;

export type Callback1<A> = (a: A) => void;

export type Callback2<A, B> = (a: A, b: B) => void;

export type VariadicCallback = (...args: any[]) => void;

export type FieldIdentification = {
  formId?: string;
  name: string;
};

export type ValidationSymbol = typeof SUCCESS | typeof WARNING | typeof ERROR;

export type ValidationResult = {
  type: ValidationSymbol;
  value?: any;
  other?: any;
};

export type Validator = (
  value: any,
  getBag: GetBagForValidator,
) => ValidationResult | Promise<ValidationResult>;

export type ConditionalValidator = (
  value: any,
  getBag: GetBagForValidator,
  values: any[],
) => ValidationResult | Promise<ValidationResult>;

export type FieldValidationResult = {
  type: ValidationSymbol;
  value?: string;
  other?: any;
  name: string;
};

export type NamedValidator = (value: any) => Promise<FieldValidationResult>;

export type FormValidationResult = {
  isValid: boolean;
  isValidStrict: boolean;
  errors: FieldValidationResult[];
  warnings: FieldValidationResult[];
  result: FieldValidationResult[];
};

export type FormSubmission = FormValidationResult | null;

export type FormState = {
  id: string;
  fieldIds: string[];
  submission: Promise<FormSubmission>;
  readyDelayKey: number;
  readyDelay: Promise<unknown>;
};

export enum FieldType {
  field,
  map,
  list,
}

export type FieldState = {
  type: FieldType;
  id: string;
  formId: string;
  name: string;
  children: string[];
  value: any;
  initialValue?: any;
  dirtyComparator?: DirtyComparator;
  touched: boolean;
  validation: Promise<FieldValidationResult>;
  validator: NamedValidator;
};

export type Bag = {
  formId: string;
  values: Dict<any>;
  initialValues: Dict<any>;
  fieldIds: string[];
  touched: boolean;
  touchedFieldIds: string[];
  dirty: boolean;
  dirtyFieldIds: string[];
  validation: FormValidationResult;
};

export type SetValuesOptions = {
  validate?: boolean;
  equal?: (currentValue: any, newValue: any) => boolean;
  asInitialValues?: boolean;
};

export type FormControls = {
  setValues: (values: Dict<any>, options?: SetValuesOptions) => void;
  setInitialValues: (values: Dict<any>) => void;
  setErrors: (errors: Dict<ValidationResult>) => void;
  setTouched: (touched: Dict<boolean>) => void;
  resetTouched: () => void;
  setAllToTouched: () => void;
  reset: () => void;
  resetFields: (names: string[]) => void;
  clear: () => void;
  addFields: (names: string[]) => void;
  removeFields: (names: string[]) => void;
  handleDependentFields: (
    requiredInNextStep: string[],
    namesToRemove: string[],
    errorValue?: string,
  ) => void;
};

export type Form = FormControls & {
  formId: string;
  revalidate: (fieldIds?: string[]) => void;
  getBag: GetBag;
  submit: (...args: any[]) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export type OnSubmitBag = Bag & FormControls & { args: readonly any[] };

export type OnReadyBag = Form;

export type GetBag = () => Promise<Bag>;

export type GetBagForValidator = () => Promise<Omit<Bag, 'validation'>>;

export type DirtyComparator = (
  value: any,
  initialValue: any,
) => boolean | Promise<boolean>;

export type FromTransformer = (value: any) => any;

export type ToTransformer = (value: any) => any;

export type OnFocus = Callback2<{ name: string }, GetBag>;

export type OnBlur = Callback2<{ name: string }, GetBag>;

export type OnChangeEvent = { name: string; value: any };

export type OnChange = Callback2<OnChangeEvent, GetBag>;

export type OnChangeImmediate = Callback1<OnChangeEvent>;

export type OnSubmit = (bag: OnSubmitBag) => any;

export type UseFormProps = {
  formId?: string;
  onSubmit?: OnSubmit;
  onSubmitInvalid?: OnSubmit;
  onReady?: (bag: OnReadyBag) => any;
  initialValues?: Dict<any>;
  isValidProp?: 'isValid' | 'isValidStrict';
};

export type UseFieldProps = {
  name: string;
  formId?: string;
  initialValue?: any;
  validator?: Validator;
  validateOnMount?: boolean;
  validateOnFocus?: boolean;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  onFocus?: OnFocus;
  onBlur?: OnBlur;
  onChange?: OnChange;
  onChangeImmediate?: OnChangeImmediate;
  from?: FromTransformer;
  to?: ToTransformer;
  required?: boolean;
  dirtyComparator?: DirtyComparator;
  preserveStateAfterUnmount?: boolean;
};

export type UseFieldResult = {
  formId: string;
  touched: boolean;
  inited: boolean;
  onChange: (value: any) => void;
  onFocus: () => void;
  onBlur: () => void;
  name: string;
  id: string;
  value: any;
  initialValue?: any;
  dirtyComparator?: DirtyComparator;
  validator: NamedValidator;
  validation: Promise<FieldValidationResult>;
  validationResult: Loadable<FieldValidationResult>;
};

export type UseListProps = FieldIdentification & {
  initialValue?: Dict<any>[];
  dirtyComparator?: DirtyComparator;
  preserveStateAfterUnmount?: boolean;
};

export type MappedFieldProp = {
  name: string;
  initialValue: any;
};

export type Row = {
  id: string;
  fieldProps: (nestedFieldName: string) => MappedFieldProp;
  getBag: () => Promise<RowBag>;
};

export type RowBag = {
  value: Dict<any>;
  initialValue: Dict<any>;
  touched: boolean;
  dirty: boolean;
  validation: FieldValidationResult;
};

export type UseListResult = {
  rows: Row[];
  rowIds: string[];
  add: (value?: Dict<any>) => string;
  addAt: (index: number, value?: Dict<any>) => string;
  addMany: (values: Dict<any>[]) => string[];
  remove: (name: string) => void;
  removeAll: () => void;
  swap: (a: string, b: string) => void;
  move: (name: string, b: number) => void;
  replaceAll: (value: Dict<any>[]) => void;
  getRowBag: (id: string) => Promise<RowBag>;
  getFieldName: (rowId: string, name: string) => string;
};

export type ListProps = UseListProps & {
  children: (list: UseListResult) => JSX.Element;
  validator?: Validator;
};
