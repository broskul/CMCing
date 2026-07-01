import { redirect } from 'next/navigation';

export default function NuevaVisita() {
  redirect('/admin?modulo=visitas&nuevo=1');
}
