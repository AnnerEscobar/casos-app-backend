import { BadRequestException } from '@nestjs/common';

export type TipoCasoNumero = 'alerta' | 'maltrato' | 'conflicto';

const caseNumberPatterns: Record<TipoCasoNumero, RegExp[]> = {
  alerta: [/^DEIC52-\d{4}-\d{2}-\d{2}-\d+$/, /^AK\d{6}$/],
  maltrato: [/^DEIC51-\d{4}-\d{2}-\d{2}-\d+$/, /^MT\d{6}$/],
  conflicto: [/^DEIC53-\d{4}-\d{2}-\d{2}-\d+$/, /^AC\d{6}$/],
};

const caseNumberHelp: Record<TipoCasoNumero, string> = {
  alerta: 'Formato permitido: DEIC52-AAAA-MM-DD-### o historico AK000001',
  maltrato: 'Formato permitido: DEIC51-AAAA-MM-DD-### o historico MT000001',
  conflicto: 'Formato permitido: DEIC53-AAAA-MM-DD-### o historico AC000001',
};

const conflictoMpPattern = /^(?:M0004|MP001|MPE01)-\d{4}-\d+$/;
const conflictoMpHelp = 'Formato MP permitido para conflicto: M0004-AAAA-###, MP001-AAAA-### o MPE01-AAAA-###';
const alertaMpPattern = /^M0030-\d{4}-\d+$/;
const alertaMpHelp = 'Formato MP permitido para alerta: M0030-AAAA-###';
const maltratoMpPattern = /^(?:(?:MPE01|M0008|MP004|M0030|MP001)-\d{4}-\d+|IC\/PNCORLLAT\d+-\d{4}-\d+)$/;
const maltratoMpHelp = 'Formato MP permitido para maltrato: MPE01-AAAA-###, M0008-AAAA-###, IC/PNCORLLAT###-AAAA-###, MP004-AAAA-###, M0030-AAAA-### o MP001-AAAA-###';

export const normalizeCaseNumber = (numero: string): string => {
  return numero.trim().toUpperCase();
};

export const isValidCaseNumber = (tipo: TipoCasoNumero, numero: string): boolean => {
  const normalized = normalizeCaseNumber(numero);
  return caseNumberPatterns[tipo].some((pattern) => pattern.test(normalized));
};

export const assertValidCaseNumber = (tipo: TipoCasoNumero, numero: string): string => {
  if (!numero || typeof numero !== 'string') {
    throw new BadRequestException('El numero de caso es requerido.');
  }

  const normalized = normalizeCaseNumber(numero);

  if (!isValidCaseNumber(tipo, normalized)) {
    throw new BadRequestException(caseNumberHelp[tipo]);
  }

  return normalized;
};

export const caratulaTipoToCaseNumberTipo = (tipoCaso: string): TipoCasoNumero => {
  const normalized = tipoCaso.trim().toLowerCase();

  if (normalized === 'alerta') return 'alerta';
  if (normalized === 'maltrato') return 'maltrato';
  if (normalized === 'conflicto') return 'conflicto';

  throw new BadRequestException('Tipo de caso invalido.');
};

export const normalizeMpNumber = (numeroMp: string): string => {
  return numeroMp.trim().toUpperCase();
};

export const isValidConflictoMpNumber = (numeroMp: string): boolean => {
  return conflictoMpPattern.test(normalizeMpNumber(numeroMp));
};

export const isValidAlertaMpNumber = (numeroMp: string): boolean => {
  return alertaMpPattern.test(normalizeMpNumber(numeroMp));
};

export const isValidMaltratoMpNumber = (numeroMp: string): boolean => {
  return maltratoMpPattern.test(normalizeMpNumber(numeroMp));
};

export const assertValidAlertaMpNumber = (numeroMp?: string): string => {
  if (!numeroMp || typeof numeroMp !== 'string') {
    throw new BadRequestException('El numero de expediente MP es requerido.');
  }

  const normalized = normalizeMpNumber(numeroMp);

  if (!isValidAlertaMpNumber(normalized)) {
    throw new BadRequestException(alertaMpHelp);
  }

  return normalized;
};

export const assertValidMaltratoMpNumber = (numeroMp?: string): string => {
  if (!numeroMp || typeof numeroMp !== 'string') {
    throw new BadRequestException('El numero de expediente MP es requerido.');
  }

  const normalized = normalizeMpNumber(numeroMp);

  if (!isValidMaltratoMpNumber(normalized)) {
    throw new BadRequestException(maltratoMpHelp);
  }

  return normalized;
};

export const assertValidConflictoMpNumber = (numeroMp?: string): string => {
  if (!numeroMp || typeof numeroMp !== 'string') {
    throw new BadRequestException('El numero de expediente MP es requerido.');
  }

  const normalized = normalizeMpNumber(numeroMp);

  if (!isValidConflictoMpNumber(normalized)) {
    throw new BadRequestException(conflictoMpHelp);
  }

  return normalized;
};

export const assertValidCaratulaMpNumber = (tipoCaso: string, numeroMp?: string): string | undefined => {
  const tipo = caratulaTipoToCaseNumberTipo(tipoCaso);

  if (tipo === 'alerta') return assertValidAlertaMpNumber(numeroMp);
  if (tipo === 'maltrato') return assertValidMaltratoMpNumber(numeroMp);
  if (tipo === 'conflicto') return assertValidConflictoMpNumber(numeroMp);

  return numeroMp ? normalizeMpNumber(numeroMp) : numeroMp;
};
