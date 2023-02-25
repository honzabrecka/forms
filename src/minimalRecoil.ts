export const atomFamily = ({ key, default }) => {};

export const selectorFamily = ({ key, get }) => (id) => ({ get }) => {};

export const waitForAll = (...listOrMap) => {
};

//

export const useRecoilState = (atom) => {};

export const useSetRecoilState = (atom) => {};

export const useRecoilValue = (atom) => {};

export const useRecoilValueLoadable = (atom) => {}

//

export const useRecoilCallback = (cb) => {
  const transact_UNSTABLE = (cb) => cb({ set });
  return (...args) => cb({ snapshot, transact_UNSTABLE })(...args);
}

export const useRecoilTransaction_UNSTABLE = (cb) => {
  return (...args) => cb({ get, set })(...args);
}
