import { redirect } from 'next/navigation';

export default function HostedEntry() {
  redirect('/signup?mode=hosted');
}
