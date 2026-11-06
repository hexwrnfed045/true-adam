import { AuthForm } from '@/components/account';
export const metadata = { title: 'Регистрация', robots: { index: false, follow: false } };
export default function Page() { return <AuthForm register />; }
