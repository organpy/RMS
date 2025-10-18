import Badge from './Badge'

export default {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger', 'info', 'secondary'],
    },
  },
}

export const Default = {
  args: {
    children: 'Active',
  },
}

export const Success = {
  args: {
    children: 'Paid',
    variant: 'success',
  },
}

export const Warning = {
  args: {
    children: 'Expiring soon',
    variant: 'warning',
  },
}

export const Danger = {
  args: {
    children: 'Suspended',
    variant: 'danger',
  },
}

export const Info = {
  args: {
    children: 'New lead',
    variant: 'info',
  },
}
