import { clsx, type ClassValue } from "clsx";
import { customAlphabet } from "nanoid";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUsernameId(length = 12) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, length);
  const id = nanoid();

  return id;
}
