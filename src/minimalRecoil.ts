/* eslint-disable camelcase */
import { useSyncExternalStore, useCallback } from 'react';
import { Callback0, Callback1 } from './types';

const noop: IGNORE = () => undefined;

const undef = Symbol('undef');

const isPromise = (value: any): boolean =>
  value && typeof value === 'object' && typeof value.then === 'function';

type TODO = any;

type IGNORE = any;

enum StoredType {
  atom,
  selector,
}

enum StoredState {
  loading,
  hasValue,
}

type LoadableState<V> =
  | {
      state: 'loading';
      contents: Promise<V>;
      valueMaybe: () => undefined;
      toPromise: () => Promise<V>;
      getValue: () => undefined;
    }
  | {
      state: 'hasValue';
      contents: V;
      valueMaybe: () => V;
      toPromise: () => Promise<V>;
      getValue: () => V;
    };

type Atom<V> = {
  type: StoredType.atom;
  atomId: string;
  value: V;
  defaultValue: V;
  state: StoredState;
  cachedLoadableState: LoadableState<V>;
  resolve?: Callback1<any>;
  dependents: Set<Stored<any>>;
  listeners: Set<Callback0>;
};

type SelectorFactoryProps = {
  get: (atom: Stored<any>) => any;
};
type SelectorFactory<V> = ({ get }: SelectorFactoryProps) => V | Promise<V>;

type Selector<V> = {
  type: StoredType.selector;
  atomId: string;
  factory: SelectorFactory<V>;
  value: V | Promise<V>;
  state: StoredState;
  cachedLoadableState: LoadableState<V>;
  resolve?: Callback1<any>;
  dependents: Set<Stored<any>>;
  listeners: Set<Callback0>;
};

type Stored<V> = Atom<V> | Selector<V>;

const debug = (...x: any) => {
  // console.log(...x);
  noop(...x);
};

const store = new Map<string, Stored<any>>();

const cacheAtomLoadableState = <V>(atom: Stored<V>) => {
  if (atom.state === StoredState.loading) {
    // (async atom) contents: (pending) Promise
    atom.cachedLoadableState = {
      state: 'loading',
      contents: atom.value as unknown as Promise<V>,
      valueMaybe: () => undefined,
      toPromise: () => getPromise(atom),
      getValue: () => getPromiseForSuspense(atom),
    };
  } else if (isPromise(atom.value)) {
    const { atomId, state, value } = atom;
    debug('cache', { atomId, state, value });
    // (async atom) contents: (resolved) Promise.value
    atom.cachedLoadableState = {
      state: 'hasValue',
      contents: (atom.value as any).value as V,
      valueMaybe: () => (atom.value as any).value as V,
      toPromise: () => getPromise(atom),
      getValue: () => getPromiseForSuspense(atom),
    };
  } else {
    // (simple atom)
    atom.cachedLoadableState = {
      state: 'hasValue',
      contents: atom.value as unknown as V,
      valueMaybe: () => atom.value as unknown as V,
      toPromise: () => Promise.resolve(atom.value),
      getValue: () => atom.value as unknown as V,
    };
  }

  return atom;
};

const handleThrowPromise = (atom: Stored<any>, e: TODO) => {
  if (e.type && e.type === 'valueIsPromise' && !e.promise.state) {
    e.promise.state = StoredState.loading;
    e.promise.atomId = atom.atomId;
    e.promise
      .then((resolvedValue: TODO) => {
        // TODO resolved with stale value
        console.log('(HTP) resolve promise', atom.atomId, resolvedValue);
        console.log('>', e.promise);
        e.promise.value = resolvedValue;
        e.promise.state = StoredState.hasValue;
        atom.state = StoredState.hasValue;
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
        // console.error(atom, e);

        handleThrowPromise(atom, e);
      });
    return;
  }

  if (isPromise(e) && !e.state) {
    e.state = StoredState.loading;
    e.atomId = atom.atomId;
    e.then((resolvedValue: TODO) => {
      debug('(HTP) resolve promise', atom.atomId, resolvedValue);
      e.value = resolvedValue;
      e.state = StoredState.hasValue;

      if (atom.resolve) {
        debug(
          '(HTP) resolve promise (atom.resolve)',
          atom.atomId,
          resolvedValue,
        );
        atom.state = StoredState.hasValue;
        atom.resolve(resolvedValue);
        cacheAtomLoadableState(atom);
      }

      notify(atom).forEach((l) => l());
    }).catch((e) => {
      // TODO why?
      debug('[catch]', atom.atomId, e);
      // console.error(atom, e);

      handleThrowPromise(atom, e);
    });
  }
};

