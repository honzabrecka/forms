export const nestedFieldSeparator = '.';

export const createNestedName = (...names: string[]) =>
  names.join(nestedFieldSeparator);
