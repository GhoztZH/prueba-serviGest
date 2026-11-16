/** Política de contraseñas del contrato: mínimo 8 caracteres, al menos una letra y un número. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function motivoPasswordInvalida(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (password.length > PASSWORD_MAX) return `La contraseña no puede superar ${PASSWORD_MAX} caracteres`;
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir al menos una letra y un número';
  }
  return null;
}
