import { add, fetchData } from './utils';
import { User, type ID } from './models';

export function main(): number {
  const result = add(1, 2);
  return result;
}

export async function runAsync(): Promise<string> {
  const data = await fetchData('https://example.com');
  return data;
}

export function createUser(id: ID): User {
  return new User(id, 'Alice');
}

export function getUserName(user: User | null): string | undefined {
  return user?.name;
}
