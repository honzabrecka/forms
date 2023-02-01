# forms

> yet another form library for [React](https://react.org) to build always fast & reactive forms; **experimental**

## Why?

 - always fast & reactive
 - (async) values & validation (Suspense ready)
 - List component and nested fields
 - low level, compatible with any UI lib/kit
 - client side only (unfortunately)

## How?

```jsx
// App.jsx
import { useForm } from 'forms'
import Field from './Field'

const App = () => {
  const onSubmit = ({ values }) => {
    console.log(values)
  }
  const { Form } = useForm({ onSubmit })
  return (
    <Form>
      <Field as={"input"} name="username" label="Username" />
      <button type="submit">submit</button>
    </Form>
  )
}
```

```jsx
// Field.jsx
import { useField } from 'forms'
import FieldValidation from './FieldValidation'

const Field = ({ as: InputComponent, label, ...rest }) => {
  const { id, name, value, onBlur, onChange, onFocus } = useField(rest)
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <InputComponent
        id={id}
        name={name}
        value={value}
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus} />
      <FieldValidation name={name} />
    </>
  )
}

export default Field
```

```jsx
// FieldValidation.jsx
import { useFieldValidation, isError, isWarning } from 'forms'
import { Suspense } from 'react'

const FieldValidationInner = ({ name }) => {
  const { type, value } = useFieldValidation({ name })
  if (isError(type)) return <div className="validation error">{value}</div>
  if (isWarning(type)) return <div className="validation warning">{value}</div>
  return null
}

const FieldValidation = ({ name }) => {
  return (
    <Suspense fallback={null}>
      <FieldValidationInner name={name} />
    </Suspense>
  )
}

export default FieldValidation
```
