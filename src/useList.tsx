import { useEffect, useMemo, useState } from 'react';
import {
  useRecoilState,
  useResetRecoilState,
  useRecoilCallback,
  /* eslint-disable-next-line camelcase */
  useRecoilTransaction_UNSTABLE,
} from './minimalRecoil';
import {
  fieldId,
  $field,
  $fieldValue,
  $fieldTouched,
  $fieldDirty,
  $fieldValidation,
  $fieldInitialValue,
} from './selectors';
import { useFormId } from './hooks';
import { useFieldRegistration, useWarnOnChanged } from './internalHooks';
import {
  Dict,
  FieldType,
  UseListProps,
  UseListResult,
  RowBag,
  Row,
} from './types';
import uid from './uid';
import { createNestedName } from './nested';

const emptyArray: Dict<any>[] = [];

const useList = ({
  formId: formIdProp,
  name,
  initialValue = emptyArray,
  // should be unchanged - used only when initializing, any other update has no effect
  dirtyComparator,
  preserveStateAfterUnmount = true,
}: UseListProps): UseListResult => {
  const formId = useFormId(formIdProp);

  useWarnOnChanged('formId', formId);
  useWarnOnChanged('name', name);

  const [fieldState, setFieldState] = useRecoilState(
    $field(fieldId(formId, name)),
  );
  const reset = useResetRecoilState($field(fieldId(formId, name)));
  const registration = useFieldRegistration(formId);
  const [initialValueByName, setInitialValueByName] = useState<Dict<any>>({});

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
              validation: state.validator(value, state.meta),
            }));
          }
        });
      },
    [],
  );

  // problem with index as name is that children can be removed or change order
  const generateNewName = () => {
    return createNestedName(name, `${uid()}`);
  };

  const createRows = (rows: Dict<any>[]): [string[], Dict<any>] => {
    const rowNames = rows.map(generateNewName);
    return [
      rowNames,
      rows.reduce<Dict<any>>((acc, row, i) => {
        const rowName = rowNames[i];
        Object.entries(row).forEach(([key, value]) => {
          acc[createNestedName(rowName, key)] = value;
        });
        return acc;
      }, {}),
    ];
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
          acc[createNestedName(newName, k)] = v;
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
          acc[createNestedName(newName, k)] = v;
          return acc;
        }, {}),
      );
    return newName;
  };

  const addMany = (values: Dict<any>[]) => {
    const [children, vals] = createRows(values);
    setValues(vals);
    setFieldState((state) => ({
      ...state,
      children: [...state.children, ...children],
      touched: false,
    }));
    return children;
  };

  const remove = (name: string) => {
    setFieldState((state) => ({
      ...state,
      children: state.children.filter((x) => x !== name),
      touched: true,
    }));
  };

  const removeAll = () => {
    setFieldState((state) => ({
      ...state,
      children: [],
      touched: true,
    }));
  };

  const swap = (a: string, b: string) => {
    setFieldState((state) => ({
      ...state,
      children: state.children.map((x) => {
        if (x === a) {
          return b;
        }
        if (x === b) {
          return a;
        }
        return x;
      }),
      touched: true,
    }));
  };

  const move = (name: string, to: number) => {
    setFieldState((state) => {
      const indicesByName = state.children.reduce(
        /* <Dict<number>> */ (acc, x, i) => {
          acc[x] = i;
          return acc;
        },
        {},
      );
      const from = indicesByName[name];
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

  const replaceAll = (rows: Dict<any>[]) => {
    const [children, values] = createRows(rows);
    setValues(values);
    setFieldState((state) => ({
      ...state,
      children,
      initialValue: rows,
      touched: false,
    }));
  };

  // to get row (by its id) values, errors, etc.
  const getRowBag = useRecoilCallback(
    ({ snapshot }) =>
      async (id: string): Promise<RowBag> => {
        const touched = snapshot.getValue($fieldTouched(fieldId(formId, id)));
        const [value, dirty, validation, initialValue] = await Promise.all([
          snapshot.getPromise($fieldValue(fieldId(formId, id))),
          snapshot.getPromise($fieldDirty(fieldId(formId, id))),
          snapshot.getPromise($fieldValidation(fieldId(formId, id))),
          snapshot.getPromise($fieldInitialValue(fieldId(formId, id))),
        ]);
        return { value, touched, dirty, validation, initialValue };
      },
    [],
  ) as any;

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

    if (initialValue.length) {
      setInitialValueByName(
        children.reduce<Dict<any>>((acc, name, i) => {
          acc[name] = initialValue[i];
          return acc;
        }, {}),
      );
    }

    return () => {
      if (!preserveStateAfterUnmount) {
        reset();
      }
      registration.remove([name]);
    };
  }, []);

  const rows = useMemo<Row[]>(
    () =>
      fieldState.children.map((name) => ({
        id: name,
        fieldProps: (nestedFieldName: string) => ({
          name: createNestedName(name, nestedFieldName),
          initialValue: initialValueByName[name]?.[nestedFieldName],
        }),
        getBag: () => getRowBag(name),
      })),
    [fieldState.children, initialValueByName],
  );

  const getFieldName = (rowId: string, name: string) =>
    createNestedName(rowId, name);

  return {
    rows,
    rowIds: fieldState.children,
    replaceAll,
    add,
    addAt,
    addMany,
    remove,
    removeAll,
    swap,
    move,
    getRowBag,
    getFieldName,
  };
};

export default useList;
