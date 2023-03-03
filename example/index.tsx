import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  RecoilRoot,
  useForm,
  OnChange,
  Validator,
  error,
  success,
  createNestedName,
} from '../src/index';
import { SubmitButton, LazyField, delay } from '../__tests__/shared';

const validator: Validator = async (_, getBag) => {
  await delay(100);
  const { values } = await getBag();
  console.log('>>', values);
  return ['a', 'b'].some((name) => values[name])
    ? success()
    : error('missing field');
};

const x = createNestedName('x', 'y', 'z');

const App = () => {
  const { Form, setValues, addFields } = useForm({
    onSubmit: ({ values }) => {
      console.log('submit', values);
    },
    onSubmitInvalid: console.log,
  });
  const onChange: OnChange = ({ name }) => {
    // reset other field
    addFields([x]);
    setValues({
      [name === 'a' ? 'b' : 'a']: undefined,
      [x]: 'foo',
    });
  };

  return (
    <Form>
      <LazyField name="a" label="A" onChange={onChange} validator={validator} />
      <LazyField name="b" label="B" onChange={onChange} validator={validator} />
      <SubmitButton>submit</SubmitButton>
    </Form>
  );
};

const Wrapper = () => {
  return (
    <StrictMode>
      <RecoilRoot>
        <App />
      </RecoilRoot>
    </StrictMode>
  );
};

const root = createRoot(document.querySelector('#example')!);
root.render(<Wrapper />);
