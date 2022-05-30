import { useEffect } from 'react';
import { useRecoilCallback, useRecoilState } from 'recoil';
import { fieldId, $field } from './selectors';
import { useFormId } from './hooks';
import { useFieldRegistration } from './internalHooks';
import useWarnOnChanged from './useWarnOnChanged';
import { FieldIdentification, Dict, FieldType } from './types';
import uid from './uid';

export type UseListProps = FieldIdentification & {
  // TODO
  initialValue?: Dict<any>[];
};

export type UseListResult = {
  fields: string[];
  add: () => string;
  addAt: (index: number) => string;
  remove: (index: number) => void;
  removeAll: () => void;
  swap: (a: number, b: number) => void;
  move: (a: number, b: number) => void;
  createRows: (rows: any[]) => Dict<any>;
};

const useList = ({ formId: formIdProp, name }: UseListProps): UseListResult => {
  const formId = useFormId(formIdProp);

  useWarnOnChanged('formId', formId);
  useWarnOnChanged('name', name);

  const [fieldState, setFieldState] = useRecoilState(
    $field(fieldId(formId, name)),
  );
  const registration = useFieldRegistration(formId);

  const reset = useRecoilCallback(
    ({ reset }) =>
      () => {
        reset($field(fieldId(formId, name)));
      },
    [],
  );

  useEffect(() => {
    registration.add([name]);
    setFieldState((state) => ({
      ...state,
      type: FieldType.list,
    }));
    return () => {
      reset();
      registration.remove([name]);
    };
  }, []);

  const generateNewName = () => {
    return `${name}.${uid()}`;
  };

  const add = () => {
    // problem with index as name is that children can be removed or change order
    const newName = generateNewName();
    setFieldState((state) => ({
      ...state,
      children: [...state.children, newName],
    }));
    return newName;
  };

  const addAt = (index: number) => {
    const newName = generateNewName();
    setFieldState((state) => {
      const children = [...state.children];
      children.splice(index, 0, newName);
      return {
        ...state,
        children,
      };
    });
    return newName;
  };

  const remove = (index: number) => {
    setFieldState((state) => ({
      ...state,
      children: state.children.filter((_, i) => i !== index),
    }));
  };

  const removeAll = () => {
    setFieldState((state) => {
      return {
        ...state,
        children: [],
      };
    });
  };

  const swap = (a: number, b: number) => {
    setFieldState((state) => {
      const ax = state.children[a];
      const bx = state.children[b];
      return {
        ...state,
        children: state.children.map((x, i) => {
          if (i === a) {
            return bx;
          }
          if (i === b) {
            return ax;
          }
          return x;
        }),
      };
    });
  };

  const move = (from: number, to: number) => {
    setFieldState((state) => {
      const before = state.children.slice(0, from);
      const after = state.children.slice(from + 1);
      const tempChildren = [...before, ...after];
      const beforeNew = tempChildren.slice(0, to);
      const afterNew = tempChildren.slice(to);
      return {
        ...state,
        children: [...beforeNew, state.children[from], ...afterNew],
      };
    });
  };

  // returns structure (dict with fully qualified names) suitable for form.setValues/form.setInitialValues
  // has side-effects
  const createRows = (rows: any[]) =>
    rows.reduce<Dict<any>>((acc, row) => {
      const rowName = add();
      Object.entries(row).forEach(([key, value]) => {
        acc[`${rowName}.${key}`] = value;
      });
      return acc;
    }, {});

  return {
    fields: fieldState.children,
    // manipulation
    add,
    addAt,
    remove,
    removeAll,
    swap,
    move,
    // helpers
    createRows,
  };
};

export default useList;
