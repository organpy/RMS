import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { MemberForm } from '../components/members/MemberForm'
import { useState } from 'react'

function Wrapper({ onSubmit = () => {} }) {
  const [submitted, setSubmitted] = useState(false)
  const form = useForm({ defaultValues: { first_name: '', last_name: '', email: '', membership_plan: '', status: 'active' } })

  const handleSubmit = (values) => {
    setSubmitted(true)
    onSubmit(values)
  }

  return (
    <div>
      <MemberForm form={form} onSubmit={handleSubmit} onCancel={() => {}} />
      {submitted ? <div data-testid="submitted">true</div> : null}
    </div>
  )
}

test('renders MemberForm and submits with values', async () => {
  const handleSubmit = vi.fn()
  render(<Wrapper onSubmit={handleSubmit} />)

  const firstName = screen.getByLabelText(/First name/i)
  const lastName = screen.getByLabelText(/Last name/i)
  const email = screen.getByLabelText(/Email/i)
  const submit = screen.getByRole('button', { name: /Save member/i })

  fireEvent.change(firstName, { target: { value: 'Alex' } })
  fireEvent.change(lastName, { target: { value: 'Doe' } })
  fireEvent.change(email, { target: { value: 'alex.doe@example.com' } })

  fireEvent.click(submit)

  // Wait for the wrapper to show that submission occurred
  await waitFor(() => expect(screen.getByTestId('submitted')).toBeInTheDocument())
  expect(handleSubmit).toHaveBeenCalled()
})
