/* eslint-disable camelcase */
import { useSyncExternalStore, useCallback } from 'react';
import { Callback0, Callback1 } from './types';

const noop: IGNORE = () => undefined;

const undef = Symbol('undef');

const isPromise = (value: TODO) =>
  value && typeof value === 'object' && typeof value.then === 'function';

type TODO = any;

type IGNORE = any;

enum StoredType {
  atom,
  selector,
}

type LoadableState = 'hasValue' | 'loading';

type Atom = {
  type: StoredType.atom;
  atomId: string;
  value: TODO;
  defaultValue: TODO;
  state: LoadableState;
  cachedLoadableState: TODO;
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
  cachedLoadableState: TODO;
  resolve?: Callback1<any>;
  dependents: Set<Stored>;
  listeners: Set<Callback0>;
};

type Stored = Atom | Selector;

const debug = (...x: any) => {
  // console.log(...x);
  noop(...x);
};

const store = new Map<string, Stored>(); // new WeakMap();

const cacheAtomLoadableState = (atom: Stored) => {
  if (atom.state === 'loading') {
    // (async atom) contents: Promise
    atom.cachedLoadableState = {
      state: 'loading',
      contents: atom.value,
      valueMaybe: undefined,
      toPromise: () => getPromise(atom),
      getValue: () => getPromiseForSuspense(atom),
    };
  } else if (isPromise(atom.value)) {
    const { atomId, state, value } = atom;
    debug('cache', { atomId, state, value });
    // (async atom) contents: (resolved) Promise.value
    atom.cachedLoadableState = {
      state: 'hasValue',
      contents: atom.value.value,
      valueMaybe: () => atom.value.value,
      toPromise: () => getPromise(atom),
      getValue: () => getPromiseForSuspense(atom),
      p: true,
    };
  } else {
    // (simple atom)
    atom.cachedLoadableState = {
      state: 'hasValue',
      contents: atom.value,
      valueMaybe: () => atom.value,
      toPromise: () => Promise.resolve(atom.value),
      getValue: () => atom.value,
    };
  }

  return atom;
};

const handleThrowPromise = (atom: Stored, e: TODO) => {
  if (e.type && e.type === 'valueIsPromise' && !e.promise.state) {
    e.promise.state = 'loading';
    e.promise.atomId = atom.atomId;
    e.promise
      .then((resolvedValue: TODO) => {
        // TODO resolved with stale value
        debug('(HTP) resolve promise', atom.atomId, resolvedValue);
        e.promise.value = resolvedValue;
        e.promise.state = 'hasValue';
        atom.state = 'hasValue';
        if (atom.resolve) {
          atom.resolve(resolvedValue);
          atom.resolve = undefined;
        }
        cacheAtomLoadableState(atom);
        notify(atom).forEach((l) => l());
      })
      .catch((e) => {
        // TODO why?
        debug('[catch]', atom.atomId, e);
        console.error(atom, e);
      });
    return;
  }

  if (isPromise(e) && !e.state) {
    e.state = 'loading';
    e.atomId = atom.atomId;
    e.then((resolvedValue: TODO) => {
      debug('(HTP) resolve promise', atom.atomId, resolvedValue);
      e.value = resolvedValue;
      e.state = 'hasValue';

      if (atom.resolve) {
        debug(
          '(HTP) resolve promise (atom.resolve)',
          atom.atomId,
          resolvedValue,
        );
        atom.state = 'hasValue';
        atom.resolve(resolvedValue);
        cacheAtomLoadableState(atom);
      }

      notify(atom).forEach((l) => l());
    }).catch((e) => {
      // TODO why?
      debug('[catch]', atom.atomId, e);
      console.error(atom, e);
    });
  }
};

const readPlain = (atom: Stored) => {
  if (atom.type === StoredType.atom) return atom.value;
  if (atom.type === StoredType.selector) {
    const get = (dependentAtom: Stored) => {
      dependentAtom.dependents.add(atom);
      return read(dependentAtom);
    };
    // compute only in case it's first read
    if (atom.value === undef) {
      return atom.factory({ get });
    }
    return atom.value;
  }
  throw new Error('unsupported read');
};

