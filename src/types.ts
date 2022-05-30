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

export type FieldValidationResult = {
  type: ValidationSymbol;
  value?: string;
  other?: any;
  name: string;
};
export type NamedValidator = (value: any) => Promise<FieldValidationResult>;

export type FormSubmission = any;

export type FormState = {
  id: string;
  fieldIds: string[];
  submission: Promise<FormSubmission>;
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
  values: Dict<any>;
  allValues: Dict<any>;
  initialValues: Dict<any>;
  touched: Dict<boolean>;
  fieldIds: string[];
  dirty: boolean;
  validation: FormValidationResult;
};

export type SetValuesOptions = {
  validate?: boolean;
  equal?: (currentValue: any, newValue: any) => boolean;
  asInitialValues?: boolean;
};

export type FormControls = {
  setValues: (values: Dict<any>, options?: SetValuesOptions) => void;
  setErrors: (errors: Dict<ValidationResult>) => void;
  setTouched: (touched: Dict<boolean>) => void;
  resetTouched: () => void;
  setAllToTouched: () => void;
  reset: () => void;
  clear: () => void;
  addFields: (names: string[]) => void;
  removeFields: (names: string[]) => void;
};

export type OnSubmitBag = Bag & FormControls & { args: readonly any[] };

export type GetBag = () => Promise<Bag>;

export type GetBagForValidator = () => Promise<Omit<Bag, 'validation'>>;

export type FormValidationResult = {
  isValid: boolean;
  isValidStrict: boolean;
  errors: FieldValidationResult[];
  warnings: FieldValidationResult[];
  result: FieldValidationResult[];
};

export type DirtyComparator = (value: any, initialValue: any) => boolean;
