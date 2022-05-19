import useList, { UseListResult } from './useList';
import { FieldIdentification } from './types';

export type ListProps = FieldIdentification & {
  children: (list: UseListResult) => JSX.Element;
};

const List = ({ children, formId, name }: ListProps) =>
  children(useList({ formId, name }));

export default List;
