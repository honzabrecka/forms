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
  useFormValidationLoadable,
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
  const { formId, Form, setValues, addFields, setErrors } = useForm({
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
    setErrors({ [x]: error('bar') });
  };

  const validation = useFormValidationLoadable(formId) as any;

  console.log(validation);

  return (
    <Form>
      <div>
        {validation.state === 'hasValue' ? validation.contents.isValid : null}
      </div>
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