const readPlain = (atom: Stored<any>) => {
  if (atom.type === StoredType.atom) return atom.value;
  if (atom.type === StoredType.selector) {
    const get = (dependentAtom) => {
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

const read = (atom: Stored<any>) => {
  try {
    const value = readPlain(atom);

    // debug('read:', atom.atomId, value);

    // async selector
    if (isPromise(value)) {
      debug('read (isPromise)', atom.atomId);
      if (value.state === StoredState.hasValue) return value.value;
      throw valueIsPromise(value);
    } else {
      if (atom.state === StoredState.loading) {
        atom.state = StoredState.hasValue;
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
      (isPromise(atom.value) && atom.value.state === undefined)
    ) {
      debug('create promise', atom.atomId, atom.value);
      atom.state = StoredState.loading;
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

const ignoredRead = (atom: Stored<any>) => {
  try {
    read(atom);
  } catch (e) {
    // ignore
  }
};

const compare = (a: any, b: any) => {
  if (isPromise(a) && isPromise(b)) {
    return (
      (a.state === StoredState.loading && b.state === StoredState.loading) ||
      (a.state === StoredState.hasValue &&
        b.state === StoredState.hasValue &&
        JSON.stringify(a) === JSON.stringify(b))
    );
  }
  if ((isPromise(a) && !isPromise(b)) || (isPromise(b) && !isPromise(a))) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
};

// if atom is modified, we need to notify all the dependent atoms (recursively)
// now run callbacks for all the components that are dependent on this atom
const notify = (atom: Stored<any>) => {
  debug('notify:', atom.atomId);

  const listeners = new Set<Callback0>();

  atom.listeners.forEach((l) => listeners.add(l));

  atom.dependents.forEach((d) => {
    if (d !== atom) {
      if (d.type === StoredType.atom) {
        notify(d).forEach((l) => listeners.add(l));
      } else if (d.type === StoredType.selector) {
        const get = (dependentAtom) => {
          dependentAtom.dependents.add(d);
          return read(dependentAtom);
        };

        try {
          const oldValue = d.value;
          const newValue = d.factory({ get });

          // console.log(
          //   'notify:',
          //   atom.atomId,
          //   oldValue,
          //   newValue,
          //   compare(oldValue, newValue),
          // );

          if (compare(oldValue, newValue)) {
            debug('same', d.atomId);
            return;
          }

          if (isPromise(newValue)) {
            // d.value = newValue;
            throw valueIsPromise(newValue);
          }

          if (d.state === StoredState.loading) {
            d.state = StoredState.hasValue;
            if (d.resolve) {
              d.resolve(newValue);
              d.resolve = undefined;
            }
            cacheAtomLoadableState(d);
            notify(d).forEach((l) => listeners.add(l));
            return;
          }

          if (d.state === StoredState.hasValue) {
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

          if (d.state === StoredState.hasValue) {
            debug('create promise (N)', d.atomId);
            d.state = StoredState.loading;
            d.value = new Promise((resolve) => {
              d.resolve = (value) => {
                if (isPromise(value)) {
                  console.error('resolve with promise???', atom);
                }
                console.log('resolved with', d.atomId, value);
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

type Updater<V> = (state: V) => V;
type ValueOrUpdater<V> = V | Updater<V>;

const write = <V>(atom: Stored<V>, value: ValueOrUpdater<V>, reset = false) => {
  debug('write:', atom.atomId);
  if (atom.type === StoredType.atom) {
    if (typeof value === 'function') {
      atom.value = (value as Updater<V>)(atom.value);
    } else {
      atom.value = value;
    }
    if (!reset) debug('write (value):', atom.value);
    cacheAtomLoadableState(atom);
    if (!reset) console.log('write', atom.atomId, atom.value);
    notify(atom).forEach((l) => l());
    return;
  }
  if (atom.type === StoredType.selector)
    throw new Error('unsupported write on selector');
  throw new Error('unsupported write');
};

const getSnapshot =
  <V>(atom: Stored<V>) =>
  () => {
    debug('getSnapshot', atom.atomId);
    ignoredRead(atom);
    return atom.cachedLoadableState;
  };

const getSnapshotForSuspense =
  <V>(atom: Stored<V>) =>
  () => {
    debug('getSnapshotForSuspense', atom.atomId);
    return atom.cachedLoadableState.getValue() as V;
  };

type AtomFamilyProps<V> = {
  key: string;
  default: (id: string) => V;
};

const emptyLoadableState: LoadableState<undefined> = {
  state: 'loading',
  contents: Promise.resolve(undefined),
  valueMaybe: () => undefined,
  toPromise: () => Promise.resolve(undefined),
  getValue: () => undefined,
};

export const atomFamily =
  <V, ID extends string>({ key, ...props }: AtomFamilyProps<V>) =>
  (id: ID) => {
    const atomId = `A/${key}/${id}`;
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
          state: StoredState.hasValue,
          cachedLoadableState: emptyLoadableState,
          listeners: new Set(),
          dependents: new Set(),
        })),
      );
    }

    return atom as Atom<V>;
  };

type SelectorFamilyProps<T> = {
  key: string;
  get: (id: string) => ({ get }: SelectorFactoryProps) => T;
  cachePolicy_UNSTABLE?: IGNORE;
};

export const selectorFamily =
  <V, ID extends string>({ key, get }: SelectorFamilyProps<V>) =>
  (id: ID) => {
    const atomId = `S/${key}/${id}`;
    let atom = store.get(atomId);
    if (!atom)
      store.set(
        atomId,
        (atom = cacheAtomLoadableState({
          atomId,
          type: StoredType.selector,
          value: undef as TODO,
          state: StoredState.loading,
          cachedLoadableState: emptyLoadableState,
          factory: get(id),
          listeners: new Set(),
          dependents: new Set(),
        })),
      );
    return atom as Selector<V>;
  };

//

export const useSetRecoilState = <V>(atom: Stored<V>) => {
  return useCallback(
    (value: ValueOrUpdater<V>) => {
      write(atom, value);
    },
    [atom],
  );
};

export const useRecoilValue = <V>(atom: Stored<V>) => {
  const subscribe = useCallback(
    (listener: Callback0) => {
      atom.listeners.add(listener);
      return () => {
        atom.listeners.delete(listener);
      };
    },
    [atom],
  );
  return useSyncExternalStore<V>(
    subscribe,
    useCallback(getSnapshotForSuspense(atom), [atom]),
  );
};

export const useRecoilValueLoadable = <V>(atom: Stored<V>) => {
  const subscribe = useCallback(
    (listener: Callback0) => {
      atom.listeners.add(listener);
      return () => {
        atom.listeners.delete(listener);
      };
    },
    [atom],
  );
  return useSyncExternalStore<LoadableState<V>>(subscribe, getSnapshot(atom));
};

export const useRecoilState = <V>(atom: Stored<V>) => {
  return [useRecoilValue<V>(atom), useSetRecoilState<V>(atom)] as const;
};

export const useResetRecoilState = <V>(atom: Stored<V>) => {
  return () => {
    if (atom.type === StoredType.atom) {
      write(atom, atom.defaultValue, true);
    }
  };
};

//

const getPromise = <V>(atom: Stored<V>) => {
  try {
    return Promise.resolve(read(atom));
  } catch (e) {
    return atom.value as Promise<V>;
  }
};

const getPromiseForSuspense = <V>(atom: Stored<V>) => {
  try {
    return read(atom);
  } catch (e) {
    throw atom.value;
  }
};

const snapshot = {
  getLoadable: <V>(atom: Stored<V>) => {
    ignoredRead(atom);
    return atom.cachedLoadableState;
  },
  getPromise: <V>(atom: Stored<V>) => atom.cachedLoadableState.toPromise(),
};

type Snapshot = typeof snapshot;

const createTransaction = () => {
  const touchedAtoms = new Set<Stored<unknown>>();
  let wasReset = false;
  return {
    get<V>(atom: Stored<V>) {
      if (atom.type !== StoredType.atom)
        throw new Error('only atom can be used in transaction');
      return atom.value;
    },
    set<V>(atom: Stored<V>, value: ValueOrUpdater<V>) {
      if (atom.type !== StoredType.atom)
        throw new Error('only atom can be used in transaction');
      if (typeof value === 'function') {
        atom.value = (value as Updater<V>)(atom.value);
      } else {
        atom.value = value;
      }
      touchedAtoms.add(atom);
    },
    reset<V>(atom: Stored<V>) {
      if (atom.type !== StoredType.atom)
        throw new Error('only atom can be used in transaction');
      atom.value = atom.defaultValue;
      touchedAtoms.add(atom);
      wasReset = true;
    },
    commit: () => {
      touchedAtoms.forEach((atom) => {
        write(atom, atom.value, wasReset);
      });
      touchedAtoms.clear();
    },
  };
};

type Transaction = {
  get: <V>(atom: Stored<V>) => V;
  set: <V>(atom: Stored<V>, value: ValueOrUpdater<V>) => void;
  reset: <V>(atom: Stored<V>) => void;
};

type TransactionCallback = (transaction: Transaction) => void;

type RecoilCallback<R> = (options: {
  snapshot: Snapshot;
  set: <V>(atom: Stored<V>, value: ValueOrUpdater<V>) => void;
  transact_UNSTABLE: (cb: TransactionCallback) => void;
}) => (...args: unknown[]) => R;

export const useRecoilCallback = <D extends ReadonlyArray<unknown>, R>(
  cb: RecoilCallback<R>,
  deps: D,
) => {
  return useCallback(
    // TODO snapshot should be really snapshot, not reading from live data
    (...args) => {
      const transact_UNSTABLE = (cb: TransactionCallback) => {
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
    deps,
  );
};

type RecoilTransaction = (
  transaction: Transaction,
) => (...args: unknown[]) => void;

export const useRecoilTransaction_UNSTABLE = <D extends ReadonlyArray<unknown>>(
  cb: RecoilTransaction,
  deps: D,
) => {
  return useCallback((...args: any[]) => {
    const transaction = createTransaction();
    cb({
      get: transaction.get,
      set: transaction.set,
      reset: transaction.reset,
    })(...args);
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
