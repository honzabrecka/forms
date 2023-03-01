/* eslint-disable camelcase */
import { useSyncExternalStore, useCallback } from 'react';
import { Callback0, Callback1 } from './types';

const noop: IGNORE = () => undefined;

const undef = Symbol('undef');

const clone = (x: any) => {
  if (typeof x === 'object' && !Array.isArray(x)) {
    return { ...x };
  }
  return x;
};

const isPromise = (value: TODO) =>
  value && typeof value === 'object' && typeof value.then === 'function';

type TODO = any;

type IGNORE = any;

enum StoredType {
  atom,
  selector,
}

type LoadableState = 'hasValue' | 'loading' | 'hasError';

type Atom = {
  type: StoredType.atom;
  atomId: string;
  value: TODO;
  defaultValue: TODO;
  state: LoadableState;
  resolve?: Callback1<any>;
  dependents: Set<Stored>;
  listeners: Set<Callback0>;
};

type SelectorFactoryProps = {
  get: (atom: Stored) => TODO;
};

type Selector = {
  type: StoredType.selector;
  atomId: string;
  factory: ({ get }: SelectorFactoryProps) => TODO;
  value: TODO;
  state: LoadableState;
  resolve?: Callback1<any>;
  dependents: Set<Stored>;
  listeners: Set<Callback0>;
};

type Stored = Atom | Selector;

const debug = (...x: any) => {
  console.log(...x);
  noop(...x);
};

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
      try {
        atom.state = 'hasValue';
        atom.value = atom.factory({ get });
      } catch (e) {
        atom.state = 'loading';
        atom.value = new Promise((resolve) => {
          atom.resolve = resolve;
        });
      }
    }
    return atom.value;
  }
  throw new Error('unsupported read');
};

const read = (atom: Stored) => {
  try {
    debug('read:', atom);
    // if inner `get(s)` not ready it throws promise
    const value = readPlain(atom);

    debug('read (value):', value);

    // selector marked as async or returns promise
    if (isPromise(value)) {
      debug('read (isPromise)', atom);
      throw value;
    } else {
      return value;
    }
  } catch (e: TODO) {
    debug('read (catch)', atom, e);

    if (isPromise(e) && !e.waiting) {
      e.waiting = true;
      e.then((resolvedValue: TODO) => {
        atom.state = 'hasValue';
        atom.value = resolvedValue;
        notify(atom);
      });
    }

    throw e;
  }
};

// if atom is modified, we need to notify all the dependent atoms (recursively)
// now run callbacks for all the components that are dependent on this atom
const notify = (atom: Stored) => {
  debug('notify:', atom);
  if (atom.resolve) {
    atom.resolve(atom.value);
    atom.resolve = undefined;
  }
  let changed = false;
  atom.dependents.forEach((d) => {
    if (d !== atom) {
      if (d.type === StoredType.atom) {
        notify(d);
        changed = true;
      } else if (d.type === StoredType.selector) {
        const get = (dependentAtom: Stored) => {
          dependentAtom.dependents.add(d);
          return read(dependentAtom);
        };

        try {
          const newValue = d.factory({ get });
          d.state = 'hasValue';

          // selectors are recomputed only in case dependent atom has changed
          if (!Object.is(d.value, newValue)) {
            d.value = newValue;
            notify(d);
            changed = true;
          }
        } catch (e) {
          // to avoid creating promises that never resolves
          // -> reuse existing pending promise
          if (d.state === 'loading') return;

          d.state = 'loading';
          d.value = new Promise((resolve) => {
            d.resolve = resolve;
          });
        }
      }
    }
  });

  if (changed || atom.dependents.size === 0) {
    atom.listeners.forEach((l) => l());
  }
};

const write = (atom: Stored, value: TODO) => {
  console.log('write:', atom);
  if (atom.type === StoredType.atom) {
    if (typeof value === 'function') {
      atom.value = value(atom.value);
    } else {
      atom.value = value;
    }
    console.log('write (value):', atom.value);
    notify(atom);
    return;
  }
  if (atom.type === StoredType.selector)
    throw new Error('unsupported write on selector');
  throw new Error('unsupported write');
};

