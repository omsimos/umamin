import bcrypt from 'bcrypt';

export const hashPassword = (password: string) => {
  return bcrypt.hashSync(password, 10);
};

export const isPassword = (password: string, hashed: string) => {
  return bcrypt.compareSync(password, hashed);
};
