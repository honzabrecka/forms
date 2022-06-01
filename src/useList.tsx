import { useEffect } from 'react';
import {
  useRecoilCallback,
  useRecoilState,
  /* eslint-disable-next-line camelcase */
  useRecoilTransaction_UNSTABLE,
} from 'recoil';
import { fieldId, $field } from './selectors';
import { useFormId } from './hooks';
import { useFieldRegistration } from './internalHooks';
import useWarnOnChanged from './useWarnOnChanged';
import { FieldIdentification, Dict, FieldType, DirtyComparator } from './types';
import uid from './uid';

export type UseListProps = FieldIdentification & {
  initialValue?: Dict<any>[];
  dirtyComparator?: DirtyComparator;
  preserveStateAfterUnmount?: boolean;
};

export type MappedFieldProp = {
  name: string;
  initialValue: any;
};

export type UseListResult = {
  fields: string[];
  add: (value?: Dict<any>) => string;
  addAt: (index: number, value?: Dict<any>) => string;
  addMany: (values: Dict<any>[]) => string[];
  remove: (index: number) => void;
  removeAll: () => void;
  swap: (a: number, b: number) => void;
  move: (a: number, b: number) => void;
  replace: (value: Dict<any>[]) => void;
  fieldProps: (i: number, name: string) => MappedFieldProp;
};

const emptyArray: Dict<any>[] = [];

const useList = ({
  formId: formIdProp,
  name,
  initialValue = emptyArray,
  dirtyComparator,
  preserveStateAfterUnmount = false,
}: UseListProps): UseListResult => {
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

  const setValues = useRecoilTransaction_UNSTABLE(
    ({ get, set }) =>
      (values: Dict<any>) => {
        Object.keys(values).forEach((id) => {
          const atom = $field(fieldId(formId, id));
          const field = get(atom);
          const value = values[id];

          if (field.type === FieldType.field) {
            set(atom, (state) => ({
              ...state,
              initialValue: value,
              value,
              validation: state.validator(value),
            }));
          }
        });
      },
    [],
  );

  // problem with index as name is that children can be removed or change order
  const generateNewName = () => {
    return `${name}.${uid()}`;
  };

  const add = (value?: Dict<any>) => {
    const newName = generateNewName();
    setFieldState((state) => ({
      ...state,
      children: [...state.children, newName],
      touched: true,
    }));
    if (value)
      setValues(
        Object.entries(value).reduce<Dict<any>>((acc, [k, v]) => {
          acc[`${newName}.${k}`] = v;
          return acc;
        }, {}),
      );
    return newName;
  };

  const addAt = (index: number, value?: Dict<any>) => {
    const newName = generateNewName();
    setFieldState((state) => {
      const children = [...state.children];
      children.splice(index, 0, newName);
      return {
        ...state,
        children,
        touched: true,
      };
    });
    if (value)
      setValues(
        Object.entries(value).reduce<Dict<any>>((acc, [k, v]) => {
          acc[`${newName}.${k}`] = v;
          return acc;
        }, {}),
      );
    return newName;
  };

  const addMany = (values: Dict<any>[]) => {
    return values.map(add);
  };

  const remove = (index: number) => {
    setFieldState((state) => ({
      ...state,
      children: state.children.filter((_, i) => i !== index),
      touched: true,
    }));
  };

  const removeAll = () => {
    setFieldState((state) => {
      return {
        ...state,
        children: [],
        touched: true,
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
        touched: true,
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
        touched: true,
      };
    });
  };

  const createRows = (rows: Dict<any>[]): [string[], Dict<any>] => {
    const rowNames = rows.map(generateNewName);
    return [
      rowNames,
      rows.reduce<Dict<any>>((acc, row, i) => {
        const rowName = rowNames[i];
        Object.entries(row).forEach(([key, value]) => {
          acc[`${rowName}.${key}`] = value;
        });
        return acc;
      }, {}),
    ];
  };

  const replace = (rows: Dict<any>[]) => {
    removeAll();
    const [children, values] = createRows(rows);
    setValues(values);
    setFieldState((state) => ({
      ...state,
      children,
      initialValue: rows,
      touched: false,
    }));
  };

  useEffect(() => {
    registration.add([name]);

    const [children, values] = initialValue.length
      ? createRows(initialValue)
      : [[], {}];

    setValues(values);
    setFieldState((state) => ({
      ...state,
      type: FieldType.list,
      initialValue,
      dirtyComparator: dirtyComparator || state.dirtyComparator,
      children: initialValue.length ? children : state.children,
    }));

    return () => {
      if (preserveStateAfterUnmount) {
        return;
      }

      reset();
      registration.remove([name]);
    };
  }, []);

  return {
    fields: fieldState.children,
    replace,
    add,
    addAt,
    addMany,
    remove,
    removeAll,
    swap,
    move,
    fieldProps: (i: number, name: string) => ({
      name: `${fieldState.children[i]}.${name}`,
      initialValue: fieldState.initialValue[i]?.[name],
    }),
  };
};

export default useList;
