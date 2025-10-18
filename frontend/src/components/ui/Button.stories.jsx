import Button from './Button'

export default {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export const Primary = {
  args: {
    children: 'Primary action',
  },
}

export const Secondary = {
  args: {
    children: 'Secondary action',
    variant: 'secondary',
  },
}

export const Ghost = {
  args: {
    children: 'Ghost button',
    variant: 'ghost',
  },
}

export const Danger = {
  args: {
    children: 'Delete member',
    variant: 'danger',
  },
}

export const WithIcon = {
  args: {
    children: (
      <span className="inline-flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Add member
      </span>
    ),
  },
}
