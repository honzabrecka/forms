import { Validator, ValidationResult } from './types';

export const SUCCESS = Symbol('SUCCESS');
export const WARNING = Symbol('WARNING');
export const ERROR = Symbol('ERROR');

export const isSuccess = ({ type }: ValidationResult) => type === SUCCESS;
export const isWarning = ({ type }: ValidationResult) => type === WARNING;
export const isError = ({ type }: ValidationResult) => type === ERROR;

export const success = (): ValidationResult => ({
  type: SUCCESS,
});

export const warning = (value: string, other?: any): ValidationResult => ({
  type: WARNING,
  value,
  other,
});

export const error = (value: string, other?: any): ValidationResult => ({
  type: ERROR,
  value,
  other,
});

export const multi = (values: ValidationResult[]): ValidationResult => ({
  type: values.every(isSuccess) ? SUCCESS : ERROR,
  value: values,
});

export const failOnFirst =
  (rules: Validator[]): Validator =>
  (value, getBag) => {
    async function $([rule, ...rules]: Validator[]): Promise<ValidationResult> {
      if (!rule) {
        return success();
      }
      const result = await rule(value, getBag);
      if (!isSuccess(result)) {
        return result;
      }
      return $(rules);
    }
    return $(rules);
  };

export const all =
  (rules: Validator[]): Validator =>
  async (value, getBag) =>
    multi(await Promise.all(rules.map((rule) => rule(value, getBag))));
