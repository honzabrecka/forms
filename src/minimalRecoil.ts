/* eslint-disable camelcase */
import { useSyncExternalStore, useCallback, useEffect } from 'react';
import isEqual from 'lodash.isequal';
import throttle from 'lodash.throttle';
import { Callback0, Callback1 } from './types';

const debug = false;

const undef = Symbol('undef');

const isPromise = (value: any): boolean =>
  value && typeof value === 'object' && typeof value.then === 'function';

enum StoredType {
  atom,
  selector,
}

// @private
export enum StoredState {
  loading,
  hasValue,
}

export type LoadingLoadable<V> = {
  state: 'loading';
  contents: undefined;
  valueMaybe: () => undefined;
  getValue: () => undefined;
  toPromise: () => Promise<V>;
};

export type ValueLoadable<V> = {
  state: 'hasValue';
  contents: V;
  valueMaybe: () => V;
  getValue: () => V;
  toPromise: () => Promise<V>;
};

export type Loadable<V> = ValueLoadable<V> | LoadingLoadable<V>;

type Atom<V> = {
  type: StoredType.atom;
  id: string;
  partitionId: string;
  version: number;
  value: V;
  defaultValue: V;
  state: StoredState;
  destroyed: number;
  cachedLoadableState: Loadable<V>;
  resolve?: Callback1<any>;
  dependents: Set<Stored<any>>;
  listeners: {
    components: Set<Callback0>;
    atoms: Set<Stored<any>>;
  };
};

type SelectorFactoryProps = {
  get: (atom: Stored<any>) => any;
};
type SelectorFactory<V> = ({ get }: SelectorFactoryProps) => V | Promise<V>;

type Selector<V> = {
  type: StoredType.selector;
  id: string;
  partitionId: string;
  version: number;
  factory: SelectorFactory<V>;
  value: V | Promise<V>;
  state: StoredState;
  destroyed: number;
  cachedLoadableState: Loadable<V>;
  resolve?: Callback1<any>;
  dependents: Set<Stored<any>>;
  listeners: {
    components: Set<Callback0>;
    atoms: Set<Stored<any>>;
  };
};

type Stored<V> = Atom<V> | Selector<V>;

