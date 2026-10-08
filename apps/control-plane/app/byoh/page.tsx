import { redirect } from 'next/navigation';

export default function ByohEntry() {
  redirect('/signup?mode=byoh');
}