const valueIsPromise = (promise: Promise<TODO>) => ({
  type: 'valueIsPromise',
  promise,
});

const read = (atom: Stored) => {
  try {
    const value = readPlain(atom);

    debug('read:', atom.atomId, value);

    // async selector
    if (isPromise(value)) {
      debug('read (isPromise)', atom.atomId);
      if (value.state === 'hasValue') return value.value;
      throw valueIsPromise(value);
    } else {
      if (atom.state === 'loading') {
        atom.state = 'hasValue';
        atom.value = value;
        cacheAtomLoadableState(atom);
      }
      return value;
    }
  } catch (e: TODO) {
    debug('read (catch)', atom.atomId, e);

    handleThrowPromise(atom, e);

    // throw in inner get
    if (
      !isPromise(atom.value) ||
      (isPromise(atom.value) && !atom.value.state)
    ) {
      debug('create promise', atom.atomId, atom.value);
      atom.state = 'loading';
      atom.value = new Promise((resolve) => {
        atom.resolve = (value) => {
          if (isPromise(value)) {
            console.error('resolve with promise???', atom);
          }
          debug('resolved with', atom.atomId, value);
          resolve(value);
        };
      });
      cacheAtomLoadableState(atom);
    }

    if (e.type && e.type === 'valueIsPromise') {
      throw e.promise;
    }

    throw e;
  }
};

const ignoredRead = (atom: Stored) => {
  try {
    read(atom);
  } catch (e) {
    // ignore
  }
};

const compare = (a: TODO, b: TODO) => {
  if (isPromise(a) && isPromise(b)) {
    return a === b;
  }
  if ((isPromise(a) && !isPromise(b)) || (isPromise(b) && !isPromise(a))) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
};

// if atom is modified, we need to notify all the dependent atoms (recursively)
// now run callbacks for all the components that are dependent on this atom
const notify = (atom: Stored) => {
  debug('notify:', atom.atomId);

  const listeners = new Set<Callback0>();

  atom.listeners.forEach((l) => listeners.add(l));

  atom.dependents.forEach((d) => {
    if (d !== atom) {
      if (d.type === StoredType.atom) {
        notify(d).forEach((l) => listeners.add(l));
      } else if (d.type === StoredType.selector) {
        const get = (dependentAtom: Stored) => {
          dependentAtom.dependents.add(d);
          return read(dependentAtom);
        };

        try {
          const oldValue = d.value;
          const newValue = d.factory({ get });

          debug('notify:', atom.atomId, newValue);

          if (compare(oldValue, newValue)) {
            debug('same', d.atomId);
            return;
          }

          if (isPromise(newValue)) {
            // d.value = newValue;
            throw valueIsPromise(newValue);
          }

          if (d.state === 'loading') {
            d.state = 'hasValue';
            if (d.resolve) {
              d.resolve(newValue);
              d.resolve = undefined;
            }
            cacheAtomLoadableState(d);
            notify(d).forEach((l) => listeners.add(l));
            return;
          }

          if (d.state === 'hasValue') {
            // if (isPromise(newValue)) {
            //   d.value = newValue;
            //   throw valueIsPromise(newValue);
            // }
            d.value = newValue;
            cacheAtomLoadableState(d);
            notify(d).forEach((l) => listeners.add(l));
          }
        } catch (e: TODO) {
          debug('thrown', d.atomId, e);
          handleThrowPromise(d, e);

          if (d.state === 'hasValue') {
            debug('create promise (N)', d.atomId);
            d.state = 'loading';
            d.value = new Promise((resolve) => {
              d.resolve = (value) => {
                if (isPromise(value)) {
                  console.error('resolve with promise???', atom);
                }
                debug('resolved with', d.atomId, value);
                resolve(value);
              };
            });
            cacheAtomLoadableState(d);
            notify(d).forEach((l) => listeners.add(l));
          }
        }
      }
    }
  });

  return listeners;
};

