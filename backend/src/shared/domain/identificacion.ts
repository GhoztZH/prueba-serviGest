/**
 * Validación de identificaciones ecuatorianas (objeto de valor compartido por
 * clientes y técnicos).
 *
 * - Cédula: 10 dígitos, provincia 01-24 (o 30), tercer dígito 0-5, dígito
 *   verificador módulo 10.
 * - RUC: 13 dígitos terminados en 001.
 *     · Persona natural (3.er dígito 0-5): cédula válida + 001.
 *     · Sociedad privada (3.er dígito 9): módulo 11 sobre 9 dígitos.
 *     · Entidad pública (3.er dígito 6): módulo 11 sobre 8 dígitos.
 */
function provinciaValida(id: string): boolean {
  const provincia = Number(id.slice(0, 2));
  return (provincia >= 1 && provincia <= 24) || provincia === 30;
}

export function digitoVerificadorCedula(nueveDigitos: string): number {
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = Number(nueveDigitos[i]) * (i % 2 === 0 ? 2 : 1);
    if (valor > 9) valor -= 9;
    suma += valor;
  }
  return (10 - (suma % 10)) % 10;
}

export function esCedulaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  if (!provinciaValida(cedula) || Number(cedula[2]) > 5) return false;
  return digitoVerificadorCedula(cedula.slice(0, 9)) === Number(cedula[9]);
}

function modulo11(digitos: string, coeficientes: number[]): number {
  const suma = coeficientes.reduce((acc, coef, i) => acc + coef * Number(digitos[i]), 0);
  const resto = suma % 11;
  return resto === 0 ? 0 : 11 - resto;
}

export function esRucValido(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc) || !provinciaValida(ruc)) return false;
  const tercero = Number(ruc[2]);
  if (tercero <= 5) return ruc.endsWith('001') && esCedulaValida(ruc.slice(0, 10));
  if (tercero === 9) {
    return ruc.endsWith('001') && modulo11(ruc, [4, 3, 2, 7, 6, 5, 4, 3, 2]) === Number(ruc[9]);
  }
  if (tercero === 6) {
    return ruc.endsWith('0001') && modulo11(ruc, [3, 2, 7, 6, 5, 4, 3, 2]) === Number(ruc[8]);
  }
  return false;
}

/** Cédula (10) o RUC (13) válidos, según el contrato de clientes. */
export function esIdentificacionValida(identificacion: string): boolean {
  return identificacion.length === 10 ? esCedulaValida(identificacion) : esRucValido(identificacion);
}
