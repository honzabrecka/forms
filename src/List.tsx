import useList, { UseListResult } from './useList';
import { FieldIdentification, Dict } from './types';

export type ListProps = FieldIdentification & {
  children: (list: UseListResult) => JSX.Element;
  initialValue?: Dict<any>[];
};

const List = ({ children, formId, name, initialValue }: ListProps) =>
  children(useList({ formId, name, initialValue }));

export default List;