const write = (atom: Stored, value: TODO) => {
  debug('write:', atom.atomId);
  if (atom.type === StoredType.atom) {
    if (typeof value === 'function') {
      atom.value = value(atom.value);
    } else {
      atom.value = value;
    }
    debug('write (value):', atom.value);
    cacheAtomLoadableState(atom);
    notify(atom).forEach((l) => l());
    return;
  }
  if (atom.type === StoredType.selector)
    throw new Error('unsupported write on selector');
  throw new Error('unsupported write');
};

const getSnapshot = (atom: TODO, suspense: boolean) => () => {
  debug('getSnapshot', atom.atomId);

  if (suspense) {
    return atom.cachedLoadableState.getValue();
  }

  ignoredRead(atom);
  return atom.cachedLoadableState;
};

type AtomFamilyProps<T> = {
  key: string;
  default: (id: string) => T;
};

export const atomFamily =
  <Value, ID extends string>({ key, ...props }: AtomFamilyProps<Value>) =>
  (id: ID) => {
    const atomId = `${key}/${id}`;
    let atom = store.get(atomId);
    if (!atom) {
      const value = props.default(id);
      store.set(
        atomId,
        (atom = cacheAtomLoadableState({
          atomId,
          type: StoredType.atom,
          value,
          defaultValue: value,
          state: 'hasValue',
          cachedLoadableState: undefined,
          listeners: new Set(),
          dependents: new Set(),
        })),
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
    const atomId = `${key}/${id}`;
    let atom = store.get(atomId);
    if (!atom)
      store.set(
        atomId,
        (atom = cacheAtomLoadableState({
          atomId,
          type: StoredType.selector,
          value: undef,
          state: 'loading',
          cachedLoadableState: undefined,
          factory: get(id),
          listeners: new Set(),
          dependents: new Set(),
        })),
      );
    return atom;
  };

//

export const useSetRecoilState = (atom: Stored) => {
  return useCallback(
    (value: TODO) => {
      write(atom, value);
    },
    [atom],
  );
};

export const useRecoilValue = <T>(atom: Stored) => {
  const subscribe = useCallback(
    (listener: Callback0) => {
      atom.listeners.add(listener);
      return () => {
        atom.listeners.delete(listener);
      };
    },
    [atom],
  );
  return useSyncExternalStore(
    subscribe,
    useCallback(getSnapshot(atom as T, true), [atom]),
  );
};

export const useRecoilValueLoadable = <T>(atom: Stored): T => {
  const subscribe = useCallback(
    (listener: Callback0) => {
      atom.listeners.add(listener);
      return () => {
        atom.listeners.delete(listener);
      };
    },
    [atom],
  );
  return useSyncExternalStore(subscribe, getSnapshot(atom, false)) as T;
};

export const useRecoilState = (atom: Stored) => {
  return [useRecoilValue(atom) as TODO, useSetRecoilState(atom)] as const;
};

// TODO
export const useResetRecoilState = (atom: Stored) => {
  return () => {
    if (atom.type === StoredType.atom) {
      write(atom, atom.defaultValue);
    }
  };
};

//

const getPromise = (atom: Stored) => {
  try {
    return read(atom);
  } catch (e) {
    return atom.value;
  }
};

const getPromiseForSuspense = (atom: Stored) => {
  try {
    return read(atom);
  } catch (e) {
    throw atom.value;
  }
};

const snapshot = {
  getLoadable: (atom: Stored) => {
    ignoredRead(atom);
    return atom.cachedLoadableState;
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
      atom.value = atom.defaultValue;
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
  return useCallback(
    // TODO snapshot should be really snapshot, not reading from live data
    (...args: any[]): R => {
      const transact_UNSTABLE = (cb: TODO) => {
        const transaction = createTransaction();
        cb({
          get: transaction.get,
          set: transaction.set,
          reset: transaction.reset,
        });
        transaction.commit();
      };
      return cb({ snapshot, set: write, transact_UNSTABLE })(...args);
    },
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