const getSnapshot = (atom: TODO, suspense: boolean) => () => {
  if (suspense) {
    return read(atom);
  }

  try {
    const value = read(atom);
    return { state: atom.state, contents: value };
  } catch (e) {
    return { state: atom.state, contents: e };
  }
};

type AtomFamilyProps<T> = {
  key: string;
  default: (id: string) => T;
};

export const atomFamily =
  <Value, ID extends string>({ key, ...props }: AtomFamilyProps<Value>) =>
  (id: ID) => {
    const atomId = `${key}${id}`;
    let atom = store.get(atomId);
    if (!atom) {
      const value = props.default(id);
      store.set(
        atomId,
        (atom = {
          atomId,
          type: StoredType.atom,
          value,
          defaultValue: clone(value),
          state: 'hasValue',
          listeners: new Set(),
          dependents: new Set(),
        }),
      );
    }

    return atom;
  };

type SelectorFamilyProps<T> = {
  key: string;
  get: (id: string) => ({ get }: SelectorFactoryProps) => T;
  cachePolicy_UNSTABLE?: IGNORE;
};

export const selectorFamily =
  <Value, ID extends string>({ key, get }: SelectorFamilyProps<Value>) =>
  (id: ID) => {
    const atomId = `${key}${id}`;
    let atom = store.get(atomId);
    if (!atom)
      store.set(
        atomId,
        (atom = {
          atomId,
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

const waitForAllStore = new WeakMap<Stored[], TODO>();

// TODO support map (now only list)
export const waitForAll = (atoms: Stored[]) => {
  let atom = waitForAllStore.get(atoms);

  if (!atom) {
    const id = atoms.reduce((acc, { atomId }) => acc + atomId, '');

    atom = selectorFamily({
      key: 'waitForAll',
      get:
        () =>
        ({ get }) => {
          let throws = false;
          const resolved = atoms.map((atom) => {
            try {
              return get(atom);
            } catch (e) {
              throws = true;
              return null; // just to please linter
            }
          });
          if (throws) throw Error('pending waitForAll');
          return resolved;
        },
    })(id);

    waitForAllStore.set(atoms, atom);
  }

  return atom;
};

//

export const useSetRecoilState = (atom: Stored) => {
  return (value: TODO) => {
    write(atom, value);
  };
};

export const useRecoilValue = <T>(atom: Stored) => {
  const subscribe = useCallback((listener: Callback0) => {
    atom.listeners.add(listener);
    return () => {
      atom.listeners.delete(listener);
    };
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot(atom, true)) as T;
};

// do not throw promise (suspense)
export const useRecoilValueLoadable = <T>(atom: Stored): T => {
  const subscribe = useCallback((listener: Callback0) => {
    atom.listeners.add(listener);
    return () => {
      atom.listeners.delete(listener);
    };
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot(atom, false)) as T;
};

export const useRecoilState = (atom: Stored) => {
  return [useRecoilValue(atom) as TODO, useSetRecoilState(atom)] as const;
};

// TODO
export const useResetRecoilState = (atom: Stored) => {
  return () => {
    if (atom.type === StoredType.atom) {
      atom.value = clone(atom.defaultValue);
      notify(atom);
    }
  };
};

//

const getPromise = (atom: Stored) => {
  try {
    return read(atom);
  } catch (e) {
    return e;
  }
};

const snapshot = {
  getLoadable: (atom: Stored) => {
    const valueMaybe = () => getPromise(atom);
    try {
      const value = read(atom);
      return { state: atom.state, contents: value, valueMaybe };
    } catch (e) {
      return { state: atom.state, contents: e, valueMaybe };
    }
  },
  getPromise: (atom: Stored) => getPromise(atom),
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
    reset(atom: Atom) {
      if (atom.type !== StoredType.atom)
        throw new Error('only atom can be used in transaction');
      atom.value = clone(atom.defaultValue);
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

export const useRecoilCallback = <X, R extends TODO>(cb: TODO, deps: X) => {
  const transact_UNSTABLE = (cb: TODO) => {
    const transaction = createTransaction();
    cb({
      get: transaction.get,
      set: transaction.set,
      reset: transaction.reset,
    });
    transaction.commit();
  };
  return useCallback(
    // TODO snapshot should be really snapshot, not reading from live data
    (...args: any[]): R =>
      cb({ snapshot, set: write, transact_UNSTABLE })(...args),
    deps as TODO,
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
