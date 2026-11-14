import { customAlphabet } from 'nanoid';
const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);
export const uid = (prefix = 'el') => `${prefix}-${nano()}`;
