import { BookOpen, Building2, DatabaseBackup, MessageSquare, Receipt, Smartphone, Tags, UserPlus, Users } from 'lucide-react'

/** Copy and links for each checklist step; completion comes from GET /onboarding. */
export const STEPS = {
  organization: {
    icon: Building2,
    title: 'Add your contact details',
    body: 'Your address, phone and email appear on every invoice. Upload a logo and pick an accent colour under Branding while you are there.',
    action: ['Open organization settings', '/settings#organization'],
    admin: true,
  },
  course: {
    icon: BookOpen,
    title: 'Create a course and its groups',
    body: 'Courses are what you teach (Piano, Grade 5, Fitness). Groups split a course into classes or time slots, each with an optional capacity.',
    action: ['Go to courses', '/courses'],
  },
  plan: {
    icon: Tags,
    title: 'Add a membership plan',
    body: 'A plan is a price and how many days one payment covers, such as 30 days for a monthly fee. Link it to a course or keep it general.',
    action: ['Go to plans', '/plans'],
  },
  members: {
    icon: Users,
    title: 'Add your members',
    body: 'Add people one by one, or import a spreadsheet. Download the CSV template from the import dialog, fill it in and preview it before anything is saved.',
    action: ['Add a member', '/members?new=1'],
    secondary: ['Import a CSV', '/members?import=1'],
  },
  payment: {
    icon: Receipt,
    title: 'Record the first payment',
    body: 'A plan payment extends the member’s paid-until date and creates a printable two-copy invoice: one for the customer, one for your records.',
    action: ['Record a payment', '/payments?new=1'],
  },
  backups: {
    icon: DatabaseBackup,
    title: 'Turn on automatic backups',
    body: 'Everything lives in one file on this computer. Daily backups keep the last few snapshots; download one now and then to keep a copy elsewhere.',
    action: ['Open backup settings', '/settings#backups'],
    admin: true,
  },
  messaging: {
    icon: MessageSquare,
    title: 'Connect email, SMS or WhatsApp',
    body: 'Add SMTP or Twilio credentials to the .env file next to the app and restart it. Until then reminders open on your own phone or mail app.',
    action: ['See messaging status', '/settings#messaging'],
    admin: true,
  },
  staff: {
    icon: UserPlus,
    title: 'Invite your team',
    body: 'Give each person their own sign-in so invoices show who received the payment and the activity log shows who changed what.',
    action: ['Manage staff', '/settings#staff'],
    admin: true,
  },
  network: {
    icon: Smartphone,
    title: 'Use RMS on phones and other computers',
    body: 'Open RMS to devices on the same Wi-Fi or office network, then scan the QR code with a phone. Nothing is opened to the internet.',
    action: ['Open network settings', '/settings#network'],
    admin: true,
  },
}