const cacheAtomLoadableState = <V>(atom: Stored<V>) => {
  if (atom.state === StoredState.loading) {
    // (async atom) contents: (pending) Promise
    atom.cachedLoadableState = {
      state: 'loading',
      contents: undefined,
      valueMaybe: () => undefined,
      toPromise: () => getPromise(atom),
      getValue: () => getPromiseForSuspense(atom),
    };
  } else if (isPromise(atom.value)) {
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

type P = Promise<any> & {
  id?: string;
  state?: StoredState;
  version?: number;
  internalPromise?: boolean;
  value?: any;
};

const outdated = (promise: P, atom: number) => {
  if (promise.internalPromise) return false;
  return promise.version !== atom;
};

type ValueIsPromise = {
  type: 'valueIsPromise';
  promise: P;
};

type E = ValueIsPromise | P | Error;

const eIsValueIsPromise = (e: any): e is ValueIsPromise =>
  e.type && e.type === 'valueIsPromise';

const eIsP = (e: any): e is P => isPromise(e);

// @private
export const handleThrowPromise = (atom: Stored<any>, e: E) => {
  if (eIsValueIsPromise(e) && e.promise.state === undefined) {
    if (debug) console.log('add then', atom.id, atom.version, e.promise);

    e.promise.state = StoredState.loading;
    e.promise.id = atom.id;
    e.promise.version = atom.version;
    e.promise
      .then((resolvedValue: any) => {
        if (atom.destroyed > 0) return;

        if (debug)
          console.log(
            '(HTP) resolve, version',
            atom.id,
            `[p:${e.promise.version};a:${atom.version}]`,
            e.promise,
          );

        if (outdated(e.promise, atom.version)) {
          if (debug)
            console.log(
              '(HTP) version mismatch',
              atom.id,
              `[${e.promise.version};${atom.version}]`,
              resolvedValue,
              atom.value,
            );
          return;
        }

        if (atom.resolve) {
          e.promise.value = resolvedValue;
          e.promise.state = StoredState.hasValue;

          atom.state = StoredState.hasValue;
          atom.resolve(resolvedValue);
          atom.resolve = undefined;
          atom.value.value = resolvedValue;
          atom.value.state = StoredState.hasValue;

          cacheAtomLoadableState(atom);

          if (debug)
            console.log(
              '(HTP) resolve promise',
              atom.id,
              resolvedValue,
              atom.value,
            );

          notify(atom).forEach((l) => l());
        }
      })
      .catch((e) => {
        if (debug) console.log('[catch]', atom.id, e);
        handleThrowPromise(atom, e);
      });
    return;
  }

  if (eIsP(e) && e.state === undefined) {
    if (debug) console.log('add then', atom.id, atom.version, e);
    e.version = atom.version;
    e.state = StoredState.loading;
    e.id = atom.id;
    e.then((resolvedValue: any) => {
      if (atom.destroyed > 0) return;

      if (debug)
        console.log(
          '(HTP) resolve, version',
          atom.id,
          `[p:${e.version};a:${atom.version}]`,
          e,
        );

      if (outdated(e, atom.version)) {
        if (debug)
          console.log(
            '(HTP) version mismatch',
            atom.id,
            `[${e.version};${atom.version}]`,
            resolvedValue,
            atom.value,
          );
        return;
      }

      if (debug) console.log('(HTP) resolve promise', atom.id, resolvedValue);

      e.value = resolvedValue;
      e.state = StoredState.hasValue;

      notify(atom).forEach((l) => l());
    }).catch((e) => {
      if (debug) console.log('[catch]', atom.id, e);
      handleThrowPromise(atom, e);
    });
  }
};

const readPlain = (atom: Stored<any>) => {
  if (atom.type === StoredType.atom) return atom.value;
  if (atom.type === StoredType.selector) {
    const get = (dependentAtom) => {
      dependentAtom.dependents.add(atom);
      atom.listeners.atoms.add(dependentAtom);
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

const valueIsPromise = (promise: Promise<any>): ValueIsPromise => ({
  type: 'valueIsPromise',
  promise,
});

// @private
export const read = (atom: Stored<any>) => {
  try {
    const value = readPlain(atom);

    // async selector
    if (isPromise(value)) {
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
  } catch (e: any) {
    if (debug) console.log('read (catch)', atom.id, e);

    handleThrowPromise(atom, e);

    // throw in inner get
    if (
      !isPromise(atom.value) ||
      (isPromise(atom.value) && atom.value.state === undefined)
    ) {
      if (debug)
        console.log('create promise', atom.id, atom.value, atom.version);
      atom.state = StoredState.loading;
      atom.value = new Promise((resolve) => {
        atom.resolve = (value) => {
          if (isPromise(value)) {
            if (debug) console.error('resolve with promise???', atom);
          }
          if (debug) console.log('resolved with', atom.id, value);
          resolve(value);
        };
      });
      atom.value.internalPromise = true;
      cacheAtomLoadableState(atom);
    }

    if (eIsValueIsPromise(e)) {
      throw e.promise;
    }

    throw e;
  }
};

const readWithIgnoredThrow = (atom: Stored<any>) => {
  try {
    read(atom);
  } catch (e) {
    // ignore
  }
};

// @private
export const compare = (a: any, b: any) => {
  if (isPromise(a) && isPromise(b)) {
    return (
      (a.state === StoredState.loading && b.state === StoredState.loading) ||
      (a.state === StoredState.hasValue &&
        b.state === StoredState.hasValue &&
        isEqual(a.value, b.value)) ||
      a === b
    );
  }
  if ((isPromise(a) && !isPromise(b)) || (isPromise(b) && !isPromise(a))) {
    return false;
  }
  return isEqual(a, b);
};

// const logTree = (atom) => {
//   console.log([atom.id, atom.value]);
//   console.log(
//     '>',
//     [...atom.dependents].map(({ id, value }) => [id, value]),
//   );
// };

// if atom is modified, we need to notify all the dependent atoms (recursively)
// now run callbacks for all the components that are dependent on this atom
// @private
export const notify = (atom: Stored<any>) => {
  if (debug) console.log('notify:', atom.id);

  const listeners = new Set<Callback0>();

  atom.listeners.components.forEach((l) => listeners.add(l));

  atom.dependents.forEach((d) => {
    if (d !== atom) {
      if (d.type === StoredType.atom) {
        notify(d).forEach((l) => listeners.add(l));
      } else if (d.type === StoredType.selector) {
        const get = (dependentAtom) => {
          dependentAtom.dependents.add(d);
          d.listeners.atoms.add(dependentAtom);
          return read(dependentAtom);
        };

        try {
          const oldValue = d.value;
          const newValue = d.factory({ get });

          // if (debug) console.log(
          //   'notify:',
          //   atom.id,
          //   oldValue,
          //   newValue,
          //   compare(oldValue, newValue),
          // );

          if (compare(oldValue, newValue)) {
            if (debug) console.log('same', d.id);
            return;
          }

          if (isPromise(newValue) && newValue.state !== StoredState.hasValue) {
            throw valueIsPromise(newValue);
          }

          if (debug) console.log('inc version (notify)', d.id);
          d.version++;

          if (d.state === StoredState.loading) {
            if (d.resolve) {
              d.state = StoredState.hasValue;
              d.value.state = StoredState.hasValue;
              d.value.value = newValue;

              d.resolve(newValue);
              d.resolve = undefined;

              cacheAtomLoadableState(d);
              notify(d).forEach((l) => listeners.add(l));
            }
            return;
          }

          d.state = StoredState.hasValue;
          d.value = newValue;
          cacheAtomLoadableState(d);
          notify(d).forEach((l) => listeners.add(l));
        } catch (e: any) {
          if (debug) console.log('thrown', d.id, e);

          if (
            (eIsValueIsPromise(e) && e.promise.state === undefined) ||
            (isPromise(e) && e.state === undefined)
          ) {
            if (debug) console.log('inc version (notify, catch)', d.id);
            d.version++;
          }

          handleThrowPromise(d, e);

          if (d.state === StoredState.hasValue) {
            if (debug) console.log('create promise (N)', d.id);
            d.state = StoredState.loading;
            d.value = new Promise((resolve) => {
              d.resolve = (value) => {
                if (isPromise(value)) {
                  if (debug) console.error('resolve with promise???', atom);
                }
                if (debug) console.log('resolved with', d.id, value);
                resolve(value);
              };
            });
            d.value.internalPromise = true;
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

// @private
export const write = <V>(
  atom: Stored<V>,
  value: ValueOrUpdater<V>,
  reset = false,
) => {
  if (debug) console.log('write:', atom.id);
  if (atom.type === StoredType.atom) {
    if (typeof value === 'function') {
      atom.value = (value as Updater<V>)(atom.value);
    } else {
      atom.value = value;
    }
    if (!reset) if (debug) console.log('write (value):', atom.value);
    cacheAtomLoadableState(atom);
    atom.version++;
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
    // if (debug) console.log('getSnapshot', atom.id);
    readWithIgnoredThrow(atom);
    return atom.cachedLoadableState;
  };

const getSnapshotForSuspense =
  <V>(atom: Stored<V>) =>
  () => {
    // if (debug) console.log('getSnapshotForSuspense', atom.id);
    return atom.cachedLoadableState.getValue() as V;
  };

const emptyLoadableState: Loadable<undefined> = {
  state: 'loading',
  contents: undefined,
  valueMaybe: () => undefined,
  toPromise: () => Promise.resolve(undefined),
  getValue: () => undefined,
};

// @private
export const partitions = new Map<string, Map<string, Stored<any>>>();

const getPartition = (id: string) => {
  let partition = partitions.get(id);
  if (!partition) {
    partition = new Map<string, Stored<any>>();
    partitions.set(id, partition);
  }
  return partition;
};

const globalPartitionId = 'minimal-recoil/global';

const defaultGetPartitionFromId = () => globalPartitionId;

type AtomProps<V> = {
  key: string;
  default: V;
};

// TODO test
export const atom = <V>({ key, ...props }: AtomProps<V>) => {
  const partition = globalPartitionId;
  const newId = `A/${key}`;
  let atom = getPartition(partition).get(newId);
  if (!atom) {
    const value = props.default;
    getPartition(partition).set(
      newId,
      (atom = cacheAtomLoadableState({
        id: newId,
        partitionId: partition,
        type: StoredType.atom,
        version: 0,
        value,
        defaultValue: value,
        state: StoredState.hasValue,
        destroyed: 0,
        cachedLoadableState: emptyLoadableState,
        listeners: {
          components: new Set(),
          atoms: new Set(),
        },
        dependents: new Set(),
      })),
    );
  }

  return atom as Atom<V>;
};

type AtomFamilyProps<V> = {
  key: string;
  default: (id: string) => V;
  getPartitionFromId?: (id: string) => string;
};

export const atomFamily =
  <V>({
    key,
    getPartitionFromId = defaultGetPartitionFromId,
    ...props
  }: AtomFamilyProps<V>) =>
  (id: string) => {
    const partition = getPartitionFromId(id);
    const newId = `A/${key}/${id}`;
    let atom = getPartition(partition).get(newId);
    if (!atom) {
      const value = props.default(id);
      getPartition(partition).set(
        newId,
        (atom = cacheAtomLoadableState({
          id: newId,
          partitionId: partition,
          type: StoredType.atom,
          version: 0,
          value,
          defaultValue: value,
          state: StoredState.hasValue,
          destroyed: 0,
          cachedLoadableState: emptyLoadableState,
          listeners: {
            components: new Set(),
            atoms: new Set(),
          },
          dependents: new Set(),
        })),
      );
    }

    return atom as Atom<V>;
  };

type SelectorProps<T> = {
  key: string;
  get: ({ get }: SelectorFactoryProps) => T;
};

// TODO test
export const selector = <V>({ key, get }: SelectorProps<V>) => {
  const partition = globalPartitionId;
  const newId = `S/${key}`;
  let atom = getPartition(partition).get(newId);
  if (!atom)
    getPartition(partition).set(
      newId,
      (atom = cacheAtomLoadableState({
        id: newId,
        partitionId: partition,
        type: StoredType.selector,
        version: 0,
        value: undef as any,
        state: StoredState.loading,
        destroyed: 0,
        cachedLoadableState: emptyLoadableState,
        factory: get,
        listeners: {
          components: new Set(),
          atoms: new Set(),
        },
        dependents: new Set(),
      })),
    );
  return atom as Selector<V>;
};

type SelectorFamilyProps<T> = {
  key: string;
  get: (id: string) => ({ get }: SelectorFactoryProps) => T;
  getPartitionFromId?: (id: string) => string;
};

export const selectorFamily =
  <V>({
    key,
    get,
    getPartitionFromId = defaultGetPartitionFromId,
  }: SelectorFamilyProps<V>) =>
  (id: string) => {
    const partition = getPartitionFromId(id);
    const newId = `S/${key}/${id}`;
    let atom = getPartition(partition).get(newId);
    if (!atom)
      getPartition(partition).set(
        newId,
        (atom = cacheAtomLoadableState({
          id: newId,
          partitionId: partition,
          type: StoredType.selector,
          version: 0,
          value: undef as any,
          state: StoredState.loading,
          destroyed: 0,
          cachedLoadableState: emptyLoadableState,
          factory: get(id),
          listeners: {
            components: new Set(),
            atoms: new Set(),
          },
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
      atom.listeners.components.add(listener);
      return () => {
        atom.listeners.components.delete(listener);
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
      atom.listeners.components.add(listener);
      return () => {
        atom.listeners.components.delete(listener);
      };
    },
    [atom],
  );
  return useSyncExternalStore<Loadable<V>>(subscribe, getSnapshot(atom));
};

export const useRecoilState = <V>(atom: Stored<V>) => {
  return [useRecoilValue<V>(atom), useSetRecoilState<V>(atom)] as const;
};

export const useResetRecoilState = <V>(atom: Stored<V>) => {
  return () => {
    if (atom.type === StoredType.atom) {
      write(atom, atom.defaultValue, true);
      return;
    }
    if (atom.type === StoredType.selector)
      throw new Error('unsupported reset on selector');
    throw new Error('unsupported reset');
  };
};

type WaitFor = Stored<any>[] | { [key: string]: Stored<any> };

const emptyArrayAtom = atomFamily({
  key: 'waitForAll/emptyArray',
  default: () => [],
});

const emptyMapAtom = atomFamily({
  key: 'waitForAll/emptyMap',
  default: () => ({}),
});

const waitForAllArray = (atoms: Stored<any>[]) => {
  if (atoms.length === 0) return emptyArrayAtom('internal');

  const { partitionId } = atoms[0];
  const id = atoms.reduce((acc, { id }) => `${acc}/${id}`, partitionId);
  let selector = getPartition(partitionId).get(id);

  if (!selector) {
    selector = selectorFamily<any[]>({
      key: 'waitForAll/array',
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
    // no need to set it to store manually as it is done by selectorFamily call
  }

  return selector;
};

const waitForAllMap = (atoms: { [key: string]: Stored<any> }) => {
  const entries = Object.entries(atoms);

  if (entries.length === 0) return emptyMapAtom('internal');

  const { partitionId } = entries[0][1];
  const id = entries.reduce((acc, [, { id }]) => `${acc}/${id}`, partitionId);
  let selector = getPartition(partitionId).get(id);

  if (!selector) {
    selector = selectorFamily<{ [key: string]: any }>({
      key: 'waitForAll/map',
      get:
        () =>
        ({ get }) => {
          let throws = false;
          const resolved = entries.reduce((acc, [key, atom]) => {
            try {
              acc[key] = get(atom);
            } catch (e) {
              throws = true;
            }
            return acc;
          }, {});
          if (throws) throw Error('pending waitForAll');
          return resolved;
        },
    })(id);
    // no need to set it to store manually as it is done by selectorFamily call
  }

  return selector;
};

export const waitForAll = (atoms: WaitFor) => {
  return Array.isArray(atoms) ? waitForAllArray(atoms) : waitForAllMap(atoms);
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
    readWithIgnoredThrow(atom);
    return atom.cachedLoadableState;
  },
  getPromise: <V>(atom: Stored<V>) => atom.cachedLoadableState.toPromise(),
  // custom addition
  // useful for reading selectors that are always sync,
  // so no need to shuffle with state & contents (TS thing, yes)
  getValue: <V>(atom: Stored<V>) => {
    return getPromiseForSuspense(atom);
  },
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
}) => (...args: any[]) => R;

export const useRecoilCallback = <D extends ReadonlyArray<unknown>, R>(
  cb: RecoilCallback<R>,
  deps: D,
) => {
  return useCallback(
    // TODO snapshot should be really snapshot, not reading from live data
    (...args: unknown[]) => {
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

type RecoilTransaction = (transaction: Transaction) => (...args: any[]) => void;

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

const partitionsToGC = new Set<string>();

// clears the whole partition, nothing smart & no hard feelings
const runPartitionGC = throttle(
  () => {
    if (debug) console.log('running GC', partitionsToGC);

    const id = partitionsToGC.values().next().value;

    if (id) {
      if (debug) console.log('running GC on partition', id);

      const partition = partitions.get(id);

      if (partition) {
        const now = Date.now();

        partition.forEach((atom) => {
          if (atom.destroyed > 0 && now > atom.destroyed) {
            atom.dependents = new Set();
            atom.listeners = {
              components: new Set(),
              atoms: new Set(),
            };
            partition.delete(atom.id);
          }
        });

        if (partition.size === 0) {
          partitions.delete(id);
          partitionsToGC.delete(id);
        }
      }

      if (partitionsToGC.size > 0) {
        runPartitionGC();
      }
    }
  },
  200,
  { leading: false },
);

// TODO custom addition
// NOTE atoms/selectors in global partition are not GCed at all
export const useRecoilPartitionGC_UNSTABLE = (id: string) => {
  useEffect(() => {
    const mark = (destroyed: number) => {
      const partition = partitions.get(id);
      if (partition) {
        partition.forEach((atom) => {
          atom.destroyed = destroyed;
        });
      }
    };
    mark(0);
    partitionsToGC.delete(id);
    return () => {
      const now = Date.now();
      mark(now + 250);
      partitionsToGC.add(id);
      runPartitionGC();
    };
  }, [id]);
};
