import { UserAccount } from '../types';

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'USR-9925045ZY',
    userId: '9925045ZY',
    name: 'Administrator ULP Baguala',
    role: 'Administrator',
    password: 'admin123',
    unit: 'ULP Baguala',
    email: 'fikiilham56@gmail.com',
    status: 'Aktif',
    createdAt: '2026-01-01',
    lastLogin: '2026-10-15'
  },
  {
    id: 'USR-SPV-8816024',
    userId: '8816024BT',
    name: 'Ir. Ahmad Zulkarnaen',
    role: 'Supervisor Teknik',
    password: 'admin123',
    unit: 'ULP Baguala',
    email: 'supervisor.baguala@pln.co.id',
    status: 'Aktif',
    createdAt: '2026-02-15'
  }
];
