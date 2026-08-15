import { randomInt } from "node:crypto";

/**
 * Deliberately excludes 0/O/1/I/L/5/S so codes read unambiguously when
 * someone types one in from a screenshot or reads it aloud on Discord.
 */
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789";

export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(length: number = JOIN_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Accepts user input in any case and with stray spaces or dashes. */
export function normaliseJoinCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidJoinCodeShape(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${JOIN_CODE_LENGTH}}$`).test(code);
}
