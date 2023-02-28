/* eslint-disable camelcase */
import { useSyncExternalStore, useCallback } from 'react';
import { Callback0 } from './types';

// const noop: TODO = () => undefined;

const undef = Symbol('undef');

const isPromise = (value: TODO) =>
  value && typeof value === 'object' && typeof value.then === 'function';

type TODO = any;

enum StoredType {
  atom,
  selector,
}

type LoadableState = 'hasValue' | 'loading' | 'hasError';

type Atom = {
  type: StoredType.atom;
  value: TODO;
  state: LoadableState;
  dependents: Set<Stored>;
  listeners: Set<Callback0>;
};

type SelectorFactoryProps = {
  get: (atom: Stored) => TODO;
};

type Selector = {
  type: StoredType.selector;
  factory: ({ get }: SelectorFactoryProps) => TODO;
  value: TODO;
  state: LoadableState;
  dependents: Set<Stored>;
  listeners: Set<Callback0>;
};

type Stored = Atom | Selector;

const store = new Map<string, Stored>(); // new WeakMap();

const readPlain = (atom: Stored) => {
  if (atom.type === StoredType.atom) return atom.value;
  if (atom.type === StoredType.selector) {
    const get = (dependentAtom: Stored) => {
      dependentAtom.dependents.add(atom);
      return read(dependentAtom);
    };
    // compute only in case it's first read
    if (atom.value === undef) {
      atom.value = atom.factory({ get });
    }
    return atom.value;
  }
  throw new Error('unsupported read');
};

// wraps value with Loadable interface
const read = (atom: Stored) => {
  const value = readPlain(atom);
  if (isPromise(value)) {
    if (atom.state !== 'loading') return value;

    atom.state = 'loading';
    value.then(
      () => {
        atom.state = 'hasValue';
        notify(atom);
      },
      () => {
        // TODO
        atom.state = 'hasError';
        notify(atom);
      },
    );
    // TODO maybe throw (like suspense does?) - `get` in selectors should halt until it's done
    throw value;
  }
  return value;
};

// if atom is modified, we need to notify all the dependent atoms (recursively)
// now run callbacks for all the components that are dependent on this atom
const notify = (atom: Stored) => {
  atom.dependents.forEach((d) => {
    if (d !== atom) {
      if (d.type === StoredType.atom) {
        notify(d);
      } else if (d.type === StoredType.selector) {
        const get = (dependentAtom: Stored) => {
          dependentAtom.dependents.add(d);
          return read(dependentAtom);
        };
        // selectors are recomputed only in case dependent atom has changed
        const newValue = d.factory({ get });
        if (!Object.is(d.value, newValue)) {
          d.value = newValue;
          notify(d);
        }
      }
    }
  });
  atom.listeners.forEach((l) => l());
};

const write = (atom: Stored, value: TODO) => {
  if (atom.type === StoredType.atom) {
    if (typeof value === 'function') {
      atom.value = value(atom.value);
    } else {
      atom.value = value;
    }
    notify(atom);
    return;
  }
  if (atom.type === StoredType.selector)
    throw new Error('unsupported write on selector');
  throw new Error('unsupported write');
};

const getSnapshot = (atom: TODO) => () => {
  // TODO suspense
  return read(atom);
};

type AtomFamilyProps<T> = {
  key: string;
  default: (id: string) => T;
};

export const atomFamily =
  ({ key, ...props }: AtomFamilyProps<TODO>) =>
  (id: string) => {
    const atomId = `${key}${id}`;
    let atom = store.get(atomId);
    if (!atom)
      store.set(
        atomId,
        (atom = {
          type: StoredType.atom,
          value: props.default(id),
          state: 'loading',
          listeners: new Set(),
          dependents: new Set(),
        }),
      );
    return atom;
  };

type SelectorFamilyProps<T> = {
  key: string;
  get: (id: string) => ({ get }: SelectorFactoryProps) => T;
};

export const selectorFamily =
  ({ key, get }: SelectorFamilyProps<TODO>) =>
  (id: string) => {
    const atomId = `${key}${id}`;
    let atom = store.get(atomId);
    if (!atom)
      store.set(
        atomId,
        (atom = {
          type: StoredType.selector,
          value: undef,
          state: 'loading',
          factory: get(id),
          listeners: new Set(),
          dependents: new Set(),
        }),
      );
    return atom;
  };

// TODO support map (now only list)
// export const waitForAll = (...listOrMapOfAtoms) => {};

//

export const useSetRecoilState = (atom: Stored) => {
  return (value: TODO) => {
    write(atom, value);
  };
};

// TODO suspense ready
export const useRecoilValue = (atom: Stored) => {
  const subscribe = useCallback((listener: Callback0) => {
    atom.listeners.add(listener);
    return () => {
      atom.listeners.delete(listener);
    };
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot(atom)); // TODO suspense
};

// do not throw promise (suspense)
export const useRecoilValueLoadable = (atom: Stored) => {
  const subscribe = useCallback((listener: Callback0) => {
    atom.listeners.add(listener);
    return () => {
      atom.listeners.delete(listener);
    };
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot(atom));
};

export const useRecoilState = (atom: Stored) => {
  return [useRecoilValue(atom), useSetRecoilState(atom)];
};

//

const snapshot = {
  getLoadable: (atom: Stored) => {
    const value = read(atom);
    return { state: atom.state, contents: value };
  },
  getPromise: (atom: Stored) => read(atom), // TODO
};

const createTransaction = () => {
  const touchedAtoms = new Set<Atom>();
  return {
    get(atom: Atom) {
      if (atom.type !== StoredType.atom)
        throw new Error('only atom can be used in transaction');
      return atom.value;
    },
    set(atom: Atom, value: TODO) {
      if (atom.type !== StoredType.atom)
        throw new Error('only atom can be used in transaction');
      if (typeof value === 'function') {
        atom.value = value(atom.value);
      } else {
        atom.value = value;
      }
      touchedAtoms.add(atom);
    },
    commit: () => {
      touchedAtoms.forEach((atom) => {
        write(atom, atom.value);
      });
      touchedAtoms.clear();
    },
  };
};

export const useRecoilCallback = (cb: TODO, deps: TODO[]) => {
  const transact_UNSTABLE = (cb: TODO) => {
    const transaction = createTransaction();
    cb({ get: transaction.get, set: transaction.set });
    transaction.commit();
  };
  return useCallback(
    // TODO snapshot should be really snapshot, not reading from live data
    (...args: any[]) => cb({ snapshot, transact_UNSTABLE })(...args),
    deps,
  );
};

export const useRecoilTransaction_UNSTABLE = (cb: TODO, deps: TODO[]) => {
  return useCallback((...args: any[]) => {
    const transaction = createTransaction();
    cb({ get: transaction.get, set: transaction.set })(...args);
    transaction.commit();
  }, deps);
};

// extra functionality that would be nice

// clears atomFamily and kills all selectors
// export const clear = (atom: Stored) => {};

// export const atomFamilyWithDefaultValue = (atom: Stored, value: TODO) => {};

// TODO to be able to run tests
export const clearStore = () => {
  store.clear();
};
