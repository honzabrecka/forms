import {
  success,
  warning,
  error,
  multi,
  isSuccess,
  isWarning,
  isError,
  all,
  failOnFirst,
  Validator,
} from '../src/index';

test('isSuccess', () => {
  expect(isSuccess(success())).toBe(true);
  expect(isSuccess(warning('whatever'))).toBe(false);
  expect(isSuccess(error('whatever'))).toBe(false);
});

test('isWarning', () => {
  expect(isWarning(success())).toBe(false);
  expect(isWarning(warning('whatever'))).toBe(true);
  expect(isWarning(error('whatever'))).toBe(false);
});

test('isError', () => {
  expect(isError(success())).toBe(false);
  expect(isError(warning('whatever'))).toBe(false);
  expect(isError(error('whatever'))).toBe(true);
});

test('multi', () => {
  expect(isSuccess(multi([success(), success()]))).toBe(true);
  expect(isError(multi([success(), error('whatever')]))).toBe(true);
  expect(isError(multi([warning('whatever'), success()]))).toBe(true);
});

const ok: Validator = () => success();
const fail: Validator = () => error('failed');

const fakeGetBagDoNotCall: any = () => ({});

test('all execute validator', async () => {
  const validator = jest.fn().mockReturnValueOnce(success());
  await all([validator])('whatever', fakeGetBagDoNotCall);
  expect(validator).toHaveBeenCalledWith('whatever', fakeGetBagDoNotCall);
});

test('all result', async () => {
  expect(isSuccess(await all([ok, ok])('whatever', fakeGetBagDoNotCall))).toBe(
    true,
  );
  expect(isError(await all([ok, fail])('whatever', fakeGetBagDoNotCall))).toBe(
    true,
  );
});

test('failOnFirst returns success when no validator given', async () => {
  expect(
    isSuccess(await failOnFirst([])('whatever', fakeGetBagDoNotCall)),
  ).toBe(true);
});

test('failOnFirst fails on first error', async () => {
  const a = jest.fn().mockReturnValueOnce(success());
  const b = jest.fn().mockReturnValueOnce(error('a'));
  const c = jest.fn().mockReturnValueOnce(success());
  const result = await failOnFirst([a, b])('whatever', fakeGetBagDoNotCall);
  expect(a).toHaveBeenCalledWith('whatever', fakeGetBagDoNotCall);
  expect(b).toHaveBeenCalledWith('whatever', fakeGetBagDoNotCall);
  expect(c).toHaveBeenCalledTimes(0);
  expect(isError(result)).toBe(true);
});

test('failOnFirst result', async () => {
  expect(
    isSuccess(await failOnFirst([ok, ok])('whatever', fakeGetBagDoNotCall)),
  ).toBe(true);
  expect(
    isError(await failOnFirst([ok, fail])('whatever', fakeGetBagDoNotCall)),
  ).toBe(true);
});
