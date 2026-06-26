export type SexoBovino = "Hembra" | "Macho";

type ValidationOk = { ok: true; valor: string };
type ValidationErr = { ok: false; error: string };

const TEXTO_INFORMAL =
  /\b(soy|quiero|porque|para que|mundo|entonces|muy|preciosa|bonita|mejor|dale|queso|quesito|leche|jaja|xd|:p|:P)\b/i;

const ARETE_VALIDO = /^[A-Za-z0-9][A-Za-z0-9\s\-_.]{0,49}$/;

function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function rechazarTextoInformal(
  valor: string,
  etiqueta: string,
  maxPalabras: number,
  maxCaracteres: number
): ValidationOk | ValidationErr {
  const v = valor.trim();

  if (!v) {
    return { ok: false, error: `El ${etiqueta} es obligatorio.` };
  }

  if (v.length > maxCaracteres) {
    return {
      ok: false,
      error: `El ${etiqueta} no puede superar ${maxCaracteres} caracteres. Usa un valor corto y concreto.`
    };
  }

  if (contarPalabras(v) > maxPalabras) {
    return {
      ok: false,
      error: `El ${etiqueta} debe ser breve (máximo ${maxPalabras} palabras), no un párrafo ni una frase larga.`
    };
  }

  if (TEXTO_INFORMAL.test(v)) {
    return {
      ok: false,
      error: `El ${etiqueta} debe ser un dato concreto del registro, no texto conversacional ni bromas.`
    };
  }

  return { ok: true, valor: v };
}

export function normalizarSexo(raw: string): { ok: true; sexo: SexoBovino } | ValidationErr {
  const original = raw.trim();

  if (!original) {
    return { ok: false, error: "El sexo es obligatorio. Indica Hembra (vaca) o Macho (toro)." };
  }

  const t = original.toLowerCase();

  if (TEXTO_INFORMAL.test(original) || contarPalabras(original) > 3) {
    return {
      ok: false,
      error:
        "El sexo debe ser solo Hembra (vaca) o Macho (toro). No acepto frases, bromas ni respuestas ambiguas."
    };
  }

  const mencionaVaca = /\bvaca(s)?\b/.test(t);
  const mencionaToro = /\btoro(s)?\b/.test(t);
  const mencionaMacho = /\bmacho(s)?\b/.test(t) || t === "m";
  const mencionaHembra = /\bhembra(s)?\b/.test(t) || t === "f";

  if (mencionaVaca && (mencionaToro || mencionaMacho)) {
    return {
      ok: false,
      error: "Una vaca es siempre hembra. Si quieres registrar un toro, indica sexo Macho."
    };
  }

  if (mencionaToro && mencionaHembra) {
    return {
      ok: false,
      error: "Un toro es siempre macho. Indica sexo Macho para toros y Hembra para bovinos."
    };
  }

  if (mencionaVaca || mencionaHembra || ["femenino", "female"].includes(t)) {
    return { ok: true, sexo: "Hembra" };
  }

  if (mencionaToro || mencionaMacho || ["masculino", "male"].includes(t)) {
    return { ok: true, sexo: "Macho" };
  }

  return {
    ok: false,
    error: 'El sexo debe ser "Hembra" (vaca) o "Macho" (toro).'
  };
}

export function validarNumeroArete(valor: string): ValidationOk | ValidationErr {
  const base = rechazarTextoInformal(valor, "número de arete", 4, 50);
  if (!base.ok) return base;

  if (!ARETE_VALIDO.test(base.valor)) {
    return {
      ok: false,
      error:
        "El número de arete debe ser un identificador corto (letras, números, guiones). Ejemplo: A-101."
    };
  }

  return base;
}

export function validarNombre(valor: string): ValidationOk | ValidationErr {
  return rechazarTextoInformal(valor, "nombre", 5, 100);
}

export function validarRaza(valor: string): ValidationOk | ValidationErr {
  return rechazarTextoInformal(valor, "raza", 4, 100);
}

export type DatosBovinoInput = {
  numero_arete: string;
  nombre: string;
  raza: string;
  sexo: string;
};

export function validarDatosBovino(
  datos: DatosBovinoInput
): { ok: true; datos: DatosBovinoInput & { sexo: SexoBovino } } | ValidationErr {
  const arete = validarNumeroArete(datos.numero_arete);
  if (!arete.ok) return arete;

  const nombre = validarNombre(datos.nombre);
  if (!nombre.ok) return nombre;

  const raza = validarRaza(datos.raza);
  if (!raza.ok) return raza;

  const sexo = normalizarSexo(datos.sexo);
  if (!sexo.ok) return sexo;

  const nombreLower = nombre.valor.toLowerCase();
  if (/\bvaca\b/.test(nombreLower) && sexo.sexo === "Macho") {
    return {
      ok: false,
      error: "Una vaca no puede tener sexo masculino. Usa Hembra o cambia el nombre si es un toro."
    };
  }

  if (/\btoro\b/.test(nombreLower) && sexo.sexo === "Hembra") {
    return {
      ok: false,
      error: "Un toro no puede tener sexo hembra. Usa Macho o corrige el nombre."
    };
  }

  return {
    ok: true,
    datos: {
      numero_arete: arete.valor,
      nombre: nombre.valor,
      raza: raza.valor,
      sexo: sexo.sexo
    }
  };
}

export function mensajeDatosBovinoFaltantes(): string {
  return "Faltan datos obligatorios: número de arete, nombre, raza y sexo (Hembra o Macho). Pide un dato a la vez, con valores cortos y concretos.";
}
